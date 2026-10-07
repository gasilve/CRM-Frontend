import { Phone, MapPin, Calendar, Hash, Building2, User, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";
import type { useCanvassState } from "./useCanvassState";

type State = ReturnType<typeof useCanvassState>;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      <span className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{value}</span>
    </div>
  );
}

export function CanvassSubjectPanel({ ctx, inv, meta, state }: {
  ctx: CasePanelCtx; inv: any; meta: any; state: State;
}) {
  const kase = ctx.case;
  const phones: string[] = inv.subject_phones ?? [];
  const addresses: string[] = (inv.subject_addresses ?? []).filter((a: string) =>
    a && a.length > 5 && !a.includes("people named") && !a.includes("RESIDES IN")
  );
  const [editingAddr, setEditingAddr] = useState(false);
  const [addrDraft, setAddrDraft] = useState(state.canvassAddress);

  const dob = inv.subject_dob
    ? new Date(inv.subject_dob + "T00:00:00").toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" })
    : null;

  return (
    <PanelShell title="Subject info" icon={<User size={11} strokeWidth={1.8} />}>
      <div className="flex flex-col gap-3">
        <Field label="Name"     value={kase.subjectName} />
        <Field label="DOB"      value={dob} />
        <Field label="Claim #"  value={meta?.claim_number ?? kase.claimNumber} />
        <Field label="Client"   value={meta?.client_company ?? kase.client?.company} />
        <Field label="Adjuster" value={meta?.adjuster_name ?? kase.adjusterName} />
        {meta?.body_parts && (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Body parts</span>
            <span className="text-[0.75rem] leading-snug text-[var(--color-text-hi)]">{meta.body_parts}</span>
          </div>
        )}

        {phones.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-[var(--color-line)] pt-3">
            <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Phones</span>
            {phones.map((ph, i) => (
              <a key={i} href={`tel:${ph.replace(/\D/g,"")}`}
                className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--color-accent)] hover:underline">
                <Phone size={12} className="shrink-0" />{ph}{i===0?" ★":""}
              </a>
            ))}
          </div>
        )}

        {/* All addresses — click to use for canvass */}
        {addresses.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-[var(--color-line)] pt-3">
            <span className="font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Addresses</span>
            {addresses.map((addr, i) => {
              const isActive = addr === state.canvassAddress;
              return (
                <button key={i} type="button"
                  onClick={() => state.setCanvassAddress(addr)}
                  className={"flex items-start gap-2 rounded-[0.5rem] border px-2.5 py-2 text-left transition-all " + (isActive
                    ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "border-[var(--color-line)] bg-transparent text-[var(--color-text-mid)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text-hi)]")}
                  title={isActive ? "Active address for canvass" : "Click to use for canvass"}
                >
                  <MapPin size={11} className="mt-0.5 shrink-0" />
                  <span className="text-[0.6875rem] leading-snug">{addr}</span>
                  {isActive && <span className="ml-auto shrink-0 font-mono text-[0.5rem] opacity-70">ACTIVE</span>}
                </button>
              );
            })}
            {/* Custom address */}
            {editingAddr ? (
              <div className="flex flex-col gap-1.5">
                <input
                  className="w-full rounded-[0.375rem] border border-[var(--color-accent)]/50 bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none"
                  value={addrDraft} onChange={e=>setAddrDraft(e.target.value)}
                  placeholder="Custom address…" autoFocus
                />
                <div className="flex gap-1.5">
                  <button onClick={()=>{state.setCanvassAddress(addrDraft);setEditingAddr(false);}}
                    className="flex flex-1 items-center justify-center gap-1 rounded-[0.375rem] bg-[var(--color-accent-soft)] py-1 text-[0.6875rem] text-[var(--color-text-hi)]">
                    <Check size={11}/>Apply
                  </button>
                  <button onClick={()=>setEditingAddr(false)}
                    className="rounded-[0.375rem] border border-[var(--color-line)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-mid)]">
                    <X size={11}/>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={()=>{setAddrDraft("");setEditingAddr(true);}}
                className="flex items-center gap-1.5 rounded-[0.5rem] border border-dashed border-[var(--color-line)] px-2.5 py-2 text-[0.625rem] text-[var(--color-text-lo)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]">
                <Edit2 size={10}/> Custom address…
              </button>
            )}
          </div>
        )}
      </div>
    </PanelShell>
  );
}
