import { memo, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GridStack, type GridStackNode, type GridStackOptions } from "gridstack";
import { designPx } from "@/lib/rem";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { WidgetSizeProvider } from "@/lib/widget-size";
import {
  getWidgetBridge,
  subscribeWidgetBridge,
  WidgetTreeProviders,
} from "@/lib/widget-bridge";
import { WidgetErrorBoundary } from "@/components/widgets/WidgetErrorBoundary";
import {
  canPlaceAtY,
  clampY,
  gridMaxRow,
  packLayoutWithinMaxRows,
} from "./dashboard-grid-layout";
import {
  CELL_HEIGHT,
  COLUMNS,
  GRID_MARGIN,
  WIDGETS,
  dashboardBoardHeightPx,
  layoutToGridWidgets,
  widgetFootprint,
  type LayoutItem,
  type WidgetId,
} from "./dashboard-widgets";

type GridHost = HTMLDivElement & { gridstack?: GridStack };
type GridItemEl = HTMLElement & { gridstackNode?: GridStackNode };

export type DashboardGridHandle = {
  getGrid: () => GridStack | null;
  getEl: () => HTMLDivElement | null;
  releaseWidgetRoot: (id: WidgetId) => void;
  /**
   * Update the sync baseline *before* an intentional remove. Without this,
   * GridStack's `removed` → syncLayout sees a shrink vs a stale layoutRef and
   * re-adds the widget (trash appears broken).
   */
  syncLayoutBaseline: (items: LayoutItem[]) => void;
  /** Dock drag in flight — show where it would land if Gridstack isn't already. */
  previewDockDrop: (id: WidgetId, clientX: number, clientY: number) => void;
  clearDockPreview: () => void;
  /** Place a dock widget ourselves. No-op when Gridstack already handled the drop. */
  dropDockWidget: (id: WidgetId, clientX: number, clientY: number) => boolean;
};

type Props = {
  layout: LayoutItem[];
  mountKey: string | number;
  gridRef: React.MutableRefObject<DashboardGridHandle | null>;
  onLayoutPersist: (items: LayoutItem[]) => void;
  onWidgetDragStart?: (id: WidgetId | null) => void;
  onWidgetDragStop?: (id: WidgetId | null) => void;
  onAfterExternalDrop?: () => void;
};

/** One React root per mount host — never keyed by widget id alone */
const widgetRoots = new WeakMap<HTMLElement, Root>();
const hostById = new Map<WidgetId, HTMLElement>();
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
      /* Gridstack may have already removed the mount node */
    }
    allRoots.delete(root);
  });
}

function releaseWidgetHost(host: HTMLElement | null | undefined) {
  if (!host) return;
  const root = widgetRoots.get(host);
  if (!root) return;
  widgetRoots.delete(host);
  scheduleUnmount(root);
}

function releaseWidgetRoot(id: WidgetId) {
  const host = hostById.get(id);
  if (!host) return;
  hostById.delete(id);
  releaseWidgetHost(host);
}

function unmountAllWidgetRoots() {
  hostById.clear();
  const roots = [...allRoots];
  allRoots.clear();
  roots.forEach(scheduleUnmount);
}

function getContentHost(itemEl: HTMLElement): HTMLElement {
  const content = itemEl.querySelector(":scope > .grid-stack-item-content");
  return (content as HTMLElement | null) ?? itemEl;
}

function renderWidgetContent(host: HTMLElement, id: WidgetId) {
  const def = WIDGETS[id];
  if (!def) return;

  const prevHost = hostById.get(id);
  if (prevHost && prevHost !== host) {
    releaseWidgetHost(prevHost);
  }
  hostById.set(id, host);

  let root = widgetRoots.get(host);
  if (!root) {
    root = createRoot(host);
    widgetRoots.set(host, root);
    allRoots.add(root);
  }

  // Key resets the error boundary after the auth/navigate bridge becomes ready
  // (first paint can race sync and leave widgets stuck on the failed state).
  const bridgeKey = getWidgetBridge() ? "ready" : "pending";

  root.render(
    <div className="widget-frame h-full w-full">
      <div className="widget-body h-full w-full">
        <WidgetErrorBoundary key={bridgeKey} name={id}>
          <WidgetTreeProviders>
            <WidgetSizeProvider>{def.render()}</WidgetSizeProvider>
          </WidgetTreeProviders>
        </WidgetErrorBoundary>
      </div>
    </div>,
  );
}

function rerenderAllWidgetHosts() {
  for (const [id, host] of hostById) {
    if (widgetRoots.has(host)) renderWidgetContent(host, id);
  }
}

