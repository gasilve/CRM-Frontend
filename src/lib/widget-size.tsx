import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * iOS-widget-style size tiers. Every widget on both the Dashboard and
 * Case-detail surfaces gets one of these for free — see `DashboardGrid.tsx`
 * (`renderWidgetContent`) and `CaseDetailGrid.tsx` (`renderPanel`), which both
 * wrap `def.render()` in a `WidgetSizeProvider`.
 *
 * Tiers are driven by the widget's own measured pixel box (a `ResizeObserver`
 * on its mount node), not by grid cell counts — a 4-col-wide widget on a
 * narrow laptop and a 4-col-wide widget on an ultrawide monitor can land in
 * different tiers, which is the point: the tier tracks how much room there
 * actually is to render into, not how many grid columns were requested.
 */
export type WidgetSizeTier = "compact" | "standard" | "expanded";

export interface WidgetSize {
  pxWidth: number;
  pxHeight: number;
  tier: WidgetSizeTier;
}

export interface WidgetSizeBreakpoints {
  /** Width (px) at/above which a widget leaves "compact" for "standard". */
  standard: number;
  /** Width (px) at/above which a widget leaves "standard" for "expanded". */
  expanded: number;
  /** Optional height gate — for widgets that need vertical room to expand (tables, charts, timelines). */
  minExpandedHeight?: number;
}

/** Shared defaults — height gate is soft; list widgets clamp row count via pxHeight. */
export const DEFAULT_WIDGET_BREAKPOINTS: WidgetSizeBreakpoints = {
  standard: 240,
  expanded: 400,
  minExpandedHeight: 140,
};

/**
 * How many list rows fit in the widget body. Prefer this over hardcoding
 * slice(0, 5) so a short tile shows 2 rows and a tall one shows more —
 * instead of clipping mid-row.
 */
export function listCapacity(pxHeight: number, rowPx = 44, reservedPx = 48): number {
  if (pxHeight <= 0) return 4;
  return Math.max(1, Math.floor(Math.max(0, pxHeight - reservedPx) / rowPx));
}

const FALLBACK_SIZE: WidgetSize = { pxWidth: 0, pxHeight: 0, tier: "standard" };

const WidgetSizeContext = createContext<WidgetSize>(FALLBACK_SIZE);

/** Read the current widget's measured size/tier. Call from inside a widget's `render()` tree. */
export function useWidgetSize(): WidgetSize {
  return useContext(WidgetSizeContext);
}

const computeTier = (w: number, h: number, bp: WidgetSizeBreakpoints): WidgetSizeTier => {
  if (w <= 0) return "standard"; // not measured yet — don't flash "compact"
  if (w < bp.standard) return "compact";
  if (w < bp.expanded) return "standard";
  if (bp.minExpandedHeight && h < bp.minExpandedHeight) return "standard";
  return "expanded";
};

/**
 * Wraps a widget's rendered output in a size-observing box. Purely
 * observational (a plain `ResizeObserver` on a wrapper `div`) — needs zero
 * changes to GridStack's own drag/resize event wiring.
 */
export function WidgetSizeProvider({
  children,
  breakpoints,
}: {
  children: ReactNode;
  breakpoints?: WidgetSizeBreakpoints;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<WidgetSize>(FALLBACK_SIZE);
  const bp = breakpoints ?? DEFAULT_WIDGET_BREAKPOINTS;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const apply = (w: number, h: number) => {
      setSize((prev) => {
        const tier = computeTier(w, h, bp);
        if (prev.tier === tier && Math.abs(prev.pxWidth - w) < 2 && Math.abs(prev.pxHeight - h) < 2) {
          return prev;
        }
        return { pxWidth: w, pxHeight: h, tier };
      });
    };

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    ro.observe(el);

    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- breakpoints object identity is the caller's concern
  }, [bp.standard, bp.expanded, bp.minExpandedHeight]);

  return (
    <div ref={hostRef} className="h-full w-full min-h-0 min-w-0">
      <WidgetSizeContext.Provider value={size}>{children}</WidgetSizeContext.Provider>
    </div>
  );
}
