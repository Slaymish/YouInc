import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { ClassificationRule, RuleInput } from "~/server/tenantRules";

// --- Server functions --------------------------------------------------------

const listRulesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClassificationRule[]> => {
    const { listRules } = await import("~/server/tenantRules");
    return listRules();
  },
);

const createRuleFn = createServerFn({ method: "POST" })
  .validator((data: RuleInput) => data)
  .handler(async ({ data }): Promise<ClassificationRule[]> => {
    const { createRule } = await import("~/server/tenantRules");
    return createRule(data);
  });

const updateRuleFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; input: RuleInput }) => data)
  .handler(async ({ data }): Promise<ClassificationRule[]> => {
    const { updateRule } = await import("~/server/tenantRules");
    return updateRule(data.id, data.input);
  });

const setEnabledFn = createServerFn({ method: "POST" })
  .validator((data: { id: string; isEnabled: boolean }) => data)
  .handler(async ({ data }): Promise<ClassificationRule[]> => {
    const { setRuleEnabled } = await import("~/server/tenantRules");
    return setRuleEnabled(data.id, data.isEnabled);
  });

const deleteRuleFn = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<ClassificationRule[]> => {
    const { deleteRule } = await import("~/server/tenantRules");
    return deleteRule(id);
  });

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

const EMPTY_FORM: RuleInput = {
  ruleKey: "",
  priority: 100,
  isEnabled: true,
  matchDescriptionRegex: "",
  matchMerchantRegex: "",
  matchAmountGreaterThan: null,
  matchAmountAbsGreaterThan: null,
  targetAccount: "",
  memo: "",
};

function ruleToForm(r: ClassificationRule): RuleInput {
  return {
    ruleKey: r.ruleKey,
    priority: r.priority,
    isEnabled: r.isEnabled,
    matchDescriptionRegex: r.matchDescriptionRegex ?? "",
    matchMerchantRegex: r.matchMerchantRegex ?? "",
    matchAmountGreaterThan: r.matchAmountGreaterThan,
    matchAmountAbsGreaterThan: r.matchAmountAbsGreaterThan,
    targetAccount: r.targetAccount,
    memo: r.memo ?? "",
  };
}

function conditionSummary(r: ClassificationRule): string {
  const parts: string[] = [];
  if (r.matchDescriptionRegex) parts.push(`description ~ /${r.matchDescriptionRegex}/`);
  if (r.matchMerchantRegex) parts.push(`merchant ~ /${r.matchMerchantRegex}/`);
  if (r.matchAmountGreaterThan != null) parts.push(`amount > ${r.matchAmountGreaterThan}`);
  if (r.matchAmountAbsGreaterThan != null) parts.push(`|amount| > ${r.matchAmountAbsGreaterThan}`);
  return parts.length > 0 ? parts.join(" and ") : "no conditions";
}

function numberOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

interface FormProps {
  initial: RuleInput;
  editing: boolean;
  onSubmit: (input: RuleInput) => void;
  onCancel?: () => void;
  pending: boolean;
}

function RuleForm({ initial, editing, onSubmit, onCancel, pending }: FormProps) {
  const [form, setForm] = useState<RuleInput>(initial);

  function set<K extends keyof RuleInput>(key: K, value: RuleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      className="rule-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="rule-form__row">
        <label>
          Name
          <input
            value={form.ruleKey}
            onChange={(e) => set("ruleKey", e.target.value)}
            placeholder="coffee"
            disabled={editing || pending}
            required
          />
        </label>
        <label>
          Priority
          <input
            type="number"
            value={form.priority}
            onChange={(e) => set("priority", Number(e.target.value))}
            disabled={pending}
          />
        </label>
      </div>

      <div className="rule-form__row">
        <label>
          Description matches (regex)
          <input
            value={form.matchDescriptionRegex ?? ""}
            onChange={(e) => set("matchDescriptionRegex", e.target.value)}
            placeholder="(?i)countdown|new world"
            disabled={pending}
          />
        </label>
        <label>
          Merchant matches (regex)
          <input
            value={form.matchMerchantRegex ?? ""}
            onChange={(e) => set("matchMerchantRegex", e.target.value)}
            placeholder="(?i)spark"
            disabled={pending}
          />
        </label>
      </div>

      <div className="rule-form__row">
        <label>
          Amount &gt; (signed)
          <input
            type="number"
            step="0.01"
            value={form.matchAmountGreaterThan ?? ""}
            onChange={(e) => set("matchAmountGreaterThan", numberOrNull(e.target.value))}
            placeholder="e.g. 0"
            disabled={pending}
          />
        </label>
        <label>
          |Amount| &gt;
          <input
            type="number"
            step="0.01"
            value={form.matchAmountAbsGreaterThan ?? ""}
            onChange={(e) => set("matchAmountAbsGreaterThan", numberOrNull(e.target.value))}
            placeholder="e.g. 1000"
            disabled={pending}
          />
        </label>
      </div>

      <div className="rule-form__row">
        <label>
          Route to account
          <input
            value={form.targetAccount}
            onChange={(e) => set("targetAccount", e.target.value)}
            placeholder="Expenses:Groceries"
            disabled={pending}
            required
          />
        </label>
        <label>
          Memo (optional)
          <input
            value={form.memo ?? ""}
            onChange={(e) => set("memo", e.target.value)}
            disabled={pending}
          />
        </label>
      </div>

      <div className="rule-form__actions">
        <button className="auth-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add rule"}
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

export function RulesEditor({ initialRules }: { initialRules: ClassificationRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ClassificationRule[]>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        setRules(await action());
        after?.();
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <div className="rules-editor">
      <p className="rules-editor__note">
        Rules route transactions to ledger accounts, tried in priority order (lower
        first). The first rule whose conditions all match wins; anything unmatched
        falls back to the suspense account. Edits apply to future syncs.
      </p>

      {rules.length > 0 ? (
        <div className="mb-table-wrap">
          <table className="mb-table rules-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Rule</th>
                <th>Routes to</th>
                <th className="mb-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={4}>
                      <RuleForm
                        initial={ruleToForm(r)}
                        editing
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) =>
                          run(
                            () => updateRuleFn({ data: { id: r.id, input } }),
                            () => setEditingId(null),
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className={r.isEnabled ? "" : "rule-row--disabled"}>
                    <td>{r.priority}</td>
                    <td>
                      <code className="mb-account">{r.ruleKey}</code>
                      <span className="rule-cond">{conditionSummary(r)}</span>
                    </td>
                    <td>
                      <code className="mb-account">{r.targetAccount}</code>
                    </td>
                    <td className="mb-actions">
                      <button type="button" onClick={() => setEditingId(r.id)} disabled={pending}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => run(() => setEnabledFn({ data: { id: r.id, isEnabled: !r.isEnabled } }))}
                        disabled={pending}
                      >
                        {r.isEnabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="mb-remove"
                        onClick={() => run(() => deleteRuleFn({ data: r.id }))}
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
          No rules yet. Add one to control where your transactions are categorized.
        </p>
      )}

      {error ? <p className="mb-error" role="alert">{error}</p> : null}

      {adding ? (
        <RuleForm
          initial={EMPTY_FORM}
          editing={false}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            run(
              () => createRuleFn({ data: input }),
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
          + Add rule
        </button>
      )}
    </div>
  );
}
