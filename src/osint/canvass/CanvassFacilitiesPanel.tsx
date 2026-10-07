import { useState } from "react";
import { MapPin, Loader2, Phone, StickyNote, X, RotateCcw } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import { TYPE_CFG } from "./useCanvassState";
import type { Facility, useCanvassState } from "./useCanvassState";

type State = ReturnType<typeof useCanvassState>;

function TypeChip({ type, active, onClick }: { type: string; active: boolean; onClick: () => void }) {
  const cfg = TYPE_CFG[type];
  if (!cfg) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.625rem] font-medium transition-all"
      style={{
        background: active ? cfg.chipOnDark : "var(--color-ink-3)",
        color: active ? cfg.chipTextDark : "var(--color-text-lo)",
        border: `1px solid ${active ? cfg.dot + "44" : "var(--color-line)"}`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? cfg.dot : "currentColor", opacity: active ? 1 : 0.4 }} />
      {cfg.label}
    </button>
  );
}

function NoteModal({ facility, existing, onSave, onClose }: {
  facility: Facility; existing: string;
  onSave: (note: string) => void; onClose: () => void;
}) {
  const [note, setNote] = useState(existing);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="surface w-full max-w-sm rounded-[1rem] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">Note — {facility.name}</span>
          <button onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"><X size={14}/></button>
        </div>
        <textarea
          className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] p-2.5 text-[0.8125rem] text-[var(--color-text-hi)] focus:outline-none"
          rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note…" autoFocus
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-mid)]">Cancel</button>
          <button onClick={()=>{onSave(note);onClose();}} className="rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--color-text-hi)]">Save</button>
        </div>
      </div>
    </div>
  );
}

function FacilityRow({ f, state }: { f: Facility; state: State }) {
  const [showNote, setShowNote] = useState(false);
  const status = state.getFacStatus(f) as string;
  const note = state.getFacNote(f);
  const cfg = TYPE_CFG[f.type] ?? TYPE_CFG.other;

  return (
    <>
      {showNote && <NoteModal facility={f} existing={note} onSave={n=>state.saveNote(f,n)} onClose={()=>setShowNote(false)}/>}
      <div className="surface rounded-[0.625rem] p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: cfg.dot }} />
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-semibold text-[var(--color-text-hi)]">{f.name}</div>
            <div className="mt-0.5 text-[0.6875rem] text-[var(--color-text-mid)]">
              {[f.address, f.city, f.state].filter(Boolean).join(", ")}
              {f.distance_mi > 0 && ` · ${f.distance_mi.toFixed(1)} mi`}
            </div>
            {f.phone && (
              <a href={`tel:${f.phone.replace(/\D/g,"")}`} className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-[var(--color-accent)]">
                <Phone size={10}/>{f.phone}
              </a>
            )}
            {note && <div className="mt-1 text-[0.625rem] italic text-[var(--color-text-lo)]">{note}</div>}
          </div>
        </div>

        {status === "pending" && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button onClick={()=>state.markWithRecord(f,{record_name_variant:"",record_note:""})}
              className="rounded-[0.375rem] bg-[rgba(74,222,128,0.15)] px-2.5 py-1 text-[0.625rem] font-medium text-[#4ade80] border border-[rgba(74,222,128,0.3)]">
              ✓ With record
            </button>
            <button onClick={()=>state.markChartOnly(f,{has_type:"chart",notes:""})}
              className="rounded-[0.375rem] bg-[rgba(251,191,36,0.15)] px-2.5 py-1 text-[0.625rem] font-medium text-[#fbbf24] border border-[rgba(251,191,36,0.3)]">
              📄 Chart only
            </button>
            <button onClick={()=>state.markNoRecord(f)}
              className="rounded-[0.375rem] bg-[var(--color-ink-3)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--color-text-mid)] border border-[var(--color-line)]">
              ✕ No record
            </button>
            <button onClick={()=>setShowNote(true)}
              className="rounded-[0.375rem] bg-[var(--color-ink-3)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--color-text-mid)] border border-[var(--color-line)]">
              📝 Note
            </button>
          </div>
        )}

        {status !== "pending" && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[0.625rem] font-medium" style={{
              color: status==="with_record"?"#4ade80":status==="chart_only"?"#fbbf24":"var(--color-text-lo)"
            }}>
              {status==="with_record"?"✓ With record":status==="chart_only"?"📄 Chart only":"✕ No record"}
            </span>
            <button onClick={()=>state.markPending(f)} className="flex items-center gap-1 text-[0.5625rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]">
              <RotateCcw size={9}/>Undo
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function CanvassFacilitiesPanel({ state }: { state: State }) {
  const allTypes = Object.keys(TYPE_CFG).filter(k=>k!=="other");

  return (
    <PanelShell
      title="Facilities"
      icon={<MapPin size={11} strokeWidth={1.8}/>}
      action={
        <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">
          {state.facilities.length} total · {state.pending.length} pending
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Type filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {allTypes.map(type => (
            <TypeChip key={type} type={type}
              active={state.activeTypes.has(type)}
              onClick={()=>setActiveTypes(prev=>{
                const next=new Set(prev);
                next.has(type)?next.delete(type):next.add(type);
                return next;
              })}
            />
          ))}
        </div>

        {/* Radius slider */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">Radius</span>
          <input type="range" min={5} max={100} step={5} value={state.radius}
            onChange={e=>state.setRadius(Number(e.target.value))}
            onMouseUp={()=>state.setCommittedRadius(state.radius)}
            className="flex-1 accent-[var(--color-accent)]"
          />
          <span className="w-10 font-mono text-[0.5625rem] text-[var(--color-accent)]">{state.radius} mi</span>
        </div>

        {/* Address warning */}
        {state.addressChanged && (
          <div className="rounded-[0.5rem] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] p-2.5 text-[0.625rem] text-[#fbbf24]">
            ⚠ Facilities cached for a different address ({state.addressChanged.mi.toFixed(1)} mi away).
            <button onClick={state.invalidateCache} className="ml-2 underline">
              {state.invalidating?"Refreshing…":"Refresh"}
            </button>
          </div>
        )}

        {/* Facility list */}
        {state.loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[0.75rem] text-[var(--color-text-lo)]">
            <Loader2 size={14} className="animate-spin"/> Loading facilities…
          </div>
        ) : state.pending.length === 0 && state.facilities.length === 0 ? (
          <div className="py-8 text-center text-[0.75rem] text-[var(--color-text-lo)]">
            {state.canvassAddress ? "No facilities found — try increasing the radius" : "No address set for this case"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {state.pending.map(f=><FacilityRow key={f.id} f={f} state={state}/>)}
          </div>
        )}
      </div>
    </PanelShell>
  );

  function setActiveTypes(fn: (prev: Set<string>) => Set<string>) {
    state.setActiveTypes(fn);
  }
}
