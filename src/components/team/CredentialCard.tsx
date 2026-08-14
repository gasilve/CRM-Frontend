import { Award, BadgeCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Certification } from "@/lib/crm-api";

const DAY_MS = 86_400_000;

const fmt = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function expiryStatus(cert: Certification): { label: string; color: string } | null {
  if (!cert.expiresAt) return null;
  const days = Math.round((new Date(`${cert.expiresAt}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / DAY_MS);
  if (days < 0) return { label: "Expired", color: "#f87171" };
  if (days <= 60) return { label: `Expires in ${days}d`, color: "#fbbf24" };
  return null;
}

/** One certification or license, as a horizontal row card. */
export function CredentialCard({ cert, onRemove }: { cert: Certification; onRemove?: () => void }) {
  const color = cert.color ?? (cert.kind === "license" ? "#4ade80" : "#4a7fff");
  const Icon = cert.kind === "license" ? BadgeCheck : Award;
  const status = expiryStatus(cert);

  return (
    <div
      className="group flex items-center gap-3 rounded-[0.75rem] border p-3"
      style={{ borderColor: `${color}40`, background: `${color}0d` }}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem]"
        style={{ background: `${color}1f` }}
      >
        <Icon size={17} strokeWidth={1.7} style={{ color }} />
      </span>

      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-2">
          <span className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{cert.label}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider"
            style={{ background: `${color}1f`, color }}
          >
            {cert.kind}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {[cert.authority, cert.number].filter(Boolean).join(" · ") || "No details on file"}
        </div>
      </div>

      <div className="shrink-0 text-right leading-tight">
        {cert.issuedAt && (
          <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">issued {fmt(cert.issuedAt)}</div>
        )}
        {cert.expiresAt && (
          <div className={cn("font-mono text-[0.59375rem]", status ? "" : "text-[var(--color-text-mid)]")} style={status ? { color: status.color } : undefined}>
            expires {fmt(cert.expiresAt)}
          </div>
        )}
        {status && (
          <span
            className="mt-1 inline-block rounded-full px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider"
            style={{ background: `${status.color}1f`, color: status.color }}
          >
            {status.label}
          </span>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${cert.label}`}
          className="shrink-0 rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] opacity-0 transition-opacity hover:text-[var(--color-neg)] group-hover:opacity-100"
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
