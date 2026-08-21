import { memo, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GridStack, type GridStackNode, type GridStackOptions } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import {
  CASE_CELL_HEIGHT,
  CASE_COLUMNS,
  CASE_GRID_MARGIN,
  CASE_PANELS,
  layoutToCaseGridWidgets,
  type CaseLayoutItem,
  type CasePanelCtx,
  type CasePanelId,
} from "./case-detail-widgets";

type GridHost = HTMLDivElement & { gridstack?: GridStack };

export type CaseDetailGridHandle = {
  getGrid: () => GridStack | null;
  getEl: () => HTMLDivElement | null;
};

type Props = {
  layout: CaseLayoutItem[];
  mountKey: string | number;
  ctx: CasePanelCtx;
  gridRef: React.MutableRefObject<CaseDetailGridHandle | null>;
  onLayoutPersist: (items: CaseLayoutItem[]) => void;
};

const panelRoots = new WeakMap<HTMLElement, Root>();
const hostById = new Map<CasePanelId, HTMLElement>();
const allRoots = new Set<Root>();
const pendingUnmounts = new Set<Root>();

function scheduleUnmount(root: Root) {
  if (pendingUnmounts.has(root)) return;
  pendingUnmounts.add(root);
  queueMicrotask(() => {
    pendingUnmounts.delete(root);
    try {
      root.unmount();
    } catch {
      /* node may already be gone */
    }
    allRoots.delete(root);
  });
}

function releaseHost(host: HTMLElement | null | undefined) {
  if (!host) return;
  const root = panelRoots.get(host);
  if (!root) return;
  panelRoots.delete(host);
  scheduleUnmount(root);
}

function unmountAll() {
  hostById.clear();
  const roots = [...allRoots];
  allRoots.clear();
  roots.forEach(scheduleUnmount);
}

function renderPanel(host: HTMLElement, id: CasePanelId, ctx: CasePanelCtx) {
  const def = CASE_PANELS[id];
  if (!def) return;

  const prev = hostById.get(id);
  if (prev && prev !== host) releaseHost(prev);
  hostById.set(id, host);

  let root = panelRoots.get(host);
  if (!root) {
    root = createRoot(host);
    panelRoots.set(host, root);
    allRoots.add(root);
  }

  root.render(
    <div className="widget-frame h-full w-full">
      <div className="widget-body h-full w-full">{def.render(ctx)}</div>
    </div>,
  );
}

function CaseDetailGridInner({
  layout,
  mountKey,
  ctx,
  gridRef,
  onLayoutPersist,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStack | null>(null);
  const layoutRef = useRef(layout);
  const ctxRef = useRef(ctx);
  const persistRef = useRef(onLayoutPersist);
  const initSettledRef = useRef(false);
  layoutRef.current = layout;
  ctxRef.current = ctx;
  persistRef.current = onLayoutPersist;

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    let cancelled = false;
    initSettledRef.current = false;

    unmountAll();

    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as CasePanelId | null;
      if (!id || !CASE_PANELS[id]) return;
      renderPanel(el, id, ctxRef.current);
    };

    const existing = (hostEl as GridHost).gridstack;
    if (existing) {
      try {
        existing.destroy(true);
      } catch {
        /* ignore */
      }
    }
    hostEl.innerHTML = "";
    hostEl.classList.add("grid-stack", "min-h-[30rem]", "dashboard-edit");

    const opts: GridStackOptions = {
      column: CASE_COLUMNS,
      cellHeight: designPx(CASE_CELL_HEIGHT),
      margin: designPx(CASE_GRID_MARGIN),
      float: true,
      animate: false,
      disableResize: false,
      disableDrag: false,
      draggable: { handle: ".widget-body", appendTo: "body" },
      resizable: { handles: "n,e,s,w,se,sw,ne,nw" },
    };

    const grid = GridStack.init(opts, hostEl);
    gridInstanceRef.current = grid;

    const widgets = layoutToCaseGridWidgets(layoutRef.current);
    if (widgets.length > 0) grid.load(widgets);
    settleGridMetrics(grid, CASE_CELL_HEIGHT, CASE_GRID_MARGIN);

    const syncCellMetrics = () => {
      settleGridMetrics(grid, CASE_CELL_HEIGHT, CASE_GRID_MARGIN);
    };
    window.addEventListener("resize", syncCellMetrics);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) initSettledRef.current = true;
      });
    });

    const nodesToLayout = (nodes: GridStackNode[]): CaseLayoutItem[] =>
      nodes
        .filter((n) => typeof n.id === "string" && n.id.length > 0)
        .map((n) => ({
          id: n.id as CasePanelId,
          x: n.x ?? 0,
          y: n.y ?? 0,
          w: n.w ?? 1,
          h: n.h ?? 1,
        }));

    const syncLayout = () => {
      if (cancelled || !initSettledRef.current) return;
      if (grid.isIgnoreChangeCB?.()) return;
      const items = nodesToLayout(grid.save(false) as GridStackNode[]);
      layoutRef.current = items;
      persistRef.current(items);
    };

    let syncQueued = false;
    const queueSync = () => {
      if (syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(() => {
        syncQueued = false;
        syncLayout();
      });
    };

    const onDragStart = () => {
      document.body.classList.add("dashboard-widget-dragging");
    };
    const onDragStop = () => {
      document.body.classList.remove("dashboard-widget-dragging");
      queueSync();
    };

    grid.on("dragstart", onDragStart);
    grid.on("dragstop", onDragStop);
    grid.on("resizestop", queueSync);

    gridRef.current = {
      getGrid: () => gridInstanceRef.current,
      getEl: () => hostRef.current,
    };

    return () => {
      cancelled = true;
      initSettledRef.current = false;
      window.removeEventListener("resize", syncCellMetrics);
      document.body.classList.remove("dashboard-widget-dragging");
      try {
        grid.off("dragstart");
        grid.off("dragstop");
        grid.off("resizestop");
      } catch {
        /* ignore */
      }
      try {
        grid.destroy(true);
      } catch {
        /* ignore */
      }
      gridInstanceRef.current = null;
      if (gridRef.current?.getEl() === hostEl) gridRef.current = null;
      unmountAll();
      if (GridStack.renderCB) {
        try {
          delete (GridStack as { renderCB?: unknown }).renderCB;
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via mountKey
  }, [mountKey, gridRef]);

  useEffect(() => {
    hostById.forEach((host, id) => {
      renderPanel(host, id, ctx);
    });
  }, [ctx.case.id, ctx]);

  return <div ref={hostRef} key={mountKey} className="case-detail-grid" />;
}

export const CaseDetailGrid = memo(CaseDetailGridInner);