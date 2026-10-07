import type { ReactNode } from "react";
import { Clock, MapPin, UserRound } from "lucide-react";
import { MobilityMark } from "@/components/cases/SubjectMobility";
import { cn } from "@/lib/cn";
import { placeholderPhotoFor, SERVICE_LABELS } from "@/lib/mock-data";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { READABLE_DATE_CLASS } from "@/lib/journal";
import { dueDateTone, formatCalendarDate } from "@/lib/dates";
import { REGION_LABELS, type CaseListItem, type CasePriority, type CaseRecentNote, type CaseService, type MyCaseloadItem, type Region, type SubjectTransport } from "@/lib/crm-api";

/** Shared snapshot for the little case cards on My Day and the cases board. */
export interface CaseGlance {
  id: string;
  caseNumber: string;
  subjectName: string;
  subjectPhotoUrl: string | null;
  subjectTransport: SubjectTransport | null;
  service: CaseService;
  priority: CasePriority;
  region: Region | null;
  state: string | null;
  dueDate: string | null;
  claimNumber: string | null;
  earliestActiveAt: string | null;
  situationSummary: string | null;
  subjectWorkStatus: string | null;
  clientName: string | null;
  address: string | null;
  peopleCount: number;
  vehicleCount: number;
  investigators: string[];
  recentNotes: CaseRecentNote[];
  scheduleLabel: string | null;
  daysWorked: number | null;
}

const fmtShortDate = (iso: string | null): string =>
  iso ? formatCalendarDate(iso, { month: "short", day: "numeric" }) : "";

export const formatEarliestActive = (iso: string | null): { time: string; date: string } | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
};

const addressLine = (parts: { line1?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null | undefined) => {
  if (!parts) return null;
  const line = [parts.line1, parts.city, parts.state, parts.zip].filter(Boolean).join(", ");
  return line || null;
};

export const glanceFromListItem = (c: CaseListItem): CaseGlance => {
  const primary = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0] ?? null;
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    subjectName: c.subjectName,
    subjectPhotoUrl: c.subjectPhotoUrl,
    subjectTransport: c.subjectTransport,
    service: c.service,
    priority: c.priority,
    region: c.region,
    state: c.state ?? primary?.state ?? null,
    dueDate: c.dueDate,
    claimNumber: c.claimNumber,
    earliestActiveAt: c.earliestActiveAt,
    situationSummary: c.situationSummary,
    subjectWorkStatus: c.subjectWorkStatus,
    clientName: c.client?.company ?? null,
    address: addressLine(primary),
    peopleCount: c._count?.people ?? 0,
    vehicleCount: c._count?.vehicles ?? 0,
    investigators: c.assignments.map((a) => a.user.name),
    recentNotes: c.recentNotes ?? [],
    scheduleLabel: null,
    daysWorked: null,
  };
};

export const glanceFromMyDay = (item: MyCaseloadItem): CaseGlance => {
  const k = item.case;
  const primary = k.addresses?.find((a) => a.isPrimary) ?? k.addresses?.[0] ?? null;
  const scheduleLabel =
    item.bucket === "current" && item.nextScheduledDate
      ? null
      : item.lastScheduledDate
        ? `Last ${fmtShortDate(item.lastScheduledDate)}`
        : "Not scheduled";
  return {
    id: k.id,
    caseNumber: k.caseNumber,
    subjectName: k.subjectName,
    subjectPhotoUrl: k.subjectPhotoUrl,
    subjectTransport: k.subjectTransport,
    service: k.service,
    priority: k.priority,
    region: k.region,
    state: k.state ?? primary?.state ?? null,
    dueDate: k.dueDate,
    claimNumber: k.claimNumber,
    earliestActiveAt: k.earliestActiveAt,
    situationSummary: k.situationSummary,
    subjectWorkStatus: k.subjectWorkStatus,
    clientName: k.client?.company ?? null,
    address: addressLine(primary),
    peopleCount: k._count?.people ?? 0,
    vehicleCount: k._count?.vehicles ?? 0,
    investigators: (k.assignments ?? []).map((a) => a.user.name),
    recentNotes: item.recentNotes ?? [],
    scheduleLabel,
    daysWorked: item.daysWorked,
  };
};

