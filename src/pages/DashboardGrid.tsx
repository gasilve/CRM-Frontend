import { memo, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GridStack, type GridStackNode, type GridStackOptions } from "gridstack";
import { designPx } from "@/lib/rem";
import {
  canPlaceAtY,
  clampY,
  enforceLayoutRowRules,
  gridMaxRow,
} from "./dashboard-grid-layout";
import {
  CELL_HEIGHT,
  COLUMNS,
  GRID_MARGIN,
  WIDGETS,
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
};

type Props = {
  layout: LayoutItem[];
  mountKey: number;
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

  root.render(
    <div className="widget-frame h-full w-full">
      <div className="widget-body signal-acquired h-full w-full">
        {def.render()}
      </div>
    </div>,
  );
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
    };
    return () => {
      gridRef.current = null;
    };
  }, [gridRef]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;

    let cancelled = false;
    initSettledRef.current = false;

    unmountAllWidgetRoots();

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
      animate: true,
      acceptWidgets: ".dock-carousel-item",
      disableResize: false,
      disableDrag: false,
      draggable: { handle: ".widget-body", appendTo: "body" },
      resizable: { handles: "n,e,s,w,se,sw,ne,nw" },
    };

    const grid = GridStack.init(opts, hostEl);
    gridInstanceRef.current = grid;
    initSettledRef.current = false;

    const widgets = layoutToGridWidgets(
      enforceLayoutRowRules(layoutRef.current),
    );
    if (widgets.length > 0) {
      grid.load(widgets);
    }
    grid.engine.maxRow = gridMaxRow(
      enforceLayoutRowRules(layoutRef.current),
    );

    const syncCellMetrics = () => {
      const g = gridInstanceRef.current;
      if (!g) return;
      g.cellHeight(designPx(CELL_HEIGHT));
      g.margin(designPx(GRID_MARGIN));
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
        if (cancelled || !initSettledRef.current || replacingDockDrop) return;
        const nodes = grid.save(false) as GridStackNode[];
        const next = nodesToLayout(nodes);
        applyMaxRow(next);
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

    /**
     * Gridstack drops a dock clone via _prepareElement (DD handles on dock DOM).
     * Do not mutate that node — remove it and add a clean widget so DD/renderCB stay in sync.
     */
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
      const y = clampY(existing, newNode.y ?? 0);

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

    const isDockDrop = (node: GridStackNode) =>
      node.el?.classList.contains("dock-carousel-item") ||
      !!(node as GridStackNode & { _isExternal?: boolean })._isExternal;

    const onDropped = (
      _e: Event,
      _prev: GridStackNode | undefined,
      newNode: GridStackNode,
    ) => {
      if (isDockDrop(newNode)) {
        replaceDockDropWithWidget(newNode);
        return;
      }
      syncLayout();
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

    grid.on("change", syncLayout);
    grid.on("dropped", onDropped);
    grid.on("removed", onRemoved);
    grid.on("dragstart", onDragStart);
    grid.on("drag", onDrag);
    grid.on("dragstop", onDragStop);
    document.addEventListener("contextmenu", onCancelDragPointer, true);
    hostEl.addEventListener("dragstart", onNativeDragStart);
    return () => {
      cancelled = true;
      initSettledRef.current = false;
      window.removeEventListener("resize", syncCellMetrics);
      document.body.classList.remove("dashboard-widget-dragging");
      document.removeEventListener("contextmenu", onCancelDragPointer, true);
      hostEl.removeEventListener("dragstart", onNativeDragStart);
      try {
        grid.off("change");
        grid.off("dropped");
        grid.off("removed");
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
      delete GridStack.renderCB;
    };
  }, [mountKey]);

  return (
    <div ref={hostRef} key={mountKey} className="grid-stack min-h-[30rem]" />
  );
}

export const DashboardGrid = memo(
  DashboardGridInner,
  (prev, next) => prev.mountKey === next.mountKey,
);
