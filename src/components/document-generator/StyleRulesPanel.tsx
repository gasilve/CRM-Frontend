import { useCallback, useEffect, useState } from "react";
import { X, Lightbulb, Plus, Pencil, Check, Loader2, ScrollText } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  reportConfigApi,
  type PromptConfig,
  type StyleRule,
} from "@/lib/report-config-api";

interface Props {
  open: boolean;
  onClose: () => void;
  onRulesChange?: (count: number) => void;
}

type PanelTab = "prompt" | "rules";

export default function StyleRulesPanel({ open, onClose, onRulesChange }: Props) {
  const [tab, setTab] = useState<PanelTab>("prompt");
  const [rules, setRules] = useState<StyleRule[]>([]);
  const [prompt, setPrompt] = useState<PromptConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [promptRes, rulesRes] = await Promise.all([
        reportConfigApi.getPrompt(),
        reportConfigApi.listStyleRules(),
      ]);
      setPrompt(promptRes);
      setRules(rulesRes.rules);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    onRulesChange?.(rules.length);
  }, [rules.length, onRulesChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditDraft("");
      setFeedback("");
      setTab("prompt");
    }
  }, [open]);

  const addRule = async () => {
    const text = feedback.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const { rule } = await reportConfigApi.createStyleRule(text);
      setRules((prev) => [rule, ...prev]);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add rule.");
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await reportConfigApi.deleteStyleRule(id);
      if (editingId === id) {
        setEditingId(null);
        setEditDraft("");
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove rule.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rule: StyleRule) => {
    setEditingId(rule.id);
    setEditDraft(rule.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (id: string) => {
    const text = editDraft.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const { rule } = await reportConfigApi.updateStyleRule(id, text);
      setRules((prev) => prev.map((r) => (r.id === id ? rule : r)));
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[0.125rem] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(27.5rem,92vw)] flex-col",
          "border-l border-[var(--color-line)] bg-[var(--color-ink-1)] shadow-2xl",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
        role="dialog"
        aria-label="Report agent configuration"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
          <div className="flex gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
              <Lightbulb size={17} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-[0.9375rem] font-medium text-[var(--color-text-hi)]">Report agent</h2>
              <p className="text-[0.71875rem] leading-snug text-[var(--color-text-lo)] mt-0.5 max-w-[17.5rem]">
                View the AI prompt and manage standing style rules for every conversion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[0.5rem] p-2 text-[var(--color-text-lo)] hover:bg-white/5 hover:text-[var(--color-text-hi)] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-[var(--color-line)] px-5 gap-1">
          {(
            [
              ["prompt", "Main prompt", ScrollText],
              ["rules", "Style rules", Lightbulb],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-[0.75rem] font-medium border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-[var(--color-accent)] text-[var(--color-text-hi)]"
                  : "border-transparent text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
              )}
            >
              <Icon size={13} />
              {label}
              {id === "rules" && rules.length > 0 && (
                <span className="rounded-full bg-[var(--color-warn)]/15 px-1.5 text-[0.625rem] font-mono text-[var(--color-warn)]">
                  {rules.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[0.75rem] text-[var(--color-neg)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[var(--color-text-lo)] text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : tab === "prompt" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <p className="text-[0.75rem] font-medium text-[var(--color-text-hi)] mb-1">System prompt</p>
              <p className="text-[0.6875rem] text-[var(--color-text-lo)] mb-2 leading-snug">
                Base instructions the agent follows when paraphrasing surveillance notes. Style rules
                are appended automatically at generation time.
              </p>
              <pre
                className={cn(
                  "whitespace-pre-wrap rounded-[0.625rem] border border-[var(--color-line)]",
                  "bg-[var(--color-ink-2)] text-[0.6875rem] leading-relaxed text-[var(--color-text-mid)] p-3.5",
                  "max-h-[min(52vh,26.25rem)] overflow-y-auto font-mono",
                )}
              >
                {prompt?.systemPrompt ?? "—"}
              </pre>
            </div>
            <div>
              <p className="text-[0.75rem] font-medium text-[var(--color-text-hi)] mb-1">User prompt template</p>
              <pre
                className={cn(
                  "whitespace-pre-wrap rounded-[0.625rem] border border-[var(--color-line)]",
                  "bg-[var(--color-ink-2)] text-[0.6875rem] leading-relaxed text-[var(--color-text-mid)] p-3.5",
                  "font-mono",
                )}
              >
                {prompt?.userPromptTemplate ?? "—"}
              </pre>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {rules.length === 0 && (
                <p className="text-[0.75rem] text-[var(--color-text-lo)] text-center py-8">
                  No rules yet. Add one below.
                </p>
              )}
              {rules.map((rule) => {
                const isEditing = editingId === rule.id;
                return (
                  <div
                    key={rule.id}
                    className="rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[0.625rem] tracking-wider text-[var(--color-accent-2)]">
                        {rule.code}
                      </span>
                      <span className="text-[0.625rem] text-[var(--color-text-lo)]">{rule.createdAt}</span>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={4}
                        autoFocus
                        className={cn(
                          "w-full resize-y rounded-[0.5rem] border border-[var(--color-line)]",
                          "bg-[var(--color-ink-1)] text-[var(--color-text-hi)] text-[0.78125rem] leading-relaxed p-2.5",
                          "focus:outline-none focus:border-[var(--color-accent)] transition-colors",
                        )}
                      />
                    ) : (
                      <p className="text-[0.78125rem] leading-relaxed text-[var(--color-text-mid)]">{rule.text}</p>
                    )}

                    <div className="mt-2.5 flex items-center gap-3">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEdit(rule.id)}
                            disabled={!editDraft.trim() || saving}
                            className="flex items-center gap-1 text-[0.6875rem] text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40 transition-colors"
                          >
                            <Check size={12} />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-[0.6875rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)] transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(rule)}
                            disabled={saving}
                            className="flex items-center gap-1 text-[0.6875rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)] disabled:opacity-40 transition-colors"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          <span className="text-[var(--color-line-2)]">·</span>
                          <button
                            type="button"
                            onClick={() => void removeRule(rule.id)}
                            disabled={saving}
                            className="text-[0.6875rem] text-[var(--color-text-lo)] hover:text-[var(--color-neg)] disabled:opacity-40 transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--color-line)] px-5 py-4 space-y-3">
              <div>
                <p className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
                  Suggest a style rule
                </p>
                <p className="text-[0.6875rem] text-[var(--color-text-lo)] mt-0.5 leading-snug">
                  Describe a formatting preference. It is saved and applied on every report generation.
                </p>
              </div>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Keep venue names verbatim. Bold each day's date range."
                className={cn(
                  "w-full min-h-[6.25rem] max-h-[13.75rem] resize-y rounded-[0.75rem] border border-[var(--color-line)]",
                  "bg-[var(--color-ink-2)] text-[var(--color-text-hi)] text-[0.8125rem] leading-relaxed p-3.5",
                  "placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)] transition-colors",
                )}
              />
              <button
                type="button"
                onClick={() => void addRule()}
                disabled={!feedback.trim() || saving}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-tile py-2.5 text-sm font-medium",
                  "bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Add rule
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export type { StyleRule };
