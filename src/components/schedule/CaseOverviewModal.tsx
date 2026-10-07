import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarRange, ChevronLeft, ChevronRight, Folder, LayoutGrid, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { ViewToggle, ViewToggleGroup } from "@/components/ui/ViewToggle";
import { weatherIcon, weatherColor, conditionLabel } from "@/components/cases/WeatherStrip";
import {
  casesApi,
  scheduleApi,
  weatherApi,
  REGION_LABELS,
  type CaseListItem,
  type Region,
  type ScheduleBlock,
  type WeatherDay,
  type WeeklyWeather,
} from "@/lib/crm-api";

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const VIEW_LS_KEY = "accenty.crm.schedule.overviewView";
const REGION_SHORT: Record<Region, string> = { ca: "CA", tristate: "TR", texas: "TX" };

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function mondayOf(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return isoOf(copy);
}

const dateOnly = (iso: string): string => iso.slice(0, 10);

/** Overdue open/suspended cases still fill through today. */
function effectiveSpanEnd(c: CaseListItem, todayIso: string): string {
  if (!c.dueDate) return "9999-12-31";
  const due = dateOnly(c.dueDate);
  if (c.status === "closed") return due;
  return due < todayIso ? todayIso : due;
}

function overlapsRange(c: CaseListItem, rangeStart: string, rangeEnd: string, todayIso: string): boolean {
  const start = dateOnly(c.dateOpened);
  const end = effectiveSpanEnd(c, todayIso);
  return start <= rangeEnd && end >= rangeStart;
}

function spanIncludesDay(c: CaseListItem, dayIso: string, todayIso: string): boolean {
  const start = dateOnly(c.dateOpened);
  const end = effectiveSpanEnd(c, todayIso);
  return dayIso >= start && dayIso <= end;
}

type OverviewView = "month" | "cases";

const regionBarTint = (region: Region | null, overdue: boolean): string => {
  if (overdue) return "color-mix(in srgb, var(--color-neg) 32%, transparent)";
  if (region === "ca") return "color-mix(in srgb, #f59e0b 26%, transparent)";
  if (region === "texas") return "color-mix(in srgb, #f472b6 26%, transparent)";
  if (region === "tristate") return "color-mix(in srgb, var(--color-accent) 26%, transparent)";
  return "color-mix(in srgb, var(--color-accent) 16%, transparent)";
};

const regionBarBorder = (region: Region | null, overdue: boolean): string => {
  if (overdue) return "color-mix(in srgb, var(--color-neg) 55%, transparent)";
  if (region === "ca") return "color-mix(in srgb, #f59e0b 50%, transparent)";
  if (region === "texas") return "color-mix(in srgb, #f472b6 50%, transparent)";
  return "color-mix(in srgb, var(--color-accent) 45%, transparent)";
};

