import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User, MapPin, Users2, Paperclip,
} from "lucide-react";
import type { CaseDetail, GridLayoutWidget } from "@/lib/crm-api";
import {
  AddressesMapPanel,
  AssignmentPanel,
  CaseFilesPanel,
  SubjectPhotoPanel,
} from "./case-detail-panels";

export type CasePanelId =
  | "subject-photo"
  | "assignment"
  | "addresses-map"
  | "files";

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

/** Stable ids for the house-default text panels (editable custom widgets). */
export const CUSTOM_ASSIGNMENT_DETAILS_ID = "custom-assignment-details";
export const CUSTOM_CLIENT_ID = "custom-client";
export const CUSTOM_ADJUSTER_ID = "custom-adjuster";
export const CUSTOM_CASE_STATUS_ID = "custom-case-status";

/**
 * Seed definitions for the text panels that used to be premade. Stable ids so
 * reset / migration / dock stay aligned. `persisted: true` keeps them in the
 * dock when removed from the board.
 */
export const CASE_DEFAULT_WIDGETS: CustomCaseWidgetDef[] = [
  {
    id: CUSTOM_ASSIGNMENT_DETAILS_ID,
    type: "custom",
    title: "Assignment details",
    columns: 2,
    persisted: true,
    fields: [
      { key: "case.client.company", label: "Client" },
      { key: "case.claimNumber", label: "Claim #" },
      { key: "case.city", label: "City" },
      { key: "case.policyNumber", label: "Policy #" },
      { key: "case.startTime", label: "Start time" },
      { key: "case.dueDate", label: "Due date" },
      { key: "case.adjusterName", label: "Adjuster" },
      { key: "case.daysAllotted", label: "Days" },
      { key: "case.dateOfInjury", label: "Date of injury" },
      { key: "case.service", label: "Service" },
    ],
  },
  {
    id: CUSTOM_CLIENT_ID,
    type: "custom",
    title: "Client",
    columns: 1,
    persisted: true,
    fields: [
      { key: "case.client.company", label: "Client" },
      { key: "case.claimNumber", label: "Claim #" },
      { key: "case.policyNumber", label: "Policy #" },
    ],
  },
  {
    id: CUSTOM_ADJUSTER_ID,
    type: "custom",
    title: "Adjuster",
    columns: 1,
    persisted: true,
    fields: [
      { key: "case.adjusterName", label: "Adjuster" },
      { key: "case.adjusterEmail", label: "Adjuster email" },
    ],
  },
  {
    id: CUSTOM_CASE_STATUS_ID,
    type: "custom",
    title: "Case status",
    columns: 1,
    persisted: true,
    fields: [{ key: "case.status", label: "Status" }],
  },
];

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
  // Assignment details is wider by default (was the premade footprint).
  if (id === CUSTOM_ASSIGNMENT_DETAILS_ID) {
    return { minW: CUSTOM_WIDGET_MIN_W, minH: CUSTOM_WIDGET_MIN_H, defaultW: 6, defaultH: 3 };
  }
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
 * Built-in house board when no server layout exists yet.
 * Used only as a fallback — never overwrites a saved board on load.
 */