export function CaseGlanceCard({
  glance,
  muted = false,
  isActiveClock = false,
  onOpen,
  tone,
  panel,
  panelOpen = false,
  inert = false,
}: {
  glance: CaseGlance;
  muted?: boolean;
  isActiveClock?: boolean;
  onOpen?: () => void;
  /** Scheduling case cards use a yellow wash. */
  tone?: "amber";
  /** Replaces the summary that drops open on hover. */
  panel?: ReactNode;
  /** Keep the drop-down panel open, for example while an investigator is being dragged. */
  panelOpen?: boolean;
  /** Stay closed. Used on the investigator board, where the card is only a preview. */
  inert?: boolean;
}) {
  const direct =
    glance.subjectPhotoUrl && /^(https?:|data:|blob:)/.test(glance.subjectPhotoUrl) ? glance.subjectPhotoUrl : null;
  const resolved = useCasePhoto(glance.id, direct ? null : glance.subjectPhotoUrl);
  const src = direct || resolved || placeholderPhotoFor(glance.id);
  const active = formatEarliestActive(glance.earliestActiveAt);
  const due = dueDateTone(glance.dueDate);

  const cardClass = cn(
    "group surface flex w-full min-w-0 flex-col items-stretch overflow-hidden rounded-[1rem] border text-left transition-colors hover:shadow-lg",
    tone === "amber"
      ? "border-[rgba(247,168,19,0.45)] hover:border-[rgba(247,168,19,0.7)]"
      : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
  );
  const cardStyle = tone === "amber"
    ? { background: "color-mix(in srgb, #f7a813 18%, var(--color-ink-2))" }
    : undefined;
  const hover = (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200",
        panelOpen
          ? "grid-rows-[1fr]"
          : "grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]",
      )}
      onClick={panel ? (event) => event.stopPropagation() : undefined}
    >
      <div className="overflow-hidden">
        {panel ?? (
          <div className="flex h-[7.25rem] flex-col gap-1.5 border-t border-[var(--color-line)] px-3 py-2">
            {glance.investigators.length > 0 && (
              <div className="flex shrink-0 items-center gap-1.5 font-mono text-[0.625rem] text-[var(--color-text-hi)]">
                <UserRound size={11} className="shrink-0 text-[var(--color-accent-2)]" />
                <span className="min-w-0 truncate">{glance.investigators.join(" · ")}</span>
              </div>
            )}
            <p
              className="min-h-0 flex-1 overflow-hidden text-[0.75rem] leading-snug text-[var(--color-text-mid)]"
              style={{ display: "-webkit-box", WebkitLineClamp: glance.investigators.length > 0 ? 4 : 5, WebkitBoxOrient: "vertical" }}
              title={glance.situationSummary ?? undefined}
            >
              {glance.situationSummary?.trim() || "No case summary yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const body = (
    <>
      <div className="flex h-[6.25rem] w-full min-w-0 shrink-0 items-stretch">
        <img
          src={src}
          alt=""
          className={cn(
            "aspect-[4/3] h-full shrink-0 object-cover transition-[filter] duration-200",
            muted && "grayscale-[0.9] contrast-[0.85] brightness-[0.75] group-hover:grayscale-0 group-hover:brightness-100 group-focus-within:grayscale-0",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 overflow-hidden px-3 py-2">
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
            {isActiveClock && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(74,222,128,0.15)] px-1.5 py-0.5 font-mono text-[0.5625rem] text-[#4ade80]">
                <span className="h-1 w-1 rounded-full bg-[#4ade80]" />
                Clocked in
              </span>
            )}
            {glance.scheduleLabel && (
              <span className={cn("shrink-0 text-[0.625rem] uppercase tracking-wider", READABLE_DATE_CLASS, muted && "!text-[var(--color-text-lo)]")}>
                {glance.scheduleLabel}
              </span>
            )}
            {due && !muted && (
              <span className="shrink-0 truncate font-mono text-[0.625rem] font-semibold" style={{ color: due.color }}>
                {due.label}
              </span>
            )}
            <span
              className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[0.625rem] font-semibold text-[var(--color-text-hi)]"
              title={active ? `Earliest active ${active.time} on ${active.date}` : "No investigator note yet"}
            >
              <Clock size={9} className="text-[var(--color-accent-2)]" />
              {active ? `EAT: ${active.time}` : "EAT: —"}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "min-w-0 flex-1 truncate text-[1.0625rem] font-medium leading-tight",
                muted ? "text-[var(--color-text-mid)]" : "text-[var(--color-text-hi)] group-hover:text-[var(--color-accent-2)]",
              )}
            >
              {glance.subjectName}
            </div>
            <MobilityMark transport={glance.subjectTransport} />
          </div>

          <div className="flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
            {glance.claimNumber && <span className="shrink-0 text-[#fbbf24]">{glance.claimNumber}</span>}
            {glance.claimNumber && <span className="shrink-0">·</span>}
            <span className="shrink-0">{SERVICE_LABELS[glance.service]}</span>
            {glance.clientName && (
              <>
                <span className="shrink-0">·</span>
                <span className="min-w-0 truncate text-[var(--color-text-hi)]">{glance.clientName}</span>
              </>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-x-2.5 overflow-hidden whitespace-nowrap font-mono text-[0.625rem] text-[var(--color-text-lo)]">
            {glance.daysWorked != null && <span className="shrink-0">{glance.daysWorked} days</span>}
            {glance.region && (
              <span className="inline-flex min-w-0 items-center gap-1 truncate" title="Region">
                <MapPin size={9} className="shrink-0" />
                {REGION_LABELS[glance.region]}
              </span>
            )}
          </div>
        </div>
      </div>

      {inert ? null : hover}
    </>
  );

  if (panel) {
    return (
      <div
        className={cn(cardClass, onOpen && "cursor-pointer")}
        style={cardStyle}
        onClick={onOpen}
        onKeyDown={
          onOpen
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
      >
        {body}
      </div>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={cardClass} style={cardStyle}>
      {body}
    </button>
  );
}
