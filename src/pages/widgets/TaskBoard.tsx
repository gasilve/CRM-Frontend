import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { tasks as initial } from "@/lib/mock-data";
import { Check, Plus } from "lucide-react";

export function TaskBoard() {
  const [items, setItems] = useState(initial);

  const toggle = (id: string) =>
    setItems((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const remaining = items.filter((t) => !t.done).length;

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[0.6875rem]">
          <span className="font-mono text-[var(--color-text-hi)]">{remaining}</span>
          <span className="text-[var(--color-text-mid)]">remaining</span>
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-line-2)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
          aria-label="Add task"
        >
          <Plus size={14} strokeWidth={1.8} />
        </button>
      </div>

      <ul className="anim-stagger anim-stagger-tight -mx-1 min-h-0 flex-1 overflow-y-auto">
        {items.map((t) => (
          <li
            key={t.id}
            className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.025]"
          >
            <button
              type="button"
              onClick={() => toggle(t.id)}
              className={
                "relative grid h-4 w-4 shrink-0 place-items-center rounded-[0.3125rem] border transition-colors " +
                (t.done
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/30"
                  : "border-[var(--color-line-2)] hover:border-[var(--color-line-3)]")
              }
              aria-label={t.done ? "Mark incomplete" : "Mark complete"}
            >
              {t.done && (
                <Check
                  size={10}
                  strokeWidth={2.5}
                  className="text-[var(--color-accent-2)]"
                />
              )}
            </button>
            <span
              className={
                "flex-1 text-[0.78125rem] " +
                (t.done
                  ? "text-[var(--color-text-lo)] line-through decoration-[var(--color-text-lo)]"
                  : "text-[var(--color-text-hi)]")
              }
            >
              {t.text}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
