/**
 * Fluid widget layout contract.
 *
 * New dashboard widgets MUST compose WidgetShell + the primitives in
 * WidgetChrome.tsx (Hero / MetricStrip / Feed / Media / Split / FeedRow) and
 * drive density from `useWidgetLayout()` — do not invent custom `h-full
 * justify-between` stacks or inflate GridStack `minH` to hide bad layouts.
 */
import { useWidgetSize, type WidgetSizeTier } from "@/lib/widget-size";

export type WidgetDensity = "dense" | "comfortable" | "rich";

export type WidgetLayout = {
  /** Measured box from ResizeObserver. */
  pxWidth: number;
  pxHeight: number;
  /** Legacy width tier — prefer `density` for layout recipes. */
  tier: WidgetSizeTier;
  /** Layout recipe: what the body should look like. */
  density: WidgetDensity;
  /** How many feed/list rows fit in the primary body without clipping. */
  slots: number;
  /**
   * Rows that fit in a secondary pane (split column/row). Always ≤ slots.
   * Use this for WidgetFeed inside WidgetSplit.secondary — never the full
   * `slots` count, or the last row gets sliced in half.
   */
  secondarySlots: number;
  /** Charts, filters, footnotes, secondary columns. */
  showSecondary: boolean;
  /** Tabs, search, extra chrome in the body. */
  showChrome: boolean;
  /** Show 1-line summaries under titles. */
  showSummary: boolean;
};

export type UseWidgetLayoutOpts = {
  /** Approximate height of one feed row in px (default 56). */
  rowPx?: number;
  /** Reserved px for chrome inside the body (tabs, footers, metric strip). */
  reservedPx?: number;
};

const DENSE_MAX_H = 140;
const DENSE_MAX_W = 220;
const RICH_MIN_W = 380;
const RICH_MIN_H = 240;
/** Leave slack so the last fully-visible row isn't an optimistic overcount. */
const SLOT_SAFETY_PX = 16;

function computeDensity(w: number, h: number): WidgetDensity {
  if (w <= 0 || h <= 0) return "comfortable";
  if (h < DENSE_MAX_H || w < DENSE_MAX_W) return "dense";
  if (w >= RICH_MIN_W && h >= RICH_MIN_H) return "rich";
  return "comfortable";
}

function computeSlots(h: number, rowPx: number, reservedPx: number): number {
  if (h <= 0) return 4;
  const usable = Math.max(0, h - reservedPx - SLOT_SAFETY_PX);
  return Math.max(1, Math.floor(usable / rowPx));
}

/**
 * Single hook every size-aware widget should call.
 * Replaces ad-hoc `pxHeight < 110` / scattered `listCapacity` checks.
 */
export function useWidgetLayout(opts: UseWidgetLayoutOpts = {}): WidgetLayout {
  const { pxWidth, pxHeight, tier } = useWidgetSize();
  const rowPx = opts.rowPx ?? 56;
  const reservedPx = opts.reservedPx ?? 12;
  const density = computeDensity(pxWidth, pxHeight);
  // Do NOT bake "rich chrome" into slots — callers that add tabs/search pass reservedPx.
  // Floor at 4 for comfortable+ so card lists aren't stuck at 2 with empty dead space.
  const rawSlots = density === "dense" ? 1 : computeSlots(pxHeight, rowPx, reservedPx);
  const slots = density === "dense" ? 1 : Math.max(4, rawSlots);
  const secondarySlots =
    density === "dense" ? 1 : Math.max(1, Math.floor((rawSlots + 1) / 2));

  return {
    pxWidth,
    pxHeight,
    tier,
    density,
    slots,
    secondarySlots,
    showSecondary: density === "rich",
    showChrome: density === "rich",
    showSummary: density === "rich" && pxHeight >= 280,
  };
}
