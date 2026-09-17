import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { ErrorBanner, SectionHeader, Toggle, inputClass, labelClass } from "@/components/admin/primitives";
import {
  questionBankApi,
  ApiError,
  type CaseService,
  type QuestionRule,
  type StandardQuestion,
} from "@/lib/crm-api";

const SERVICES = Object.keys(SERVICE_LABELS) as CaseService[];

export function QuestionBankTab() {
  const [standard, setStandard] = useState<StandardQuestion[] | null>(null);
  const [rules, setRules] = useState<QuestionRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([questionBankApi.listStandardQuestions(), questionBankApi.listRules()])
      .then(([sq, r]) => {
        setStandard(sq.questions);
        setRules(r.rules);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the question bank."));
  }, []);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-2">
      {error && (
        <div className="lg:col-span-2">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="surface flex min-h-0 flex-col gap-4 p-5">
        <SectionHeader
          title="Standard questions"
          hint="Fixed daily bank — asked every day regardless of what the note says (e.g. “Did the subject appear injured today?”)."
        />
        {standard === null ? (
          <Loader2 size={16} className="animate-spin text-[var(--color-text-lo)]" />
        ) : (
          <StandardQuestionsList questions={standard} onChanged={setStandard} />
        )}
      </div>

      <div className="surface flex min-h-0 flex-col gap-4 p-5">
        <SectionHeader
          title="Dynamic question rules"
          hint="Trigger phrases (e.g. “left the house”) mapped to follow-up questions. Matched automatically after a note is saved."
        />
        {rules === null ? (
          <Loader2 size={16} className="animate-spin text-[var(--color-text-lo)]" />
        ) : (
          <QuestionRulesList rules={rules} onChanged={setRules} />
        )}
      </div>
    </div>
  );
}

// ─── Standard questions ─────────────────────────────────────────────────────

function StandardQuestionsList({
  questions,
  onChanged,
}: {
  questions: StandardQuestion[];
  onChanged: (next: StandardQuestion[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [newService, setNewService] = useState<CaseService | "">("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const { question } = await questionBankApi.createStandardQuestion({
        text: newText.trim(),
        appliesToService: newService || null,
      });
      onChanged([...questions, question]);
      setNewText("");
      setNewService("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that question.");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (q: StandardQuestion) => {
    setBusyId(q.id);
    try {
      const { question } = await questionBankApi.updateStandardQuestion(q.id, { active: !q.active });
      onChanged(questions.map((x) => (x.id === q.id ? question : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that question.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (q: StandardQuestion) => {
    setBusyId(q.id);
    try {
      await questionBankApi.deleteStandardQuestion(q.id);
      onChanged(questions.filter((x) => x.id !== q.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that question.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {questions.length === 0 && (
          <p className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">No standard questions yet.</p>
        )}
        {questions.map((q) => (
          <div key={q.id} className="flex items-start gap-2.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-2.5">
            <div className={cn("min-w-0 flex-1", !q.active && "opacity-50")}>
              <div className="text-[0.8125rem] text-[var(--color-text-hi)]">{q.text}</div>
              <div className="mt-0.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                {q.appliesToService ? `Only ${SERVICE_LABELS[q.appliesToService]} cases` : "Every case"}
              </div>
            </div>
            {busyId === q.id ? (
              <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin text-[var(--color-text-lo)]" />
            ) : (
              <>
                <Toggle checked={q.active} onChange={() => toggleActive(q)} label={`Active — ${q.text}`} />
                <button
                  type="button"
                  onClick={() => remove(q)}
                  className="shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)]"
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>New standard question</span>
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Did the subject appear injured today?"
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-2">
          <select
            value={newService}
            onChange={(e) => setNewService(e.target.value as CaseService | "")}
            className={cn(inputClass, "flex-1")}
          >
            <option value="">Every case</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]} only
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={adding || !newText.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-2 text-[0.75rem] font-medium text-[var(--color-text-hi)] disabled:opacity-40"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2} />}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dynamic rules ───────────────────────────────────────────────────────────

function QuestionRulesList({ rules, onChanged }: { rules: QuestionRule[]; onChanged: (next: QuestionRule[]) => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [triggers, setTriggers] = useState("");
  const [followUps, setFollowUps] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linesOf = (s: string): string[] => s.split("\n").map((l) => l.trim()).filter(Boolean);

  const add = async () => {
    const triggerExamples = linesOf(triggers);
    const followUpQuestions = linesOf(followUps);
    if (!label.trim() || triggerExamples.length === 0 || followUpQuestions.length === 0) return;
    setAdding(true);
    setError(null);
    try {
      const { rule } = await questionBankApi.createRule({ label: label.trim(), triggerExamples, followUpQuestions });
      onChanged([...rules, rule]);
      setLabel("");
      setTriggers("");
      setFollowUps("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that rule.");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (r: QuestionRule) => {
    setBusyId(r.id);
    try {
      const { rule } = await questionBankApi.updateRule(r.id, { active: !r.active });
      onChanged(rules.map((x) => (x.id === r.id ? rule : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update that rule.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: QuestionRule) => {
    setBusyId(r.id);
    try {
      await questionBankApi.deleteRule(r.id);
      onChanged(rules.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that rule.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {rules.length === 0 && (
          <p className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">No dynamic rules yet.</p>
        )}
        {rules.map((r) => (
          <div key={r.id} className="flex items-start gap-2.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-2.5">
            <div className={cn("min-w-0 flex-1", !r.active && "opacity-50")}>
              <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{r.label}</div>
              <div className="mt-0.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                Triggers: {r.triggerExamples.join(" · ")}
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {r.followUpQuestions.map((q, i) => (
                  <span key={i} className="text-[0.75rem] text-[var(--color-text-mid)]">
                    → {q}
                  </span>
                ))}
              </div>
            </div>
            {busyId === r.id ? (
              <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin text-[var(--color-text-lo)]" />
            ) : (
              <>
                <Toggle checked={r.active} onChange={() => toggleActive(r)} label={`Active — ${r.label}`} />
                <button
                  type="button"
                  onClick={() => remove(r)}
                  className="shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)]"
                  title="Remove"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>New rule label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Subject left the house" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Trigger phrases (one per line)</span>
          <textarea
            value={triggers}
            onChange={(e) => setTriggers(e.target.value)}
            placeholder={"left the house\nleft home"}
            className={cn(inputClass, "min-h-[3.5rem] resize-none")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Follow-up questions (one per line)</span>
          <textarea
            value={followUps}
            onChange={(e) => setFollowUps(e.target.value)}
            placeholder={"What time?\nOn foot or by vehicle?\nWhich direction?"}
            className={cn(inputClass, "min-h-[3.5rem] resize-none")}
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={adding || !label.trim() || !triggers.trim() || !followUps.trim()}
          className="flex items-center justify-center gap-1.5 self-end rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3.5 py-2 text-[0.75rem] font-medium text-[var(--color-text-hi)] disabled:opacity-40"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2} />}
          Add rule
        </button>
      </div>
    </div>
  );
}
