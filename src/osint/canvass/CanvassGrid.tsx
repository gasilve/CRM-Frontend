import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { GridStack } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";
import type { CaseDetail } from "@/lib/crm-api";
import { useCanvassState } from "./useCanvassState";
import { CanvassSubjectPanel } from "./CanvassSubjectPanel";
import { CanvassFacilitiesPanel } from "./CanvassFacilitiesPanel";
import { CanvassResultsPanel } from "./CanvassResultsPanel";
import React from "react";

const CELL_H = 84;
const MARGIN = 8;
const COLS   = 12;
const ROWS   = 9;

const WIDGETS = [
  { id: "canvass-subject",    x: 0, y: 0, w: 3, h: 9, minW: 2, minH: 3 },
  { id: "canvass-facilities", x: 3, y: 0, w: 5, h: 9, minW: 3, minH: 3 },
  { id: "canvass-results",    x: 8, y: 0, w: 4, h: 9, minW: 2, minH: 3 },
];

export function CanvassGrid({ kase, ctx }: { kase: CaseDetail; ctx: CasePanelCtx }) {
  const hostRef  = useRef<HTMLDivElement>(null);
  const gridRef  = useRef<GridStack | null>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());

  const meta = (kase as any)._prodigy_meta ?? {
    claim_number: kase.claimNumber ?? null, body_parts: null,
    client_company: kase.client?.company ?? null,
    adjuster_name: kase.adjusterName ?? null,
  };

  const inv = {
    id: Number(kase.id),
    subject_name: kase.subjectName ?? "Unknown",
    subject_dob: kase.subjectDob ?? null,
    subject_ssn_last4: null,
    subject_addresses: (kase.addresses ?? []).map(a =>
      [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")
    ),
    subject_phones: (kase as any)._prodigy_phones ?? [],
    subject_aliases: null,
    extra_metadata: meta,
    investigation_type: (kase as any)._prodigy_type ?? "medical_canvass",
    case_types: (kase as any)._prodigy_case_types ?? ["medical_canvass"],
  };

  const state = useCanvassState(inv, meta, "/api-proxy");

  // Keep refs so renderCB closure always sees latest
  const stateRef = useRef(state);
  const ctxRef   = useRef(ctx);
  const invRef   = useRef(inv);
  const metaRef  = useRef(meta);
  stateRef.current = state;
  ctxRef.current   = ctx;
  invRef.current   = inv;
  metaRef.current  = meta;

  const renderPanel = (el: HTMLElement, id: string) => {
    let root = rootsRef.current.get(id);
    if (!root) { root = createRoot(el); rootsRef.current.set(id, root); }
    const s = stateRef.current;
    const i = invRef.current;
    const m = metaRef.current;
    const c = ctxRef.current;
    const node = (() => {
      if (id === "canvass-subject")    return <CanvassSubjectPanel ctx={c} inv={i} meta={m} state={s} />;
      if (id === "canvass-facilities") return <CanvassFacilitiesPanel state={s} />;
      if (id === "canvass-results")    return <CanvassResultsPanel state={s} inv={i} meta={m} />;
      return null;
    })();
    if (node) root.render(<div className="widget-frame h-full w-full"><div className="widget-body h-full w-full">{node}</div></div>);
  };

  // Re-render when state changes (facilities loaded, results updated)
  useEffect(() => {
    if (!hostRef.current) return;
    for (const id of rootsRef.current.keys()) {
      const el = hostRef.current.querySelector(
        `.grid-stack-item[gs-id="${id}"] .grid-stack-item-content`
      ) as HTMLElement | null;
      if (el) renderPanel(el, id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.facilities, state.loading, state.results, state.canvassAddress, state.activeTypes, state.radius]);

  // Init GridStack once
  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    let cancelled = false;

    // Clear any old content
    for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
    rootsRef.current.clear();
    hostEl.innerHTML = "";
    hostEl.classList.add("grid-stack");

    // Set global renderCB — called by GridStack for each widget
    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as string | null;
      if (id && !cancelled) renderPanel(el, id);
    };

    const grid = GridStack.init({
      column: COLS,
      cellHeight: designPx(CELL_H),
      margin: designPx(MARGIN),
      float: true,
      animate: false,
      maxRow: ROWS,
    }, hostEl);

    gridRef.current = grid;

    // Load all widgets
    grid.batchUpdate(true);
    grid.load(WIDGETS.map(w => ({
      id: w.id, x: w.x, y: w.y, w: w.w, h: w.h,
      minW: w.minW, minH: w.minH, maxW: COLS, maxH: ROWS,
    })));
    grid.batchUpdate(false);

    settleGridMetrics(grid, CELL_H, MARGIN);

    const onResize = () => { if (gridRef.current) settleGridMetrics(gridRef.current, CELL_H, MARGIN); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
      rootsRef.current.clear();
      try { grid.destroy(false); } catch { /**/ }
      gridRef.current = null;
    };
  }, [kase.id]); // eslint-disable-line

  const minH = ROWS * (designPx(CELL_H) + designPx(MARGIN)) + designPx(MARGIN);

  return (
    <div className="h-full w-full overflow-auto">
      <div ref={hostRef} style={{ minHeight: `${minH}px` }} />
    </div>
  );
}
