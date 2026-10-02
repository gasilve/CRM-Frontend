import { VenetianMask } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SubjectAwareness } from "@/lib/crm-api";

const OPTIONS: {
  id: SubjectAwareness;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { id: "unnoticed", label: "Unnoticed", color: "#4ade80", bg: "rgba(74,222,128,0.16)", border: "rgba(74,222,128,0.5)" },
  { id: "suspicious", label: "Suspicious", color: "#f59e0b", bg: "rgba(245,158,11,0.16)", border: "rgba(245,158,11,0.5)" },
  { id: "aware", label: "Aware", color: "#f87171", bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.5)" },
];

/** Same mask used on the schedule. Color is the level: green, yellow, red. */
export function SubjectAwarenessControl({
  value,
  disabled,
  onChange,
}: {
  value: SubjectAwareness | null;
  disabled?: boolean;
  onChange: (next: SubjectAwareness) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5" role="group" aria-label="Subject awareness">
      {OPTIONS.map((opt) => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            title={opt.label}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-default",
              on ? "" : "border-[var(--color-line)] bg-[var(--color-ink-2)] text-[var(--color-text-mid)]",
              !disabled && !on && "hover:text-[var(--color-text-hi)]",
            )}
            style={on ? { color: opt.color, background: opt.bg, borderColor: opt.border } : undefined}
          >
            <VenetianMask size={15} strokeWidth={1.9} style={{ color: opt.color }} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
