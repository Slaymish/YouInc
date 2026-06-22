import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import Database from "better-sqlite3";

const execFileAsync = promisify(execFile);

export type LiquidityTier = "cash" | "semi_liquid" | "illiquid";

export interface BalanceRow {
  account: string;
  accountType: string;
  balanceCents: number;
  currency: string;
  isManual: boolean;
  liquidityTier: LiquidityTier;
}

function liquidityTierForAccount(account: string): LiquidityTier {
  if (account.startsWith("Assets:Bank:") || account.startsWith("Assets:Treasury:")) {
    return "cash";
  }
  if (account === "Assets:Investments:Sharesies:Spend") {
    return "cash";
  }
  if (account.startsWith("Assets:Investments:Blossom")) {
    return "semi_liquid";
  }
  return "illiquid";
}

export interface ManualBalanceRow {
  account: string;
  balanceCents: number;
  asOfDate: string;
  updatedAt: string;
}

export interface ManualBalanceInput {
  account: string;
  balanceCents: number;
}

export interface PnlRow {
  month: string;
  incomeCents: number;
  expensesCents: number;
  ebitdaCents: number;
  ebitdaMargin: number | null;
}

export interface JournalTransactionRow {
  externalId: string;
  transactionDate: string;
  description: string;
  ruleId: string | null;
  amountCents: number;
  currency: string;
  postings: Array<{
    account: string;
    side: "debit" | "credit";
    amountCents: number;
  }>;
}

export interface PipelineHealth {
  rawCached: number;
  posted: number;
  pending: number;
  zeroAmount: number;
  unprocessed: number;
  earliestTransactionDate: string | null;
  latestTransactionDate: string | null;
  lastSeenAt: string | null;
}

export interface SourceAccountRow {
  accountId: string;
  rawCount: number;
  processedCount: number;
  pendingCount: number;
  firstTransactionDate: string | null;
  latestTransactionDate: string | null;
  netAmountCents: number;
  currency: string;
  ledgerAccount: string;
  accountType: "asset" | "liability";
  mappingStatus: "configured" | "unmapped";
}

export interface SyncLedgerInput {
  accountId?: string;
  startDate?: string;
  endDate?: string;
  delta?: boolean;
}

