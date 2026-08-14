import {
  Activity,
  BarChart3,
  CalendarClock,
  Inbox,
  ListChecks,
  PieChart,
  Radio,
  TerminalSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

import { RevenuePipeline } from "./widgets/RevenuePipeline";
import { KpiGrid } from "./widgets/KpiGrid";
import { ClientSources } from "./widgets/ClientSources";
import { UpcomingSchedule } from "./widgets/UpcomingSchedule";
import { RecentActivity } from "./widgets/RecentActivity";
import { TaskBoard } from "./widgets/TaskBoard";
import { InvestigatorsList } from "./widgets/InvestigatorsList";
import { SystemLog } from "./widgets/SystemLog";
import { SignalHealth } from "./widgets/SignalHealth";
import { designPx } from "@/lib/rem";

export type WidgetId =
  | "revenue-pipeline"
  | "kpi-grid"
  | "client-sources"
  | "upcoming-schedule"
  | "recent-activity"
  | "task-board"
  | "investigators-list"
  | "system-log"
  | "signal-health";

export type WidgetDef = {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  /**
   * INVARIANT: defaultW >= minW  and  defaultH >= minH.
   *
   * The dock preview renders at defaultW × defaultH.
   * When placed on the grid, Gridstack clamps to minW/minH.
   * If default < min, the preview and placed widget have different proportions.
   * Always satisfy: defaultW >= minW, defaultH >= minH.
   */
  minH: number;
  minW: number;
  defaultW: number;
  defaultH: number;
  render: () => React.ReactNode;
};

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  "revenue-pipeline": {
    id: "revenue-pipeline",
    label: "Revenue & pipeline",
    icon: BarChart3,
    minH: 2,
    minW: 4,
    defaultW: 5,
    defaultH: 3,
    render: () => <RevenuePipeline />,
  },
  "kpi-grid": {
    id: "kpi-grid",
    label: "KPI grid",
    icon: Activity,
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <KpiGrid />,
  },
  "client-sources": {
    id: "client-sources",
    label: "Sources",
    icon: PieChart,
    minH: 2,
    minW: 2,
    defaultW: 2,
    defaultH: 3,
    render: () => <ClientSources />,
  },
  "upcoming-schedule": {
    id: "upcoming-schedule",
    label: "Schedule",
    icon: CalendarClock,
    minH: 2,
    minW: 2,
    defaultW: 2,
    defaultH: 3,
    render: () => <UpcomingSchedule />,
  },
  "recent-activity": {
    id: "recent-activity",
    label: "Activity",
    icon: Inbox,
    minH: 2,
    minW: 4,
    defaultW: 6,
    defaultH: 3,
    render: () => <RecentActivity />,
  },
  "task-board": {
    id: "task-board",
    label: "Tasks",
    icon: ListChecks,
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <TaskBoard />,
  },
  "investigators-list": {
    id: "investigators-list",
    label: "Investigators",
    icon: Users,
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <InvestigatorsList />,
  },
  "system-log": {
    id: "system-log",
    label: "System log",
    icon: TerminalSquare,
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 3,
    render: () => <SystemLog />,
  },
  "signal-health": {
    id: "signal-health",
    label: "Signal health",
    icon: Radio,
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <SignalHealth />,
  },
};

export const WIDGET_LIST: WidgetDef[] = Object.values(WIDGETS);

if (import.meta.env.DEV) {
  for (const def of WIDGET_LIST) {
    if (def.defaultW < def.minW || def.defaultH < def.minH) {
      console.error(
        `[widgets] "${def.id}" violates sizing invariant: ` +
          `defaultW(${def.defaultW}) >= minW(${def.minW}) AND ` +
          `defaultH(${def.defaultH}) >= minH(${def.minH}) must both hold. ` +
          `Preview and placed widget will have different proportions.`,
      );
    }
  }
}

/** Single source of truth for grid footprint (preview + placement) */
export function widgetFootprint(def: WidgetDef) {
  return { w: def.defaultW, h: def.defaultH };
}

export function widgetFootprintForId(id: WidgetId) {
  return widgetFootprint(WIDGETS[id]);
}

/** Fallback reference grid width when actual cannot be measured (12 cols) */
const DOCK_REF_GRID_W = 1104;
/** Matches `.grid-stack-item-content` inset in index.css */
const GRID_CONTENT_INSET = 6;

