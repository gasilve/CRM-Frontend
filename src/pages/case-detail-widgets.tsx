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

export type CasePage = {
  id: string;
  name: string;
};

export type CaseLayoutItem = {
  id: CasePanelId;
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CasePanelCtx = {
  case: CaseDetail;
  currentUserId: string;
  investigatorOptions: { id: string; name: string }[];
  onRefresh: () => void;

  canEdit: boolean;
  canAssign: boolean;
  canPostJournal: boolean;
  canModerateJournal: boolean;
  /** False when the administrator has hidden this field from the viewer's role. */
  canSee: (field: string) => boolean;
  /** True only when the field is fully writable for the viewer's role. */
  canEditField: (field: string) => boolean;
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
/** Rows per page. 9 gives three stacked rows of the common h=3 widgets. */
export const CASE_PAGE_ROWS = 9;

export const CASE_PAGE_OVERVIEW = "page-overview";
export const CASE_PAGE_DETAILS = "page-details";

export const CASE_DEFAULT_PAGES: CasePage[] = [
  { id: CASE_PAGE_OVERVIEW, name: "Overview" },
  { id: CASE_PAGE_DETAILS, name: "Details" },
];

/** Widgets split across carousel pages so each page fits one screen. */
export const CASE_DEFAULT_LAYOUT: CaseLayoutItem[] = [
  { id: "case-info", pageId: CASE_PAGE_OVERVIEW, x: 0, y: 0, w: 6, h: 3 },
  { id: "addresses-map", pageId: CASE_PAGE_OVERVIEW, x: 6, y: 0, w: 3, h: 6 },
  { id: "subject-photo", pageId: CASE_PAGE_OVERVIEW, x: 9, y: 0, w: 3, h: 6 },
  { id: "identity", pageId: CASE_PAGE_OVERVIEW, x: 0, y: 3, w: 3, h: 3 },
  { id: "work", pageId: CASE_PAGE_OVERVIEW, x: 3, y: 3, w: 3, h: 3 },

  { id: "assignment", pageId: CASE_PAGE_DETAILS, x: 0, y: 0, w: 3, h: 3 },
  { id: "client-adjuster", pageId: CASE_PAGE_DETAILS, x: 3, y: 0, w: 3, h: 3 },
  { id: "tags", pageId: CASE_PAGE_DETAILS, x: 6, y: 0, w: 3, h: 3 },
  { id: "description", pageId: CASE_PAGE_DETAILS, x: 9, y: 0, w: 3, h: 3 },
  { id: "vehicles", pageId: CASE_PAGE_DETAILS, x: 0, y: 3, w: 12, h: 3 },
];

/**
 * Legacy localStorage key from before layouts moved to the server. Cleared
 * after the shared house layout (or built-in default) loads — no longer a
 * source of truth. Safe to delete when no client can still be holding one.
 */
export const CASE_LEGACY_LS_KEY = "accenty.crm.case-detail.layout.v5";

function newPageId(): string {
  return `page-${Math.random().toString(36).slice(2, 10)}`;
}

/** Clamp a widget into the page row budget. */
function clampItem(
  raw: { id: CasePanelId; pageId?: string; x?: number; y?: number; w?: number; h?: number },
  pageId: string,
): CaseLayoutItem {
  const def = CASE_PANELS[raw.id];
  const w = Number.isFinite(raw.w) ? Math.max(def.minW, Math.min(CASE_COLUMNS, Math.floor(raw.w!))) : def.minW;
  let h = Number.isFinite(raw.h) ? Math.max(def.minH, Math.floor(raw.h!)) : def.minH;
  h = Math.min(h, CASE_PAGE_ROWS);
  const x = Number.isFinite(raw.x) ? Math.max(0, Math.min(CASE_COLUMNS - w, Math.floor(raw.x!))) : 0;
  let y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y!)) : 0;
  if (y + h > CASE_PAGE_ROWS) y = Math.max(0, CASE_PAGE_ROWS - h);
  return { id: raw.id, pageId, x, y, w, h };
}

/**
 * Normalize a saved (or legacy flat) layout into pages + items. Legacy rows
 * without pageId are split: anything that would overflow page 1 goes to page 2.
 */
