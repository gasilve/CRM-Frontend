import type { DragEvent, ReactNode } from "react";
import { Folder, MapPin, Plus, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { type Region, type ScheduleBlock } from "@/lib/crm-api";

const REGION_SHORT: Record<Region, string> = { ca: "CA", tristate: "TR", texas: "TX" };

/** Same chip avatars as the week schedule rail. */
export const INVESTIGATOR_BG = "linear-gradient(135deg,#4a7fff,#7aa1ff)";
export const CASE_BG = "linear-gradient(135deg,#f59e0b,#fbbf24)";

function formatAddress(block: ScheduleBlock): string | null {
  const addr = block.case.addresses?.[0];
  if (!addr) return null;
  const cityState = [addr.city, addr.state].filter(Boolean).join(", ");
  if (cityState) return `${addr.line1}, ${cityState}`;
  return addr.line1;
}

function formatTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

const DAY_MS = 86_400_000;

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Calendar-day delta from today → due (negative = overdue). */
function daysUntilDue(iso: string): number {
  const due = new Date(iso);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

function dueReminder(iso: string, status: ScheduleBlock["case"]["status"]): string {
  if (status === "closed") return "closed";
  const left = daysUntilDue(iso);
  if (left < 0) return left === -1 ? "1 day overdue" : `${Math.abs(left)} days overdue`;
  if (left === 0) return "due today";
  if (left === 1) return "1 day left";
  return `${left} days left`;
}

function MetaChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <span className="inline-flex h-[1.125rem] max-w-full items-center gap-1 truncate">
      <span className="calendar-band-text shrink-0 font-mono text-[0.5625rem] leading-none uppercase tracking-wider text-[rgba(255,248,230,0.88)]">
        {label}
      </span>
      <span
        className={cn(
          "calendar-band-text truncate text-[0.6875rem] leading-none text-[var(--color-text-hi)]",
          valueClassName,
        )}
      >
        {value}
      </span>
    </span>
  );
}

export function InvestigatorAssignmentBand({
  block,
  onClick,
  onContextUnassign,
  dense,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  block: ScheduleBlock;
  onClick?: () => void;
  /** Right-click removes the assignment when provided. */
  onContextUnassign?: () => void;
  /** Compact row for narrow case columns. */
  dense?: boolean;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onContextUnassign) return;
        e.preventDefault();
        onContextUnassign();
      }}
      title={onContextUnassign ? "Right-click to unassign" : undefined}
      className={cn(
        "calendar-assign-band flex w-full items-center gap-2.5 rounded-[0.5rem] border px-2.5 text-left transition-colors hover:brightness-110",
        dense ? "min-h-[2.75rem] py-2" : "min-h-[4.25rem] gap-3 px-3 py-3",
      )}
      style={{ ["--band-accent" as string]: "var(--color-accent)" }}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-white",
          dense ? "h-6 w-6" : "h-7 w-7",
        )}
        style={{ background: INVESTIGATOR_BG }}
      >
        <User size={dense ? 12 : 13} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
        {block.user.name}
      </span>
      {block.user.region && (
        <span className="shrink-0 font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-mid)]">
          {REGION_SHORT[block.user.region]}
        </span>
      )}
      {!dense && block.notes && (
        <span className="ml-auto max-w-[40%] truncate text-[0.6875rem] text-[var(--color-text-lo)]">
          {block.notes}
        </span>
      )}
    </button>
  );
}

export function CaseAssignmentBand({
  block,
  onClick,
  onContextUnassign,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  block: ScheduleBlock;
  onClick?: () => void;
  onContextUnassign?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const service = block.case.service;
  const typeLabel = service ? SERVICE_LABELS[service] ?? service : null;
  const address = formatAddress(block);
  const start = formatTime(block.startTime ?? block.case.startTime);
  const street = block.case.addresses?.[0]?.line1 ?? null;
  const client = block.case.client?.company ?? null;
  const dueIso = block.case.dueDate;
  const dueLeft = dueIso ? daysUntilDue(dueIso) : null;
  const dueTone =
    dueIso == null || block.case.status === "closed"
      ? undefined
      : dueLeft != null && dueLeft < 0
        ? "text-[var(--color-neg)]"
        : dueLeft != null && dueLeft <= 7
          ? "text-[#fb923c]"
          : undefined;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onContextUnassign) return;
        e.preventDefault();
        onContextUnassign();
      }}
      title={onContextUnassign ? "Right-click to unassign" : undefined}
      className="calendar-assign-band flex min-h-[4.25rem] w-full flex-col justify-center gap-1.5 rounded-[0.5rem] border px-3 py-3 text-left transition-colors hover:brightness-110"
      style={{ ["--band-accent" as string]: "#f7a813" }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {typeLabel && (
          <span className="calendar-band-text font-mono text-[0.625rem] font-semibold uppercase leading-none tracking-wider text-[var(--color-text-hi)]">
            {typeLabel}
          </span>
        )}
        <span className="calendar-band-text truncate text-[0.8125rem] font-medium leading-none text-[var(--color-text-hi)]">
          {block.case.subjectName}
        </span>
        <span className="calendar-band-text font-mono text-[0.625rem] leading-none text-[rgba(255,248,230,0.88)]">
          {block.case.caseNumber}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {address && <MetaChip label="Addr" value={address} />}
        {street && street !== address && <MetaChip label="Street" value={street} />}
        {start && <MetaChip label="Start" value={start} />}
        {client && <MetaChip label="Client" value={client} />}
        {dueIso && (
          <MetaChip
            label="Due"
            value={`${formatDueDate(dueIso)} · ${dueReminder(dueIso, block.case.status)}`}
            valueClassName={dueTone}
          />
        )}
        {block.notes && <MetaChip label="Notes" value={block.notes} />}
      </div>
    </button>
  );
}