export interface SyncLedgerResult {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface AkahuAccountRow {
  id: string;
  name: string;
  label: string;
  status: string | null;
  type: string | null;
}

export interface AkahuAccountsResult {
  ok: boolean;
  accounts: AkahuAccountRow[];
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface AccountMappingInput {
  accountId: string;
  ledgerAccount: string;
  accountType: "asset" | "liability";
}

interface AccountMapping {
  ledgerAccount: string;
  accountType: "asset" | "liability";
}

export interface RoutingHealth {
  journalCount: number;
  customRuleCount: number;
  nzfccFallbackCount: number;
  suspenseCount: number;
  suspenseCents: number;
  classificationRate: number | null;
}

export interface SyncStateRow {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AccountTotal {
  account: string;
  amountCents: number;
}

export interface SuspenseItem {
  externalId: string;
  transactionDate: string;
  description: string;
  amountCents: number;
}

export interface NetWorthPoint {
  month: string;
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
}

export interface LedgerDashboardData {
  databasePath: string;
  databaseExists: boolean;
  generatedAt: string;
  manualBalances: ManualBalanceRow[];
  totals: {
    netWorthCents: number;
    assetsCents: number;
    liabilitiesCents: number;
    assetLiabilityRatio: number | null;
    incomeCents: number;
    expensesCents: number;
    ebitdaCents: number;
    ebitdaMargin: number | null;
    averageMonthlyIncomeCents: number;
    monthlyOverheadCents: number;
    runwayMonths: number | null;
    transactionCount: number;
    rawTransactionCount: number;
  };
  balances: BalanceRow[];
  pnl: PnlRow[];
  incomeBreakdown: AccountTotal[];
  expenseBreakdown: AccountTotal[];
  suspenseQueue: SuspenseItem[];
  netWorthTrend: NetWorthPoint[];
  recentTransactions: JournalTransactionRow[];
  pipeline: PipelineHealth;
  sourceAccounts: SourceAccountRow[];
  routing: RoutingHealth;
  syncState: SyncStateRow[];
  error: string | null;
}

type BalanceQueryRow = {
  account: string;
  balance_cents: number;
  currency: string;
};

type IncomeQueryRow = {
  month: string;
  account: string;
  amount_cents: number;
  currency: string;
};

type JournalQueryRow = {
  external_id: string;
  transaction_date: string;
  description: string;
  rule_id: string | null;
  account: string;
  side: "debit" | "credit";
  amount_cents: number;
  currency: string;
};

type CountQueryRow = {
  count: number;
};

type PipelineQueryRow = {
  raw_cached: number | null;
  processed: number | null;
  pending: number | null;
  zero_amount: number | null;
  unprocessed: number | null;
  earliest_transaction_date: string | null;
  latest_transaction_date: string | null;
  last_seen_at: string | null;
};

type SourceAccountQueryRow = {
  account_id: string;
  raw_count: number;
  processed_count: number | null;
  pending_count: number | null;
  first_transaction_date: string | null;
  latest_transaction_date: string | null;
  net_amount_cents: number | null;
  currency: string;
};

type RoutingQueryRow = {
  journal_count: number | null;
  custom_rule_count: number | null;
  nzfcc_fallback_count: number | null;
};

type SuspenseQueryRow = {
  suspense_count: number | null;
  suspense_cents: number | null;
};

type SyncStateQueryRow = {
  key: string;
  value: string;
  updated_at: string;
};

type SuspenseQueueQueryRow = {
  external_id: string;
  transaction_date: string;
  description: string;
  amount_cents: number | null;
};

type NetWorthTrendQueryRow = {
  month: string;
  assets_delta: number | null;
  liabilities_delta: number | null;
};

function resolveProjectRoot() {
  const configuredRoot = process.env.YOUINC_PROJECT_ROOT;
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  const cwd = process.cwd();
  const parent = path.resolve(cwd, "..");
  if (
    path.basename(cwd) === "frontend" &&
    fs.existsSync(path.join(parent, "pyproject.toml"))
  ) {
    return parent;
  }

  return cwd;
}

function resolveFromFrontendCwd(configuredPath: string) {
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

function resolveDatabasePath() {
  const configuredPath =
    process.env.YOUINC_DB_PATH ?? "../data/youinc-ledger.sqlite3";
  return resolveFromFrontendCwd(configuredPath);
}

function resolveRulesPath() {
  const configuredPath =
    process.env.YOUINC_RULES_PATH ?? "../config/rules.yaml";
  return resolveFromFrontendCwd(configuredPath);
}

function resolvePythonCommand() {
  if (process.env.YOUINC_PYTHON) {
    return process.env.YOUINC_PYTHON;
  }

  const venvPython = path.join(resolveProjectRoot(), ".venv", "bin", "python");
  return fs.existsSync(venvPython) ? venvPython : "python3";
}

function buildSyncEnvironment() {
  const env = { ...process.env };

  for (const key of ["REQUESTS_CA_BUNDLE", "SSL_CERT_FILE", "CURL_CA_BUNDLE"]) {
    delete env[key];
  }

  if (process.env.YOUINC_ALLOW_PROXY !== "1") {
    for (const key of [
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "ALL_PROXY",
      "https_proxy",
      "http_proxy",
      "all_proxy",
    ]) {
      delete env[key];
    }
  }

  env.PYTHONPATH = [
    path.join(resolveProjectRoot(), "src"),
    process.env.PYTHONPATH,
  ]
    .filter(Boolean)
    .join(path.delimiter);

  return env;
}

function accountType(account: string) {
  return account.includes(":") ? account.split(":", 1)[0] : "Other";
}

function emptyPipeline(): PipelineHealth {
  return {
    rawCached: 0,
    posted: 0,
    pending: 0,
    zeroAmount: 0,
    unprocessed: 0,
    earliestTransactionDate: null,
    latestTransactionDate: null,
    lastSeenAt: null,
  };
}

function emptyRouting(): RoutingHealth {
  return {
    journalCount: 0,
    customRuleCount: 0,
    nzfccFallbackCount: 0,
    suspenseCount: 0,
    suspenseCents: 0,
    classificationRate: null,
  };
}

function sanitizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateAccountMapping(
  input: AccountMappingInput,
): AccountMappingInput {
  const accountId = input.accountId.trim();
  const ledgerAccount = input.ledgerAccount.trim();
  const accountType = input.accountType;

  if (!accountId) {
    throw new Error("Source account id is required.");
  }
  if (!ledgerAccount || !ledgerAccount.includes(":")) {
    throw new Error(
      "Ledger account must be a colon-delimited account, e.g. Assets:BNZ:Cash.",
    );
  }
  if (accountType !== "asset" && accountType !== "liability") {
    throw new Error("Account type must be asset or liability.");
  }

  return { accountId, ledgerAccount, accountType };
}

function formatYamlKey(key: string) {
  return /^[A-Za-z0-9_.-]+$/.test(key) ? key : `'${key.replaceAll("'", "''")}'`;
}

function parseYamlKey(key: string) {
  const trimmed = key.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function accountMappingLines(mapping: AccountMappingInput) {
  return [
    `  ${formatYamlKey(mapping.accountId)}:`,
    `    ledger_account: ${mapping.ledgerAccount}`,
    `    account_type: ${mapping.accountType}`,
  ];
}

function parseAccountMappings(rulesPath = resolveRulesPath()) {
  const mappings = new Map<string, AccountMapping>();
  if (!fs.existsSync(rulesPath)) {
    return mappings;
  }

  const lines = fs.readFileSync(rulesPath, "utf-8").split(/\r?\n/);
  const start = lines.findIndex((line) => /^account_mappings:\s*$/.test(line));
  if (start === -1) {
    return mappings;
  }

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim() !== "") {
      break;
    }

    const accountMatch = line.match(/^  ([^:]+|'(?:[^']|'')+'|"[^"]+"):\s*$/);
    if (!accountMatch) {
      continue;
    }

    const accountId = parseYamlKey(accountMatch[1]);
    let ledgerAccount: string | undefined;
    let accountType: "asset" | "liability" = "asset";

    for (let child = index + 1; child < lines.length; child += 1) {
      const childLine = lines[child];
      if (/^  \S/.test(childLine) || /^\S/.test(childLine)) {
        break;
      }

      const ledgerMatch = childLine.match(/^    ledger_account:\s*(.+?)\s*$/);
      if (ledgerMatch) {
        ledgerAccount = ledgerMatch[1];
      }

      const typeMatch = childLine.match(/^    account_type:\s*(.+?)\s*$/);
      if (typeMatch && typeMatch[1].toLowerCase() === "liability") {
        accountType = "liability";
      }
    }

    if (ledgerAccount) {
      mappings.set(accountId, { ledgerAccount, accountType });
    }
  }

  return mappings;
}

function normalizeAkahuAccountRows(raw: unknown): AkahuAccountRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const account = row as Record<string, unknown>;
      const id = typeof account.id === "string" ? account.id : "";
      if (!id) {
        return null;
      }
      return {
        id,
        name:
          typeof account.name === "string" ? account.name : "Unnamed account",
        label: typeof account.label === "string" ? account.label : id,
        status: typeof account.status === "string" ? account.status : null,
        type: typeof account.type === "string" ? account.type : null,
      };
    })
    .filter((row): row is AkahuAccountRow => row !== null);
}

