import type { ReactNode } from "react";
import { CircleCheck, CirclePause, Clock, FolderOpen, MapPin } from "lucide-react";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { SERVICE_LABELS } from "@/lib/mock-data";
import {
  REGION_LABELS,
  type CaseListItem,
  type CaseService,
  type CaseSortField,
  type CaseStatus,
  type GridLayoutItem,
} from "@/lib/crm-api";
import { daysUntilDue, formatCalendarDate } from "@/lib/dates";

// ─── Shared cell styling ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string }> = {
  open: { label: "Open", dot: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b" },
  closed: { label: "Closed", dot: "#5b6680" },
};

const PRIORITY_CONFIG = {
  rush: { label: "RUSH", bg: "rgba(248,113,113,0.16)", text: "#f87171" },
  standard: { label: "STD", bg: "var(--color-ink-3)", text: "var(--color-text-lo)" },
} as const;

const SERVICE_COLORS: Record<CaseService, { bg: string; text: string }> = {
  SURV: { bg: "rgba(74,127,255,0.16)", text: "#7aa1ff" },
  WC: { bg: "rgba(167,139,250,0.16)", text: "#a78bfa" },
  FMLA: { bg: "rgba(45,212,191,0.16)", text: "#2dd4bf" },
  BG: { bg: "rgba(148,163,184,0.16)", text: "#94a3b8" },
  DOM: { bg: "rgba(251,113,133,0.16)", text: "#fb7185" },
  SOC: { bg: "rgba(192,132,252,0.16)", text: "#c084fc" },
  DIS: { bg: "rgba(251,191,36,0.16)", text: "#fbbf24" },
  LOC: { bg: "rgba(74,222,128,0.16)", text: "#4ade80" },
  PS: { bg: "rgba(34,211,238,0.16)", text: "#22d3ee" },
  LIA: { bg: "rgba(244,114,182,0.16)", text: "#f472b6" },
};

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "2-digit" });

const Dash = () => <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">—</span>;

function DueCell({ c }: { c: CaseListItem }) {
  if (!c.dueDate) return <Dash />;
  const left = daysUntilDue(c.dueDate);
  const closed = c.status === "closed";
  const overdue = !closed && left < 0;
  const soon = !closed && left >= 0 && left <= 7;
  return (
    <div className="min-w-0 text-center">
      <div
        className={cn(
          "font-mono text-[0.71875rem] font-medium leading-tight",
          overdue ? "text-[var(--color-neg)]" : soon ? "text-[#fb923c]" : "text-[var(--color-text-hi)]",
        )}
      >
        {formatCalendarDate(c.dueDate, { month: "2-digit", day: "2-digit", year: "2-digit" })}
      </div>
      <div
        className={cn(
          "font-mono text-[0.5625rem] uppercase tracking-wide leading-tight",
          overdue ? "text-[var(--color-neg)]" : soon ? "text-[#fb923c]" : "text-[var(--color-text-lo)]",
        )}
      >
        {closed ? "closed" : overdue ? "overdue" : `${left}d left`}
      </div>
    </div>
  );
}

function ServicePill({ service }: { service: CaseService }) {
  const colors = SERVICE_COLORS[service];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide"
      style={{ background: colors.bg, color: colors.text }}
      title={SERVICE_LABELS[service]}
    >
      {SERVICE_LABELS[service]}
    </span>
  );
}

const locationOf = (c: CaseListItem): { city: string | null; state: string | null } => {
  const primary = c.addresses[0];
  return { city: primary?.city ?? null, state: primary?.state ?? c.state ?? null };
};

/** Date the case landed on the desk — first assignment, else intake date. */
const assignedDate = (c: CaseListItem): string => c.assignments[0]?.assignedAt ?? c.dateOpened;

// ─── Column catalog ──────────────────────────────────────────────────────────

export type CaseColumnId =
  | "phase"
  | "due"
  | "active"
  | "location"
  | "subject"
  | "claim"
  | "assigned"
  | "region"
  | "priority"
  | "type"
  | "client"
  | "days"
  | "investigator"
  | "status"
  | "policy"
  | "opened";

export interface CaseColumnDef {
  id: CaseColumnId;
  label: string;
  /**
   * Relative flex weight for this column's grid track (`minmax(2.75rem, Nfr)`).
   * Drag-resizing in the table adjusts this per column, shared across users.
   */
  defaultWidth: number;
  /** Server sort field when the header is clickable. */
  sortKey?: CaseSortField;
  center?: boolean;
  /** Pin the header and the cell to the right edge of the track. */
  end?: boolean;
  render: (c: CaseListItem) => ReactNode;
}

const fmtActive = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function SubjectCell({ c }: { c: CaseListItem }) {
  return (
    <div className="min-w-0 text-center">
      <div className="truncate text-[0.8125rem] font-medium leading-tight text-[var(--color-text-hi)]">{c.subjectName}</div>
      <div className="truncate font-mono text-[0.625rem] leading-tight text-[var(--color-text-lo)]">
        {c.subjectDob ? `DOB ${c.subjectDob.slice(0, 10)}` : c.caseNumber}
      </div>
    </div>
  );
}

