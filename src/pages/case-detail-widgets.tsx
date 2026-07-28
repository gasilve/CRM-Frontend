import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Clock,
  FileText,
  Tag,
  User,
  Briefcase,
} from "lucide-react";
import type { InvCase, Investigator, TimeEntry } from "@/lib/mock-data";
import {
  CaseInfoPanel,
  InvestigatorsPanel,
  NotesPanel,
  SubjectDetailsPanel,
  SubjectPhotoPanel,
  TagsPanel,
  TimelinePanel,
  TimeLogPanel,
} from "./case-detail-panels";

export type CasePanelId =
  | "subject-photo"
  | "subject-details"
  | "timeline"
  | "case-info"
  | "tags"
  | "investigators"
  | "time-log"
  | "notes";

export type CaseLayoutItem = {
  id: CasePanelId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CasePanelCtx = {
  case: InvCase;
  investigators: Investigator[];
  timeEntries: TimeEntry[];
};

export type CasePanelDef = {
  id: CasePanelId;
  label: string;
  icon: LucideIcon;
  minH: number;
  minW: number;
  defaultW: number;
  defaultH: number;
  render: (ctx: CasePanelCtx) => ReactNode;
};

export const CASE_PANELS: Record<CasePanelId, CasePanelDef> = {
  "subject-photo": {
    id: "subject-photo",
    label: "Photo",
    icon: User,
    minH: 5,
    minW: 2,
    defaultW: 3,
    defaultH: 6,
    render: (ctx) => <SubjectPhotoPanel c={ctx.case} />,
  },
  "subject-details": {
    id: "subject-details",
    label: "Subject",
    icon: User,
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 4,
    render: (ctx) => <SubjectDetailsPanel c={ctx.case} />,
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    icon: Calendar,
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 2,
    render: (ctx) => <TimelinePanel c={ctx.case} />,
  },
  "case-info": {
    id: "case-info",
    label: "Case info",
    icon: Briefcase,
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: (ctx) => <CaseInfoPanel c={ctx.case} />,
  },
  tags: {
    id: "tags",
    label: "Tags",
    icon: Tag,
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 2,
    render: (ctx) => <TagsPanel c={ctx.case} />,
  },
  investigators: {
    id: "investigators",
    label: "Investigators",
    icon: User,
    minH: 2,
    minW: 2,
    defaultW: 3,
    defaultH: 3,
    render: (ctx) => (
      <InvestigatorsPanel investigators={ctx.investigators} />
    ),
  },
  "time-log": {
    id: "time-log",
    label: "Time log",
    icon: Clock,
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 4,
    render: (ctx) => <TimeLogPanel entries={ctx.timeEntries} />,
  },
  notes: {
    id: "notes",
    label: "Notes",
    icon: FileText,
    minH: 2,
    minW: 3,
    defaultW: 6,
    defaultH: 2,
    render: (ctx) => <NotesPanel c={ctx.case} />,
  },
};

export const CASE_PANEL_LIST = Object.values(CASE_PANELS);

export const CASE_DEFAULT_LAYOUT: CaseLayoutItem[] = [
  { id: "subject-photo", x: 0, y: 0, w: 3, h: 6 },
  { id: "subject-details", x: 3, y: 0, w: 3, h: 4 },
  { id: "timeline", x: 6, y: 0, w: 6, h: 2 },
  { id: "case-info", x: 6, y: 2, w: 3, h: 3 },
  { id: "tags", x: 9, y: 2, w: 3, h: 2 },
  { id: "investigators", x: 9, y: 4, w: 3, h: 3 },
  { id: "time-log", x: 0, y: 6, w: 6, h: 4 },
  { id: "notes", x: 6, y: 5, w: 3, h: 3 },
];

export const CASE_LS_KEY = "accenty.crm.case-detail.layout.v2";
export const CASE_COLUMNS = 12;
export const CASE_CELL_HEIGHT = 84;
export const CASE_GRID_MARGIN = 8;

export function normalizeCaseLayout(items: CaseLayoutItem[]): CaseLayoutItem[] {
  const seen = new Set<CasePanelId>();
  const out: CaseLayoutItem[] = [];

  for (const raw of items) {
    if (!CASE_PANELS[raw.id] || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const def = CASE_PANELS[raw.id];
    const w = Number.isFinite(raw.w)
      ? Math.max(def.minW, Math.min(CASE_COLUMNS, Math.floor(raw.w)))
      : def.defaultW;
    const h = Number.isFinite(raw.h)
      ? Math.max(def.minH, Math.floor(raw.h))
      : def.defaultH;
    const x = Number.isFinite(raw.x)
      ? Math.max(0, Math.min(CASE_COLUMNS - w, Math.floor(raw.x)))
      : 0;
    const y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y)) : 0;
    out.push({ id: raw.id, x, y, w, h });
  }

  // Ensure every known panel exists (new panels after upgrades)
  for (const def of CASE_PANEL_LIST) {
    if (seen.has(def.id)) continue;
    out.push({
      id: def.id,
      x: 0,
      y: out.reduce((m, i) => Math.max(m, i.y + i.h), 0),
      w: def.defaultW,
      h: def.defaultH,
    });
  }

  return out;
}

export function loadCaseLayout(): CaseLayoutItem[] {
  try {
    const raw = localStorage.getItem(CASE_LS_KEY);
    if (!raw) return CASE_DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as CaseLayoutItem[];
    if (!Array.isArray(parsed)) return CASE_DEFAULT_LAYOUT;
    return normalizeCaseLayout(parsed);
  } catch {
    return CASE_DEFAULT_LAYOUT;
  }
}

export function layoutToCaseGridWidgets(items: CaseLayoutItem[]) {
  return normalizeCaseLayout(items).map((item) => {
    const def = CASE_PANELS[item.id];
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