export function normalizeCaseDocument(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
  pages?: CasePage[] | null,
): { pages: CasePage[]; items: CaseLayoutItem[] } {
  const hasPageIds = items.some((i) => typeof i.pageId === "string" && i.pageId.length > 0);

  let nextPages: CasePage[] =
    pages && pages.length > 0
      ? pages
          .filter((p) => p.id && p.name)
          .map((p) => ({ id: String(p.id), name: String(p.name).slice(0, 80) || "Page" }))
      : CASE_DEFAULT_PAGES.map((p) => ({ ...p }));

  if (nextPages.length === 0) {
    nextPages = CASE_DEFAULT_PAGES.map((p) => ({ ...p }));
  }

  const pageIds = new Set(nextPages.map((p) => p.id));
  const seen = new Set<CasePanelId>();
  const out: CaseLayoutItem[] = [];

  if (!hasPageIds) {
    // Migrate flat layouts: keep what fits on page 1, spill the rest to page 2.
    if (nextPages.length < 2) {
      nextPages = [
        nextPages[0] ?? { id: CASE_PAGE_OVERVIEW, name: "Overview" },
        { id: CASE_PAGE_DETAILS, name: "Details" },
      ];
    }
    const page1 = nextPages[0].id;
    const page2 = nextPages[1].id;

    for (const raw of items) {
      const id = raw.id as CasePanelId;
      if (!CASE_PANELS[id] || seen.has(id)) continue;
      seen.add(id);
      const y = Number.isFinite(raw.y) ? Math.floor(raw.y!) : 0;
      const h = Number.isFinite(raw.h) ? Math.floor(raw.h!) : CASE_PANELS[id].minH;
      if (y + h <= CASE_PAGE_ROWS) {
        out.push(clampItem({ ...raw, id }, page1));
      } else {
        out.push(clampItem({ ...raw, id, y: 0 }, page2));
      }
    }
  } else {
    for (const raw of items) {
      const id = raw.id as CasePanelId;
      if (!CASE_PANELS[id] || seen.has(id)) continue;
      seen.add(id);
      let pageId = raw.pageId && pageIds.has(raw.pageId) ? raw.pageId : nextPages[0].id;
      if (!pageIds.has(pageId)) {
        pageId = nextPages[0].id;
      }
      out.push(clampItem({ ...raw, id }, pageId));
    }
  }

  for (const def of CASE_PANEL_LIST) {
    if (seen.has(def.id)) continue;
    const fallback = CASE_DEFAULT_LAYOUT.find((i) => i.id === def.id);
    const pageId =
      fallback && pageIds.has(fallback.pageId) ? fallback.pageId : nextPages[nextPages.length - 1].id;
    const onPage = out.filter((i) => i.pageId === pageId);
    const bottom = onPage.reduce((m, i) => Math.max(m, i.y + i.h), 0);
    const h = fallback?.h ?? def.minH;
    const y = bottom + h <= CASE_PAGE_ROWS ? bottom : 0;
    out.push(
      clampItem(
        {
          id: def.id,
          pageId,
          x: fallback?.x ?? 0,
          y,
          w: fallback?.w ?? def.minW,
          h,
        },
        pageId,
      ),
    );
  }

  return { pages: nextPages, items: out };
}

/** @deprecated Prefer normalizeCaseDocument — kept for call sites that only need items. */
export function normalizeCaseLayout(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
): CaseLayoutItem[] {
  return normalizeCaseDocument(items).items;
}

export function layoutToCaseGridWidgets(items: CaseLayoutItem[]) {
  return items.map((item) => {
    const def = CASE_PANELS[item.id];
    return {
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: def.minW,
      minH: def.minH,
      maxW: CASE_COLUMNS,
      // A page is one screen — a widget can never be taller than that.
      maxH: CASE_PAGE_ROWS,
    };
  });
}

export function itemsForPage(items: CaseLayoutItem[], pageId: string): CaseLayoutItem[] {
  return items.filter((i) => i.pageId === pageId);
}

export function createCasePage(name = "New page"): CasePage {
  return { id: newPageId(), name };
}