/** Square portrait pinned to the left of every list row, independent of column order. */
export function CaseRowPhoto({ c }: { c: CaseListItem }) {
  const src = useCasePhoto(c.id, c.subjectPhotoUrl);
  return (
    <span className="grid h-[3.575rem] w-[3.625rem] shrink-0 overflow-hidden rounded-[0.375rem] bg-[var(--color-ink-3)]">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
          {getInitials(c.subjectName)}
        </span>
      )}
    </span>
  );
}

export type CasePhase = "active" | "upcoming" | "paused" | "finished";

export const PHASE_META: {
  id: CasePhase;
  title: string;
  hint: string;
  dot: string;
  icon: typeof FolderOpen;
}[] = [
  { id: "active", title: "Active", hint: "Open, and an investigator has already written a note", dot: "#4ade80", icon: FolderOpen },
  { id: "upcoming", title: "Coming up", hint: "Open, not started yet", dot: "#60a5fa", icon: Clock },
  { id: "paused", title: "Paused", hint: "Suspended until it can move again", dot: "#fb923c", icon: CirclePause },
  { id: "finished", title: "Finished", hint: "Closed", dot: "#94a3b8", icon: CircleCheck },
];

export const phaseOf = (c: CaseListItem): CasePhase => {
  if (c.status === "closed") return "finished";
  if (c.status === "suspended") return "paused";
  if (c.earliestActiveAt) return "active";
  return "upcoming";
};

export const CASE_COLUMNS: CaseColumnDef[] = [
  {
    id: "phase",
    label: "State",
    defaultWidth: 4,
    end: true,
    render: (c) => {
      const phase = PHASE_META.find((p) => p.id === phaseOf(c)) ?? PHASE_META[0];
      const Icon = phase.icon;
      return (
        <span className="grid h-7 w-7 place-items-center" title={phase.title}>
          <Icon size={16} strokeWidth={2} style={{ color: phase.dot }} />
        </span>
      );
    },
  },
  { id: "due", label: "Due", defaultWidth: 9, sortKey: "dueDate", render: (c) => <DueCell c={c} /> },
  {
    id: "active",
    label: "EAT",
    defaultWidth: 11,
    sortKey: "earliestActiveAt",
    render: (c) =>
      c.earliestActiveAt ? (
        <div className="min-w-0 text-center">
          <div className="font-mono text-[0.71875rem] font-medium leading-tight text-[var(--color-text-hi)]">
            {fmtActive(c.earliestActiveAt)}
          </div>
          <div className="font-mono text-[0.5625rem] uppercase tracking-wide leading-tight text-[var(--color-text-lo)]">
            {fmtShortDate(c.earliestActiveAt)}
          </div>
        </div>
      ) : (
        <Dash />
      ),
  },
  {
    id: "location",
    label: "State / City",
    defaultWidth: 12,
    sortKey: "state",
    render: (c) => {
      const { city, state } = locationOf(c);
      if (!city && !state) return <Dash />;
      return (
        <div className="flex min-w-0 items-center justify-center gap-1">
          <MapPin size={10} strokeWidth={1.8} className="shrink-0 text-[var(--color-text-lo)]" />
          <span className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">
            {state && <span className="font-medium text-[var(--color-text-hi)]">{state}</span>}
            {state && city ? " · " : ""}
            {city ?? ""}
          </span>
        </div>
      );
    },
  },
  {
    id: "subject",
    label: "Subject",
    defaultWidth: 18,
    sortKey: "subjectName",
    render: (c) => <SubjectCell c={c} />,
  },
  {
    id: "claim",
    label: "Claim",
    defaultWidth: 11,
    sortKey: "claimNumber",
    render: (c) => <div className="truncate text-center font-mono text-[0.6875rem] text-[var(--color-text-mid)]">{c.claimNumber ?? "—"}</div>,
  },
  {
    id: "assigned",
    label: "Assigned",
    defaultWidth: 9,
    sortKey: "dateOpened",
    render: (c) => (
      <span className="font-mono text-[0.71875rem] text-[var(--color-text-mid)]">{fmtShortDate(assignedDate(c))}</span>
    ),
  },
  {
    id: "region",
    label: "Region",
    defaultWidth: 10,
    sortKey: "region",
    render: (c) =>
      c.region ? (
        <span className="inline-block truncate rounded-full border border-[var(--color-line-2)] px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide text-[var(--color-text-mid)]">
          {REGION_LABELS[c.region]}
        </span>
      ) : (
        <Dash />
      ),
  },
  {
    id: "priority",
    label: "!",
    defaultWidth: 5,
    sortKey: "priority",
    render: (c) => {
      const pri = PRIORITY_CONFIG[c.priority];
      return (
        <span
          className="inline-block rounded-[0.3125rem] px-1.5 py-0.5 font-mono text-[0.53125rem] font-semibold tracking-wider"
          style={{ background: pri.bg, color: pri.text }}
        >
          {pri.label}
        </span>
      );
    },
  },
  {
    id: "type",
    label: "Type",
    defaultWidth: 11,
    sortKey: "service",
    render: (c) => (
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-1 overflow-hidden">
        <ServicePill service={c.service} />
        {c.reopened && (
          <span className="inline-block rounded-full border border-[var(--color-line-2)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--color-text-lo)]">
            Reopen
          </span>
        )}
      </div>
    ),
  },
  {
    id: "client",
    label: "Client / Adjuster",
    defaultWidth: 13,
    render: (c) => (
      <div className="min-w-0 text-center">
        <div className="truncate text-[0.75rem] leading-tight text-[var(--color-text-hi)]">{c.client?.company ?? "—"}</div>
        <div className="truncate text-[0.65625rem] leading-tight text-[var(--color-text-lo)]">{c.adjusterName ?? ""}</div>
      </div>
    ),
  },
  {
    id: "days",
    label: "Days",
    defaultWidth: 5,
    center: true,
    render: (c) => (
      <div className="text-center font-mono text-[0.8125rem] font-semibold text-[var(--color-accent-2)]">{c.daysAllotted ?? "—"}</div>
    ),
  },
  {
    id: "investigator",
    label: "Investigator",
    defaultWidth: 11,
    render: (c) => {
      const inv = c.assignments[0]?.user ?? null;
      if (!inv) return <Dash />;
      return (
        <div className="flex min-w-0 items-center justify-center gap-1.5">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.5625rem] font-medium text-white"
            style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
            title={inv.name}
          >
            {getInitials(inv.name)}
          </span>
          <span className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">{inv.name.split(" ")[0]}</span>
          {c.assignments.length > 1 && (
            <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">+{c.assignments.length - 1}</span>
          )}
        </div>
      );
    },
  },
  {
    id: "status",
    label: "Status",
    defaultWidth: 9,
    sortKey: "status",
    render: (c) => {
      const cfg = STATUS_CONFIG[c.status];
      return (
        <div className="flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
          <span className="text-[0.71875rem] text-[var(--color-text-mid)]">{cfg.label}</span>
        </div>
      );
    },
  },
  {
    id: "policy",
    label: "Policy",
    defaultWidth: 10,
    render: (c) => <div className="truncate text-center font-mono text-[0.6875rem] text-[var(--color-text-mid)]">{c.policyNumber ?? "—"}</div>,
  },
  {
    id: "opened",
    label: "Opened",
    defaultWidth: 9,
    sortKey: "dateOpened",
    render: (c) => <span className="font-mono text-[0.71875rem] text-[var(--color-text-mid)]">{fmtShortDate(c.dateOpened)}</span>,
  },
];