export async function listAkahuAccounts(): Promise<AkahuAccountsResult> {
  const python = resolvePythonCommand();
  const args = ["-m", "youinc_ledger.cli", "accounts", "--json"];
  const env = buildSyncEnvironment();

  try {
    const { stdout, stderr } = await execFileAsync(python, args, {
      cwd: resolveProjectRoot(),
      env,
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      ok: true,
      accounts: normalizeAkahuAccountRows(JSON.parse(stdout || "[]")),
      stdout,
      stderr,
      code: 0,
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | null;
    };
    return {
      ok: false,
      accounts: [],
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message,
      code: failure.code ?? null,
    };
  }
}

export async function reclassifyLedger(): Promise<SyncLedgerResult> {
  const databasePath = resolveDatabasePath();
  const rulesPath = resolveRulesPath();
  const python = resolvePythonCommand();
  const args = [
    "-m",
    "youinc_ledger.cli",
    "reclassify",
    "--db-path",
    databasePath,
    "--rules-path",
    rulesPath,
  ];
  const env = buildSyncEnvironment();

  try {
    const { stdout, stderr } = await execFileAsync(python, args, {
      cwd: resolveProjectRoot(),
      env,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      ok: true,
      command: [python, ...args].join(" "),
      stdout,
      stderr,
      code: 0,
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | null;
    };
    return {
      ok: false,
      command: [python, ...args].join(" "),
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message,
      code: failure.code ?? null,
    };
  }
}

export async function syncLedger(
  input: SyncLedgerInput,
): Promise<SyncLedgerResult> {
  const databasePath = resolveDatabasePath();
  const rulesPath = resolveRulesPath();
  const args = [
    "-m",
    "youinc_ledger.cli",
    "sync",
    "--db-path",
    databasePath,
    "--rules-path",
    rulesPath,
  ];

  const accountId = sanitizeOptionalText(input.accountId);
  if (!accountId) {
    throw new Error("Live sync requires a source account id.");
  }
  args.push("--account-id", accountId);

  const startDate = sanitizeOptionalText(input.startDate);
  const endDate = sanitizeOptionalText(input.endDate);
  if (startDate) {
    args.push("--start-date", startDate);
  }
  if (endDate) {
    args.push("--end-date", endDate);
  }
  if (input.delta) {
    args.push("--delta");
  }

  const python = resolvePythonCommand();
  const env = buildSyncEnvironment();
  const execOpts = {
    cwd: resolveProjectRoot(),
    env,
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  };

  try {
    const { stdout, stderr } = await execFileAsync(python, args, execOpts);
    return { ok: true, command: [python, ...args].join(" "), stdout, stderr, code: 0 };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | null;
    };
    const failureStderr = failure.stderr ?? failure.message;

    // The stored delta marker can be ahead of Akahu's UTC clock when NZT is
    // already the next calendar day. Retry with yesterday (UTC) so we never
    // ask for a future date.
    if (input.delta && failureStderr.includes("Start date cannot be in the future")) {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const retryArgs = [
        ...args.filter((a) => a !== "--delta"),
        "--start-date",
        yesterday.toISOString().slice(0, 10),
      ];
      try {
        const { stdout: rs, stderr: re } = await execFileAsync(python, retryArgs, execOpts);
        return { ok: true, command: [python, ...retryArgs].join(" "), stdout: rs, stderr: re, code: 0 };
      } catch (retryError) {
        const rf = retryError as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | null };
        return { ok: false, command: [python, ...retryArgs].join(" "), stdout: rf.stdout ?? "", stderr: rf.stderr ?? rf.message, code: rf.code ?? null };
      }
    }

    return {
      ok: false,
      command: [python, ...args].join(" "),
      stdout: failure.stdout ?? "",
      stderr: failureStderr,
      code: failure.code ?? null,
    };
  }
}

