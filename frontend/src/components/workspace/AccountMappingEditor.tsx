import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  AccountMapping,
  AccountMappingInput,
} from "~/server/accountMappings";
import type { AkahuAccountSummary } from "~/server/akahuConnection";
import { formatMoney } from "~/components/widgets/format";

// --- Server functions --------------------------------------------------------

const listAccountMappingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountMapping[]> => {
    const { listAccountMappings } = await import("~/server/accountMappings");
    return listAccountMappings();
  },
);

const createAccountMappingFn = createServerFn({ method: "POST" })
  .validator((data: AccountMappingInput) => data)
  .handler(async ({ data }): Promise<AccountMapping[]> => {
    const { createAccountMapping } = await import("~/server/accountMappings");
    return createAccountMapping(data);
  });

const updateAccountMappingFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; input: AccountMappingInput }) => data)
  .handler(async ({ data }): Promise<AccountMapping[]> => {
    const { updateAccountMapping } = await import("~/server/accountMappings");
    return updateAccountMapping(data.id, data.input);
  });

const deleteAccountMappingFn = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<AccountMapping[]> => {
    const { deleteAccountMapping } = await import("~/server/accountMappings");
    return deleteAccountMapping(id);
  });

// Reuses the existing Akahu accounts listing so the "Akahu account" field can
// be a dropdown when the tenant is connected. Throws (409) when Akahu isn't
// connected yet — the editor catches that and stays on free-text entry.
const listConnectedAccountsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AkahuAccountSummary[]> => {
    const { listConnectedAccounts } = await import("~/server/akahuConnection");
    return listConnectedAccounts();
  },
);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

const EMPTY_FORM: AccountMappingInput = {
  akahuAccountId: "",
  ledgerAccount: "",
  accountType: "asset",
  creditLimitCents: null,
};

function mappingToForm(m: AccountMapping): AccountMappingInput {
  return {
    akahuAccountId: m.akahuAccountId,
    ledgerAccount: m.ledgerAccount,
    accountType: m.accountType,
    creditLimitCents: m.creditLimitCents,
  };
}

/** Balance-domain tag class ("assets"/"liabilities") for the shared .mb-tag styles. */
function tagClass(accountType: AccountMappingInput["accountType"]): string {
  return "mb-tag mb-tag--" + (accountType === "liability" ? "liabilities" : "assets");
}

interface FormProps {
  initial: AccountMappingInput;
  editing: boolean;
  akahuAccounts: AkahuAccountSummary[] | null;
  onSubmit: (input: AccountMappingInput) => void;
  onCancel?: () => void;
  pending: boolean;
}

