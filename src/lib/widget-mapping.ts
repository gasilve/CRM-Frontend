import type { PatternId, PatternSize } from "@/lib/pattern-size";
import type { WidgetId } from "@/pages/dashboard-widgets";

/**
 * Widget → template mapping for the Playground Mapping tab.
 * Decided entries are omitted from the open lab (see DECIDED_MAPPINGS).
 */
export type MappingProposal = {
  id: string;
  patternId: PatternId;
  size: PatternSize;
  rationale: string;
  preferred?: boolean;
};

export type WidgetMapping = {
  widgetId: WidgetId | "case-video-player";
  label: string;
  folder: string;
  current: string;
  proposals: MappingProposal[];
  /** Locked decision — hide from open Mapping lab */
  decided?: boolean;
  decisionNote?: string;
};

/** Quick reference of locked picks (also flagged decided on each row). */
export const DECIDED_SUMMARY: { widget: string; pattern: string; note?: string }[] = [
  { widget: "Caseload Overview", pattern: "metric-over-bars" },
  {
    widget: "Rush & Overdue",
    pattern: "metric-over-list",
    note: "Metrics = Pending / Active / Overdue (not rush counts).",
  },
  {
    widget: "Pending Intake",
    pattern: "stack-list (Rush Queue)",
    note: "Replaced with rush/overdue stack list.",
  },
  { widget: "My Active Cases", pattern: "status-roster / feed + expand" },
  { widget: "Recent Case Activity", pattern: "activity-feed + expand" },
  { widget: "Landmark Precedents", pattern: "card-list + expand" },
  { widget: "Regulatory Watch", pattern: "card-list + expand" },
  {
    widget: "Fraud Intel Research",
    pattern: "ask",
    note: "Library match now; live AI intended. Cache 2h.",
  },
  { widget: "Evidence & File Health (org)", pattern: "bars-fill" },
  { widget: "Team & Access", pattern: "metric-over-bars" },
  { widget: "Client Portfolio", pattern: "donut-legend" },
  { widget: "Client Master Detail", pattern: "client-master-detail" },
  { widget: "Aging Buckets", pattern: "aging-buckets" },
  { widget: "Aging Funnel", pattern: "aging-funnel" },
  { widget: "Notes / Checklist / Combo", pattern: "notes-pad / checklist / notes-checklist" },
  { widget: "Fraud Intel Ticker", pattern: "chrome-feed + expand" },
  { widget: "Pre-surveillance Pipeline", pattern: "retired" },
  { widget: "Case Video (compact)", pattern: "video-playlist", note: "Needs case picker + recent clips." },
];

