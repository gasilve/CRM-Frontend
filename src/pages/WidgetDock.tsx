import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GridStack } from "gridstack";
import { cn } from "@/lib/cn";
import {
  WIDGET_LIST,
  dockPreviewDimensions,
  widgetFootprint,
  type WidgetId,
} from "./dashboard-widgets";
import type { DashboardGridHandle } from "./DashboardGrid";

const MAGNET_RADIUS = 140;
const MAX_LIFT = 52;
const MAX_SCALE = 0.42;
const DISMISS_MARGIN_VH = 0.01;
const EDGE_SCROLL_ZONE = 72;
const EDGE_SCROLL_SPEED = 7;

type DockDragEl = HTMLElement & {
  ddElement?: { cleanDraggable: () => void };
};

function cleanupDockDragIn(ids: Iterable<WidgetId>) {
  for (const id of ids) {
    const el = document.querySelector<DockDragEl>(`[data-dock-widget="${id}"]`);
    el?.ddElement?.cleanDraggable();
  }
}

type Props = {
  open: boolean;
  hiddenIds: Set<WidgetId>;
  gridRef: React.MutableRefObject<DashboardGridHandle | null>;
  gridMountKey: number;
  onClose: () => void;
  onPlacingChange?: (placing: boolean) => void;
};