function AccountMappingForm({
  initial,
  editing,
  akahuAccounts,
  onSubmit,
  onCancel,
  pending,
}: FormProps) {
  const [form, setForm] = useState<AccountMappingInput>(initial);
  const [creditLimitDollars, setCreditLimitDollars] = useState(
    initial.creditLimitCents != null ? (initial.creditLimitCents / 100).toFixed(2) : "",
  );
  const hasAkahuAccounts = Boolean(akahuAccounts && akahuAccounts.length > 0);
  const [useCustomId, setUseCustomId] = useState(
    !hasAkahuAccounts ||
      !akahuAccounts!.some((a) => a.id === initial.akahuAccountId),
  );

  function set<K extends keyof AccountMappingInput>(key: K, value: AccountMappingInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    const trimmed = creditLimitDollars.trim();
    const parsedCents =
      form.accountType === "liability" && trimmed !== ""
        ? Math.round(parseFloat(trimmed) * 100)
        : null;
    onSubmit({
      ...form,
      creditLimitCents: parsedCents != null && Number.isFinite(parsedCents) ? parsedCents : null,
    });
  }

  return (
    <form
      className="rule-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="rule-form__row">
        <label>
          Akahu account
          {hasAkahuAccounts && !useCustomId ? (
            <select
              value={form.akahuAccountId}
              onChange={(e) => set("akahuAccountId", e.target.value)}
              disabled={pending}
              required
            >
              <option value="" disabled>
                Choose an account…
              </option>
              {akahuAccounts!.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          ) : (
            <input
              value={form.akahuAccountId}
              onChange={(e) => set("akahuAccountId", e.target.value)}
              placeholder="acc_..."
              disabled={pending || editing}
              required
            />
          )}
        </label>
        {hasAkahuAccounts ? (
          <button
            type="button"
            onClick={() => setUseCustomId((v) => !v)}
            disabled={pending}
          >
            {useCustomId ? "Choose from list" : "Enter id manually"}
          </button>
        ) : null}
      </div>

      <div className="rule-form__row">
        <label>
          Ledger account
          <input
            value={form.ledgerAccount}
            onChange={(e) => set("ledgerAccount", e.target.value)}
            placeholder="Assets:Checking"
            disabled={pending}
            required
          />
        </label>
        <label>
          Account type
          <select
            value={form.accountType}
            onChange={(e) =>
              set("accountType", e.target.value as AccountMappingInput["accountType"])
            }
            disabled={pending}
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
          </select>
        </label>
      </div>

      {form.accountType === "liability" ? (
        <div className="rule-form__row">
          <label>
            Credit limit (optional)
            <input
              type="number"
              step="0.01"
              value={creditLimitDollars}
              onChange={(e) => setCreditLimitDollars(e.target.value)}
              placeholder="0.00"
              disabled={pending}
            />
          </label>
        </div>
      ) : null}

      <div className="rule-form__actions">
        <button className="auth-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add mapping"}
        </button>
        {onCancel ? (
          <button className="auth-secondary" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function AccountMappingEditor({
  initialMappings,
}: {
  initialMappings: AccountMapping[];
}) {
  const [mappings, setMappings] = useState(initialMappings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [akahuAccounts, setAkahuAccounts] = useState<AkahuAccountSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AccountMapping[]>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setMappings(await action());
        after?.();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function loadAkahuAccounts() {
    setError(null);
    startTransition(async () => {
      try {
        setAkahuAccounts(await listConnectedAccountsFn());
      } catch (err) {
        // Akahu may not be connected yet — free-text entry still works.
        setError(errorMessage(err));
      }
    });
  }

  return (
    <div className="rules-editor">
      <p className="rules-editor__note">
        Map each Akahu-connected account to a ledger account so synced
        transactions post to the right place. Liability mappings can carry a
        credit limit, used to compute available credit.
      </p>

      <button
        className="auth-secondary rules-editor__add"
        type="button"
        onClick={loadAkahuAccounts}
        disabled={pending}
      >
        {akahuAccounts === null ? "Load Akahu accounts" : "Reload Akahu accounts"}
      </button>

      {mappings.length > 0 ? (
        <div className="mb-table-wrap">
          <table className="mb-table rules-table">
            <thead>
              <tr>
                <th>Akahu account</th>
                <th>Ledger account</th>
                <th>Type</th>
                <th className="mb-numeric">Credit limit</th>
                <th className="mb-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) =>
                editingId === m.id ? (
                  <tr key={m.id}>
                    <td colSpan={5}>
                      <AccountMappingForm
                        initial={mappingToForm(m)}
                        editing
                        akahuAccounts={akahuAccounts}
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) =>
                          run(
                            () => updateAccountMappingFn({ data: { id: m.id, input } }),
                            () => setEditingId(null),
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td>
                      <code className="mb-account">{m.akahuAccountId}</code>
                    </td>
                    <td>
                      <code className="mb-account">{m.ledgerAccount}</code>
                    </td>
                    <td>
                      <span className={tagClass(m.accountType)}>{m.accountType}</span>
                    </td>
                    <td className="mb-numeric">
                      {m.accountType === "liability" && m.creditLimitCents != null
                        ? formatMoney(m.creditLimitCents)
                        : "—"}
                    </td>
                    <td className="mb-actions">
                      <button type="button" onClick={() => setEditingId(m.id)} disabled={pending}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="mb-remove"
                        onClick={() => run(() => deleteAccountMappingFn({ data: m.id }))}
                        disabled={pending}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-empty">
          No account mappings yet. Add one to route a synced Akahu account to a
          ledger account.
        </p>
      )}

      {error ? <p className="mb-error" role="alert">{error}</p> : null}

      {adding ? (
        <AccountMappingForm
          initial={EMPTY_FORM}
          editing={false}
          akahuAccounts={akahuAccounts}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            run(
              () => createAccountMappingFn({ data: input }),
              () => setAdding(false),
            )
          }
        />
      ) : (
        <button
          className="auth-secondary rules-editor__add"
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
        >
          + Add mapping
        </button>
      )}
    </div>
  );
}
