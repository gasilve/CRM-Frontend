import { Bike, Bus, Car, Footprints } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SubjectTransport } from "@/lib/crm-api";

const OPTIONS: {
  id: SubjectTransport;
  label: string;
  title: string;
  icon: typeof Car;
  color: string;
  bg: string;
  border: string;
}[] = [
  { id: "vehicle", label: "Vehicle", title: "Car or truck", icon: Car, color: "#93c5fd", bg: "rgba(96,165,250,0.18)", border: "rgba(96,165,250,0.55)" },
  { id: "foot", label: "On foot", title: "Walking", icon: Footprints, color: "#fbbf24", bg: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.55)" },
  { id: "transit", label: "Transit", title: "Bus or public transit", icon: Bus, color: "#34d399", bg: "rgba(52,211,153,0.16)", border: "rgba(52,211,153,0.5)" },
  { id: "other", label: "Other", title: "Bike, skateboard, or similar", icon: Bike, color: "#c084fc", bg: "rgba(192,132,252,0.16)", border: "rgba(192,132,252,0.5)" },
];

export const transportLabel = (transport: SubjectTransport | null): string =>
  OPTIONS.find((opt) => opt.id === transport)?.label ?? "Not set";

/** Labeled choice for how the subject gets around. Clicking the active option clears it. */
export function SubjectMobilityControl({
  value,
  onChange,
}: {
  value: SubjectTransport | null;
  onChange: (next: SubjectTransport | null) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5" role="group" aria-label="How the subject gets around">
      {OPTIONS.map((opt) => {
        const on = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={on}
            title={opt.title}
            onClick={() => onChange(on ? null : opt.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[0.8125rem] font-medium transition-colors",
              on ? "" : "border-[var(--color-line)] bg-[var(--color-ink-2)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
            )}
            style={on ? { color: opt.color, background: opt.bg, borderColor: opt.border } : undefined}
          >
            <Icon size={15} strokeWidth={1.9} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only mobility chip. Hidden until how they get around is known. */
export function MobilityMark({ transport }: { transport: SubjectTransport | null }) {
  const opt = OPTIONS.find((o) => o.id === transport);
  if (!opt) return null;
  const Icon = opt.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold"
      style={{ color: opt.color, background: opt.bg, borderColor: opt.border }}
      title={opt.title}
    >
      <Icon size={11} strokeWidth={2} />
      {opt.label}
    </span>
  );
}