export default function WidgetDock({
  open,
  hiddenIds,
  gridRef,
  gridMountKey,
  onClose,
  onPlacingChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const placingDragRef = useRef(false);
  const dockWidgetIdsRef = useRef<WidgetId[]>([]);
  const itemRefs = useRef<Map<WidgetId, HTMLDivElement | null>>(new Map());
  const magnetRaf = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const edgeScrollDirRef = useRef<-1 | 0 | 1>(0);
  const edgeScrollRafRef = useRef<number | null>(null);

  const [placingDrag, setPlacingDrag] = useState(false);
  placingDragRef.current = placingDrag;

  const onPlacingChangeRef = useRef(onPlacingChange);
  onPlacingChangeRef.current = onPlacingChange;

  const finishPlacementDrag = useCallback(() => {
    if (!placingDragRef.current) return;
    placingDragRef.current = false;
    setPlacingDrag(false);
    shellRef.current?.classList.remove("is-dock-placing");
    document.body.classList.remove("dashboard-dock-placing");
    cleanupDockDragIn(dockWidgetIdsRef.current);
    onPlacingChangeRef.current?.(false);
  }, []);

  const isDockHelperDragging = useCallback(
    () =>
      !!document.querySelector(
        "body > .dock-carousel-item.ui-draggable-dragging",
      ) ||
      !!document.querySelector("body > .ui-draggable-dragging"),
    [],
  );

  // Watch for dock-to-grid drags finishing (pointer up or helper removed).
  useEffect(() => {
    const endIfDragComplete = () => {
      window.setTimeout(() => {
        if (!isDockHelperDragging()) finishPlacementDrag();
      }, 0);
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        for (const node of m.removedNodes) {
          if (
            node instanceof HTMLElement &&
            node.classList.contains("dock-carousel-item")
          ) {
            endIfDragComplete();
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });

    document.addEventListener("pointerup", endIfDragComplete, true);
    document.addEventListener("pointercancel", endIfDragComplete, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerup", endIfDragComplete, true);
      document.removeEventListener("pointercancel", endIfDragComplete, true);
    };
  }, [finishPlacementDrag, isDockHelperDragging]);

  useEffect(
    () => () => {
      document.body.classList.remove("dashboard-dock-placing");
    },
    [],
  );

  // When the user starts dragging from the dock, close it immediately.
  useEffect(() => {
    if (!open) return;

    const shellEl = shellRef.current;
    let moveCleanup: (() => void) | null = null;

    const beginPlacementDrag = () => {
      if (placingDragRef.current) return;
      placingDragRef.current = true;
      setPlacingDrag(true);
      shellEl?.classList.add("is-dock-placing");
      document.body.classList.add("dashboard-dock-placing");
      onClose();
      onPlacingChangeRef.current?.(true);
    };

    const onPointerDown = (e: PointerEvent) => {
      const item = (e.target as HTMLElement).closest(
        ".dock-carousel-item",
      ) as HTMLElement | null;
      if (!item) return;

      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (me: PointerEvent) => {
        if (Math.hypot(me.clientX - startX, me.clientY - startY) < 6) return;
        cleanup();
        beginPlacementDrag();
      };

      const onUp = () => cleanup();

      const cleanup = () => {
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        moveCleanup = null;
      };

      moveCleanup = cleanup;
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      moveCleanup?.();
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose]);

  // Measure the live grid width so previews use the real col:row aspect ratio
  const [actualGridWidth, setActualGridWidth] = useState<number | undefined>();
  useEffect(() => {
    if (!open) return;
    const el = gridRef.current?.getEl();
    if (el) setActualGridWidth(el.clientWidth);
  }, [open, gridRef]);

  const availableWidgets = useMemo(
    () => WIDGET_LIST.filter((w) => hiddenIds.has(w.id)),
    [hiddenIds],
  );

  const applyMagnification = (clientX: number | null) => {
    const lane = laneRef.current;
    const laneRect = lane?.getBoundingClientRect();

    itemRefs.current.forEach((el) => {
      if (!el) return;
      if (clientX === null) {
        el.style.setProperty("--dock-lift", "0px");
        el.style.setProperty("--dock-scale", "1");
        el.style.setProperty("--dock-z", "1");
        return;
      }
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      const t = Math.max(0, 1 - dist / MAGNET_RADIUS);
      const eased = t * t * (3 - 2 * t);
      let scale = 1 + eased * MAX_SCALE;

      // Taper scale near lane edges so magnified widgets don't bleed off-screen
      if (laneRect) {
        const halfW = rect.width / 2;
        const bleed = halfW * MAX_SCALE;
        const distLeft = center - laneRect.left;
        const distRight = laneRect.right - center;
        const edgeRoom = Math.min(distLeft, distRight);
        if (edgeRoom < bleed) {
          scale = 1 + eased * MAX_SCALE * Math.max(0, edgeRoom / bleed);
        }
      }

      el.style.setProperty("--dock-lift", `${-eased * MAX_LIFT}px`);
      el.style.setProperty("--dock-scale", `${scale}`);
      el.style.setProperty("--dock-z", `${Math.round(10 + eased * 40)}`);
    });
  };

  const onStripMove = (e: React.MouseEvent) => {
    if (magnetRaf.current !== null) return;
    magnetRaf.current = requestAnimationFrame(() => {
      magnetRaf.current = null;
      applyMagnification(e.clientX);
    });
  };

  const onStripLeave = () => {
    if (magnetRaf.current !== null) {
      cancelAnimationFrame(magnetRaf.current);
      magnetRaf.current = null;
    }
    applyMagnification(null);
  };

  const getScrollBounds = useCallback(() => {
    const strip = stripRef.current;
    const lane = laneRef.current;
    if (!strip || !lane) return { maxScroll: 0, visibleW: 0 };
    const visibleW = lane.clientWidth;
    const maxScroll = Math.max(0, strip.scrollWidth - visibleW);
    return { maxScroll, visibleW };
  }, []);

  const applyScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const { maxScroll } = getScrollBounds();
    scrollOffsetRef.current = Math.max(
      0,
      Math.min(maxScroll, scrollOffsetRef.current),
    );
    strip.style.transform = `translateX(${-scrollOffsetRef.current}px)`;
  }, [getScrollBounds]);

  useEffect(() => {
    if (!open) return;
    scrollOffsetRef.current = 0;
    applyScroll();
  }, [open, availableWidgets, applyScroll]);

  useEffect(() => {
    if (!open) return;

    const tick = () => {
      const dir = edgeScrollDirRef.current;
      if (dir !== 0) {
        const strip = stripRef.current;
        const viewport = viewportRef.current;
        if (strip && viewport) {
          const { maxScroll } = getScrollBounds();
          if (maxScroll > 0) {
            scrollOffsetRef.current = Math.max(
              0,
              Math.min(maxScroll, scrollOffsetRef.current + dir * EDGE_SCROLL_SPEED),
            );
            strip.style.transform = `translateX(${-scrollOffsetRef.current}px)`;
          }
        }
      }
      edgeScrollRafRef.current = requestAnimationFrame(tick);
    };
    edgeScrollRafRef.current = requestAnimationFrame(tick);

    const onPointerMove = (e: PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        edgeScrollDirRef.current = 0;
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const lane = laneRef.current;
      const laneRect = lane?.getBoundingClientRect() ?? rect;
      const yInDock = e.clientY >= rect.top - 24 && e.clientY <= rect.bottom + 24;
      if (!yInDock) {
        edgeScrollDirRef.current = 0;
        return;
      }
      if (e.clientX <= laneRect.left + EDGE_SCROLL_ZONE) edgeScrollDirRef.current = -1;
      else if (e.clientX >= laneRect.right - EDGE_SCROLL_ZONE) edgeScrollDirRef.current = 1;
      else edgeScrollDirRef.current = 0;
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      if (edgeScrollRafRef.current !== null) {
        cancelAnimationFrame(edgeScrollRafRef.current);
        edgeScrollRafRef.current = null;
      }
      edgeScrollDirRef.current = 0;
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, [open, availableWidgets]);

  useEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      const strip = stripRef.current;
      if (!strip) return;
      const { maxScroll } = getScrollBounds();
      if (maxScroll <= 0) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      scrollOffsetRef.current = Math.max(
        0,
        Math.min(maxScroll, scrollOffsetRef.current + delta),
      );
      strip.style.transform = `translateX(${-scrollOffsetRef.current}px)`;
      e.preventDefault();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [open, availableWidgets, getScrollBounds]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".dashboard-add-fab")) return;
      if (target.closest(".widget-dock-shell")) return;
      if (target.closest(".dashboard-modal")) return;

      const shell = document.querySelector(".widget-dock-shell");
      if (!shell) return;
      const top = shell.getBoundingClientRect().top;
      const margin = window.innerHeight * DISMISS_MARGIN_VH;
      if (e.clientY < top - margin) onClose();
    };

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".dashboard-add-fab")) return;
      const dragging =
        !!document.querySelector(".grid-stack-placeholder") ||
        !!document.querySelector(".ui-draggable-dragging");
      if (dragging) {
        e.preventDefault();
        return;
      }
      if (target.closest(".dock-carousel-item")) return;
      e.preventDefault();
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const widgetIds = availableWidgets.map((w) => w.id);
    dockWidgetIdsRef.current = widgetIds;
    const timer = window.setTimeout(() => {
      const grid = gridRef.current?.getGrid();
      if (!grid) return;

      const dragEls: HTMLElement[] = [];
      const widgetMeta = [];

      for (const w of availableWidgets) {
        const el = document.querySelector<HTMLElement>(
          `[data-dock-widget="${w.id}"]`,
        );
        if (!el) continue;

        const { w: gw, h: gh } = widgetFootprint(w);
        const node = {
          id: w.id,
          w: gw,
          h: gh,
          minW: w.minW,
          minH: w.minH,
        };
        el.setAttribute("data-gs-widget", JSON.stringify(node));
        (el as HTMLElement & { gridstackNode: typeof node }).gridstackNode =
          node;
        el.setAttribute("gs-id", w.id);
        el.setAttribute("gs-w", String(gw));
        el.setAttribute("gs-h", String(gh));
        dragEls.push(el);
        widgetMeta.push(node);
      }

      if (dragEls.length === 0) return;

      GridStack.setupDragIn(
        dragEls,
        {
          appendTo: "body",
          helper: "clone",
          scroll: false,
        },
        widgetMeta,
      );
    }, 120);

    return () => {
      window.clearTimeout(timer);
      if (!placingDragRef.current) {
        cleanupDockDragIn(widgetIds);
      }
    };
  }, [open, availableWidgets, gridRef, gridMountKey]);

  const showInner = open || placingDrag;

  const dock = (
    <div
      ref={shellRef}
      className={cn(
        "widget-dock-shell",
        open && "is-open",
        placingDrag && !open && "is-dock-placing",
      )}
      aria-hidden={!open && !placingDrag}
    >
      {showInner && (
      <div className="widget-dock-inner">
        {availableWidgets.length === 0 ? (
          <p className="widget-dock-empty">
            All widgets are on the dashboard. Remove one to add it again from
            here.
          </p>
        ) : (
          <div ref={viewportRef} className="widget-dock-viewport widget-dock-viewport--scrollable">
            <div ref={laneRef} className="widget-dock-lane">
              <div
                ref={stripRef}
                className="widget-dock-strip"
                onMouseMove={onStripMove}
                onMouseLeave={onStripLeave}
              >
                <div className="dock-strip-spacer" aria-hidden />
                {availableWidgets.map((w) => {
                const dims = dockPreviewDimensions(w, actualGridWidth);
                const { w: gw, h: gh } = widgetFootprint(w);
                return (
                  <div
                    key={w.id}
                    ref={(el) => {
                      itemRefs.current.set(w.id, el);
                    }}
                    data-dock-widget={w.id}
                    className="dock-carousel-item"
                    style={
                      {
                        "--dock-frame-w": `${dims.frameW}px`,
                        "--dock-frame-h": `${dims.frameH}px`,
                      } as React.CSSProperties
                    }
                    title={`Drag ${w.label} onto the dashboard (${gw}×${gh})`}
                  >
                    <div className="dock-carousel-frame">
                      <div className="dock-carousel-preview-slot">
                        <div
                          className="dock-carousel-preview"
                          style={{
                            width: dims.nativeW,
                            height: dims.nativeH,
                            transform: `scale(${dims.scale})`,
                          }}
                        >
                          <div className="widget-frame h-full w-full">
                            <div className="widget-body h-full w-full">
                              {w.render()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="dock-carousel-label">{w.label}</span>
                  </div>
                );
              })}
                <div className="dock-strip-spacer" aria-hidden />
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );

  return createPortal(dock, document.body);
}
