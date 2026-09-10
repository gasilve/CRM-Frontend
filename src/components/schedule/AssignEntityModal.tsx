import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Folder, History, Loader2, MapPin, Search, Sparkles, User, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CoverStatusMark } from "@/components/icons";
import { CASE_BG, INVESTIGATOR_BG } from "@/components/schedule/CalendarDayRow";
import { placeholderCoverStatus } from "@/components/schedule/cover-status";
import {
  REGION_LABELS,
  type CaseListItem,
  type InvestigatorListItem,
  type SchedulePriorWork,
} from "@/lib/crm-api";
import { SERVICE_LABELS } from "@/lib/mock-data";

type PriorKey = string;
export const priorKey = (caseId: string, userId: string): PriorKey => `${caseId}:${userId}`;

const DAY_MS = 86_400_000;

function formatDueShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysUntilDue(iso: string): number {
  const due = new Date(iso);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

function dueReminderLabel(iso: string, status: CaseListItem["status"]): string {
  if (status === "closed") return "closed";
  const left = daysUntilDue(iso);
  if (left < 0) return left === -1 ? "1 day overdue" : `${Math.abs(left)} days overdue`;
  if (left === 0) return "due today";
  if (left === 1) return "1 day left";
  return `${left} days left`;
}

export function sortCasesForInvestigator(
  cases: CaseListItem[],
  investigator: InvestigatorListItem,
  prior: Set<PriorKey>,
): CaseListItem[] {
  return [...cases].sort((a, b) => {
    const aRegion = a.region && investigator.region && a.region === investigator.region ? 0 : 1;
    const bRegion = b.region && investigator.region && b.region === investigator.region ? 0 : 1;
    if (aRegion !== bRegion) return aRegion - bRegion;
    const aPrior = prior.has(priorKey(a.id, investigator.id)) ? 0 : 1;
    const bPrior = prior.has(priorKey(b.id, investigator.id)) ? 0 : 1;
    if (aPrior !== bPrior) return aPrior - bPrior;
    return a.caseNumber.localeCompare(b.caseNumber) || a.subjectName.localeCompare(b.subjectName);
  });
}

export function sortInvestigatorsForCase(
  investigators: InvestigatorListItem[],
  kase: CaseListItem,
  prior: Set<PriorKey>,
): InvestigatorListItem[] {
  return [...investigators].sort((a, b) => {
    const aRegion = a.region && kase.region && a.region === kase.region ? 0 : 1;
    const bRegion = b.region && kase.region && b.region === kase.region ? 0 : 1;
    if (aRegion !== bRegion) return aRegion - bRegion;
    const aPrior = prior.has(priorKey(kase.id, a.id)) ? 0 : 1;
    const bPrior = prior.has(priorKey(kase.id, b.id)) ? 0 : 1;
    if (aPrior !== bPrior) return aPrior - bPrior;
    return a.name.localeCompare(b.name);
  });
}

function SignalBadge({
  icon,
  label,
  className,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[0.53125rem] uppercase tracking-wider",
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/** Case picker when assigning to a specific investigator. */
export function AssignCaseModal({
  dayLabel,
  investigator,
  cases,
  priorWork,
  excludeCaseIds,
  busy,
  onPick,
  onClose,
}: {
  dayLabel: string;
  investigator: InvestigatorListItem;
  cases: CaseListItem[];
  priorWork: SchedulePriorWork[];
  excludeCaseIds?: Set<string>;
  busy?: boolean;
  onPick: (caseId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const prior = useMemo(
    () => new Set(priorWork.map((p) => priorKey(p.caseId, p.userId))),
    [priorWork],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const pool = cases.filter((c) => !excludeCaseIds?.has(c.id));
    const sorted = sortCasesForInvestigator(pool, investigator, prior);
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (c) =>
        c.caseNumber.toLowerCase().includes(needle) ||
        c.subjectName.toLowerCase().includes(needle) ||
        (c.client?.company?.toLowerCase().includes(needle) ?? false) ||
        (c.region && REGION_LABELS[c.region].toLowerCase().includes(needle)),
    );
  }, [cases, excludeCaseIds, investigator, prior, q]);

  return (
    <PickerShell
      title="Assign case"
      subtitle={`${investigator.name} · ${dayLabel}`}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search cases…"
      busy={busy}
      onClose={onClose}
      empty="No open cases to assign."
      count={list.length}
    >
      {list.map((c) => {
        const matched = !!investigator.region && c.region === investigator.region;
        const worked = prior.has(priorKey(c.id, investigator.id));
        const cover = placeholderCoverStatus(`${investigator.id}:${c.id}`);
        return (
          <button
            key={c.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(c.id)}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-[0.625rem] border px-3 py-2.5 text-left transition-colors",
              matched
                ? "border-[rgba(74,222,128,0.45)] bg-[color-mix(in_srgb,var(--color-pos)_18%,var(--color-ink-3))]"
                : "border-[var(--color-line)] bg-[var(--color-ink-2)] hover:border-[var(--color-line-2)]",
            )}
          >
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
              style={{ background: CASE_BG }}
            >
              <Folder size={15} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</span>
                <span className="shrink-0 font-mono text-[0.625rem] text-[var(--color-text-lo)]">{c.caseNumber}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-mid)]">
                  {SERVICE_LABELS[c.service] ?? c.service}
                </span>
                {c.dueDate && (() => {
                  const left = daysUntilDue(c.dueDate);
                  const tone =
                    c.status === "closed"
                      ? "bg-[var(--color-ink-3)] text-[var(--color-text-mid)]"
                      : left < 0
                        ? "bg-[rgba(248,113,113,0.12)] text-[var(--color-neg)]"
                        : left <= 7
                          ? "bg-[rgba(251,146,60,0.12)] text-[#fb923c]"
                          : "bg-[var(--color-ink-3)] text-[var(--color-text-mid)]";
                  return (
                    <SignalBadge
                      icon={<CalendarClock size={9} strokeWidth={1.8} />}
                      label={`${formatDueShort(c.dueDate)} · ${dueReminderLabel(c.dueDate, c.status)}`}
                      className={tone}
                    />
                  );
                })()}
                {matched ? (
                  <SignalBadge
                    icon={<MapPin size={9} strokeWidth={1.8} />}
                    label="Same region"
                    className="bg-[rgba(74,222,128,0.12)] text-[var(--color-pos)]"
                  />
                ) : (
                  c.region && (
                    <SignalBadge
                      icon={<MapPin size={9} strokeWidth={1.8} />}
                      label={REGION_LABELS[c.region]}
                      className="bg-[var(--color-ink-3)] text-[var(--color-text-mid)]"
                    />
                  )
                )}
                {worked ? (
                  <SignalBadge
                    icon={<History size={9} strokeWidth={1.8} />}
                    label="Previously assigned"
                    className="bg-[rgba(74,127,255,0.12)] text-[var(--color-accent-2)]"
                  />
                ) : (
                  <SignalBadge
                    icon={<Sparkles size={9} strokeWidth={1.8} />}
                    label="Never assigned"
                    className="bg-[var(--color-ink-3)] text-[var(--color-text-lo)]"
                  />
                )}
                <CoverStatusMark status={cover} size={11} />
              </div>
            </div>
          </button>
        );
      })}
    </PickerShell>
  );
}