/** Imperative Gridstack host — never re-renders when parent toggles edit/dock UI */
function DashboardGridInner({
  layout,
  mountKey,
  gridRef,
  onLayoutPersist,
  onWidgetDragStart,
  onWidgetDragStop,
  onAfterExternalDrop,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStack | null>(null);
  const initSettledRef = useRef(false);
  const previewDockRef = useRef<DashboardGridHandle["previewDockDrop"] | null>(null);
  const clearPreviewRef = useRef<DashboardGridHandle["clearDockPreview"] | null>(null);
  const dropDockRef = useRef<DashboardGridHandle["dropDockWidget"] | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onLayoutPersistRef = useRef(onLayoutPersist);
  onLayoutPersistRef.current = onLayoutPersist;
  const onDragStartRef = useRef(onWidgetDragStart);
  const onDragStopRef = useRef(onWidgetDragStop);
  const onAfterDropRef = useRef(onAfterExternalDrop);
  onDragStartRef.current = onWidgetDragStart;
  onDragStopRef.current = onWidgetDragStop;
  onAfterDropRef.current = onAfterExternalDrop;

  useEffect(() => {
    gridRef.current = {
      getGrid: () => gridInstanceRef.current,
      getEl: () => hostRef.current,
      releaseWidgetRoot,
      syncLayoutBaseline: (items) => {
        layoutRef.current = items;
      },
      previewDockDrop: (id, x, y) => previewDockRef.current?.(id, x, y),
      clearDockPreview: () => clearPreviewRef.current?.(),
      dropDockWidget: (id, x, y) => dropDockRef.current?.(id, x, y) ?? false,
    };
    return () => {
      gridRef.current = null;
    };
  }, [gridRef]);

  // Keep baseline current even when mountKey is unchanged (memo used to skip
  // re-renders on layout-only updates — that broke intentional deletes).
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;

    let cancelled = false;
    initSettledRef.current = false;

    unmountAllWidgetRoots();

    const unsubBridge = subscribeWidgetBridge(() => {
      if (!cancelled) rerenderAllWidgetHosts();
    });

    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as WidgetId | null;
      if (!id || !WIDGETS[id]) return;
      renderWidgetContent(el, id);
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
      column: COLUMNS,
      cellHeight: designPx(CELL_HEIGHT),
      margin: designPx(GRID_MARGIN),
      float: true,
      animate: false,
      maxRow: gridMaxRow(layoutRef.current),
      // Dock cards are NOT .grid-stack-item, so `true` would reject them.
      // Accept both dock cards and real items.
      acceptWidgets: (el: Element) =>
        el.classList.contains("dock-carousel-item") ||
        el.classList.contains("grid-stack-item"),
      disableResize: false,
      disableDrag: false,
      draggable: {
        handle: ".widget-shell-header",
        cancel: ".widget-shell-body,input,textarea,button,a,select",
        appendTo: "body",
      },
      resizable: { handles: "n,e,s,w,se,sw,ne,nw" },
    };

    const grid = GridStack.init(opts, hostEl);
    gridInstanceRef.current = grid;

    const widgets = layoutToGridWidgets(packLayoutWithinMaxRows(layoutRef.current));
    if (widgets.length > 0) {
      try {
        grid.batchUpdate(true);
        grid.load(widgets);
        grid.batchUpdate(false);
      } catch (err) {
        console.warn("[dashboard] grid.load failed — retrying without maxRow", err);
        grid.engine.maxRow = 0;
        grid.batchUpdate(true);
        grid.load(widgets);
        grid.batchUpdate(false);
        grid.engine.maxRow = gridMaxRow(layoutRef.current);
      }
    }
    grid.engine.maxRow = gridMaxRow(layoutRef.current);
    settleGridMetrics(grid, CELL_HEIGHT, GRID_MARGIN);

    const syncCellMetrics = () => {
      settleGridMetrics(grid, CELL_HEIGHT, GRID_MARGIN);
    };
    window.addEventListener("resize", syncCellMetrics);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) initSettledRef.current = true;
      });
    });

    let syncQueued = false;
    let replacingDockDrop = false;
    const placedDockIds = new Set<string>();
    /** Ignore GridStack churn right after load — it can report a partial node
     *  list and we must not persist that (it silently deletes widgets). */
    let persistUnlocked = false;
    const unlockPersist = window.setTimeout(() => {
      persistUnlocked = true;
    }, 1500);

    const nodesToLayout = (nodes: GridStackNode[]): LayoutItem[] =>
      nodes
        .filter((n) => typeof n.id === "string" && n.id.length > 0)
        .map((n) => ({
          id: n.id as WidgetId,
          x: n.x ?? 0,
          y: n.y ?? 0,
          w: n.w ?? 1,
          h: n.h ?? 1,
        }));

    const applyMaxRow = (items: LayoutItem[]) => {
      grid.engine.maxRow = gridMaxRow(items);
    };

    let isDraggingWidget = false;

    const cancelActiveDrag = () => {
      hostEl.classList.remove("dashboard-placement-invalid");
      document.body.classList.remove("dashboard-widget-dragging");
      (grid as GridStack & { cancelDrag: () => void }).cancelDrag();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      isDraggingWidget = false;
      onDragStopRef.current?.(null);
    };

    const onCancelDragPointer = (e: PointerEvent | MouseEvent) => {
      if (e.button !== 2) return;
      const dragging =
        isDraggingWidget ||
        !!hostEl.querySelector(".grid-stack-placeholder") ||
        !!document.querySelector(".ui-draggable-dragging");
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      cancelActiveDrag();
    };

    const revertNode = (el: HTMLElement, node: GridStackNode) => {
      const orig = (node as GridStackNode & { _orig?: GridStackNode })._orig;
      if (!orig || orig.x == null || orig.y == null) return;
      grid.update(el, {
        x: orig.x,
        y: orig.y,
        w: orig.w ?? node.w,
        h: orig.h ?? node.h,
      });
    };

    const updatePlacementValidity = () => {
      const placeholder = grid.el.querySelector(
        ".grid-stack-placeholder",
      ) as (HTMLElement & { gridstackNode?: GridStackNode }) | null;
      const phNode = placeholder?.gridstackNode;
      if (!placeholder || !phNode || phNode.y == null) {
        hostEl.classList.remove("dashboard-placement-invalid");
        return true;
      }
      const layout = nodesToLayout(grid.save(false) as GridStackNode[]);
      const valid = canPlaceAtY(layout, phNode.y);
      hostEl.classList.toggle("dashboard-placement-invalid", !valid);
      return valid;
    };

    const syncLayout = () => {
      if (cancelled || !initSettledRef.current || replacingDockDrop) return;
      if (!persistUnlocked) return;
      if (grid.isIgnoreChangeCB?.()) return;
      if (
        isDraggingWidget &&
        hostEl.classList.contains("dashboard-placement-invalid")
      ) {
        return;
      }
      if (syncQueued) return;
      syncQueued = true;
      queueMicrotask(() => {
        syncQueued = false;
        if (cancelled || !initSettledRef.current || replacingDockDrop || !persistUnlocked) return;
        const nodes = grid.save(false) as GridStackNode[];
        const next = nodesToLayout(nodes);
        const prev = layoutRef.current;
        // GridStack occasionally reports a truncated node list after remount /
        // collision resolution. Persisting that deletes widgets from the user's
        // saved layout (dock then says "all widgets are on the dashboard" while
        // half of them are gone from the grid). Refuse mysterious shrinks —
        // intentional removes update layoutRef first via removeWidget/persist.
        if (prev.length > 0 && next.length < prev.length) {
          const nextIds = new Set(next.map((i) => i.id));
          const missing = prev.filter((i) => !nextIds.has(i.id));
          console.warn(
            `[dashboard] grid lost ${missing.length} widget(s) — restoring instead of persisting. Missing:`,
            missing.map((m) => m.id),
          );
          replacingDockDrop = true;
          try {
            const restored = packLayoutWithinMaxRows([...next, ...missing]);
            for (const item of restored) {
              if (nextIds.has(item.id)) continue;
              const def = WIDGETS[item.id];
              if (!def) continue;
              grid.addWidget({
                id: item.id,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                minW: def.minW,
                minH: def.minH,
              });
            }
          } finally {
            replacingDockDrop = false;
          }
          return;
        }
        applyMaxRow(next);
        layoutRef.current = next;
        onLayoutPersistRef.current(next);
      });
    };

    const onRemoved = (_e: Event, nodes?: GridStackNode[]) => {
      if (replacingDockDrop) return;
      nodes?.forEach((n) => {
        const id = n.id as WidgetId | undefined;
        const itemEl = n.el as HTMLElement | undefined;
        if (itemEl) {
          releaseWidgetHost(getContentHost(itemEl));
        }
        if (id) {
          hostById.delete(id);
          placedDockIds.delete(id);
        }
      });
      syncLayout();
    };

    const replaceDockDropWithWidget = (newNode: GridStackNode) => {
      const el = newNode.el as HTMLElement | undefined;
      const id = (newNode.id ??
        el?.getAttribute("gs-id")) as WidgetId | undefined;
      const def = id ? WIDGETS[id] : undefined;
      if (!def || !id) return;
      if (placedDockIds.has(id)) return;
      placedDockIds.add(id);

      const { w, h } = widgetFootprint(def);
      const x = newNode.x ?? 0;
      const existing = nodesToLayout(
        grid.save(false) as GridStackNode[],
      );
      const y = clampY(existing, newNode.y ?? 0, undefined, h);

      replacingDockDrop = true;
      try {
        grid.batchUpdate(true);
        if (el && el.parentElement === hostEl) {
          grid.removeWidget(el, true, false);
        }
        grid.addWidget({
          id,
          x,
          y,
          w,
          h,
          minW: def.minW,
          minH: def.minH,
        });
        grid.batchUpdate(false);
        applyMaxRow(
          nodesToLayout(grid.save(false) as GridStackNode[]),
        );
      } finally {
        replacingDockDrop = false;
      }

      requestAnimationFrame(() => {
        if (cancelled) return;
        onAfterDropRef.current?.();
        syncLayout();
      });
    };

    /**
     * Manual dock placement.
     *
     * Gridstack's own external-drop path (droppable `mouseenter` → placeholder →
     * `dropped`) is fragile on this surface: when it doesn't engage there is no
     * preview and the card silently springs back. These two helpers drive the
     * same result from the pointer alone, and stand down whenever Gridstack is
     * handling the drag itself (i.e. it has inserted its placeholder).
     */
    const dockTargetFor = (id: WidgetId, clientX: number, clientY: number) => {
      const def = WIDGETS[id];
      if (!def) return null;
      const rect = hostEl.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const { w, h } = widgetFootprint(def);
      const cellW = rect.width / COLUMNS;
      const cellH = designPx(CELL_HEIGHT);
      const x = Math.max(
        0,
        Math.min(COLUMNS - w, Math.round((clientX - rect.left - (w * cellW) / 2) / cellW)),
      );
      const existing = nodesToLayout(grid.save(false) as GridStackNode[]);
      const y = clampY(
        existing,
        Math.max(0, Math.round((clientY - rect.top - (h * cellH) / 2) / cellH)),
        undefined,
        h,
      );
      return { def, x, y, w, h, cellW, cellH };
    };

    let previewEl: HTMLElement | null = null;

    const clearDockPreview = () => {
      previewEl?.remove();
      previewEl = null;
    };

    const gridIsHandlingDrag = () => !!hostEl.querySelector(".grid-stack-placeholder");

    const previewDockDrop = (id: WidgetId, clientX: number, clientY: number) => {
      if (gridIsHandlingDrag()) {
        clearDockPreview();
        return;
      }
      const target = dockTargetFor(id, clientX, clientY);
      if (!target) {
        clearDockPreview();
        return;
      }
      if (!previewEl) {
        previewEl = document.createElement("div");
        previewEl.className = "dashboard-drop-preview";
        hostEl.appendChild(previewEl);
      }
      // Inset by the grid margin so the outline lines up with real widgets.
      const m = designPx(GRID_MARGIN);
      previewEl.style.left = `${target.x * target.cellW + m}px`;
      previewEl.style.top = `${target.y * target.cellH + m}px`;
      previewEl.style.width = `${Math.max(0, target.w * target.cellW - m * 2)}px`;
      previewEl.style.height = `${Math.max(0, target.h * target.cellH - m * 2)}px`;
    };

    const dropDockWidget = (id: WidgetId, clientX: number, clientY: number) => {
      clearDockPreview();
      if (layoutRef.current.some((item) => item.id === id)) return false;
      if ((grid.save(false) as GridStackNode[]).some((n) => n.id === id)) return false;
      const target = dockTargetFor(id, clientX, clientY);
      if (!target) return false;

      replacingDockDrop = true;
      try {
        grid.addWidget({
          id,
          x: target.x,
          y: target.y,
          w: target.w,
          h: target.h,
          minW: target.def.minW,
          minH: target.def.minH,
        });
        applyMaxRow(nodesToLayout(grid.save(false) as GridStackNode[]));
      } finally {
        replacingDockDrop = false;
      }
      placedDockIds.add(id);

      requestAnimationFrame(() => {
        if (cancelled) return;
        onAfterDropRef.current?.();
        syncLayout();
      });
      return true;
    };

    previewDockRef.current = previewDockDrop;
    clearPreviewRef.current = clearDockPreview;
    dropDockRef.current = dropDockWidget;

    const nodeId = (node: GridStackNode): string | undefined => {
      const raw = node.id ?? node.el?.getAttribute("gs-id");
      return typeof raw === "string" && raw.length > 0 ? raw : undefined;
    };

  /** GridStack clears `_isExternal` before `dropped`, so also treat unknown ids as dock drops. */
    const isDockDrop = (node: GridStackNode) => {
      if (node.el?.classList.contains("dock-carousel-item")) return true;
      if ((node as GridStackNode & { _isExternal?: boolean })._isExternal) return true;
      const id = nodeId(node) as WidgetId | undefined;
      if (!id || !WIDGETS[id]) return false;
      return !layoutRef.current.some((item) => item.id === id);
    };

    const onDropped = (
      _e: Event,
      _prev: GridStackNode | undefined,
      newNode: GridStackNode,
    ) => {
      if (newNode && isDockDrop(newNode)) {
        replaceDockDropWithWidget(newNode);
        return;
      }
      syncLayout();
    };

    const onAdded = (_e: Event, nodes?: GridStackNode[]) => {
      if (replacingDockDrop || !initSettledRef.current) return;
      for (const node of nodes ?? []) {
        if (isDockDrop(node)) {
          replaceDockDropWithWidget(node);
          return;
        }
      }
    };

    const onDragStart = (_e: Event, el: HTMLElement) => {
      isDraggingWidget = true;
      document.body.classList.add("dashboard-widget-dragging");
      hostEl.classList.remove("dashboard-placement-invalid");
      const item = el as GridItemEl;
      const id = (item.gridstackNode?.id ?? item.getAttribute("gs-id")) as
        | WidgetId
        | null;
      onDragStartRef.current?.(id && WIDGETS[id] ? id : null);
    };

    const onDrag = () => {
      updatePlacementValidity();
    };

    const onDragStop = (_e: Event, el: HTMLElement) => {
      const item = el as GridItemEl;
      const node = item.gridstackNode;
      const invalid = hostEl.classList.contains("dashboard-placement-invalid");
      hostEl.classList.remove("dashboard-placement-invalid");

      const finishDrag = () => {
        isDraggingWidget = false;
        document.body.classList.remove("dashboard-widget-dragging");
        syncLayout();
      };

      if (invalid && node) {
        revertNode(el, node);
        requestAnimationFrame(finishDrag);
      } else {
        finishDrag();
      }

      const id = (node?.id ?? item.getAttribute("gs-id")) as WidgetId | null;
      onDragStopRef.current?.(id && WIDGETS[id] ? id : null);
    };

    const onNativeDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".grid-stack-item")) {
        e.preventDefault();
      }
    };

    grid.on("dropped", onDropped);
    grid.on("removed", onRemoved);
    grid.on("added", onAdded);
    grid.on("dragstart", onDragStart);
    grid.on("drag", onDrag);
    grid.on("dragstop", onDragStop);
    document.addEventListener("contextmenu", onCancelDragPointer, true);
    hostEl.addEventListener("dragstart", onNativeDragStart);

    return () => {
      cancelled = true;
      initSettledRef.current = false;
      unsubBridge();
      window.clearTimeout(unlockPersist);
      clearDockPreview();
      previewDockRef.current = null;
      clearPreviewRef.current = null;
      dropDockRef.current = null;
      window.removeEventListener("resize", syncCellMetrics);
      document.body.classList.remove("dashboard-widget-dragging");
      document.removeEventListener("contextmenu", onCancelDragPointer, true);
      hostEl.removeEventListener("dragstart", onNativeDragStart);
      try {
        grid.off("dropped");
        grid.off("removed");
        grid.off("added");
        grid.off("dragstart");
        grid.off("drag");
        grid.off("dragstop");
        grid.destroy(true);
      } catch {
        /* ignore */
      }
      gridInstanceRef.current = null;
      hostEl.innerHTML = "";
      unmountAllWidgetRoots();
      // GridStack.renderCB is global — left in place on purpose. The next grid
      // surface to mount overwrites it; deleting here can race a sibling
      // surface's mount and leave its dock-dropped widgets rendered empty.
    };
  }, [mountKey]);

  return (
    <div
      ref={hostRef}
      key={mountKey}
      className="grid-stack"
      style={{ minHeight: dashboardBoardHeightPx() }}
    />
  );
}

/** Remount only when mountKey changes; layout updates still flow through. */
export const DashboardGrid = memo(
  DashboardGridInner,
  (prev, next) =>
    prev.mountKey === next.mountKey &&
    prev.layout === next.layout &&
    prev.onLayoutPersist === next.onLayoutPersist &&
    prev.onWidgetDragStart === next.onWidgetDragStart &&
    prev.onWidgetDragStop === next.onWidgetDragStop &&
    prev.onAfterExternalDrop === next.onAfterExternalDrop &&
    prev.gridRef === next.gridRef,
);
