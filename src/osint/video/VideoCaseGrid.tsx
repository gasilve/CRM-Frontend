import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { GridStack } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import type { CaseDetail } from "@/lib/crm-api";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";
import { useVideoState } from "./useVideoState";
import type { VideoRecord } from "./useVideoState";
import { VideoCaseInfoPanel } from "./VideoCaseInfoPanel";
import { VideoRecordsPanel } from "./VideoRecordsPanel";
import { VideoDetailPanel } from "./VideoDetailPanel";
import { VideoHighlightsPanel } from "./VideoHighlightsPanel";
import React from "react";

const CELL_H = 84;
const MARGIN = 8;
const COLS   = 12;
const ROWS   = 9;

const WIDGETS = [
  { id: "video-case-info",   x: 0, y: 0, w: 2, h: 9, minW: 2, minH: 3 },
  { id: "video-records",     x: 2, y: 0, w: 3, h: 9, minW: 2, minH: 3 },
  { id: "video-detail",      x: 5, y: 0, w: 4, h: 9, minW: 3, minH: 3 },
  { id: "video-highlights",  x: 9, y: 0, w: 3, h: 9, minW: 2, minH: 3 },
];

export function VideoCaseGrid({ kase, ctx }: { kase: CaseDetail; ctx: CasePanelCtx }) {
  const hostRef  = useRef<HTMLDivElement>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());
  const [selectedRecord, setSelectedRecord] = useState<VideoRecord | null>(null);

  const state = useVideoState(Number(kase.id));

  const stateRef  = useRef(state);
  const kaseRef   = useRef(kase);
  const selRef    = useRef(selectedRecord);
  const selSetRef = useRef(setSelectedRecord);
  stateRef.current  = state;
  kaseRef.current   = kase;
  selRef.current    = selectedRecord;

  const renderPanel = (el: HTMLElement, id: string) => {
    let root = rootsRef.current.get(id);
    if (!root) { root = createRoot(el); rootsRef.current.set(id, root); }
    const s = stateRef.current;
    const k = kaseRef.current;
    const sel = selRef.current;
    const node = (() => {
      if (id === "video-case-info") return <VideoCaseInfoPanel kase={k} records={s.records} />;
      if (id === "video-records")   return <VideoRecordsPanel state={s} selectedId={sel?.id ?? null} onSelect={r => { selRef.current = r; selSetRef.current(r); }} />;
      if (id === "video-detail")    return <VideoDetailPanel record={sel} state={s} />;
      if (id === "video-highlights") return <VideoHighlightsPanel kase={k} invId={Number(k.id)} />;
      return null;
    })();
    if (node) root.render(<div className="widget-frame h-full w-full"><div className="widget-body h-full w-full">{node}</div></div>);
  };

  // Re-render panels when state changes — dep array prevents runaway renders
  useEffect(() => {
    if (!hostRef.current) return;
    for (const id of rootsRef.current.keys()) {
      const el = hostRef.current.querySelector(
        `.grid-stack-item[gs-id="${id}"] .grid-stack-item-content`
      ) as HTMLElement | null;
      if (el) renderPanel(el, id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.records, state.loading, state.uploading, state.uploadMsg, selectedRecord]);

  // Init GridStack once
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
      column: COLS,
      cellHeight: designPx(CELL_H),
      margin: designPx(MARGIN),
      float: true,
      animate: false,
      maxRow: ROWS,
    }, hostEl);

    grid.batchUpdate(true);
    grid.load(WIDGETS.map(w => ({
      id: w.id, x: w.x, y: w.y, w: w.w, h: w.h,
      minW: w.minW, minH: w.minH, maxW: COLS, maxH: ROWS,
    })));
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