export function upsertAccountMapping(input: AccountMappingInput) {
  const mapping = validateAccountMapping(input);
  const rulesPath = resolveRulesPath();
  const existingText = fs.existsSync(rulesPath)
    ? fs.readFileSync(rulesPath, "utf-8")
    : "defaults:\n  currency: NZD\n  suspense_account: Expenses:Uncategorized:Suspense\n";
  const lines = existingText.replace(/\s*$/, "").split(/\r?\n/);
  let start = lines.findIndex((line) => /^account_mappings:\s*$/.test(line));

  if (start === -1) {
    lines.push("", "account_mappings:", ...accountMappingLines(mapping));
    fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
    fs.writeFileSync(rulesPath, `${lines.join("\n")}\n`, "utf-8");
    return mapping;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index]) && lines[index].trim() !== "") {
      end = index;
      break;
    }
  }

  let accountStart = -1;
  let accountEnd = end;
  for (let index = start + 1; index < end; index += 1) {
    const accountMatch = lines[index].match(
      /^  ([^:]+|'(?:[^']|'')+'|"[^"]+"):\s*$/,
    );
    if (!accountMatch || parseYamlKey(accountMatch[1]) !== mapping.accountId) {
      continue;
    }

    accountStart = index;
    for (let next = index + 1; next < end; next += 1) {
      if (/^  \S/.test(lines[next])) {
        accountEnd = next;
        break;
      }
    }
    break;
  }

  if (accountStart === -1) {
    lines.splice(end, 0, ...accountMappingLines(mapping));
  } else {
    lines.splice(
      accountStart,
      accountEnd - accountStart,
      ...accountMappingLines(mapping),
    );
  }

  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, `${lines.join("\n")}\n`, "utf-8");
  return mapping;
}