/** Investigator picker when assigning to a specific case. */
export function AssignInvestigatorModal({
  dayLabel,
  kase,
  investigators,
  priorWork,
  excludeUserIds,
  busy,
  onPick,
  onClose,
}: {
  dayLabel: string;
  kase: CaseListItem;
  investigators: InvestigatorListItem[];
  priorWork: SchedulePriorWork[];
  excludeUserIds?: Set<string>;
  busy?: boolean;
  onPick: (userId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const prior = useMemo(
    () => new Set(priorWork.map((p) => priorKey(p.caseId, p.userId))),
    [priorWork],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const list = useMemo(() => {
    const pool = investigators.filter((i) => !excludeUserIds?.has(i.id));
    const sorted = sortInvestigatorsForCase(pool, kase, prior);
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (i) =>
        i.name.toLowerCase().includes(needle) ||
        i.email.toLowerCase().includes(needle) ||
        (i.region && REGION_LABELS[i.region].toLowerCase().includes(needle)),
    );
  }, [investigators, excludeUserIds, kase, prior, q]);

  return (
    <PickerShell
      title="Assign investigator"
      subtitle={`${kase.subjectName} · ${kase.caseNumber} · ${dayLabel}`}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Search investigators…"
      busy={busy}
      onClose={onClose}
      empty="No investigators available."
      count={list.length}
    >
      {list.map((inv) => {
        const matched = !!kase.region && inv.region === kase.region;
        const worked = prior.has(priorKey(kase.id, inv.id));
        const cover = placeholderCoverStatus(inv.id);
        return (
          <button
            key={inv.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(inv.id)}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-[0.625rem] border px-3 py-2.5 text-left transition-colors",
              matched
                ? "border-[rgba(74,222,128,0.45)] bg-[color-mix(in_srgb,var(--color-pos)_18%,var(--color-ink-3))]"
                : "border-[var(--color-line)] bg-[var(--color-ink-2)] hover:border-[var(--color-line-2)]",
            )}
          >
            <span
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
              style={{ background: INVESTIGATOR_BG }}
            >
              <User size={15} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{inv.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {matched ? (
                  <SignalBadge
                    icon={<MapPin size={9} strokeWidth={1.8} />}
                    label="Same region"
                    className="bg-[rgba(74,222,128,0.12)] text-[var(--color-pos)]"
                  />
                ) : (
                  <SignalBadge
                    icon={<MapPin size={9} strokeWidth={1.8} />}
                    label={inv.region ? REGION_LABELS[inv.region] : "No region"}
                    className="bg-[var(--color-ink-3)] text-[var(--color-text-mid)]"
                  />
                )}
                {worked ? (
                  <SignalBadge
                    icon={<History size={9} strokeWidth={1.8} />}
                    label="Previously assigned"
                    className="bg-[rgba(74,127,255,0.12)] text-[var(--color-accent-2)]"
                  />
                ) : (
                  <SignalBadge
                    icon={<Sparkles size={9} strokeWidth={1.8} />}
                    label="Never assigned"
                    className="bg-[var(--color-ink-3)] text-[var(--color-text-lo)]"
                  />
                )}
                <CoverStatusMark status={cover} size={11} />
              </div>
            </div>
          </button>
        );
      })}
    </PickerShell>
  );
}

function PickerShell({
  title,
  subtitle,
  headerExtra,
  search,
  onSearch,
  searchPlaceholder,
  busy,
  onClose,
  empty,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  headerExtra?: ReactNode;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  busy?: boolean;
  onClose: () => void;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(36rem,86vh)] w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="surface anim-modal flex min-h-0 flex-1 flex-col gap-3 rounded-[0.875rem] p-5">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.25rem] leading-tight text-[var(--color-text-hi)]">{title}</h2>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{subtitle}</p>
              {headerExtra && <div className="mt-1.5">{headerExtra}</div>}
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={16} />
            </button>
          </div>

          <div className="relative shrink-0">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {busy && (
              <div className="flex items-center justify-center gap-2 py-8 text-[var(--color-text-lo)]">
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </div>
            )}
            {!busy && count === 0 && (
              <div className="grid place-items-center py-10 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{empty}</div>
            )}
            {!busy && children}
          </div>
        </div>
      </div>
    </>
  );
}
