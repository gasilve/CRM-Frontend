import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GridStack } from "gridstack";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { designPx } from "@/lib/rem";
import {
  CASE_CELL_HEIGHT,
  CASE_COLUMNS,
  CASE_GRID_MARGIN,
  CASE_PANEL_LIST,
  CUSTOM_WIDGET_TEMPLATE_ID,
  RESERVED_WIDGET_TITLE,
  caseWidgetSizing,
  isReservedWidgetTitle,
  type CaseLayoutItem,
  type CasePanelCtx,
  type CustomCaseWidgetDef,
} from "./case-detail-widgets";
import { CustomCaseWidget } from "./CustomCaseWidget";
import type { CaseDetailGridHandle } from "./CaseDetailGrid";

const MAGNET_RADIUS = 140;
const MAX_LIFT = 52;
const MAX_SCALE = 0.42;
const DISMISS_MARGIN_VH = 0.01;
const EDGE_SCROLL_ZONE = 72;
const EDGE_SCROLL_SPEED = 7;

/** Fallback reference grid width when actual cannot be measured (12 cols). */
const DOCK_REF_GRID_W = 1104;
/** Matches `.grid-stack-item-content` inset in gridstack.css. */
const GRID_CONTENT_INSET = 6;

type DockDragEl = HTMLElement & {
  ddElement?: { cleanDraggable: () => void };
};

type DockEntry = {
  id: string;
  label: string;
  w: number;
  h: number;
  minW: number;
  minH: number;
  render: () => React.ReactNode;
};

function cleanupDockDragIn(ids: Iterable<string>) {
  for (const id of ids) {
    const el = document.querySelector<DockDragEl>(`[data-dock-widget="${id}"]`);
    el?.ddElement?.cleanDraggable();
  }
}

function dockNativePixels(entry: DockEntry, actualGridWidth?: number) {
  const margin = designPx(CASE_GRID_MARGIN);
  const cellH = designPx(CASE_CELL_HEIGHT);
  const inset = designPx(GRID_CONTENT_INSET);
  const colUnit = (actualGridWidth ?? designPx(DOCK_REF_GRID_W)) / CASE_COLUMNS;
  const outerW = Math.round(entry.w * colUnit - margin);
  const outerH = Math.round(entry.h * cellH + (entry.h - 1) * margin);
  const nativeW = Math.max(outerW - inset * 2, designPx(80));
  const nativeH = Math.max(outerH - inset * 2, designPx(56));
  return { nativeW, nativeH };
}

function dockPreviewDims(entry: DockEntry, actualGridWidth?: number) {
  const colPx = (actualGridWidth ?? designPx(DOCK_REF_GRID_W)) / CASE_COLUMNS;
  const rowPx = designPx(CASE_CELL_HEIGHT);

  let frameW = entry.w * colPx;
  let frameH = entry.h * rowPx;
  const maxW = designPx(220);
  const maxH = designPx(155);
  const fit = Math.min(1, maxW / frameW, maxH / frameH);
  frameW = Math.round(frameW * fit);
  frameH = Math.round(frameH * fit);

  const { nativeW, nativeH } = dockNativePixels(entry, actualGridWidth);
  const scale = Math.min(frameW / nativeW, frameH / nativeH);

  return { frameW, frameH, nativeW, nativeH, scale };
}

function NewWidgetTemplatePreview() {
  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden">
      <div className="eyebrow shrink-0 border-b border-[var(--color-line)] px-4 py-2.5">New widget</div>
      <div className="grid min-h-0 flex-1 place-items-center p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-[var(--color-line-3)] text-[var(--color-accent-2)]">
            <Plus size={18} strokeWidth={1.6} />
          </span>
          <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
            Blank — name it and pick fields
          </span>
        </div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  ctx: CasePanelCtx;
  /** Everything currently placed on any page. */
  layout: CaseLayoutItem[];
  /** All custom widget defs (placed or not). */
  customWidgets: CustomCaseWidgetDef[];
  gridRef: React.MutableRefObject<CaseDetailGridHandle | null>;
  gridMountKey: string | number;
  onClose: () => void;
  onPlacingChange?: (placing: boolean) => void;
};

