import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User, Briefcase, Tag, MapPin, Users2, ScrollText, Paperclip,
} from "lucide-react";
import type { CaseDetail, GridLayoutWidget } from "@/lib/crm-api";
import {
  AddressesMapPanel,
  AssignmentPanel,
  CaseFilesPanel,
  CaseInfoPanel,
  ClientAdjusterPanel,
  DescriptionPanel,
  IdentityPanel,
  SubjectPhotoPanel,
  TagsPanel,
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
  | "files"
  | "description";

export type CasePage = {
  id: string;
  name: string;
};

/** SuperAdmin-built widget definition, stored in the layout document. */
export type CustomCaseWidgetDef = GridLayoutWidget;

/** Layout item ids are premade panel ids or `custom-*` widget-def ids. */
export type CaseLayoutItem = {
  id: string;
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

  /** Resolves a custom widget definition by layout id. Reads live state. */
  getCustomWidget: (id: string) => CustomCaseWidgetDef | null;
  /** Present only for SuperAdmins in edit mode — opens the widget builder. */
  onEditCustomWidget?: (id: string) => void;

  /**
   * File-source overrides for surfaces whose documents live behind another
   * endpoint (the pending-intake view renders this same widget set against a
   * proposal). When absent, panels use the regular /cases/:id/files routes.
   */
  loadFileBlob?: (fileId: string, signal?: AbortSignal) => Promise<Blob>;
  fileDownloadHref?: (fileId: string) => string;
};

export type CasePanelDef = {
  id: CasePanelId;
  label: string;
  icon: LucideIcon;
  minH: number;
  minW: number;
  /** Dock footprint. INVARIANT: defaultW >= minW and defaultH >= minH. */
  defaultW: number;
  defaultH: number;
  render: (ctx: CasePanelCtx) => ReactNode;
};

export const CASE_PANELS: Record<CasePanelId, CasePanelDef> = {
  "subject-photo": {
    id: "subject-photo", label: "Photo", icon: User,
    minH: 4, minW: 2, defaultW: 3, defaultH: 6,
    render: (ctx) => <SubjectPhotoPanel ctx={ctx} />,
  },
  identity: {
    id: "identity", label: "Identity", icon: User,
    minH: 3, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <IdentityPanel ctx={ctx} />,
  },
  work: {
    id: "work", label: "Work", icon: Briefcase,
    minH: 3, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <WorkPanel ctx={ctx} />,
  },
  "client-adjuster": {
    id: "client-adjuster", label: "Client", icon: Briefcase,
    minH: 3, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <ClientAdjusterPanel ctx={ctx} />,
  },
  "case-info": {
    id: "case-info", label: "Assignment details", icon: Briefcase,
    minH: 3, minW: 3, defaultW: 6, defaultH: 3,
    render: (ctx) => <CaseInfoPanel ctx={ctx} />,
  },
  tags: {
    id: "tags", label: "Tags", icon: Tag,
    minH: 2, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <TagsPanel ctx={ctx} />,
  },
  assignment: {
    id: "assignment", label: "Assignment", icon: Users2,
    minH: 2, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <AssignmentPanel ctx={ctx} />,
  },
  "addresses-map": {
    id: "addresses-map", label: "Addresses & map", icon: MapPin,
    minH: 4, minW: 2, defaultW: 3, defaultH: 6,
    render: (ctx) => <AddressesMapPanel ctx={ctx} />,
  },
  files: {
    id: "files", label: "Files", icon: Paperclip,
    minH: 2, minW: 2, defaultW: 3, defaultH: 4,
    render: (ctx) => <CaseFilesPanel ctx={ctx} />,
  },
  description: {
    id: "description", label: "Description", icon: ScrollText,
    minH: 2, minW: 2, defaultW: 3, defaultH: 3,
    render: (ctx) => <DescriptionPanel ctx={ctx} />,
  },
};

export const CASE_PANEL_LIST = Object.values(CASE_PANELS);

// ─── Custom widgets ─────────────────────────────────────────────────────────

export const CUSTOM_WIDGET_PREFIX = "custom-";
/** Dock template id — dropping it creates a brand-new custom widget. */
export const CUSTOM_WIDGET_TEMPLATE_ID = "custom-template";
export const CUSTOM_WIDGET_MIN_W = 2;
export const CUSTOM_WIDGET_MIN_H = 2;
export const CUSTOM_WIDGET_DEFAULT_W = 3;
export const CUSTOM_WIDGET_DEFAULT_H = 3;
export const CUSTOM_WIDGET_MAX_FIELDS = 12;
/** How many columns the widget uses when rendering its fields. */
export type CustomWidgetColumns = 1 | 2 | 3;

export function normalizeWidgetColumns(value: unknown): CustomWidgetColumns {
  return value === 2 || value === 3 ? value : 1;
}

export function isCustomWidgetId(id: string): boolean {
  return id.startsWith(CUSTOM_WIDGET_PREFIX) && id !== CUSTOM_WIDGET_TEMPLATE_ID;
}

export function newCustomWidgetId(): string {
  return `${CUSTOM_WIDGET_PREFIX}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Belongs to the dock's blank template. A widget keeps this title until it is
 * named, so it can never be saved to the reusable list under it — otherwise the
 * list would fill up with indistinguishable "New widget" entries.
 */
export const RESERVED_WIDGET_TITLE = "New widget";

export function isReservedWidgetTitle(title: string): boolean {
  return title.trim().toLowerCase() === RESERVED_WIDGET_TITLE.toLowerCase();
}

export function sameWidgetTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function createCustomWidgetDef(title = RESERVED_WIDGET_TITLE): CustomCaseWidgetDef {
  return { id: newCustomWidgetId(), type: "custom", title, fields: [], columns: 1, persisted: false };
}

/** Label for any placeable widget — premade or custom. */
export function caseWidgetLabel(id: string, widgets: CustomCaseWidgetDef[] | null | undefined): string {
  const panel = CASE_PANELS[id as CasePanelId];
  if (panel) return panel.label;
  return widgets?.find((w) => w.id === id)?.title ?? "Widget";
}

type WidgetSizing = { minW: number; minH: number; defaultW: number; defaultH: number };

export function caseWidgetSizing(id: string): WidgetSizing {
  const panel = CASE_PANELS[id as CasePanelId];
  if (panel) return { minW: panel.minW, minH: panel.minH, defaultW: panel.defaultW, defaultH: panel.defaultH };
  return {
    minW: CUSTOM_WIDGET_MIN_W,
    minH: CUSTOM_WIDGET_MIN_H,
    defaultW: CUSTOM_WIDGET_DEFAULT_W,
    defaultH: CUSTOM_WIDGET_DEFAULT_H,
  };
}

// ─── Grid geometry ──────────────────────────────────────────────────────────

export const CASE_COLUMNS = 12;
/** Design px at 1920 — convert with designPx() when configuring GridStack. */
export const CASE_CELL_HEIGHT = 84;
export const CASE_GRID_MARGIN = 8;
/** Rows per page. 9 gives three stacked rows of the common h=3 widgets. */
export const CASE_PAGE_ROWS = 9;

export const CASE_PAGE_OVERVIEW = "page-overview";
/** Kept for migrating older multi-page saved layouts. */
export const CASE_PAGE_DETAILS = "page-details";

export const CASE_DEFAULT_PAGES: CasePage[] = [
  { id: CASE_PAGE_OVERVIEW, name: "Overview" },
];

/**
 * Single-screen house default — every premade panel except vehicles
 * (vehicles stay in the case action-bar drawer).
 */
export const CASE_DEFAULT_LAYOUT: CaseLayoutItem[] = [
  { id: "case-info", pageId: CASE_PAGE_OVERVIEW, x: 0, y: 0, w: 4, h: 3 },
  { id: "assignment", pageId: CASE_PAGE_OVERVIEW, x: 4, y: 0, w: 2, h: 3 },
  { id: "client-adjuster", pageId: CASE_PAGE_OVERVIEW, x: 6, y: 0, w: 3, h: 3 },
  { id: "tags", pageId: CASE_PAGE_OVERVIEW, x: 9, y: 0, w: 3, h: 3 },
  { id: "subject-photo", pageId: CASE_PAGE_OVERVIEW, x: 0, y: 3, w: 3, h: 6 },
  { id: "identity", pageId: CASE_PAGE_OVERVIEW, x: 3, y: 3, w: 3, h: 3 },
  { id: "work", pageId: CASE_PAGE_OVERVIEW, x: 6, y: 3, w: 3, h: 3 },
  { id: "addresses-map", pageId: CASE_PAGE_OVERVIEW, x: 9, y: 3, w: 3, h: 6 },
  { id: "description", pageId: CASE_PAGE_OVERVIEW, x: 3, y: 6, w: 3, h: 3 },
  { id: "files", pageId: CASE_PAGE_OVERVIEW, x: 6, y: 6, w: 3, h: 3 },
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
  raw: { id: string; pageId?: string; x?: number; y?: number; w?: number; h?: number },
  pageId: string,
): CaseLayoutItem {
  const sizing = caseWidgetSizing(raw.id);
  const w = Number.isFinite(raw.w)
    ? Math.max(sizing.minW, Math.min(CASE_COLUMNS, Math.floor(raw.w!)))
    : sizing.defaultW;
  let h = Number.isFinite(raw.h) ? Math.max(sizing.minH, Math.floor(raw.h!)) : sizing.defaultH;
  h = Math.min(h, CASE_PAGE_ROWS);
  const x = Number.isFinite(raw.x) ? Math.max(0, Math.min(CASE_COLUMNS - w, Math.floor(raw.x!))) : 0;
  let y = Number.isFinite(raw.y) ? Math.max(0, Math.floor(raw.y!)) : 0;
  if (y + h > CASE_PAGE_ROWS) y = Math.max(0, CASE_PAGE_ROWS - h);
  return { id: raw.id, pageId, x, y, w, h };
}

function sanitizeWidgets(widgets: CustomCaseWidgetDef[] | null | undefined): CustomCaseWidgetDef[] {
  if (!widgets?.length) return [];
  const seen = new Set<string>();
  const out: CustomCaseWidgetDef[] = [];
  for (const w of widgets) {
    if (!w || typeof w.id !== "string" || !isCustomWidgetId(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push({
      id: w.id,
      type: "custom",
      title: typeof w.title === "string" && w.title.trim() ? w.title.slice(0, 80) : "Widget",
      fields: Array.isArray(w.fields)
        ? w.fields
            .filter((f) => f && typeof f.key === "string" && f.key.length > 0)
            .slice(0, CUSTOM_WIDGET_MAX_FIELDS)
            .map((f) => ({ key: f.key, label: typeof f.label === "string" && f.label ? f.label.slice(0, 80) : f.key }))
        : [],
      columns: normalizeWidgetColumns(w.columns),
      persisted: w.persisted === true,
    });
  }
  return out;
}

/**
 * Panels shipped after layouts were already saved. Saved layouts predate them,
 * so on LOAD (never on persist) any missing promoted panel is pushed into the
 * first page with room. Removing one still works — the removal persists a doc
 * without it and nothing re-injects until the next full load. Once any layout
 * edit is saved, the injected panel is part of the document for good.
 */
const PROMOTED_PANEL_IDS: CasePanelId[] = ["files"];

function injectPromotedPanels(pages: CasePage[], items: CaseLayoutItem[]): CaseLayoutItem[] {
  const present = new Set(items.map((i) => i.id));
  let out = items;

  for (const id of PROMOTED_PANEL_IDS) {
    if (present.has(id)) continue;
    const sizing = caseWidgetSizing(id);

    // First page whose content leaves enough free rows at the bottom.
    let pageId = pages[pages.length - 1]?.id ?? CASE_PAGE_OVERVIEW;
    let y = Math.max(0, CASE_PAGE_ROWS - sizing.defaultH);
    for (const p of pages) {
      const bottom = out
        .filter((i) => i.pageId === p.id)
        .reduce((max, i) => Math.max(max, i.y + i.h), 0);
      if (bottom + sizing.defaultH <= CASE_PAGE_ROWS) {
        pageId = p.id;
        y = bottom;
        break;
      }
    }

    out = [...out, { id, pageId, x: 0, y, w: sizing.defaultW, h: sizing.defaultH }];
  }

  return out;
}

/**
 * Normalize a saved (or legacy flat) layout into pages + items + widget defs.
 *
 * Unlike the pre-dock era this does NOT force missing premade panels back in —
 * a panel absent from the layout is simply "removed" and lives in the dock.
 * Items whose id is neither a premade panel nor a known custom widget are
 * dropped (stale ids from an older catalog). The one exception: on load,
 * PROMOTED_PANEL_IDS are injected into layouts saved before they existed.
 */
export function normalizeCaseDocument(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
  pages?: CasePage[] | null,
  widgets?: CustomCaseWidgetDef[] | null,
  phase: "load" | "persist" = "load",
): { pages: CasePage[]; items: CaseLayoutItem[]; widgets: CustomCaseWidgetDef[] } {
  const cleanWidgets = sanitizeWidgets(widgets);
  const customIds = new Set(cleanWidgets.map((w) => w.id));
  const isKnown = (id: string) => Boolean(CASE_PANELS[id as CasePanelId]) || customIds.has(id);

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
  const seen = new Set<string>();
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
      if (!isKnown(raw.id) || seen.has(raw.id)) continue;
      seen.add(raw.id);
      const sizing = caseWidgetSizing(raw.id);
      const y = Number.isFinite(raw.y) ? Math.floor(raw.y!) : 0;
      const h = Number.isFinite(raw.h) ? Math.floor(raw.h!) : sizing.minH;
      if (y + h <= CASE_PAGE_ROWS) {
        out.push(clampItem(raw, page1));
      } else {
        out.push(clampItem({ ...raw, y: 0 }, page2));
      }
    }
  } else {
    for (const raw of items) {
      if (!isKnown(raw.id) || seen.has(raw.id)) continue;
      seen.add(raw.id);
      const pageId = raw.pageId && pageIds.has(raw.pageId) ? raw.pageId : nextPages[0].id;
      out.push(clampItem(raw, pageId));
    }
  }

  return {
    pages: nextPages,
    items: phase === "load" ? injectPromotedPanels(nextPages, out) : out,
    widgets: cleanWidgets,
  };
}

/** @deprecated Prefer normalizeCaseDocument — kept for call sites that only need items. */
export function normalizeCaseLayout(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
): CaseLayoutItem[] {
  return normalizeCaseDocument(items).items;
}

export function layoutToCaseGridWidgets(items: CaseLayoutItem[]) {
  return items.map((item) => {
    const sizing = caseWidgetSizing(item.id);
    return {
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: sizing.minW,
      minH: sizing.minH,
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
