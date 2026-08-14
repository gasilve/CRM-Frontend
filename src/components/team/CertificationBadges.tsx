import { cn } from "@/lib/cn";
import type { Certification } from "@/lib/certifications";

export function CertificationBadges({
  items,
  max,
  size = "sm",
}: {
  items: Certification[];
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = max ? items.slice(0, max) : items;
  const overflow = max ? items.length - shown.length : 0;
  const dim = size === "sm" ? "h-6 w-6 text-[0.5625rem]" : "h-7 w-7 text-[0.625rem]";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((cert, i) => (
        <span
          key={`${cert.code}-${i}`}
          title={cert.label}
          className={cn("grid shrink-0 place-items-center rounded-[0.375rem] border font-semibold", dim)}
          style={{ background: `${cert.color}26`, borderColor: `${cert.color}55`, color: cert.color }}
        >
          {cert.code.slice(0, 2)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={`${overflow} more`}
          className={cn(
            "grid shrink-0 place-items-center rounded-[0.375rem] border border-[var(--color-line)] font-medium text-[var(--color-text-lo)]",
            dim,
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/** Full labelled list — used in detail views instead of the compact squares. */
export function CertificationList({ items }: { items: Certification[] }) {
  if (items.length === 0) {
    return <span className="text-[0.75rem] text-[var(--color-text-lo)]">No certifications on file</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((cert, i) => (
        <span
          key={`${cert.code}-${i}`}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.71875rem] font-medium"
          style={{ background: `${cert.color}1a`, borderColor: `${cert.color}45`, color: cert.color }}
        >
          <span
            className="grid h-4 w-4 shrink-0 place-items-center rounded-[0.25rem] text-[0.5rem] font-bold"
            style={{ background: cert.color, color: "#0b0f1a" }}
          >
            {cert.code.slice(0, 2)}
          </span>
          {cert.label}
        </span>
      ))}
    </div>
  );
}
