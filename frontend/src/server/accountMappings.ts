import { rows, execute, writeRecord } from "./database";
import {
  normalizeAccountMappingInput,
  AccountMappingValidationError,
  type AccountMappingInput,
  type AccountMappingType,
} from "./accountMappingValidation";
import { throwServerError } from "./serverError";

export type { AccountMappingInput, AccountMappingType };

export interface AccountMapping {
  id: string;
  akahuAccountId: string;
  ledgerAccount: string;
  accountType: AccountMappingType;
  creditLimitCents: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountMappingDbRow {
  id: string;
  akahu_account_id: string;
  ledger_account: string;
  account_type: string;
  credit_limit_cents: string | number | null;
  created_at: string;
  updated_at: string;
}

function toAccountMapping(r: AccountMappingDbRow): AccountMapping {
  return {
    id: r.id,
    akahuAccountId: r.akahu_account_id,
    ledgerAccount: r.ledger_account,
    accountType: r.account_type === "liability" ? "liability" : "asset",
    creditLimitCents:
      r.credit_limit_cents != null ? Number(r.credit_limit_cents) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_COLS =
  "id, akahu_account_id, ledger_account, account_type, credit_limit_cents, created_at, updated_at";

export async function listAccountMappings(): Promise<AccountMapping[]> {
  return rows<AccountMappingDbRow>('SELECT * FROM account_mappings ORDER BY created_at').map(toAccountMapping);
}

// Normalize + validate, mapping the pure AccountMappingValidationError to a
// 400 Response.
function normalizeInput(input: AccountMappingInput): AccountMappingInput {
  try {
    return normalizeAccountMappingInput(input);
  } catch (err) {
    if (err instanceof AccountMappingValidationError) {
      throwServerError(err.message, 400);
    }
    throw err;
  }
}

function dbFields(input: AccountMappingInput) {
  return {
    akahu_account_id: input.akahuAccountId,
    ledger_account: input.ledgerAccount,
    account_type: input.accountType,
    credit_limit_cents: input.creditLimitCents,
  };
}

export async function createAccountMapping(rawInput: AccountMappingInput): Promise<AccountMapping[]> {
  const now = new Date().toISOString();
  writeRecord('account_mappings', {...dbFields(normalizeInput(rawInput)), created_at: now, updated_at: now});
  return listAccountMappings();
}
export async function updateAccountMapping(id: string, rawInput: AccountMappingInput): Promise<AccountMapping[]> {
  writeRecord('account_mappings', {...dbFields(normalizeInput(rawInput)), updated_at: new Date().toISOString()}, id);
  return listAccountMappings();
}
export async function deleteAccountMapping(id: string): Promise<AccountMapping[]> {
  execute('DELETE FROM account_mappings WHERE id=?', id);
  return listAccountMappings();
}