/**
 * Pixel size of the widget content area at its defaultW×defaultH.
 * Pass `actualGridWidth` (the live `.grid-stack` clientWidth) for accuracy.
 */
export function dockWidgetNativePixels(def: WidgetDef, actualGridWidth?: number) {
  const margin = designPx(GRID_MARGIN);
  const cellH = designPx(CELL_HEIGHT);
  const inset = designPx(GRID_CONTENT_INSET);
  const colUnit = (actualGridWidth ?? designPx(DOCK_REF_GRID_W)) / COLUMNS;
  const outerW = Math.round(def.defaultW * colUnit - margin);
  const outerH = Math.round(def.defaultH * cellH + (def.defaultH - 1) * margin);
  const nativeW = Math.max(outerW - inset * 2, designPx(80));
  const nativeH = Math.max(outerH - inset * 2, designPx(56));
  return { nativeW, nativeH };
}

/**
 * Frame dimensions for the dock preview thumbnail.
 *
 * Uses the real col-width : CELL_HEIGHT ratio so the preview aspect-ratio
 * matches what the widget actually looks like on the grid.
 * Pass `actualGridWidth` (the live `.grid-stack` clientWidth) for accuracy;
 * falls back to DOCK_REF_GRID_W when not yet measured.
 */
export function dockPreviewDimensions(def: WidgetDef, actualGridWidth?: number) {
  const { w, h } = widgetFootprint(def);
  const colPx = (actualGridWidth ?? designPx(DOCK_REF_GRID_W)) / COLUMNS;
  const rowPx = designPx(CELL_HEIGHT);

  let frameW = w * colPx;
  let frameH = h * rowPx;
  const maxW = designPx(220);
  const maxH = designPx(155);
  const fit = Math.min(1, maxW / frameW, maxH / frameH);
  frameW = Math.round(frameW * fit);
  frameH = Math.round(frameH * fit);

  const { nativeW, nativeH } = dockWidgetNativePixels(def, actualGridWidth);
  const scale = Math.min(frameW / nativeW, frameH / nativeH);

  return { frameW, frameH, nativeW, nativeH, scale };
}

export type LayoutItem = { id: WidgetId; x: number; y: number; w: number; h: number };

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "revenue-pipeline", x: 0, y: 0, w: 5, h: 3 },
  { id: "kpi-grid", x: 5, y: 0, w: 3, h: 3 },
  { id: "client-sources", x: 8, y: 0, w: 2, h: 3 },
  { id: "upcoming-schedule", x: 10, y: 0, w: 2, h: 3 },
  { id: "recent-activity", x: 0, y: 3, w: 6, h: 3 },
  { id: "task-board", x: 6, y: 3, w: 3, h: 3 },
  { id: "investigators-list", x: 9, y: 3, w: 3, h: 3 },
  { id: "system-log", x: 0, y: 6, w: 12, h: 3 },
];

export const LS_KEY = "accenty.crm.dashboard.layout.v5";
export const COLUMNS = 12;
export const CELL_HEIGHT = 84;
export const GRID_MARGIN = 8;

export function normalizeLayout(items: LayoutItem[]): LayoutItem[] {
  const seen = new Set<WidgetId>();
  const out: LayoutItem[] = [];

  for (const raw of items) {
    if (!WIDGETS[raw.id]) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);

    const def = WIDGETS[raw.id];
    const w = Number.isFinite(raw.w)
      ? Math.max(def.minW, Math.min(COLUMNS, Math.floor(raw.w)))
      : def.defaultW;
    const h = Number.isFinite(raw.h)
      ? Math.max(def.minH, Math.floor(raw.h))
      : def.defaultH;
    const x = Number.isFinite(raw.x)
      ? Math.max(0, Math.min(COLUMNS - w, Math.floor(raw.x)))
      : 0;
    const y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y)) : 0;

    out.push({ id: raw.id, x, y, w, h });
  }

  return out;
}

export function loadLayout(): LayoutItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    // Only seed the default layout on first visit (no saved key yet).
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;
    return normalizeLayout(parsed);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function layoutToGridWidgets(items: LayoutItem[]) {
  return normalizeLayout(items).map((item) => {
    const def = WIDGETS[item.id];
    return {
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: def.minW,
      minH: def.minH,
    };
  });
}
