/**
 * IntelGrid — 3-panel GridStack layout for the Intel tab.
 * Shows TLO data imported via Auto TLOxp: Vehicles, Criminal, Phone intel.
 */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { GridStack } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import { Car, AlertTriangle, Phone, Building2, Users } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { CaseDetail } from "@/lib/crm-api";
import React from "react";

const CELL_H = 84, MARGIN = 8, COLS = 12, ROWS = 9;

const WIDGETS = [
  { id: "intel-vehicles",  x: 0, y: 0, w: 4, h: 9, minW: 2, minH: 3 },
  { id: "intel-criminal",  x: 4, y: 0, w: 4, h: 9, minW: 2, minH: 3 },
  { id: "intel-phones",    x: 8, y: 0, w: 4, h: 9, minW: 2, minH: 3 },
];

// ── Vehicles panel ───────────────────────────────────────────────────────────
function VehiclesPanel({ kase }: { kase: CaseDetail }) {
  const meta = (kase as any)._prodigy_meta ?? {};
  const vehicles: any[] = meta.tlo_vehicles ?? [];

  return (
    <PanelShell title="Vehicles" icon={<Car size={11} strokeWidth={1.8} />}
      action={<span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{vehicles.length}</span>}>
      {vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Car size={22} className="text-[var(--color-text-lo)]" />
          <p className="text-[0.75rem] text-[var(--color-text-lo)]">No vehicles yet</p>
          <p className="text-[0.625rem] text-[var(--color-text-lo)]/60">Run Auto TLOxp with Vehicles selected</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {vehicles.map((v: any, i: number) => (
            <div key={i} className="surface rounded-[0.625rem] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[0.8125rem] font-semibold text-[var(--color-text-hi)]">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  </div>
                  <div className="mt-0.5 font-mono text-[0.625rem] text-[var(--color-accent)]">
                    {v.plate || v.vin?.slice(0, 10) || "—"}
                  </div>
                </div>
                {v.state && (
                  <span className="shrink-0 rounded-full border border-[var(--color-line)] px-2 py-0.5 font-mono text-[0.5625rem] text-[var(--color-text-mid)]">
                    {v.state}
                  </span>
                )}
              </div>
              {v.vin && (
                <div className="mt-1.5 font-mono text-[0.5rem] text-[var(--color-text-lo)]">VIN: {v.vin}</div>
              )}
              {v.color && (
                <div className="mt-0.5 text-[0.5625rem] text-[var(--color-text-mid)]">{v.color}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ── Criminal records panel ───────────────────────────────────────────────────
function CriminalPanel({ kase }: { kase: CaseDetail }) {
  const meta = (kase as any)._prodigy_meta ?? {};
  const records: any[] = meta.tlo_criminal_records ?? [];

  return (
    <PanelShell title="Criminal records" icon={<AlertTriangle size={11} strokeWidth={1.8} />}
      action={<span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{records.length}</span>}>
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <AlertTriangle size={22} className="text-[var(--color-text-lo)]" />
          <p className="text-[0.75rem] text-[var(--color-text-lo)]">No criminal records</p>
          <p className="text-[0.625rem] text-[var(--color-text-lo)]/60">Run Auto TLOxp with Criminal selected</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((cr: any, i: number) => (
            <div key={i} className="surface rounded-[0.625rem] border-l-2 border-[#ef4444]/60 p-3">
              <div className="text-[0.8125rem] font-semibold text-[var(--color-text-hi)]">
                {cr.offense || cr.charge || "Unknown charge"}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[0.5625rem] text-[var(--color-text-mid)]">
                {cr.date && <span>📅 {cr.date}</span>}
                {cr.state && <span>📍 {cr.state}</span>}
                {cr.disposition && <span className="text-[var(--color-text-lo)]">{cr.disposition}</span>}
              </div>
              {cr.case_number && (
                <div className="mt-1 font-mono text-[0.5rem] text-[var(--color-text-lo)]">#{cr.case_number}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ── Phone intel panel ────────────────────────────────────────────────────────
function PhoneIntelPanel({ kase }: { kase: CaseDetail }) {
  const meta = (kase as any)._prodigy_meta ?? {};
  const phones: any[] = (kase as any)._prodigy_phones ?? [];
  const phoneMeta: Record<string, number> = meta.subject_phones_meta ?? {};
  const relatives: any[] = meta.subject_relatives ?? [];
  const employers: any[] = meta.tlo_employers ?? [];

  return (
    <PanelShell title="Phone intel & relatives" icon={<Phone size={11} strokeWidth={1.8} />}>
      <div className="flex flex-col gap-4">
        {/* Phones */}
        {phones.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">Phones</div>
            <div className="flex flex-col gap-1.5">
              {phones.map((ph: string, i: number) => {
                const conf = phoneMeta[ph];
                return (
                  <a key={i} href={`tel:${ph.replace(/\D/g, "")}`}
                    className="flex items-center justify-between rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 hover:border-[var(--color-accent)]/50">
                    <div className="flex items-center gap-2">
                      <Phone size={11} className="text-[var(--color-accent)]" />
                      <span className="text-[0.75rem] font-medium text-[var(--color-text-hi)]">{ph}</span>
                    </div>
                    {conf !== undefined && (
                      <span className="font-mono text-[0.5625rem]"
                        style={{ color: conf >= 75 ? "#10b981" : conf >= 50 ? "#f59e0b" : "#ef4444" }}>
                        {conf}%
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Relatives */}
        {relatives.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              <Users size={10} className="inline mr-1" />Relatives
            </div>
            <div className="flex flex-col gap-1.5">
              {relatives.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2">
                  <span className="text-[0.75rem] text-[var(--color-text-hi)]">{r.name || r}</span>
                  {r.dob_year && <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">b. {r.dob_year}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employers */}
        {employers.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              <Building2 size={10} className="inline mr-1" />Employers
            </div>
            <div className="flex flex-col gap-1.5">
              {employers.map((e: any, i: number) => (
                <div key={i} className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2">
                  <div className="text-[0.75rem] font-medium text-[var(--color-text-hi)]">{e.name || e}</div>
                  {e.title && <div className="text-[0.5625rem] text-[var(--color-text-mid)]">{e.title}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {phones.length === 0 && relatives.length === 0 && employers.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Phone size={22} className="text-[var(--color-text-lo)]" />
            <p className="text-[0.75rem] text-[var(--color-text-lo)]">No intel yet</p>
            <p className="text-[0.625rem] text-[var(--color-text-lo)]/60">Run Auto TLOxp to populate</p>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

// ── Grid ─────────────────────────────────────────────────────────────────────
export function IntelGrid({ kase }: { kase: CaseDetail }) {
  const hostRef  = useRef<HTMLDivElement>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());
  const kaseRef  = useRef(kase);
  kaseRef.current = kase;

  const renderPanel = (el: HTMLElement, id: string) => {
    let root = rootsRef.current.get(id);
    if (!root) { root = createRoot(el); rootsRef.current.set(id, root); }
    const k = kaseRef.current;
    const node = (() => {
      if (id === "intel-vehicles") return <VehiclesPanel kase={k} />;
      if (id === "intel-criminal") return <CriminalPanel kase={k} />;
      if (id === "intel-phones")   return <PhoneIntelPanel kase={k} />;
      return null;
    })();
    if (node) root.render(<div className="widget-frame h-full w-full"><div className="widget-body h-full w-full">{node}</div></div>);
  };

  useEffect(() => {
    if (!hostRef.current) return;
    for (const id of rootsRef.current.keys()) {
      const el = hostRef.current.querySelector(`.grid-stack-item[gs-id="${id}"] .grid-stack-item-content`) as HTMLElement | null;
      if (el) renderPanel(el, id);
    }
  }, [(kase as any)._prodigy_meta, (kase as any)._prodigy_phones]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    let cancelled = false;
    for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
    rootsRef.current.clear();
    hostEl.innerHTML = "";
    hostEl.classList.add("grid-stack");
    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as string | null;
      if (id && !cancelled) renderPanel(el, id);
    };
    const grid = GridStack.init({
      column: COLS, cellHeight: designPx(CELL_H), margin: designPx(MARGIN),
      float: true, animate: false, maxRow: ROWS,
    }, hostEl);
    grid.batchUpdate(true);
    grid.load(WIDGETS.map(w => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: w.minW, minH: w.minH, maxW: COLS, maxH: ROWS })));
    grid.batchUpdate(false);
    settleGridMetrics(grid, CELL_H, MARGIN);
    const onResize = () => settleGridMetrics(grid, CELL_H, MARGIN);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
      rootsRef.current.clear();
      try { grid.destroy(false); } catch { /**/ }
    };
  }, [kase.id]); // eslint-disable-line

  const minH = ROWS * (designPx(CELL_H) + designPx(MARGIN)) + designPx(MARGIN);
  return (
    <div className="h-full w-full overflow-auto">
      <div ref={hostRef} style={{ minHeight: `${minH}px` }} />
    </div>
  );
}
