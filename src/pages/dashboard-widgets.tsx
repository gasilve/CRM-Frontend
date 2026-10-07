import {
  Activity,
  AlertOctagon,
  Building2,
  CheckSquare,
  Clock,
  CloudSun,
  FileWarning,
  Filter,
  FolderKanban,
  Inbox,
  Landmark,
  ListTodo,
  MapPin,
  Newspaper,
  Scale,
  Search,
  ShieldCheck,
  StickyNote,
  UserCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { CaseloadOverview } from "./widgets/CaseloadOverview";
import { RushOverdueQueue } from "./widgets/RushOverdueQueue";
import { FieldCoverageToday } from "./widgets/FieldCoverageToday";
import { PendingIntakeInbox } from "./widgets/PendingIntakeInbox";
import { FieldWeatherOutlook } from "./widgets/FieldWeatherOutlook";
import { MyActiveCases } from "./widgets/MyActiveCases";
import { ClientPortfolio } from "./widgets/ClientPortfolio";
import { ClientMasterDetail } from "./widgets/ClientMasterDetail";
import { RecentCaseActivity } from "./widgets/RecentCaseActivity";
import { FileIntakeHealth } from "./widgets/FileIntakeHealth";
import { CaseAgingTurnaround } from "./widgets/CaseAgingTurnaround";
import { CaseAgingFunnel } from "./widgets/CaseAgingFunnel";
import { RegionalCaseMap } from "./widgets/RegionalCaseMap";
import { TeamAccessSnapshot } from "./widgets/TeamAccessSnapshot";
import { FraudIntelTicker } from "./widgets/FraudIntelTicker";
import { LandmarkPrecedents } from "./widgets/LandmarkPrecedents";
import { RegulatoryWatch } from "./widgets/RegulatoryWatch";
import { FraudIntelResearch } from "./widgets/FraudIntelResearch";
import { PersonalNotes } from "./widgets/PersonalNotes";
import { PersonalChecklist } from "./widgets/PersonalChecklist";
import { NotesChecklistCombo } from "./widgets/NotesChecklistCombo";
import { designPx } from "@/lib/rem";

export type WidgetId =
  | "fraud-intel-ticker"
  | "landmark-precedents"
  | "regulatory-watch"
  | "fraud-intel-research"
  | "caseload-overview"
  | "rush-overdue-queue"
  | "field-coverage-today"
  | "pending-intake-inbox"
  | "field-weather-outlook"
  | "my-active-cases"
  | "client-portfolio"
  | "client-master-detail"
  | "recent-case-activity"
  | "file-intake-health"
  | "case-aging-turnaround"
  | "case-aging-funnel"
  | "regional-case-map"
  | "team-access-snapshot"
  | "personal-notes"
  | "personal-checklist"
  | "notes-checklist";

export type WidgetDef = {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  folder: "Ops" | "Intel" | "Evidence" | "Field" | "Admin";
  /**
   * INVARIANT: defaultW >= minW  and  defaultH >= minH.
   */
  minH: number;
  minW: number;
  defaultW: number;
  defaultH: number;
  render: () => React.ReactNode;
};

/**
 * Footprints are defaults for dock preview / first drop.
 * Widgets must look good at any size via useWidgetLayout — do not inflate minH
 * to paper over bad density recipes.
 */
export const WIDGETS: Record<WidgetId, WidgetDef> = {
  "fraud-intel-ticker": {
    id: "fraud-intel-ticker",
    label: "Fraud Intel Ticker",
    icon: Newspaper,
    folder: "Intel",
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 5,
    render: () => <FraudIntelTicker />,
  },
  "landmark-precedents": {
    id: "landmark-precedents",
    label: "Landmark Cases & Precedents",
    icon: Scale,
    folder: "Intel",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 4,
    render: () => <LandmarkPrecedents />,
  },
  "regulatory-watch": {
    id: "regulatory-watch",
    label: "Regulatory & Legislative Watch",
    icon: Landmark,
    folder: "Intel",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 4,
    render: () => <RegulatoryWatch />,
  },
  "fraud-intel-research": {
    id: "fraud-intel-research",
    label: "Fraud Intel Research",
    icon: Search,
    folder: "Intel",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <FraudIntelResearch />,
  },
  "caseload-overview": {
    id: "caseload-overview",
    label: "Caseload Overview",
    icon: FolderKanban,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <CaseloadOverview />,
  },
  "rush-overdue-queue": {
    id: "rush-overdue-queue",
    label: "Rush & Overdue",
    icon: AlertOctagon,
    folder: "Ops",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 4,
    render: () => <RushOverdueQueue />,
  },
  "field-coverage-today": {
    id: "field-coverage-today",
    label: "Field Coverage Today",
    icon: Users2,
    folder: "Field",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <FieldCoverageToday />,
  },
  "pending-intake-inbox": {
    id: "pending-intake-inbox",
    label: "Rush Queue",
    icon: Inbox,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <PendingIntakeInbox />,
  },
  "field-weather-outlook": {
    id: "field-weather-outlook",
    label: "Field Weather Outlook",
    icon: CloudSun,
    folder: "Field",
    minH: 2,
    minW: 2,
    defaultW: 4,
    defaultH: 4,
    render: () => <FieldWeatherOutlook />,
  },
  "my-active-cases": {
    id: "my-active-cases",
    label: "My Active Cases",
    icon: UserCheck,
    folder: "Ops",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <MyActiveCases />,
  },
  "client-portfolio": {
    id: "client-portfolio",
    label: "Client Portfolio",
    icon: Building2,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <ClientPortfolio />,
  },
  "client-master-detail": {
    id: "client-master-detail",
    label: "Client Master Detail",
    icon: Building2,
    folder: "Ops",
    minH: 3,
    minW: 4,
    defaultW: 6,
    defaultH: 4,
    render: () => <ClientMasterDetail />,
  },
  "recent-case-activity": {
    id: "recent-case-activity",
    label: "Recent Case Activity",
    icon: Activity,
    folder: "Ops",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 3,
    render: () => <RecentCaseActivity />,
  },
  "file-intake-health": {
    id: "file-intake-health",
    label: "Evidence & File Health",
    icon: FileWarning,
    folder: "Evidence",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <FileIntakeHealth />,
  },
  "case-aging-turnaround": {
    id: "case-aging-turnaround",
    label: "Aging Buckets",
    icon: Clock,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <CaseAgingTurnaround />,
  },
  "case-aging-funnel": {
    id: "case-aging-funnel",
    label: "Aging Funnel",
    icon: Filter,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <CaseAgingFunnel />,
  },
  "regional-case-map": {
    id: "regional-case-map",
    label: "Regional Case Map",
    icon: MapPin,
    folder: "Field",
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 4,
    render: () => <RegionalCaseMap />,
  },
  "team-access-snapshot": {
    id: "team-access-snapshot",
    label: "Team & Access",
    icon: ShieldCheck,
    folder: "Admin",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <TeamAccessSnapshot />,
  },
  "personal-notes": {
    id: "personal-notes",
    label: "Notes",
    icon: StickyNote,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <PersonalNotes />,
  },
  "personal-checklist": {
    id: "personal-checklist",
    label: "Checklist",
    icon: CheckSquare,
    folder: "Ops",
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: () => <PersonalChecklist />,
  },
  "notes-checklist": {
    id: "notes-checklist",
    label: "Notes + Checklist",
    icon: ListTodo,
    folder: "Ops",
    minH: 2,
    minW: 3,
    defaultW: 3,
    defaultH: 4,
    render: () => <NotesChecklistCombo />,
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

/** Dock card native pixel size for a given grid column width. */
export function dockWidgetNativePixels(def: WidgetDef, gridWidthPx: number) {
  const colW = (gridWidthPx - (COLUMNS - 1) * designPx(GRID_MARGIN)) / COLUMNS;
  const nativeW = def.defaultW * colW + (def.defaultW - 1) * designPx(GRID_MARGIN);
  const nativeH = def.defaultH * designPx(CELL_HEIGHT) + (def.defaultH - 1) * designPx(GRID_MARGIN);
  return { nativeW, nativeH };
}

export function widgetFootprint(defOrId: WidgetDef | WidgetId): { w: number; h: number } {
  const def = typeof defOrId === "string" ? WIDGETS[defOrId] : defOrId;
  return { w: def.defaultW, h: def.defaultH };
}

export function layoutToGridWidgets(layout: LayoutItem[]) {
  return layout.map((item) => {
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

/** Preview scale for dock carousel cards. */
export function dockPreviewDimensions(def: WidgetDef, actualGridWidth?: number) {
  let frameW = designPx(220);
  let frameH = designPx(155);
  const maxW = designPx(220);
  const maxH = designPx(155);
  const fit = Math.min(1, maxW / frameW, maxH / frameH);
  frameW = Math.round(frameW * fit);
  frameH = Math.round(frameH * fit);

  const { nativeW, nativeH } = dockWidgetNativePixels(def, actualGridWidth ?? designPx(1200));
  const scale = Math.min(frameW / nativeW, frameH / nativeH);

  return { frameW, frameH, nativeW, nativeH, scale };
}

export type LayoutItem = {
  id: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Multi-dashboard board id (reuses grid-layout pages). */
  pageId?: string;
};

export const DASHBOARD_BOARD_1 = "board-1";
export const DASHBOARD_BOARD_2 = "board-2";
/** Two boards by default so carousel arrows match the case page. */
export const DASHBOARD_DEFAULT_PAGES = [
  { id: DASHBOARD_BOARD_1, name: "1" },
  { id: DASHBOARD_BOARD_2, name: "2" },
];
export const DASHBOARD_MAX_BOARDS = 5;
/**
 * Hard cap on dashboard grid rows (case detail uses 9). Sized to fill a typical
 * laptop viewport with cellHeight 84 + margin 8.
 */
export const DASHBOARD_MAX_ROWS = 10;

/** Intel-first starter layout — fits within DASHBOARD_MAX_ROWS. */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "fraud-intel-ticker", x: 0, y: 0, w: 6, h: 4, pageId: DASHBOARD_BOARD_1 },
  { id: "landmark-precedents", x: 6, y: 0, w: 3, h: 4, pageId: DASHBOARD_BOARD_1 },
  { id: "regulatory-watch", x: 9, y: 0, w: 3, h: 4, pageId: DASHBOARD_BOARD_1 },
  { id: "fraud-intel-research", x: 0, y: 4, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "caseload-overview", x: 3, y: 4, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "rush-overdue-queue", x: 6, y: 4, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "notes-checklist", x: 9, y: 4, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "case-aging-funnel", x: 0, y: 7, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "case-aging-turnaround", x: 3, y: 7, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "my-active-cases", x: 6, y: 7, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
  { id: "recent-case-activity", x: 9, y: 7, w: 3, h: 3, pageId: DASHBOARD_BOARD_1 },
];

/**
 * Where this layout lived before it moved to the server. Read once per user to
 * carry their existing arrangement over, then removed. Safe to delete when no
 * client can still be holding one.
 */
export const DASHBOARD_LEGACY_LS_KEY = "accenty.crm.dashboard.layout.v7";
export const COLUMNS = 12;
export const CELL_HEIGHT = 84;
export const GRID_MARGIN = 8;

/** Pixel height of a full dashboard board (matches case-detail shell math). */
export function dashboardBoardHeightPx(): number {
  const cell = designPx(CELL_HEIGHT);
  const margin = designPx(GRID_MARGIN);
  return DASHBOARD_MAX_ROWS * (cell + margin) + margin;
}

export function normalizeLayout(items: LayoutItem[]): LayoutItem[] {
  const seen = new Set<string>();
  const out: LayoutItem[] = [];

  for (const raw of items) {
    // Drop retired / unknown widgets (e.g. pre-surveillance).
    if (!WIDGETS[raw.id as WidgetId]) continue;
    const pageId = raw.pageId ?? DASHBOARD_BOARD_1;
    const key = `${pageId}:${raw.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const def = WIDGETS[raw.id as WidgetId];
    const w = Number.isFinite(raw.w)
      ? Math.max(def.minW, Math.min(COLUMNS, Math.floor(raw.w)))
      : def.defaultW;
    let h = Number.isFinite(raw.h)
      ? Math.max(def.minH, Math.floor(raw.h))
      : def.defaultH;
    h = Math.min(h, DASHBOARD_MAX_ROWS);
    const x = Number.isFinite(raw.x)
      ? Math.max(0, Math.min(COLUMNS - w, Math.floor(raw.x)))
      : 0;
    let y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y)) : 0;
    if (y + h > DASHBOARD_MAX_ROWS) y = Math.max(0, DASHBOARD_MAX_ROWS - h);

    out.push({ id: raw.id as WidgetId, x, y, w, h, pageId });
  }

  return out;
}

export function normalizeDashboardDocument(
  items: LayoutItem[],
  pages: { id: string; name: string }[] | null | undefined,
): { items: LayoutItem[]; pages: { id: string; name: string }[] } {
  let nextPages =
    pages && pages.length > 0
      ? pages.map((p, i) => ({ id: p.id, name: p.name?.trim() || String(i + 1) })).slice(0, DASHBOARD_MAX_BOARDS)
      : [...DASHBOARD_DEFAULT_PAGES];
  // Always keep at least two boards so case-style carousel arrows are available.
  if (nextPages.length < 2) {
    const first = nextPages[0] ?? { id: DASHBOARD_BOARD_1, name: "1" };
    nextPages = [
      first,
      {
        id: first.id === DASHBOARD_BOARD_2 ? `${DASHBOARD_BOARD_1}-extra` : DASHBOARD_BOARD_2,
        name: "2",
      },
    ];
  }
  const pageIds = new Set(nextPages.map((p) => p.id));
  const nextItems = normalizeLayout(items).map((item) => ({
    ...item,
    pageId: item.pageId && pageIds.has(item.pageId) ? item.pageId : nextPages[0].id,
  }));
  return { items: nextItems, pages: nextPages };
}