function PersonStack({
  people,
  max = 3,
  size = "md",
}: {
  people: { id: string; name: string }[];
  max?: number;
  size?: "sm" | "md";
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const dim = size === "md" ? "h-5 w-5 text-[0.5rem]" : "h-4 w-4 text-[0.4375rem]";
  if (shown.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5">
      {shown.map((u) => (
        <span
          key={u.id}
          title={u.name}
          className={cn("grid place-items-center rounded-full font-medium text-white", dim)}
          style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
        >
          {getInitials(u.name).slice(0, 1)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="font-mono text-[0.5625rem] text-[var(--color-text-mid)]">+{overflow}</span>
      )}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function CaseOverviewModal({
  anchorMonday,
  region,
  weatherRegion,
  onClose,
  onPickDay,
}: {
  anchorMonday: string;
  region: Region | "all";
  weatherRegion: Region | null;
  onClose: () => void;
  onPickDay: (iso: string) => void;
}) {
  const navigate = useNavigate();
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date(`${anchorMonday}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [view, setView] = useState<OverviewView>(() => {
    try {
      const v = localStorage.getItem(VIEW_LS_KEY);
      return v === "cases" || v === "timeline" ? "cases" : "month";
    } catch {
      return "month";
    }
  });
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [wxByDay, setWxByDay] = useState<Map<string, WeatherDay>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => isoOf(new Date()));

  const pickView = (v: OverviewView) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_LS_KEY, v);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const gridDays = useMemo(() => {
    const start = new Date(`${mondayOf(monthStart)}T00:00:00`);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [monthStart]);

  const rangeStart = isoOf(gridDays[0]);
  const rangeEnd = isoOf(gridDays[41]);
  const today = isoOf(new Date());

  const monthDays = useMemo(() => {
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(y, m, i + 1));
  }, [monthStart]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const regionParam = region === "all" ? undefined : region;
    const caseParams = { region: regionParam, page: 1 as const, pageSize: 100 as const };

    Promise.all([
      casesApi.list({ ...caseParams, status: "open" }),
      casesApi
        .list({ ...caseParams, status: "suspended" })
        .catch(() => ({ cases: [] as CaseListItem[], total: 0, page: 1, pageSize: 100 })),
      scheduleApi.list({ from: rangeStart, to: rangeEnd, region: regionParam }).catch(() => ({ blocks: [] as ScheduleBlock[] })),
    ])
      .then(([openRes, susRes, blockRes]) => {
        if (cancelled) return;
        const merged = [...openRes.cases, ...susRes.cases];
        const seen = new Set<string>();
        const unique = merged.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        setCases(unique);
        setTruncated(openRes.total > openRes.cases.length || (susRes.total ?? 0) > susRes.cases.length);
        setBlocks(blockRes.blocks);
      })
      .catch(() => {
        if (cancelled) return;
        setCases([]);
        setBlocks([]);
        setTruncated(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, region]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    if (!weatherRegion) {
      setWxByDay(new Map());
      return;
    }
    let cancelled = false;
    const mondays = [...new Set(gridDays.map((d) => mondayOf(d)))];
    Promise.all(mondays.map((m) => weatherApi.weekly(m).catch(() => ({ start: m, groups: [] as WeeklyWeather[] }))))
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, WeatherDay>();
        for (const r of results) {
          const g = r.groups.find((x) => x.group === weatherRegion);
          for (const day of g?.days ?? []) map.set(day.date, day);
        }
        setWxByDay(map);
      })
      .catch(() => {
        if (!cancelled) setWxByDay(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [gridDays, weatherRegion]);

  const overlappingCases = useMemo(() => {
    const list = cases.filter((c) => overlapsRange(c, rangeStart, rangeEnd, today));
    return list.sort((a, b) => {
      const ad = a.dueDate ? dateOnly(a.dueDate) : "9999-12-31";
      const bd = b.dueDate ? dateOnly(b.dueDate) : "9999-12-31";
      const aOver = a.dueDate != null && dateOnly(a.dueDate) < today && a.status !== "closed" ? 0 : 1;
      const bOver = b.dueDate != null && dateOnly(b.dueDate) < today && b.status !== "closed" ? 0 : 1;
      return aOver - bOver || ad.localeCompare(bd) || a.caseNumber.localeCompare(b.caseNumber);
    });
  }, [cases, rangeStart, rangeEnd, today]);

  const casesByDay = useMemo(() => {
    const map = new Map<string, CaseListItem[]>();
    for (const d of gridDays) {
      const iso = isoOf(d);
      map.set(
        iso,
        overlappingCases.filter((c) => spanIncludesDay(c, iso, today)),
      );
    }
    return map;
  }, [gridDays, overlappingCases, today]);

  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks) {
      const key = dateOnly(b.date);
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [blocks]);

  const blocksByCase = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks) {
      map.set(b.caseId, [...(map.get(b.caseId) ?? []), b]);
    }
    return map;
  }, [blocks]);

  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pickDefaultDayForMonth = (month: Date) => {
    const n = new Date();
    if (month.getFullYear() === n.getFullYear() && month.getMonth() === n.getMonth()) {
      return isoOf(n);
    }
    return isoOf(new Date(month.getFullYear(), month.getMonth(), 1));
  };
  const shiftMonth = (n: number) => {
    setMonthStart((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + n, 1);
      setSelectedDay(pickDefaultDayForMonth(next));
      return next;
    });
  };
  const goThisMonth = () => {
    const n = new Date();
    setMonthStart(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelectedDay(isoOf(n));
  };
  const isThisMonth =
    monthStart.getFullYear() === new Date().getFullYear() && monthStart.getMonth() === new Date().getMonth();

  const goToCase = (id: string) => {
    onClose();
    navigate(`/cases/${id}`);
  };

  const selectedCases = casesByDay.get(selectedDay) ?? [];
  const selectedLabel = new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return createPortal(
    <>
      <div className="anim-backdrop fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[90] flex h-[min(55rem,92vh)] w-[min(94rem,96vw)] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="surface anim-modal flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden rounded-[0.875rem] p-5">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.5rem] leading-tight text-[var(--color-text-hi)]">Case overview</h2>
              <p className="mt-0.5 font-mono text-[0.75rem] text-[var(--color-text-mid)]">
                {monthLabel}
                {region !== "all" ? ` · ${REGION_LABELS[region]}` : ""}
                {" · "}
                read-only
                {!loading && overlappingCases.length > 0 ? ` · ${overlappingCases.length} cases` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewToggleGroup>
                <ViewToggle
                  active={view === "month"}
                  onClick={() => pickView("month")}
                  icon={<LayoutGrid size={14} strokeWidth={1.8} />}
                  label="Month"
                />
                <ViewToggle
                  active={view === "cases"}
                  onClick={() => pickView("cases")}
                  icon={<CalendarRange size={14} strokeWidth={1.8} />}
                  label="Cases"
                  badge={overlappingCases.length || undefined}
                />
              </ViewToggleGroup>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
                >
                  <ChevronLeft size={15} strokeWidth={1.8} />
                </button>
                <span className="min-w-[9rem] text-center font-mono text-[0.8125rem] text-[var(--color-text-mid)]">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
                >
                  <ChevronRight size={15} strokeWidth={1.8} />
                </button>
              </div>
              {!isThisMonth && (
                <button
                  type="button"
                  onClick={goThisMonth}
                  className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
                >
                  This month
                </button>
              )}
              {loading && <Loader2 size={14} className="animate-spin text-[var(--color-text-lo)]" />}
              <button type="button" onClick={onClose} aria-label="Close" className="ml-1 text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                <X size={18} />
              </button>
            </div>
          </div>

          {truncated && (
            <p className="shrink-0 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
              Showing first 100 cases per status — some may be missing.
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-hidden">
            {loading && overlappingCases.length === 0 ? (
              <div className="grid h-full place-items-center">
                <Loader2 size={20} className="animate-spin text-[var(--color-text-lo)]" />
              </div>
            ) : overlappingCases.length === 0 ? (
              <div className="grid h-full place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] font-mono text-[0.875rem] text-[var(--color-text-mid)]">
                No open cases overlap this month.
              </div>
            ) : view === "month" ? (
              <div className="flex h-full min-h-0 gap-3">
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                  <MonthDensityGrid
                    gridDays={gridDays}
                    monthStart={monthStart}
                    today={today}
                    casesByDay={casesByDay}
                    blocksByDay={blocksByDay}
                    wxByDay={wxByDay}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                  />
                </div>
                <DayDetailPanel
                  dayLabel={selectedLabel}
                  dayIso={selectedDay}
                  cases={selectedCases}
                  blocksByDay={blocksByDay}
                  today={today}
                  onGoToCase={goToCase}
                  onJumpWeek={(iso) => onPickDay(iso)}
                />
              </div>
            ) : (
              <CasesTimeline
                monthDays={monthDays}
                today={today}
                cases={overlappingCases}
                blocksByCase={blocksByCase}
                onGoToCase={goToCase}
              />
            )}
          </div>

          <p className="shrink-0 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
            {view === "month"
              ? "Click a day to open its case list. Jump to that week from the side panel."
              : "Each row is a case (opened → due). Dots mark scheduled work days."}
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── Month density grid ───────────────────────────────────────────────────────

function MonthDensityGrid({
  gridDays,
  monthStart,
  today,
  casesByDay,
  blocksByDay,
  wxByDay,
  selectedDay,
  onSelectDay,
}: {
  gridDays: Date[];
  monthStart: Date;
  today: string;
  casesByDay: Map<string, CaseListItem[]>;
  blocksByDay: Map<string, ScheduleBlock[]>;
  wxByDay: Map<string, WeatherDay>;
  selectedDay: string;
  onSelectDay: (iso: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="grid shrink-0 grid-cols-7 gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <div key={w} className="text-center font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-mid)]">
            {w}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1.5">
        {gridDays.map((d) => {
          const iso = isoOf(d);
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = iso === today;
          const dayCases = casesByDay.get(iso) ?? [];
          const dueCount = dayCases.filter((c) => c.dueDate && dateOnly(c.dueDate) === iso).length;
          const overdueCount = dayCases.filter(
            (c) => c.dueDate && dateOnly(c.dueDate) < today && c.status !== "closed",
          ).length;
          const workers = [...new Map((blocksByDay.get(iso) ?? []).map((b) => [b.userId, b.user])).values()];
          const wx = wxByDay.get(iso);
          const WxIcon = wx ? weatherIcon(wx.code) : null;
          const wxTip = wx ? `${conditionLabel(wx.code)} — ${wx.highF ?? "—"}° / ${wx.lowF ?? "—"}°` : undefined;
          const selected = selectedDay === iso;
          const count = dayCases.length;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              title={wxTip}
              className={cn(
                "flex min-h-0 flex-col gap-1 rounded-[0.5rem] border p-2 text-left transition-colors",
                inMonth ? "border-[var(--color-line)] bg-[var(--color-ink-1)]/50" : "border-transparent opacity-40",
                "hover:border-[rgba(74,127,255,0.45)]",
                isToday && "ring-1 ring-[var(--color-accent)]",
                selected && "border-[rgba(74,127,255,0.55)] bg-[var(--color-accent-soft)]/30",
                dueCount > 0 && inMonth && !selected && "bg-[rgba(251,191,36,0.08)]",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "font-mono text-[0.875rem] font-medium",
                    isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-hi)]",
                  )}
                >
                  {d.getDate()}
                </span>
                {WxIcon && wx && (
                  <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: `${weatherColor(wx.code)}1f` }}>
                    <WxIcon size={12} strokeWidth={1.8} style={{ color: weatherColor(wx.code) }} />
                  </span>
                )}
              </div>

              {count > 0 && (
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[0.6875rem] font-medium",
                      dueCount > 0
                        ? "bg-[rgba(251,191,36,0.18)] text-[#fbbf24]"
                        : overdueCount > 0
                          ? "bg-[color-mix(in_srgb,var(--color-neg)_18%,transparent)] text-[var(--color-neg)]"
                          : "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]",
                    )}
                  >
                    {count}{dueCount > 0 ? " due" : ""}
                  </span>
                  <PersonStack
                    people={workers.map((u) => ({ id: u.id, name: u.name }))}
                    max={4}
                    size="md"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetailPanel({
  dayLabel,
  dayIso,
  cases,
  blocksByDay,
  today,
  onGoToCase,
  onJumpWeek,
}: {
  dayLabel: string;
  dayIso: string;
  cases: CaseListItem[];
  blocksByDay: Map<string, ScheduleBlock[]>;
  today: string;
  onGoToCase: (id: string) => void;
  onJumpWeek: (iso: string) => void;
}) {
  const dayBlocks = blocksByDay.get(dayIso) ?? [];

  return (
    <div className="flex h-full w-full max-w-[22rem] shrink-0 flex-col gap-2 rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50 p-3">
      <div>
        <div className="font-mono text-[0.875rem] text-[var(--color-text-hi)]">{dayLabel}</div>
        <div className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
          {cases.length} case{cases.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {cases.length === 0 ? (
          <p className="py-8 text-center font-mono text-[0.75rem] text-[var(--color-text-mid)]">No active cases this day.</p>
        ) : (
          cases.map((c) => {
            const due = c.dueDate ? dateOnly(c.dueDate) === dayIso : false;
            const overdue = c.dueDate != null && dateOnly(c.dueDate) < today && c.status !== "closed";
            const scheduled = dayBlocks.filter((b) => b.caseId === c.id).map((b) => ({ id: b.userId, name: b.user.name }));
            const roster = c.assignments.map((a) => ({ id: a.userId, name: a.user.name }));
            const people = scheduled.length > 0 ? scheduled : roster;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onGoToCase(c.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[0.5rem] border px-2.5 py-2 text-left transition-colors hover:border-[rgba(74,127,255,0.45)]",
                  due
                    ? "border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.1)]"
                    : overdue
                      ? "border-[color-mix(in_srgb,var(--color-neg)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-neg)_10%,transparent)]"
                      : "border-[var(--color-line)] bg-[var(--color-ink-2)]/60",
                )}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }}
                >
                  <Folder size={13} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.625rem] text-[var(--color-text-mid)]">
                    <span>{c.caseNumber}</span>
                    {c.region && <span>{REGION_SHORT[c.region]}</span>}
                    {due && <span className="text-[#fbbf24]">due</span>}
                    {overdue && !due && <span className="text-[var(--color-neg)]">overdue</span>}
                  </div>
                </div>
                <PersonStack people={people} max={3} size="md" />
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => onJumpWeek(dayIso)}
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-2.5 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
      >
        Jump to this week
      </button>
    </div>
  );
}

// ─── Cases timeline ───────────────────────────────────────────────────────────

function CasesTimeline({
  monthDays,
  today,
  cases,
  blocksByCase,
  onGoToCase,
}: {
  monthDays: Date[];
  today: string;
  cases: CaseListItem[];
  blocksByCase: Map<string, ScheduleBlock[]>;
  onGoToCase: (id: string) => void;
}) {
  const colCount = monthDays.length;
  const monthStartIso = isoOf(monthDays[0]);
  const monthEndIso = isoOf(monthDays[monthDays.length - 1]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/40">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-20 flex min-w-[52rem] border-b border-[var(--color-line)] bg-[var(--color-ink-2)]/95 backdrop-blur-sm">
          <div className="sticky left-0 z-30 w-[15rem] shrink-0 border-r border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-mid)]">
            Case
          </div>
          <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
            {monthDays.map((d) => {
              const iso = isoOf(d);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={cn(
                    "border-l border-[var(--color-line)]/60 py-2 text-center font-mono text-[0.6875rem]",
                    isToday ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]" : "text-[var(--color-text-mid)]",
                  )}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 min-w-[52rem] flex-1 flex-col">
          {cases.map((c) => {
            const opened = dateOnly(c.dateOpened);
            const due = c.dueDate ? dateOnly(c.dueDate) : null;
            const end = effectiveSpanEnd(c, today);
            const overdue = due != null && due < today && c.status !== "closed";
            const openEnded = due == null;

            const barStart = opened < monthStartIso ? monthStartIso : opened;
            const barEnd = end > monthEndIso ? monthEndIso : end;
            const startIdx = monthDays.findIndex((d) => isoOf(d) === barStart);
            const endIdx = monthDays.findIndex((d) => isoOf(d) === barEnd);
            const hasBar = startIdx >= 0 && endIdx >= startIdx;
            const spanCols = hasBar ? endIdx - startIdx + 1 : 0;
            const leftPct = hasBar ? (startIdx / colCount) * 100 : 0;
            const widthPct = hasBar ? (spanCols / colCount) * 100 : 0;
            const caseBlocks = blocksByCase.get(c.id) ?? [];
            const roster = c.assignments.map((a) => ({ id: a.userId, name: a.user.name }));

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onGoToCase(c.id)}
                className="flex min-h-[3rem] w-full flex-1 cursor-pointer border-b border-[var(--color-line)]/70 text-left transition-colors last:border-b-0 hover:bg-[var(--color-accent-soft)]/20"
              >
                <div className="sticky left-0 z-10 flex w-[15rem] shrink-0 items-center gap-2.5 border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/95 px-3 py-2 backdrop-blur-sm">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
                    style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }}
                  >
                    <Folder size={13} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.625rem] text-[var(--color-text-mid)]">
                      <span>{c.caseNumber}</span>
                      {c.region && <span>{REGION_SHORT[c.region]}</span>}
                      {overdue && <span className="text-[var(--color-neg)]">overdue</span>}
                      <PersonStack people={roster} max={3} size="sm" />
                    </div>
                  </div>
                </div>

                <div className="relative min-h-[3rem] min-w-0 flex-1 self-stretch">
                  <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
                    {monthDays.map((d) => {
                      const iso = isoOf(d);
                      return (
                        <div
                          key={iso}
                          className={cn(
                            "border-l border-[var(--color-line)]/35",
                            iso === today && "bg-[var(--color-accent-soft)]/20",
                          )}
                        />
                      );
                    })}
                  </div>

                  {hasBar && (
                    <div
                      className={cn(
                        "pointer-events-none absolute top-1/2 z-[1] h-5 -translate-y-1/2 rounded-full border",
                        openEnded && "border-dashed",
                      )}
                      style={{
                        left: `calc(${leftPct}% + 0.15rem)`,
                        width: `calc(${widthPct}% - 0.3rem)`,
                        background: regionBarTint(c.region, overdue),
                        borderColor: regionBarBorder(c.region, overdue),
                      }}
                    >
                      {caseBlocks
                        .filter((b) => {
                          const bd = dateOnly(b.date);
                          return bd >= barStart && bd <= barEnd;
                        })
                        .map((b) => {
                          const bd = dateOnly(b.date);
                          const dayI = monthDays.findIndex((x) => isoOf(x) === bd);
                          if (dayI < startIdx) return null;
                          const offset = dayI - startIdx;
                          const pct = ((offset + 0.5) / spanCols) * 100;
                          return (
                            <span
                              key={b.id}
                              title={`${b.user.name} · ${bd}`}
                              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                              style={{ left: `${pct}%` }}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