function emptyDashboard(
  databasePath: string,
  error: string | null = null,
): LedgerDashboardData {
  return {
    databasePath,
    databaseExists: fs.existsSync(databasePath),
    generatedAt: new Date().toISOString(),
    totals: {
      netWorthCents: 0,
      assetsCents: 0,
      liabilitiesCents: 0,
      assetLiabilityRatio: null,
      incomeCents: 0,
      expensesCents: 0,
      ebitdaCents: 0,
      ebitdaMargin: null,
      averageMonthlyIncomeCents: 0,
      monthlyOverheadCents: 0,
      runwayMonths: null,
      transactionCount: 0,
      rawTransactionCount: 0,
    },
    manualBalances: [],
    balances: [],
    pnl: [],
    incomeBreakdown: [],
    expenseBreakdown: [],
    suspenseQueue: [],
    netWorthTrend: [],
    recentTransactions: [],
    pipeline: emptyPipeline(),
    sourceAccounts: [],
    routing: emptyRouting(),
    syncState: [],
    error,
  };
}

export function readLedgerDashboard(): LedgerDashboardData {
  const databasePath = resolveDatabasePath();

  if (!fs.existsSync(databasePath)) {
    return emptyDashboard(databasePath);
  }

  try {
    const accountMappings = parseAccountMappings();
    const db = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });

    const balances = db
      .prepare(
        `
        SELECT
          account,
          SUM(CASE WHEN side = 'debit' THEN amount_cents ELSE -amount_cents END) AS balance_cents,
          currency
        FROM journal_entries
        GROUP BY account, currency
        ORDER BY account
      `,
      )
      .all() as BalanceQueryRow[];

    const incomeStatement = db
      .prepare(
        `
        SELECT
          substr(jt.transaction_date, 1, 7) AS month,
          je.account,
          SUM(CASE WHEN je.side = 'credit' THEN je.amount_cents ELSE -je.amount_cents END) AS amount_cents,
          je.currency
        FROM journal_entries je
        JOIN journal_transactions jt ON jt.id = je.journal_transaction_id
        WHERE je.account LIKE 'Income:%' OR je.account LIKE 'Expenses:%'
        GROUP BY month, je.account, je.currency
        ORDER BY month, je.account
      `,
      )
      .all() as IncomeQueryRow[];

    const journalRows = db
      .prepare(
        `
        SELECT
          jt.external_id,
          jt.transaction_date,
          jt.description,
          jt.rule_id,
          je.account,
          je.side,
          je.amount_cents,
          je.currency
        FROM journal_transactions jt
        JOIN journal_entries je ON je.journal_transaction_id = jt.id
        ORDER BY jt.transaction_date DESC, jt.id DESC, je.id ASC
        LIMIT 80
      `,
      )
      .all() as JournalQueryRow[];

    const pipelineRow = db
      .prepare(
        `
        SELECT
          COUNT(*) AS raw_cached,
          SUM(CASE WHEN processed_at IS NOT NULL THEN 1 ELSE 0 END) AS processed,
          SUM(CASE WHEN skipped_reason = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN skipped_reason = 'zero_amount' THEN 1 ELSE 0 END) AS zero_amount,
          SUM(CASE WHEN processed_at IS NULL AND skipped_reason IS NULL THEN 1 ELSE 0 END) AS unprocessed,
          MIN(transaction_date) AS earliest_transaction_date,
          MAX(transaction_date) AS latest_transaction_date,
          MAX(last_seen_at) AS last_seen_at
        FROM raw_transactions
      `,
      )
      .get() as PipelineQueryRow | undefined;

    const sourceAccounts = db
      .prepare(
        `
        SELECT
          account_id,
          COUNT(*) AS raw_count,
          SUM(CASE WHEN processed_at IS NOT NULL THEN 1 ELSE 0 END) AS processed_count,
          SUM(CASE WHEN skipped_reason = 'pending' THEN 1 ELSE 0 END) AS pending_count,
          MIN(transaction_date) AS first_transaction_date,
          MAX(transaction_date) AS latest_transaction_date,
          SUM(amount_cents) AS net_amount_cents,
          COALESCE(MAX(currency), 'NZD') AS currency
        FROM raw_transactions
        GROUP BY account_id
        ORDER BY latest_transaction_date DESC, account_id
      `,
      )
      .all() as SourceAccountQueryRow[];

    const routingRow = db
      .prepare(
        `
        SELECT
          COUNT(*) AS journal_count,
          SUM(CASE WHEN rule_id IS NOT NULL AND rule_id NOT LIKE 'nzfcc:%' AND rule_id != 'manual:opening_balance' THEN 1 ELSE 0 END) AS custom_rule_count,
          SUM(CASE WHEN rule_id LIKE 'nzfcc:%' THEN 1 ELSE 0 END) AS nzfcc_fallback_count
        FROM journal_transactions
        WHERE source_account_id != 'manual'
      `,
      )
      .get() as RoutingQueryRow | undefined;

    const suspenseRow = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT jt.id) AS suspense_count,
          SUM(je.amount_cents) AS suspense_cents
        FROM journal_transactions jt
        JOIN journal_entries je ON je.journal_transaction_id = jt.id
        WHERE je.account LIKE 'Expenses:Uncategorized:Suspense%'
      `,
      )
      .get() as SuspenseQueryRow | undefined;

    const syncState = db
      .prepare(
        `
        SELECT key, value, updated_at
        FROM sync_state
        ORDER BY updated_at DESC, key
      `,
      )
      .all() as SyncStateQueryRow[];

    const suspenseQueueRows = db
      .prepare(
        `
        SELECT
          jt.external_id,
          jt.transaction_date,
          jt.description,
          SUM(je.amount_cents) AS amount_cents
        FROM journal_transactions jt
        JOIN journal_entries je ON je.journal_transaction_id = jt.id
        WHERE je.account LIKE 'Expenses:Uncategorized:Suspense%'
          AND je.side = 'debit'
        GROUP BY jt.id
        ORDER BY jt.transaction_date DESC, jt.id DESC
        LIMIT 50
      `,
      )
      .all() as SuspenseQueueQueryRow[];

    const netWorthTrendRows = db
      .prepare(
        `
        SELECT
          substr(jt.transaction_date, 1, 7) AS month,
          SUM(
            CASE WHEN je.account LIKE 'Assets:%'
              THEN (CASE WHEN je.side = 'debit' THEN je.amount_cents ELSE -je.amount_cents END)
              ELSE 0 END
          ) AS assets_delta,
          SUM(
            CASE WHEN je.account LIKE 'Liabilities:%'
              THEN (CASE WHEN je.side = 'debit' THEN je.amount_cents ELSE -je.amount_cents END)
              ELSE 0 END
          ) AS liabilities_delta
        FROM journal_entries je
        JOIN journal_transactions jt ON jt.id = je.journal_transaction_id
        WHERE je.account LIKE 'Assets:%' OR je.account LIKE 'Liabilities:%'
        GROUP BY month
        ORDER BY month
      `,
      )
      .all() as NetWorthTrendQueryRow[];

    const transactionCount = Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM journal_transactions WHERE source_account_id != 'manual'",
          )
          .get() as CountQueryRow | undefined
      )?.count ?? 0,
    );
    const rawTransactionCount = Number(pipelineRow?.raw_cached ?? 0);

    type ManualBalanceQueryRow = {
      account: string;
      balance_cents: number;
      as_of_date: string;
      updated_at: string;
    };

    const manualTableExists = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='manual_account_balances'",
      )
      .get();

    const rawManualBalances: ManualBalanceQueryRow[] = manualTableExists
      ? (db
          .prepare(
            "SELECT account, balance_cents, as_of_date, updated_at FROM manual_account_balances ORDER BY account",
          )
          .all() as ManualBalanceQueryRow[])
      : [];

    db.close();

    const manualBalances: ManualBalanceRow[] = rawManualBalances.map((r) => ({
      account: r.account,
      balanceCents: r.balance_cents,
      asOfDate: r.as_of_date,
      updatedAt: r.updated_at,
    }));

    // Any account in manual_account_balances supersedes its journal-derived
    // balance AND any journal-derived parent account (e.g. Sharesies:Spend
    // overrides Assets:Investments:Sharesies).
    const manualAccountSet = new Set(manualBalances.map((r) => r.account));
    const manualParentPrefixes = new Set<string>();
    for (const account of manualAccountSet) {
      const parts = account.split(":");
      for (let i = 1; i < parts.length; i++) {
        manualParentPrefixes.add(parts.slice(0, i).join(":"));
      }
    }

    const typedBalances: BalanceRow[] = [
      ...balances
        .filter(
          (row) =>
            !manualAccountSet.has(row.account) &&
            !manualParentPrefixes.has(row.account),
        )
        .map((row) => ({
          account: row.account,
          accountType: accountType(row.account),
          balanceCents: Number(row.balance_cents),
          currency: row.currency,
          isManual: false,
          liquidityTier: liquidityTierForAccount(row.account),
        })),
      ...manualBalances.map((r) => ({
        account: r.account,
        accountType: accountType(r.account),
        balanceCents: r.balanceCents,
        currency: "NZD",
        isManual: true,
        liquidityTier: liquidityTierForAccount(r.account),
      })),
    ].sort((a, b) => a.account.localeCompare(b.account));

    const totalsByType = typedBalances.reduce<Record<string, number>>(
      (totals, row) => {
        totals[row.accountType] =
          (totals[row.accountType] ?? 0) + row.balanceCents;
        return totals;
      },
      {},
    );

    const assetsCents = totalsByType.Assets ?? 0;
    const liabilitiesCents = totalsByType.Liabilities
      ? -totalsByType.Liabilities
      : 0;
    const netWorthCents = assetsCents - liabilitiesCents;

    const monthly = incomeStatement.reduce<
      Record<string, { incomeCents: number; expensesCents: number }>
    >((months, row) => {
      const bucket = months[row.month] ?? { incomeCents: 0, expensesCents: 0 };
      if (row.account.startsWith("Income:")) {
        bucket.incomeCents += Number(row.amount_cents);
      }
      if (row.account.startsWith("Expenses:")) {
        bucket.expensesCents += -Number(row.amount_cents);
      }
      months[row.month] = bucket;
      return months;
    }, {});

    const pnl = Object.entries(monthly)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, values]) => {
        const ebitdaCents = values.incomeCents - values.expensesCents;
        return {
          month,
          incomeCents: values.incomeCents,
          expensesCents: values.expensesCents,
          ebitdaCents,
          ebitdaMargin: values.incomeCents
            ? ebitdaCents / values.incomeCents
            : null,
        };
      });

    const incomeTotals = new Map<string, number>();
    const expenseTotals = new Map<string, number>();
    for (const row of incomeStatement) {
      const amount = Number(row.amount_cents);
      if (row.account.startsWith("Income:")) {
        incomeTotals.set(row.account, (incomeTotals.get(row.account) ?? 0) + amount);
      } else if (row.account.startsWith("Expenses:")) {
        expenseTotals.set(row.account, (expenseTotals.get(row.account) ?? 0) - amount);
      }
    }

    const toSortedTotals = (totals: Map<string, number>): AccountTotal[] =>
      Array.from(totals.entries())
        .map(([account, amountCents]) => ({ account, amountCents }))
        .filter((row) => row.amountCents !== 0)
        .sort((a, b) => b.amountCents - a.amountCents);

    const incomeBreakdown = toSortedTotals(incomeTotals);
    const expenseBreakdown = toSortedTotals(expenseTotals);

    let cumulativeAssets = 0;
    let cumulativeLiabilitiesSigned = 0;
    const netWorthTrend: NetWorthPoint[] = netWorthTrendRows.map((row) => {
      cumulativeAssets += Number(row.assets_delta ?? 0);
      cumulativeLiabilitiesSigned += Number(row.liabilities_delta ?? 0);
      const liabilitiesCents = -cumulativeLiabilitiesSigned;
      return {
        month: row.month,
        assetsCents: cumulativeAssets,
        liabilitiesCents,
        netWorthCents: cumulativeAssets - liabilitiesCents,
      };
    });

    const suspenseQueue: SuspenseItem[] = suspenseQueueRows.map((row) => ({
      externalId: row.external_id,
      transactionDate: row.transaction_date,
      description: row.description,
      amountCents: Number(row.amount_cents ?? 0),
    }));

    const incomeCents = pnl.reduce(
      (total, month) => total + month.incomeCents,
      0,
    );
    const expensesCents = pnl.reduce(
      (total, month) => total + month.expensesCents,
      0,
    );
    const ebitdaCents = incomeCents - expensesCents;
    const averageMonthlyIncomeCents = pnl.length
      ? Math.round(incomeCents / pnl.length)
      : 0;
    const monthlyOverheadCents = pnl.length
      ? Math.round(expensesCents / pnl.length)
      : 0;

    const recentTransactions = Array.from(
      journalRows
        .reduce<Map<string, JournalTransactionRow>>((transactions, row) => {
          const existing = transactions.get(row.external_id);
          const amountCents =
            row.side === "debit" ? row.amount_cents : -row.amount_cents;

          if (existing) {
            existing.postings.push({
              account: row.account,
              side: row.side,
              amountCents: row.amount_cents,
            });
            existing.amountCents += amountCents;
            return transactions;
          }

          transactions.set(row.external_id, {
            externalId: row.external_id,
            transactionDate: row.transaction_date,
            description: row.description,
            ruleId: row.rule_id,
            amountCents,
            currency: row.currency,
            postings: [
              {
                account: row.account,
                side: row.side,
                amountCents: row.amount_cents,
              },
            ],
          });
          return transactions;
        }, new Map())
        .values(),
    ).slice(0, 12);

    const pipeline: PipelineHealth = {
      rawCached: Number(pipelineRow?.raw_cached ?? 0),
      posted: Number(pipelineRow?.processed ?? 0),
      pending: Number(pipelineRow?.pending ?? 0),
      zeroAmount: Number(pipelineRow?.zero_amount ?? 0),
      unprocessed: Number(pipelineRow?.unprocessed ?? 0),
      earliestTransactionDate: pipelineRow?.earliest_transaction_date ?? null,
      latestTransactionDate: pipelineRow?.latest_transaction_date ?? null,
      lastSeenAt: pipelineRow?.last_seen_at ?? null,
    };

    const journalCount = Number(routingRow?.journal_count ?? 0);
    const suspenseCount = Number(suspenseRow?.suspense_count ?? 0);
    const routing: RoutingHealth = {
      journalCount,
      customRuleCount: Number(routingRow?.custom_rule_count ?? 0),
      nzfccFallbackCount: Number(routingRow?.nzfcc_fallback_count ?? 0),
      suspenseCount,
      suspenseCents: Number(suspenseRow?.suspense_cents ?? 0),
      classificationRate: journalCount
        ? (journalCount - suspenseCount) / journalCount
        : null,
    };

    return {
      databasePath,
      databaseExists: true,
      generatedAt: new Date().toISOString(),
      manualBalances,
      totals: {
        netWorthCents,
        assetsCents,
        liabilitiesCents,
        assetLiabilityRatio: liabilitiesCents
          ? assetsCents / liabilitiesCents
          : null,
        incomeCents,
        expensesCents,
        ebitdaCents,
        ebitdaMargin: incomeCents ? ebitdaCents / incomeCents : null,
        averageMonthlyIncomeCents,
        monthlyOverheadCents,
        runwayMonths: monthlyOverheadCents
          ? assetsCents / monthlyOverheadCents
          : null,
        transactionCount,
        rawTransactionCount,
      },
      balances: typedBalances,
      pnl,
      incomeBreakdown,
      expenseBreakdown,
      suspenseQueue,
      netWorthTrend,
      recentTransactions,
      pipeline,
      sourceAccounts: sourceAccounts.map((row) => {
        const mapping = accountMappings.get(row.account_id);
        const safeAccountId = row.account_id.replaceAll(
          /[^A-Za-z0-9_:-]/g,
          "_",
        );
        return {
          accountId: row.account_id,
          rawCount: Number(row.raw_count),
          processedCount: Number(row.processed_count ?? 0),
          pendingCount: Number(row.pending_count ?? 0),
          firstTransactionDate: row.first_transaction_date,
          latestTransactionDate: row.latest_transaction_date,
          netAmountCents: Number(row.net_amount_cents ?? 0),
          currency: row.currency,
          ledgerAccount:
            mapping?.ledgerAccount ?? `Assets:Unmapped:${safeAccountId}`,
          accountType: mapping?.accountType ?? "asset",
          mappingStatus: mapping ? "configured" : "unmapped",
        };
      }),
      routing,
      syncState: syncState.map((row) => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updated_at,
      })),
      error: null,
    };
  } catch (error) {
    return emptyDashboard(
      databasePath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function upsertManualBalance(input: ManualBalanceInput): void {
  const databasePath = resolveDatabasePath();
  const db = new Database(databasePath);

  db.prepare(
    `CREATE TABLE IF NOT EXISTS manual_account_balances (
      account TEXT PRIMARY KEY,
      balance_cents INTEGER NOT NULL,
      as_of_date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  db.prepare(
    `INSERT INTO manual_account_balances (account, balance_cents, as_of_date, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(account) DO UPDATE SET
       balance_cents = excluded.balance_cents,
       as_of_date    = excluded.as_of_date,
       updated_at    = excluded.updated_at`,
  ).run(input.account, input.balanceCents, today, now);

  db.close();
}