export const CASE_DEFAULT_LAYOUT: CaseLayoutItem[] = [
  { id: CUSTOM_ASSIGNMENT_DETAILS_ID, pageId: CASE_PAGE_OVERVIEW, x: 0, y: 0, w: 5, h: 6 },
  { id: CUSTOM_CLIENT_ID, pageId: CASE_PAGE_OVERVIEW, x: 5, y: 0, w: 2, h: 4 },
  { id: "assignment", pageId: CASE_PAGE_OVERVIEW, x: 7, y: 0, w: 2, h: 4 },
  { id: "subject-photo", pageId: CASE_PAGE_OVERVIEW, x: 9, y: 0, w: 3, h: 4 },
  { id: "files", pageId: CASE_PAGE_OVERVIEW, x: 5, y: 4, w: 2, h: 5 },
  { id: "addresses-map", pageId: CASE_PAGE_OVERVIEW, x: 7, y: 4, w: 5, h: 5 },
  { id: CUSTOM_ADJUSTER_ID, pageId: CASE_PAGE_OVERVIEW, x: 0, y: 6, w: 3, h: 3 },
  { id: CUSTOM_CASE_STATUS_ID, pageId: CASE_PAGE_OVERVIEW, x: 3, y: 6, w: 2, h: 3 },
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

/** Ensure stock custom defs exist without overwriting admin edits. */
function mergeDefaultWidgets(widgets: CustomCaseWidgetDef[]): CustomCaseWidgetDef[] {
  const byId = new Map(widgets.map((w) => [w.id, w]));
  for (const def of CASE_DEFAULT_WIDGETS) {
    if (!byId.has(def.id)) byId.set(def.id, { ...def, fields: def.fields.map((f) => ({ ...f })) });
  }
  return [...byId.values()];
}

/**
 * Former text-only premades → stable custom widgets. Identity / work / tags /
 * description are dropped (rebuild via custom widgets if needed).
 */
const LEGACY_TEXT_PANEL_MAP: Record<string, string | null> = {
  "case-info": CUSTOM_ASSIGNMENT_DETAILS_ID,
  "client-adjuster": CUSTOM_CLIENT_ID,
  identity: null,
  work: null,
  tags: null,
  description: null,
};

function migrateLegacyLayoutItems(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
): Array<Partial<CaseLayoutItem> & { id: string }> {
  const out: Array<Partial<CaseLayoutItem> & { id: string }> = [];
  const seen = new Set<string>();
  for (const raw of items) {
    if (!(raw.id in LEGACY_TEXT_PANEL_MAP)) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      out.push(raw);
      continue;
    }
    const nextId = LEGACY_TEXT_PANEL_MAP[raw.id];
    if (!nextId || seen.has(nextId)) continue;
    seen.add(nextId);
    out.push({ ...raw, id: nextId });
  }
  return out;
}

/** True when a saved board still carries the old text-panel house default. */
function looksLikeLegacyHouseDefault(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
): boolean {
  const ids = new Set(items.map((i) => i.id));
  const markers = ["identity", "work", "description", "case-info", "tags"] as const;
  return markers.filter((id) => ids.has(id)).length >= 3;
}

/**
 * Force only the pre-custom-widget text-panel house default onto the current
 * CASE_DEFAULT_LAYOUT. Any board the admin has arranged is left alone so
 * drags persist.
 */
function shouldForceCaseHouseDefault(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
): boolean {
  return looksLikeLegacyHouseDefault(items);
}

/**
 * Normalize a saved (or legacy flat) layout into pages + items + widget defs.
 *
 * Unlike the pre-dock era this does NOT force missing premade panels back in —
 * a panel absent from the layout is simply "removed" and lives in the dock.
 * Items whose id is neither a premade panel nor a known custom widget are
 * dropped (stale ids from an older catalog).
 *
 * Layouts that still look like the pre-custom-widget house default are
 * replaced with CASE_DEFAULT_LAYOUT on load so the cleared board ships without
 * a manual reset.
 */
export function normalizeCaseDocument(
  items: Array<Partial<CaseLayoutItem> & { id: string }>,
  pages?: CasePage[] | null,
  widgets?: CustomCaseWidgetDef[] | null,
  phase: "load" | "persist" = "load",
): { pages: CasePage[]; items: CaseLayoutItem[]; widgets: CustomCaseWidgetDef[] } {
  if (phase === "load" && shouldForceCaseHouseDefault(items)) {
    return normalizeCaseDocument(
      CASE_DEFAULT_LAYOUT,
      CASE_DEFAULT_PAGES,
      CASE_DEFAULT_WIDGETS,
      "persist",
    );
  }

  const migratedItems = migrateLegacyLayoutItems(items);
  const cleanWidgets = mergeDefaultWidgets(sanitizeWidgets(widgets));
  const customIds = new Set(cleanWidgets.map((w) => w.id));
  const isKnown = (id: string) => Boolean(CASE_PANELS[id as CasePanelId]) || customIds.has(id);

  const hasPageIds = migratedItems.some((i) => typeof i.pageId === "string" && i.pageId.length > 0);

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

    for (const raw of migratedItems) {
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
    for (const raw of migratedItems) {
      if (!isKnown(raw.id) || seen.has(raw.id)) continue;
      seen.add(raw.id);
      const pageId = raw.pageId && pageIds.has(raw.pageId) ? raw.pageId : nextPages[0].id;
      out.push(clampItem(raw, pageId));
    }
  }

  return {
    pages: nextPages,
    items: out,
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
