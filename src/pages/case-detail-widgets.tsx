import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User, Briefcase, Tag, MapPin, Car, Users2, ScrollText,
} from "lucide-react";
import type { CaseDetail } from "@/lib/crm-api";
import {
  AddressesMapPanel,
  AssignmentPanel,
  CaseInfoPanel,
  ClientAdjusterPanel,
  DescriptionPanel,
  IdentityPanel,
  SubjectPhotoPanel,
  TagsPanel,
  VehiclesPanel,
  WorkPanel,
} from "./case-detail-panels";

export type CasePanelId =
  | "subject-photo"
  | "identity"
  | "work"
  | "client-adjuster"
  | "case-info"
  | "tags"
  | "assignment"
  | "addresses-map"
  | "vehicles"
  | "description";

export type CaseLayoutItem = {
  id: CasePanelId;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CasePanelCtx = {
  case: CaseDetail;
  isAdmin: boolean;
  currentUserId: string;
  investigatorOptions: { id: string; name: string }[];
  onRefresh: () => void;
};

export type CasePanelDef = {
  id: CasePanelId;
  label: string;
  icon: LucideIcon;
  minH: number;
  minW: number;
  render: (ctx: CasePanelCtx) => ReactNode;
};

export const CASE_PANELS: Record<CasePanelId, CasePanelDef> = {
  "subject-photo": {
    id: "subject-photo", label: "Photo", icon: User,
    minH: 4, minW: 2,
    render: (ctx) => <SubjectPhotoPanel ctx={ctx} />,
  },
  identity: {
    id: "identity", label: "Identity", icon: User,
    minH: 3, minW: 2,
    render: (ctx) => <IdentityPanel ctx={ctx} />,
  },
  work: {
    id: "work", label: "Work", icon: Briefcase,
    minH: 3, minW: 2,
    render: (ctx) => <WorkPanel ctx={ctx} />,
  },
  "client-adjuster": {
    id: "client-adjuster", label: "Client", icon: Briefcase,
    minH: 3, minW: 2,
    render: (ctx) => <ClientAdjusterPanel ctx={ctx} />,
  },
  "case-info": {
    id: "case-info", label: "Assignment details", icon: Briefcase,
    minH: 3, minW: 3,
    render: (ctx) => <CaseInfoPanel ctx={ctx} />,
  },
  tags: {
    id: "tags", label: "Tags", icon: Tag,
    minH: 2, minW: 2,
    render: (ctx) => <TagsPanel ctx={ctx} />,
  },
  assignment: {
    id: "assignment", label: "Assignment", icon: Users2,
    minH: 2, minW: 2,
    render: (ctx) => <AssignmentPanel ctx={ctx} />,
  },
  "addresses-map": {
    id: "addresses-map", label: "Addresses & map", icon: MapPin,
    minH: 4, minW: 2,
    render: (ctx) => <AddressesMapPanel ctx={ctx} />,
  },
  vehicles: {
    id: "vehicles", label: "Vehicles", icon: Car,
    minH: 3, minW: 3,
    render: (ctx) => <VehiclesPanel ctx={ctx} />,
  },
  description: {
    id: "description", label: "Description", icon: ScrollText,
    minH: 2, minW: 2,
    render: (ctx) => <DescriptionPanel ctx={ctx} />,
  },
};

export const CASE_PANEL_LIST = Object.values(CASE_PANELS);

export const CASE_COLUMNS = 12;
/** Design px at 1920 — convert with designPx() when configuring GridStack. */
export const CASE_CELL_HEIGHT = 84;
export const CASE_GRID_MARGIN = 8;

/** All widgets live on one page (grid grows vertically); the activity journal
 * is a fixed folder section below the grid, not a widget. */
export const CASE_DEFAULT_LAYOUT: CaseLayoutItem[] = [
  { id: "case-info",       x: 0, y: 0, w: 6, h: 3 },
  { id: "identity",        x: 0, y: 3, w: 3, h: 3 },
  { id: "work",            x: 3, y: 3, w: 3, h: 3 },
  { id: "addresses-map",   x: 6, y: 0, w: 3, h: 6 },
  { id: "subject-photo",   x: 9, y: 0, w: 3, h: 6 },
  { id: "assignment",      x: 0, y: 6, w: 3, h: 3 },
  { id: "client-adjuster", x: 3, y: 6, w: 3, h: 3 },
  { id: "tags",            x: 6, y: 6, w: 3, h: 3 },
  { id: "description",     x: 9, y: 6, w: 3, h: 3 },
  { id: "vehicles",        x: 0, y: 9, w: 12, h: 3 },
];

/**
 * Where this layout lived before it moved to the server. Read once per user to
 * carry their existing arrangement over, then removed. Safe to delete when no
 * client can still be holding one.
 */
export const CASE_LEGACY_LS_KEY = "accenty.crm.case-detail.layout.v5";

export function normalizeCaseLayout(items: CaseLayoutItem[]): CaseLayoutItem[] {
  const seen = new Set<CasePanelId>();
  const out: CaseLayoutItem[] = [];

  for (const raw of items) {
    if (!CASE_PANELS[raw.id] || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const def = CASE_PANELS[raw.id];
    const w = Number.isFinite(raw.w) ? Math.max(def.minW, Math.min(CASE_COLUMNS, Math.floor(raw.w))) : def.minW;
    const h = Number.isFinite(raw.h) ? Math.max(def.minH, Math.floor(raw.h)) : def.minH;
    const x = Number.isFinite(raw.x) ? Math.max(0, Math.min(CASE_COLUMNS - w, Math.floor(raw.x))) : 0;
    const y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y)) : 0;
    out.push({ id: raw.id, x, y, w, h });
  }

  // Panels missing from the saved layout get appended at the bottom in their default size.
  for (const def of CASE_PANEL_LIST) {
    if (seen.has(def.id)) continue;
    const fallback = CASE_DEFAULT_LAYOUT.find((i) => i.id === def.id);
    const bottom = out.reduce((m, i) => Math.max(m, i.y + i.h), 0);
    out.push({ id: def.id, x: 0, y: bottom, w: fallback?.w ?? def.minW, h: fallback?.h ?? def.minH });
  }

  return out;
}

export function layoutToCaseGridWidgets(items: CaseLayoutItem[]) {
  return normalizeCaseLayout(items).map((item) => {
    const def = CASE_PANELS[item.id];
    return { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h, minW: def.minW, minH: def.minH };
  });
}
