import { memo, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GridStack, type GridStackNode, type GridStackOptions } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import {
  CASE_CELL_HEIGHT,
  CASE_COLUMNS,
  CASE_GRID_MARGIN,
  CASE_PAGE_ROWS,
  CASE_PANELS,
  itemsForPage,
  layoutToCaseGridWidgets,
  type CaseLayoutItem,
  type CasePage,
  type CasePanelCtx,
  type CasePanelId,
} from "./case-detail-widgets";

export type CaseDetailGridHandle = {
  getGrid: () => GridStack | null;
  getEl: () => HTMLDivElement | null;
};

/** How close to the shell's edge (px) counts as "trying to leave this page". */
const EDGE_PX = 72;
/** How long a widget has to hover at the edge before the page flips. */
const EDGE_DWELL_MS = 320;

type Props = {
  pages: CasePage[];
  activePageId: string;
  onActivePageChange: (pageId: string) => void;
  /** All widgets across every page — each grid filters its own slice. */
  layout: CaseLayoutItem[];
  mountKey: string | number;
  ctx: CasePanelCtx;
  gridRef: React.MutableRefObject<CaseDetailGridHandle | null>;
  /** Called (debounced) with the full cross-page item list whenever anything settles. */
  onLayoutPersist: (items: CaseLayoutItem[]) => void;
  editable?: boolean;
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

export function caseGridShellHeightPx(): number {
  const cell = designPx(CASE_CELL_HEIGHT);
  const margin = designPx(CASE_GRID_MARGIN);
  return CASE_PAGE_ROWS * (cell + margin) + margin;
}

function nodesToLayout(nodes: GridStackNode[], pageId: string): CaseLayoutItem[] {
  return nodes
    .filter((n) => typeof n.id === "string" && n.id.length > 0)
    .map((n) => ({
      id: n.id as CasePanelId,
      pageId,
      x: n.x ?? 0,
      y: n.y ?? 0,
      w: n.w ?? 1,
      h: n.h ?? 1,
    }));
}

function CaseDetailGridInner({
  pages,
  activePageId,
  onActivePageChange,
  layout,
  mountKey,
  ctx,
  gridRef,
  onLayoutPersist,
  editable = false,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hostElsRef = useRef(new Map<string, HTMLDivElement>());
  const gridsRef = useRef(new Map<string, GridStack>());
  const initPageRef = useRef<((pageId: string, hostEl: HTMLDivElement) => void) | null>(null);

  const pagesRef = useRef(pages);
  const activePageIdRef = useRef(activePageId);
  const layoutRef = useRef(layout);
  const ctxRef = useRef(ctx);
  const persistRef = useRef(onLayoutPersist);
  const onActivePageChangeRef = useRef(onActivePageChange);
  pagesRef.current = pages;
  activePageIdRef.current = activePageId;
  layoutRef.current = layout;
  ctxRef.current = ctx;
  persistRef.current = onLayoutPersist;
  onActivePageChangeRef.current = onActivePageChange;

  // Slide the track whenever the active page changes (tab click, or an
  // edge-hold flip during a drag) — this is the carousel motion.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const idx = Math.max(0, pages.findIndex((p) => p.id === activePageId));
    track.style.left = `-${idx * 100}%`;
  }, [activePageId, pages]);

  // Full (re)build — case switch, edit-mode switch, or an external layout
  // refresh. Every page's grid is created up front and stays mounted for the
  // carousel's lifetime so dragging a widget across pages is a native
  // GridStack cross-grid drop, not a remount.
  useEffect(() => {
    const shellEl = shellRef.current;
    if (!shellEl) return;
    let cancelled = false;

    unmountAll();

    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as CasePanelId | null;
      if (!id || !CASE_PANELS[id]) return;
      renderPanel(el, id, ctxRef.current);
    };

    for (const grid of gridsRef.current.values()) {
      try {
        grid.destroy(true);
      } catch {
        /* ignore */
      }
    }
    gridsRef.current.clear();

    const settled = new Map<string, boolean>();
    let dwellTimer: number | null = null;
    let dwellDir: "prev" | "next" | null = null;
    let edgeLatched = false;
    let dragActive = false;

    const clearDwell = () => {
      if (dwellTimer !== null) {
        window.clearTimeout(dwellTimer);
        dwellTimer = null;
      }
      dwellDir = null;
    };

    const resetDrag = () => {
      clearDwell();
      edgeLatched = false;
      shellEl.dataset.edge = "";
    };

    const neighborPageId = (dir: "prev" | "next"): string | null => {
      const list = pagesRef.current ?? [];
      const idx = list.findIndex((p) => p.id === activePageIdRef.current);
      if (idx < 0) return null;
      const targetIdx = dir === "prev" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return null;
      return list[targetIdx].id;
    };

    const updateEdgeHint = (clientX: number) => {
      if (!dragActive) return;
      const rect = shellEl.getBoundingClientRect();
      let dir: "prev" | "next" | null = null;
      if (clientX <= rect.left + EDGE_PX) dir = "prev";
      else if (clientX >= rect.right - EDGE_PX) dir = "next";
      shellEl.dataset.edge = dir ?? "";

      if (!dir) {
        clearDwell();
        edgeLatched = false;
        return;
      }
      // One flip per edge visit — otherwise the cursor, still parked at the
      // edge of the page it just landed on, would immediately flip onward and
      // you could never drop a widget near an edge.
      if (edgeLatched || dir === dwellDir) return;
      clearDwell();
      dwellDir = dir;
      dwellTimer = window.setTimeout(() => {
        dwellTimer = null;
        if (cancelled || !dragActive) return;
        edgeLatched = true;
        const target = neighborPageId(dir);
        if (target) onActivePageChangeRef.current(target);
      }, EDGE_DWELL_MS);
    };

    // GridStack's own 'drag' event only fires when the widget actually lands
    // on a new cell, so it goes quiet exactly when you park a widget against
    // the edge. Track the pointer ourselves for the whole gesture instead.
    const onPointerMove = (ev: PointerEvent) => updateEdgeHint(ev.clientX);

    let syncQueued = false;
    const resyncAll = () => {
      if (cancelled) return;
      // Only persist once every currently mounted page has finished its
      // initial settle — otherwise a page still loading would read back as
      // empty and we'd wipe its widgets from the saved document.
      for (const grid of gridsRef.current.values()) {
        if (grid.isIgnoreChangeCB?.()) return;
      }
      for (const pid of gridsRef.current.keys()) {
        if (!settled.get(pid)) return;
      }
      const items: CaseLayoutItem[] = [];
      for (const [pid, grid] of gridsRef.current) {
        items.push(...nodesToLayout(grid.save(false) as GridStackNode[], pid));
      }
      layoutRef.current = items;
      persistRef.current(items);
    };
    const queueSync = () => {
      if (syncQueued) return;
      syncQueued = true;
      requestAnimationFrame(() => {
        syncQueued = false;
        resyncAll();
      });
    };

    const endDragTracking = (sync = false) => {
      if (!dragActive) return;
      dragActive = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.classList.remove("dashboard-widget-dragging");
      resetDrag();
      if (sync) queueSync();
    };

    const onPointerUp = () => endDragTracking(true);

    const beginDragTracking = () => {
      dragActive = true;
      document.body.classList.add("dashboard-widget-dragging");
      resetDrag();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    const buildOpts = (): GridStackOptions => ({
      column: CASE_COLUMNS,
      cellHeight: designPx(CASE_CELL_HEIGHT),
      margin: designPx(CASE_GRID_MARGIN),
      float: true,
      animate: false,
      // Hard cap: a page is exactly one screen, so nothing may grow or be
      // dragged past it (widgets also carry maxH for the resize handles).
      maxRow: CASE_PAGE_ROWS,
      disableResize: !editable,
      disableDrag: !editable,
      ...(editable
        ? {
            draggable: { handle: ".widget-body", appendTo: "body" },
            resizable: { handles: "n,e,s,w,se,sw,ne,nw" },
            acceptWidgets: true,
          }
        : {}),
    });

    const attachGridEvents = (grid: GridStack) => {
      if (!editable) return;
      grid.on("dragstart", beginDragTracking);
      grid.on("dragstop", () => endDragTracking(true));
      grid.on("resizestop", queueSync);
      grid.on("change", queueSync);
      grid.on("added", queueSync);
      grid.on("removed", queueSync);
    };

    const detachGridEvents = (grid: GridStack) => {
      try {
        grid.off("dragstart");
        grid.off("dragstop");
        grid.off("resizestop");
        grid.off("change");
        grid.off("added");
        grid.off("removed");
      } catch {
        /* ignore */
      }
    };

    const initPage = (pageId: string, hostEl: HTMLDivElement) => {
      hostEl.innerHTML = "";
      hostEl.classList.add("grid-stack", "h-full");
      if (editable) hostEl.classList.add("dashboard-edit");

      const grid = GridStack.init(buildOpts(), hostEl);
      gridsRef.current.set(pageId, grid);
      settled.set(pageId, false);

      const items = itemsForPage(layoutRef.current, pageId);
      const widgets = layoutToCaseGridWidgets(items);
      if (widgets.length > 0) grid.load(widgets);
      settleGridMetrics(grid, CASE_CELL_HEIGHT, CASE_GRID_MARGIN);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) settled.set(pageId, true);
        });
      });

      attachGridEvents(grid);
    };

    initPageRef.current = initPage;

    for (const page of pagesRef.current ?? []) {
      const hostEl = hostElsRef.current.get(page.id);
      if (hostEl) initPage(page.id, hostEl);
    }

    const onResize = () => {
      for (const grid of gridsRef.current.values()) {
        settleGridMetrics(grid, CASE_CELL_HEIGHT, CASE_GRID_MARGIN);
      }
    };
    window.addEventListener("resize", onResize);

    gridRef.current = {
      getGrid: () => gridsRef.current.get(activePageIdRef.current) ?? null,
      getEl: () => hostElsRef.current.get(activePageIdRef.current) ?? null,
    };

    return () => {
      cancelled = true;
      dragActive = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.classList.remove("dashboard-widget-dragging");
      resetDrag();
      window.removeEventListener("resize", onResize);
      initPageRef.current = null;
      for (const grid of gridsRef.current.values()) {
        detachGridEvents(grid);
        try {
          grid.destroy(true);
        } catch {
          /* ignore */
        }
      }
      gridsRef.current.clear();
      gridRef.current = null;
      unmountAll();
      if (GridStack.renderCB) {
        try {
          delete (GridStack as { renderCB?: unknown }).renderCB;
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- full rebuild via mountKey only
  }, [mountKey, gridRef, editable]);

  // Mount/unmount individual pages (add/remove page) without disturbing the
  // other pages' already-live grids.
  useEffect(() => {
    const currentIds = new Set(pages.map((p) => p.id));
    for (const [pid, grid] of [...gridsRef.current]) {
      if (currentIds.has(pid)) continue;
      try {
        grid.destroy(true);
      } catch {
        /* ignore */
      }
      gridsRef.current.delete(pid);
      hostElsRef.current.delete(pid);
    }
    for (const page of pages) {
      if (gridsRef.current.has(page.id)) continue;
      const hostEl = hostElsRef.current.get(page.id);
      if (hostEl) initPageRef.current?.(page.id, hostEl);
    }
  }, [pages]);

  useEffect(() => {
    hostById.forEach((host, id) => {
      renderPanel(host, id, ctx);
    });
  }, [ctx.case.id, ctx]);

  const height = caseGridShellHeightPx();

  return (
    <div
      ref={shellRef}
      className="case-detail-grid-shell relative"
      style={{ height, maxHeight: height }}
    >
      <div
        className="edge-hint edge-hint-prev pointer-events-none absolute inset-y-0 left-0 z-20 w-14 bg-gradient-to-r from-[var(--color-accent)]/25 to-transparent"
        aria-hidden
      />
      <div
        className="edge-hint edge-hint-next pointer-events-none absolute inset-y-0 right-0 z-20 w-14 bg-gradient-to-l from-[var(--color-accent)]/25 to-transparent"
        aria-hidden
      />
      <div ref={trackRef} className="case-detail-track" style={{ width: `${pages.length * 100}%` }}>
        {pages.map((page) => (
          <div
            key={page.id}
            className="case-detail-track-page"
            style={{ width: `${100 / pages.length}%` }}
          >
            <div
              ref={(el) => {
                if (el) hostElsRef.current.set(page.id, el);
                else hostElsRef.current.delete(page.id);
              }}
              className="case-detail-grid h-full overflow-hidden"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const CaseDetailGrid = memo(CaseDetailGridInner);