export function EmptyAssignSlot({
  label,
  disabled,
  onClick,
  dense,
  className,
  dropHighlight,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  /** Shorter slot for narrow case columns. */
  dense?: boolean;
  className?: string;
  dropHighlight?: boolean;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "calendar-empty-slot flex w-full items-center justify-center gap-1.5 rounded-[0.5rem] border border-dashed border-[var(--color-line)] px-3 text-[0.6875rem] text-[var(--color-text-lo)] transition-colors",
        dense ? "min-h-[2.75rem] py-2" : "min-h-[4.25rem] py-3",
        disabled
          ? "cursor-default opacity-50"
          : "hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]",
        dropHighlight && "border-[rgba(74,127,255,0.55)] bg-[rgba(74,127,255,0.08)] text-[var(--color-accent-2)]",
        className,
      )}
    >
      {!disabled && <Plus size={12} strokeWidth={1.8} />}
      {label}
    </button>
  );
}

/**
 * Side-by-side case column for Vertical orient:
 * header = subject + case # only; body = assign / unassign investigators.
 */
export function CaseBoardColumn({
  subjectName,
  caseNumber,
  blocks,
  canManage,
  onAssign,
  onOpenNotes,
  onUnassign,
  dropHighlight,
  onDragOver,
  onDragLeave,
  onDrop,
  onBandDragStart,
  onBandDragEnd,
}: {
  subjectName: string;
  caseNumber: string;
  blocks: ScheduleBlock[];
  canManage: boolean;
  onAssign: () => void;
  onOpenNotes: (block: ScheduleBlock) => void;
  onUnassign: (blockId: string) => void;
  dropHighlight?: boolean;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onBandDragStart?: (block: ScheduleBlock, e: DragEvent) => void;
  onBandDragEnd?: () => void;
}) {
  const assigned = blocks.length > 0;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex h-[12rem] w-[15rem] flex-col overflow-hidden rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/35 transition-colors",
        dropHighlight && "border-[rgba(74,127,255,0.55)] bg-[rgba(74,127,255,0.08)]",
      )}
    >
      <div
        className="calendar-assign-band flex shrink-0 items-start justify-between gap-2 rounded-none border-0 border-b px-3 py-2.5"
        style={{ ["--band-accent" as string]: "#f7a813" }}
      >
        <div className="min-w-0 flex-1">
          <span
            className="calendar-band-text block truncate text-[0.8125rem] font-medium leading-none text-[var(--color-text-hi)]"
            title={subjectName}
          >
            {subjectName}
          </span>
          <span className="calendar-band-text mt-1 block font-mono text-[0.625rem] leading-none text-[rgba(255,248,230,0.88)]">
            {caseNumber}
          </span>
        </div>
        {assigned && (
          <span className="calendar-band-text shrink-0 rounded-full bg-[rgba(0,0,0,0.22)] px-1.5 py-0.5 font-mono text-[0.5625rem] text-[rgba(255,248,230,0.92)]">
            {blocks.length}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
        {blocks.map((block) => (
          <InvestigatorAssignmentBand
            key={block.id}
            block={block}
            dense
            draggable={canManage && !!onBandDragStart}
            onDragStart={onBandDragStart ? (e) => onBandDragStart(block, e) : undefined}
            onDragEnd={onBandDragEnd}
            onClick={() => onOpenNotes(block)}
            onContextUnassign={
              canManage
                ? () => {
                    onUnassign(block.id);
                  }
                : undefined
            }
          />
        ))}
        {canManage ? (
          <EmptyAssignSlot
            dense
            label={assigned ? "Add investigator" : "Assign investigator"}
            onClick={onAssign}
            className={assigned ? "opacity-70" : undefined}
          />
        ) : blocks.length === 0 ? (
          <EmptyAssignSlot dense label="Unassigned" disabled />
        ) : null}
      </div>
    </div>
  );
}

/** Day-board investigator column — identity only (cover/prior live in assign modals). */
export function InvestigatorRowLabel({
  name,
  region,
}: {
  name: string;
  region: Region | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
        style={{ background: INVESTIGATOR_BG }}
      >
        <User size={15} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]" title={name}>
          {name}
        </div>
        {region && (
          <div className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 font-mono text-[0.53125rem] uppercase tracking-wider text-[var(--color-text-mid)]">
            <MapPin size={9} strokeWidth={1.8} />
            {REGION_SHORT[region]}
          </div>
        )}
      </div>
    </div>
  );
}

export function CaseRowLabel({
  subjectName,
  caseNumber,
  region,
}: {
  subjectName: string;
  caseNumber: string;
  region: Region | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
        style={{ background: CASE_BG }}
      >
        <Folder size={15} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]" title={subjectName}>
          {subjectName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.625rem] text-[var(--color-text-mid)]">
          <span className="truncate">{caseNumber}</span>
          {region && (
            <span className="shrink-0 rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.53125rem] uppercase tracking-wider">
              {REGION_SHORT[region]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarDayRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[12rem_minmax(0,1fr)] gap-2 border-b border-[var(--color-line)]/60 py-2 last:border-b-0 sm:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="flex items-start px-1 pt-1">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
