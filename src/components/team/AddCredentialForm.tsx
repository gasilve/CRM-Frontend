import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Certification } from "@/lib/crm-api";

export const fieldClass =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]";
export const fieldLabelClass =
  "mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]";

const CRED_COLORS = ["#4a7fff", "#4ade80", "#f59e0b", "#a78bfa", "#22d3ee", "#f472b6", "#fb923c", "#34d399"];

/** Inline form for adding one certification or license to a credentials list. */
export function AddCredentialForm({ onAdd, onCancel }: { onAdd: (cert: Certification) => void; onCancel: () => void }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"certification" | "license">("license");
  const [authority, setAuthority] = useState("");
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!label.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      label: label.trim(),
      kind,
      authority: authority.trim() || null,
      number: number.trim() || null,
      issuedAt: issuedAt || null,
      expiresAt: expiresAt || null,
      color: CRED_COLORS[Math.floor(Math.random() * CRED_COLORS.length)],
    });
  };

  return (
    <form onSubmit={submit} className="surface flex flex-col gap-3 rounded-[0.75rem] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabelClass} htmlFor="cred-label">Name</label>
          <input id="cred-label" required autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={fieldClass} placeholder="PI License, Surveillance…" />
        </div>
        <div>
          <span className={fieldLabelClass}>Type</span>
          <div className="flex gap-1.5">
            {(["license", "certification"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 rounded-[0.5rem] border px-3 py-2 text-[0.71875rem] capitalize transition-colors",
                  kind === k
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="cred-authority">Issuing authority</label>
          <input id="cred-authority" value={authority} onChange={(e) => setAuthority(e.target.value)} className={fieldClass} placeholder="State of New Jersey" />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="cred-number">Number</label>
          <input id="cred-number" value={number} onChange={(e) => setNumber(e.target.value)} className={fieldClass} placeholder="PI-004182" />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="cred-issued">Issued</label>
          <input id="cred-issued" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={fieldLabelClass} htmlFor="cred-expires">Expires</label>
          <input id="cred-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
        >
          <Plus size={13} strokeWidth={1.8} />
          Add
        </button>
      </div>
    </form>
  );
}
