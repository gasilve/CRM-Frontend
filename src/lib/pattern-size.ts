/**
 * Layout pattern size ladder — Playground + future live widgets.
 */
export type PatternSize = "XS" | "S" | "M" | "L" | "XL";

export const PATTERN_SIZES: PatternSize[] = ["XS", "S", "M", "L", "XL"];

/** Approximate gallery card footprints (px). */
export const PATTERN_FRAME_PX: Record<PatternSize, { w: number; h: number }> = {
  XS: { w: 200, h: 140 },
  S: { w: 260, h: 168 },
  M: { w: 320, h: 220 },
  L: { w: 480, h: 300 },
  XL: { w: 640, h: 360 },
};

/** Grid cell feel for lab alignment strip (12-col / ~84px cell). */
export const PATTERN_GRID_CELLS: Record<PatternSize, { cols: number; rows: number }> = {
  XS: { cols: 2, rows: 2 },
  S: { cols: 3, rows: 2 },
  M: { cols: 4, rows: 3 },
  L: { cols: 6, rows: 3 },
  XL: { cols: 8, rows: 4 },
};

export function slotsForSize(size: PatternSize, rowPx = 44, reservedPx = 48): number {
  const h = PATTERN_FRAME_PX[size].h - reservedPx;
  return Math.max(1, Math.floor(h / rowPx));
}

export type PatternTheme = "glass" | "buzz";

export type PatternId =
  | "focal-stat"
  | "focal-feature"
  | "metric-strip"
  | "stack-list"
  | "card-list"
  | "split-primary-secondary"
  | "metric-over-list"
  | "metric-over-bars"
  | "bars-fill"
  | "media-bleed"
  | "roster"
  | "ask"
  | "chrome-feed"
  | "timeline-spine"
  | "key-value-sheet"
  | "stage-rail"
  | "media-toolbar"
  | "trend-pulse"
  | "compare-twin"
  // Dashboard-inspired + video
  | "dual-trend"
  | "spark-metric-grid"
  | "donut-legend"
  | "activity-feed"
  | "checklist"
  | "status-roster"
  | "agenda-strip"
  | "weather-band"
  | "video-stage"
  | "video-playlist"
  | "video-theater"
  // Round 2 recipes
  | "client-accordion"
  | "client-master-detail"
  | "client-drawer"
  | "aging-buckets"
  | "aging-funnel"
  | "aging-cohort"
  | "notes-pad"
  | "notes-checklist"
  | "investigator-scope"
  | "coverage-hybrid"
  | "weather-ops"
  | "weather-week"
  | "weather-alert"
  | "weather-board"
  // Theme B · Buzz
  | "shout-stat"
  | "heat-tile"
  | "chip-strip"
  | "scroll-stack"
  | "buzz-cards"
  | "duel-split"
  | "heat-over-feed"
  | "heat-over-bars"
  | "fill-meters"
  | "urgency-feed"
  | "crowd-roster"
  | "prompt-bar"
  | "pulse-line"
  | "vs-columns"
  | "streak-rail"
  | "key-blast";

export type PatternDef = {
  id: PatternId;
  label: string;
  blurb: string;
  sizes: PatternSize[];
  theme: PatternTheme;
  folder: string;
};
