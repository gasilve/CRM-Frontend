import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWidgetLayout } from "@/lib/widget-layout";
import { cn } from "@/lib/cn";
import { WidgetShell } from "@/components/widgets/WidgetShell";

type Item = { id: string; label: string; done: boolean };

function checklistKey(userId: string | undefined) {
  return `accenty.crm.personal-checklist.${userId ?? "anon"}`;
}

function loadItems(userId: string | undefined): Item[] {
  try {
    const raw = localStorage.getItem(checklistKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Item[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Actionable personal checklist — local per user. */
export function PersonalChecklist() {
  const { user } = useAuth();
  const { density, slots } = useWidgetLayout({ rowPx: 36, reservedPx: 36 });
  const [items, setItems] = useState<Item[]>(() => loadItems(user?.id));
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setItems(loadItems(user?.id));
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(checklistKey(user?.id), JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, user?.id]);

  const remaining = useMemo(() => items.filter((i) => !i.done).length, [items]);
  const visible = items.slice(0, Math.max(3, slots));

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    setItems((prev) => [{ id: `${Date.now()}`, label, done: false }, ...prev]);
    setDraft("");
  };

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <WidgetShell title="Checklist" icon={CheckSquare} eyebrow="Personal">
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">
            {remaining} remaining
          </span>
          {density !== "dense" && (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
                placeholder="Add…"
                className="min-w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] outline-none"
              />
              <button
                type="button"
                onClick={add}
                className="grid h-6 w-6 place-items-center rounded-[0.375rem] border border-[var(--color-line)] font-mono text-[0.75rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
                aria-label="Add item"
              >
                +
              </button>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {visible.length === 0 ? (
            <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">No items yet.</div>
          ) : (
            visible.map((item) => (
              <div key={item.id} className="group flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[0.25rem] border",
                      item.done
                        ? "border-[var(--color-pos)] bg-[var(--color-pos)] text-[var(--color-ink-1)]"
                        : "border-[var(--color-line-2)]",
                    )}
                  >
                    {item.done && <span className="text-[0.5rem] leading-none">✓</span>}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[0.75rem]",
                      item.done ? "text-[var(--color-text-lo)] line-through" : "text-[var(--color-text-hi)]",
                    )}
                  >
                    {item.label}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-[0.375rem] text-[var(--color-text-lo)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-neg)_14%,transparent)] hover:text-[var(--color-neg)]",
                    item.done ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label={`Remove ${item.label}`}
                  title="Remove"
                >
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