const COLUMN_BY_ID = new Map(CASE_COLUMNS.map((col) => [col.id, col]));

export const getColumnDef = (id: CaseColumnId): CaseColumnDef | undefined => COLUMN_BY_ID.get(id);

/** The client's requested default order. */
export const DEFAULT_CASE_COLUMNS: CaseColumnId[] = ["due", "active", "location", "subject", "claim", "assigned", "region", "phase"];

// ─── Saved configuration (grid-layouts `cases-table` surface) ───────────────

/** Column weight is clamped to this range so a resize never collapses a column. */
export const MIN_COLUMN_WIDTH = 3;
export const MAX_COLUMN_WIDTH = 40;

/** One configured column: catalog id, optional header rename, optional drag-resized weight. */
export interface CaseColumnSetting {
  id: CaseColumnId;
  label?: string;
  width?: number;
}

export const defaultColumnSettings = (): CaseColumnSetting[] => DEFAULT_CASE_COLUMNS.map((id) => ({ id }));

export const widthOf = (col: CaseColumnSetting): number => col.width ?? COLUMN_BY_ID.get(col.id)?.defaultWidth ?? 8;

/**
 * Decode the saved layout: `x` carries the order, `w` the drag-resized width
 * weight, `label` a rename. Unknown ids (removed catalog columns) are
 * dropped; an empty result falls back to the default set so the table never
 * renders headerless.
 */
export const columnsFromLayout = (items: GridLayoutItem[] | null | undefined): CaseColumnSetting[] => {
  if (!items || items.length === 0) return defaultColumnSettings();
  const known = items
    .filter((item) => COLUMN_BY_ID.has(item.id as CaseColumnId))
    .sort((a, b) => a.x - b.x)
    .map((item) => ({
      id: item.id as CaseColumnId,
      ...(item.label ? { label: item.label } : {}),
      ...(typeof item.w === "number" && item.w >= MIN_COLUMN_WIDTH ? { width: item.w } : {}),
    }));
  if (known.length === 0) return defaultColumnSettings();
  const phase = known.find((col) => col.id === "phase");
  const rest = known.filter((col) => col.id !== "phase");
  rest.push(phase ?? { id: "phase" });
  return rest;
};

export const layoutFromColumns = (columns: CaseColumnSetting[]): GridLayoutItem[] =>
  columns.map((col, index) => ({
    id: col.id,
    x: index,
    y: 0,
    w: Math.round(widthOf(col)),
    h: 1,
    ...(col.label && col.label.trim() && col.label.trim() !== COLUMN_BY_ID.get(col.id)?.label
      ? { label: col.label.trim() }
      : {}),
  }));
