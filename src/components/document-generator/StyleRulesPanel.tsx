import { useEffect, useState } from "react";
import { X, Lightbulb, Plus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StyleRule {
  id: string;
  code: string;
  text: string;
  createdAt: string;
}

const RULES_LS_KEY = "accenty.crm.style-rules.v1";

const SEED_RULES: StyleRule[] = [
  {
    id: "rule-011",
    code: "RULE-011",
    text: "Casino and venue names should be kept exactly as written — do not abbreviate or rename.",
    createdAt: "May 29",
  },
  {
    id: "rule-009",
    code: "RULE-009",
    text: "Each surveillance day gets its own paragraph, bolded date range as the lead-in.",
    createdAt: "May 29",
  },
];

function loadRules(): StyleRule[] {
  try {
    const raw = localStorage.getItem(RULES_LS_KEY);
    if (raw) return JSON.parse(raw) as StyleRule[];
  } catch {
    /* ignore */
  }
  return SEED_RULES;
}

function saveRules(rules: StyleRule[]) {
  try {
    localStorage.setItem(RULES_LS_KEY, JSON.stringify(rules));
  } catch {
    /* ignore */
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRulesChange?: (count: number) => void;
}

export default function StyleRulesPanel({ open, onClose, onRulesChange }: Props) {
  const [rules, setRules] = useState<StyleRule[]>(loadRules);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    onRulesChange?.(rules.length);
  }, [rules.length, onRulesChange]);

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
    }
  }, [open]);

  const persist = (updated: StyleRule[]) => {
    setRules(updated);
    saveRules(updated);
  };

  const addRule = () => {
    const text = feedback.trim();
    if (!text) return;
    const next: StyleRule = {
      id: `rule-${Date.now()}`,
      code: `RULE-${String(rules.length + 1).padStart(3, "0")}`,
      text,
      createdAt: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
    persist([next, ...rules]);
    setFeedback("");
  };

  const removeRule = (id: string) => {
    if (editingId === id) {
      setEditingId(null);
      setEditDraft("");
    }
    persist(rules.filter((r) => r.id !== id));
  };

  const startEdit = (rule: StyleRule) => {
    setEditingId(rule.id);
    setEditDraft(rule.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = (id: string) => {
    const text = editDraft.trim();
    if (!text) return;
    persist(rules.map((r) => (r.id === id ? { ...r, text } : r)));
    setEditingId(null);
    setEditDraft("");
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(400px,92vw)] flex-col",
          "border-l border-[var(--color-line)] bg-[var(--color-ink-1)] shadow-2xl",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
        role="dialog"
        aria-label="Style rules"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
          <div className="flex gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
              <Lightbulb size={17} strokeWidth={1.6} />
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-[var(--color-text-hi)]">Style rules</h2>
              <p className="text-[11.5px] leading-snug text-[var(--color-text-lo)] mt-0.5 max-w-[260px]">
                Standing instructions the agent follows every time it converts a document.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[8px] p-2 text-[var(--color-text-lo)] hover:bg-white/5 hover:text-[var(--color-text-hi)] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {rules.length === 0 && (
            <p className="text-[12px] text-[var(--color-text-lo)] text-center py-8">
              No rules yet. Add one below.
            </p>
          )}
          {rules.map((rule) => {
            const isEditing = editingId === rule.id;
            return (
              <div
                key={rule.id}
                className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-3.5"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--color-accent-2)]">
                    {rule.code}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-lo)]">{rule.createdAt}</span>
                </div>

                {isEditing ? (
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={4}
                    autoFocus
                    className={cn(
                      "w-full resize-y rounded-[8px] border border-[var(--color-line)]",
                      "bg-[var(--color-ink-1)] text-[var(--color-text-hi)] text-[12.5px] leading-relaxed p-2.5",
                      "focus:outline-none focus:border-[var(--color-accent)] transition-colors",
                    )}
                  />
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-[var(--color-text-mid)]">{rule.text}</p>
                )}

                <div className="mt-2.5 flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => saveEdit(rule.id)}
                        disabled={!editDraft.trim()}
                        className="flex items-center gap-1 text-[11px] text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40 transition-colors"
                      >
                        <Check size={12} />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-[11px] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)] transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(rule)}
                        className="flex items-center gap-1 text-[11px] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)] transition-colors"
                      >
                        <Pencil size={11} />
                        Edit
                      </button>
                      <span className="text-[var(--color-line-2)]">·</span>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="text-[11px] text-[var(--color-text-lo)] hover:text-[var(--color-neg)] transition-colors"
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
            <p className="text-[13px] font-medium text-[var(--color-text-hi)]">
              Tell the agent what&apos;s wrong
            </p>
            <p className="text-[11px] text-[var(--color-text-lo)] mt-0.5 leading-snug">
              Describe a formatting rule or mistake. It becomes a standing rule for next time.
            </p>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Keep venue names verbatim. Bold each day's date range."
            className={cn(
              "w-full aspect-square max-h-[220px] resize-none rounded-[12px] border border-[var(--color-line)]",
              "bg-[var(--color-ink-2)] text-[var(--color-text-hi)] text-[13px] leading-relaxed p-3.5",
              "placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)] transition-colors",
            )}
          />
          <button
            type="button"
            onClick={addRule}
            disabled={!feedback.trim()}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-tile py-2.5 text-sm font-medium",
              "bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <Plus size={15} />
            Add rule
          </button>
        </div>
      </aside>
    </>
  );
}