export default function CaseWidgetDock({
  open,
  ctx,
  layout,
  customWidgets,
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
  const dockWidgetIdsRef = useRef<string[]>([]);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
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
      !!document.querySelector("body > .dock-carousel-item.ui-draggable-dragging") ||
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
          if (node instanceof HTMLElement && node.classList.contains("dock-carousel-item")) {
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
      const item = (e.target as HTMLElement).closest(".dock-carousel-item") as HTMLElement | null;
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

  const entries = useMemo<DockEntry[]>(() => {
    const placed = new Set(layout.map((i) => i.id));
    const out: DockEntry[] = [];

    for (const def of CASE_PANEL_LIST) {
      if (placed.has(def.id)) continue;
      out.push({
        id: def.id,
        label: def.label,
        w: def.defaultW,
        h: def.defaultH,
        minW: def.minW,
        minH: def.minH,
        render: () => def.render(ctx),
      });
    }

    for (const w of customWidgets) {
      // Drafts live on the board only — a widget joins this list once it has
      // been dropped on the bookmark target. The blank template owns the
      // reserved name, so nothing else can show up under it.
      if (!w.persisted || isReservedWidgetTitle(w.title)) continue;
      if (placed.has(w.id)) continue;
      const sizing = caseWidgetSizing(w.id);
      out.push({
        id: w.id,
        label: w.title,
        w: sizing.defaultW,
        h: sizing.defaultH,
        minW: sizing.minW,
        minH: sizing.minH,
        render: () => <CustomCaseWidget ctx={ctx} id={w.id} />,
      });
    }

    // Always last: the blank template that mints a new custom widget on drop.
    const sizing = caseWidgetSizing(CUSTOM_WIDGET_TEMPLATE_ID);
    out.push({
      id: CUSTOM_WIDGET_TEMPLATE_ID,
      label: RESERVED_WIDGET_TITLE,
      w: sizing.defaultW,
      h: sizing.defaultH,
      minW: sizing.minW,
      minH: sizing.minH,
      render: () => <NewWidgetTemplatePreview />,
    });

    return out;
  }, [layout, customWidgets, ctx]);

  const applyMagnification = (clientX: number | null) => {
    const lane = laneRef.current;
    const laneRect = lane?.getBoundingClientRect();

    itemRefs.current.forEach((el) => {
      if (!el) return;
      if (clientX === null) {
        el.style.setProperty("--dock-lift", "0");
        el.style.setProperty("--dock-scale", "1");
        el.style.setProperty("--dock-z", "1");
        return;
      }
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      const t = Math.max(0, 1 - dist / designPx(MAGNET_RADIUS));
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

      el.style.setProperty("--dock-lift", `${-eased * designPx(MAX_LIFT)}px`);
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
    scrollOffsetRef.current = Math.max(0, Math.min(maxScroll, scrollOffsetRef.current));
    strip.style.transform = `translateX(${-scrollOffsetRef.current}px)`;
  }, [getScrollBounds]);

  /** Center the row when it fits; once it overflows, scrolling math needs it left-aligned. */
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!open) return;
    scrollOffsetRef.current = 0;
    applyScroll();
    setOverflowing(getScrollBounds().maxScroll > 0);
  }, [open, entries, applyScroll, getScrollBounds]);

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
              Math.min(maxScroll, scrollOffsetRef.current + dir * designPx(EDGE_SCROLL_SPEED)),
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
      if (e.clientX <= laneRect.left + designPx(EDGE_SCROLL_ZONE)) edgeScrollDirRef.current = -1;
      else if (e.clientX >= laneRect.right - designPx(EDGE_SCROLL_ZONE)) edgeScrollDirRef.current = 1;
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
  }, [open, entries, getScrollBounds]);

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
      scrollOffsetRef.current = Math.max(0, Math.min(maxScroll, scrollOffsetRef.current + delta));
      strip.style.transform = `translateX(${-scrollOffsetRef.current}px)`;
      e.preventDefault();
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [open, entries, getScrollBounds]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".case-action-bar")) return;
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
      if (target.closest(".case-action-bar")) return;
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

    const widgetIds = entries.map((w) => w.id);
    dockWidgetIdsRef.current = widgetIds;
    const timer = window.setTimeout(() => {
      const grid = gridRef.current?.getGrid();
      if (!grid) return;

      const dragEls: HTMLElement[] = [];
      const widgetMeta = [];

      for (const w of entries) {
        const el = document.querySelector<HTMLElement>(`[data-dock-widget="${w.id}"]`);
        if (!el) continue;

        const node = {
          id: w.id,
          w: w.w,
          h: w.h,
          minW: w.minW,
          minH: w.minH,
        };
        el.setAttribute("data-gs-widget", JSON.stringify(node));
        (el as HTMLElement & { gridstackNode: typeof node }).gridstackNode = node;
        el.setAttribute("gs-id", w.id);
        el.setAttribute("gs-w", String(w.w));
        el.setAttribute("gs-h", String(w.h));
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
  }, [open, entries, gridRef, gridMountKey]);

  const showInner = open || placingDrag;

  if (!showInner) return null;

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
          <div ref={viewportRef} className="widget-dock-viewport widget-dock-viewport--scrollable">
            <div ref={laneRef} className={cn("widget-dock-lane", !overflowing && "widget-dock-lane--center")}>
              <div
                ref={stripRef}
                className="widget-dock-strip"
                onMouseMove={onStripMove}
                onMouseLeave={onStripLeave}
              >
                <div className="dock-strip-spacer" aria-hidden />
                {entries.map((w) => {
                  const dims = dockPreviewDims(w, actualGridWidth);
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
                      title={`Drag ${w.label} onto the page (${w.w}×${w.h})`}
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
                              <div className="widget-body h-full w-full">{w.render()}</div>
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
        </div>
      )}
    </div>
  );

  return createPortal(dock, document.body);
}