export const WIDGET_MAPPINGS: WidgetMapping[] = [
  // ── Decided (hidden from open lab by default) ──────────────────────────
  {
    widgetId: "caseload-overview",
    label: "Caseload Overview",
    folder: "Ops",
    current: "Hero / metric strip + service bars.",
    decided: true,
    decisionNote: "metric-over-bars",
    proposals: [
      { id: "caseload-mob", patternId: "metric-over-bars", size: "M", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "rush-overdue-queue",
    label: "Rush & Overdue",
    folder: "Ops",
    current: "Priority queue.",
    decided: true,
    decisionNote: "metric-over-list · Pending / Active / Overdue",
    proposals: [
      {
        id: "rush-mol",
        patternId: "metric-over-list",
        size: "L",
        rationale: "Metrics: Pending, Active, Overdue + queue below.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "pending-intake-inbox",
    label: "Pending Intake",
    folder: "Ops",
    current: "Intake inbox — likely redundant.",
    decided: true,
    decisionNote: "Replace with Rush & Overdue stack-list",
    proposals: [
      {
        id: "intake-replace",
        patternId: "stack-list",
        size: "M",
        rationale: "Retire intake; use a second rush/overdue stack tile instead.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "my-active-cases",
    label: "My Active Cases",
    folder: "Ops",
    current: "Personal case list.",
    decided: true,
    decisionNote: "status-roster",
    proposals: [
      { id: "mine-status", patternId: "status-roster", size: "L", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "recent-case-activity",
    label: "Recent Case Activity",
    folder: "Ops",
    current: "Journal feed.",
    decided: true,
    decisionNote: "activity-feed",
    proposals: [
      { id: "activity-feed", patternId: "activity-feed", size: "L", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "landmark-precedents",
    label: "Landmark Cases & Precedents",
    folder: "Intel",
    current: "Case-law cards.",
    decided: true,
    decisionNote: "card-list",
    proposals: [
      { id: "landmark-cards", patternId: "card-list", size: "L", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "regulatory-watch",
    label: "Regulatory & Legislative Watch",
    folder: "Intel",
    current: "Regulatory feed.",
    decided: true,
    decisionNote: "card-list",
    proposals: [
      { id: "reg-cards", patternId: "card-list", size: "M", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "fraud-intel-research",
    label: "Fraud Intel Research",
    folder: "Intel",
    current: "Ask + suggestion chips + cached answers.",
    decided: true,
    decisionNote: "ask — keep chips + real answer (not placeholder copy)",
    proposals: [
      { id: "research-ask", patternId: "ask", size: "L", rationale: "Locked — polish Ask recipe to match live chips.", preferred: true },
    ],
  },
  {
    widgetId: "file-intake-health",
    label: "Evidence & File Health",
    folder: "Evidence",
    current: "Org-wide file health.",
    decided: true,
    decisionNote: "bars-fill (org). Per-investigator variant still open → investigator-scope.",
    proposals: [
      { id: "files-bars", patternId: "bars-fill", size: "M", rationale: "Org-wide locked.", preferred: true },
      {
        id: "files-inv",
        patternId: "investigator-scope",
        size: "L",
        rationale: "Open: pick investigator → metric-over-bars for that person.",
      },
    ],
  },
  {
    widgetId: "team-access-snapshot",
    label: "Team & Access",
    folder: "Admin",
    current: "Team counts + region mix.",
    decided: true,
    decisionNote: "metric-over-bars",
    proposals: [
      { id: "team-mob", patternId: "metric-over-bars", size: "M", rationale: "Locked.", preferred: true },
    ],
  },
  {
    widgetId: "case-video-player",
    label: "Case Video Player",
    folder: "Evidence",
    current: "Full-page only.",
    decided: true,
    decisionNote: "video-playlist (+ case picker). Theater still an option for a big second widget.",
    proposals: [
      {
        id: "video-pl",
        patternId: "video-playlist",
        size: "L",
        rationale: "Locked compact — add case picker + recent.",
        preferred: true,
      },
      {
        id: "video-th",
        patternId: "video-theater",
        size: "XL",
        rationale: "Optional big case-dock theater.",
      },
    ],
  },

  // ── Decided (shipped to live dashboard) ────────────────────────────────
  {
    widgetId: "client-portfolio",
    label: "Client Portfolio",
    folder: "Ops",
    decided: true,
    current: "Donut share-of-book (live).",
    proposals: [
      {
        id: "client-donut",
        patternId: "donut-legend",
        size: "M",
        rationale: "Share-of-book donut — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "client-master-detail",
    label: "Client Master Detail",
    folder: "Ops",
    decided: true,
    current: "Master list + detail pane (live).",
    proposals: [
      {
        id: "client-acc-split",
        patternId: "client-master-detail",
        size: "XL",
        rationale: "Master + detail — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "case-aging-turnaround",
    label: "Aging Buckets",
    folder: "Ops",
    decided: true,
    current: "Age band tiles (live).",
    proposals: [
      {
        id: "aging-buckets",
        patternId: "aging-buckets",
        size: "M",
        rationale: "Age band tiles — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "case-aging-funnel",
    label: "Aging Funnel",
    folder: "Ops",
    decided: true,
    current: "KPI strip + age funnel (live).",
    proposals: [
      {
        id: "aging-funnel",
        patternId: "aging-funnel",
        size: "L",
        rationale: "KPI + funnel — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "fraud-intel-ticker",
    label: "Fraud Intel Ticker",
    folder: "Intel",
    decided: true,
    current: "Chrome feed + expand (live).",
    proposals: [
      {
        id: "ticker-chrome-xl",
        patternId: "chrome-feed",
        size: "XL",
        rationale: "Chrome-feed XL — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "personal-notes",
    label: "Notes",
    folder: "Ops",
    decided: true,
    current: "Shipped.",
    proposals: [
      {
        id: "notes-pad",
        patternId: "notes-pad",
        size: "M",
        rationale: "Scratch pad — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "personal-checklist",
    label: "Checklist",
    folder: "Ops",
    decided: true,
    current: "Shipped.",
    proposals: [
      {
        id: "check-only",
        patternId: "checklist",
        size: "M",
        rationale: "Standalone checklist — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "notes-checklist",
    label: "Notes + Checklist",
    folder: "Ops",
    decided: true,
    current: "Combo shipped.",
    proposals: [
      {
        id: "notes-check",
        patternId: "notes-checklist",
        size: "L",
        rationale: "Combo default — shipped.",
        preferred: true,
      },
    ],
  },

  // ── Still open ─────────────────────────────────────────────────────────
  {
    widgetId: "regional-case-map",
    label: "Regional Case Map",
    folder: "Field",
    current: "Map + region filters.",
    proposals: [
      {
        id: "map-bleed",
        patternId: "media-bleed",
        size: "L",
        rationale: "Keep simple — map + corner region chips (current personality).",
        preferred: true,
      },
      {
        id: "map-toolbar",
        patternId: "media-toolbar",
        size: "XL",
        rationale: "Optional: zoom/layers/pins strip — only if we need tools beyond region chips.",
      },
    ],
  },
  {
    widgetId: "field-coverage-today",
    label: "Field Coverage Today",
    folder: "Field",
    decided: true,
    current: "Coverage hybrid (live).",
    proposals: [
      {
        id: "coverage-hybrid",
        patternId: "coverage-hybrid",
        size: "L",
        rationale: "Metrics + roster at L+ — shipped.",
        preferred: true,
      },
    ],
  },
  {
    widgetId: "field-weather-outlook",
    label: "Field Weather Outlook",
    folder: "Field",
    decided: true,
    current: "Weather board — 3 regions + detail (live).",
    proposals: [
      {
        id: "wx-board",
        patternId: "weather-board",
        size: "L",
        rationale: "All regions as tiles; click for detail — shipped.",
        preferred: true,
      },
    ],
  },
];

export function openMappings(showDecided = false): WidgetMapping[] {
  return WIDGET_MAPPINGS.filter((m) => showDecided || !m.decided);
}
