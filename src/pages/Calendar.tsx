import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  invCases,
  investigators,
  type InvCase,
  type CaseStatus,
} from "@/lib/mock-data";

// Mock data is anchored to May 26 2026
const TODAY = new Date(2026, 4, 26);

// How many day columns the timeline shows at once
const DAYS_VIEW = 15;
// Navigation step in days
const NAV_STEP = 7;
// Width of the left info panel (px)
const INFO_W = 228;
// Sidebar width (px) — used to compute available space for columns
const SIDEBAR_W = 244;
// Page horizontal padding from AppShell (px each side)
const PAGE_PAD = 28;

/** Compute how wide each day column should be to fill the remaining space. */
function colWidth(): number {
  const available = window.innerWidth - SIDEBAR_W - PAGE_PAD * 2 - INFO_W - 2;
  return Math.max(52, Math.floor(available / DAYS_VIEW));
}

const BAR: Record<CaseStatus, { bg: string; border: string; color: string; dashed?: boolean }> = {
  open:      { bg: "rgba(74,222,128,0.18)", border: "rgba(74,222,128,0.6)",  color: "#4ade80" },
  suspended: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.55)", color: "#f59e0b", dashed: true },
  closed:    { bg: "rgba(91,102,128,0.18)", border: "rgba(91,102,128,0.5)",  color: "#9aa3b5" },
};

const STATUS_DOT: Record<CaseStatus, string> = {
  open: "#4ade80", suspended: "#f59e0b", closed: "#5b6680",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayDiff(a: Date, b: Date): number {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000,
  );
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function mondayOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay();
  return addDays(x, dow === 0 ? -6 : 1 - dow);
}

function isToday(d: Date): boolean {
  return (
    d.getFullYear() === TODAY.getFullYear() &&
    d.getMonth() === TODAY.getMonth() &&
    d.getDate() === TODAY.getDate()
  );
}

function caseActiveOnDay(c: InvCase, day: Date): boolean {
  const s = startOfDay(parseYmd(c.dateOpened)).getTime();
  const e = (c.dateClosed ? startOfDay(parseYmd(c.dateClosed)) : TODAY).getTime();
  const t = startOfDay(day).getTime();
  return t >= s && t <= e;
}

function fmtRange(a: Date, b: Date): string {
  const f = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${f(a)} – ${f(b)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "timeline" | "schedule";

export default function Calendar() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("timeline");

  // Timeline: default so today falls roughly in the middle of the 15-day window
  const [rangeStart, setRangeStart] = useState(() => addDays(TODAY, -7));
  // Schedule: week starting Monday
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(TODAY));

  // Dynamic column width — recalculated on render so it responds to window size
  const COL_W = colWidth();

  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");

  const rangeDays = useMemo(
    () => Array.from({ length: DAYS_VIEW }, (_, i) => addDays(rangeStart, i)),
    [rangeStart],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const visibleCases = useMemo(() => {
    const rangeEnd = addDays(rangeStart, DAYS_VIEW - 1);
    return invCases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      const s = parseYmd(c.dateOpened);
      const e = c.dateClosed ? parseYmd(c.dateClosed) : TODAY;
      return e >= rangeStart && s <= rangeEnd;
    });
  }, [rangeStart, statusFilter]);

  const todayCol = dayDiff(rangeStart, TODAY);

  const goTimeline = (delta: number) => setRangeStart((d) => addDays(d, delta * NAV_STEP));
  const goWeek = (delta: number) => setWeekStart((d) => addDays(d, delta * 7));
  const jumpToday = () => {
    setRangeStart(addDays(TODAY, -10));
    setWeekStart(mondayOfWeek(TODAY));
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* ── Page header ── */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">
            Calendar
          </h1>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-lo)]">
            Case arcs · investigator schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewBtn
            active={view === "timeline"}
            onClick={() => setView("timeline")}
            icon={<CalendarDays size={13} strokeWidth={1.8} />}
            label="Case Timeline"
          />
          <ViewBtn
            active={view === "schedule"}
            onClick={() => setView("schedule")}
            icon={<Users size={13} strokeWidth={1.8} />}
            label="Investigator Schedule"
          />
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <NavBtn
            onClick={() => (view === "timeline" ? goTimeline(-1) : goWeek(-1))}
          >
            <ChevronLeft size={14} strokeWidth={1.8} />
          </NavBtn>
          <span className="min-w-[220px] text-center font-mono text-[11.5px] text-[var(--color-text-hi)]">
            {view === "timeline"
              ? fmtRange(rangeStart, addDays(rangeStart, DAYS_VIEW - 1))
              : fmtRange(weekStart, addDays(weekStart, 6))}
          </span>
          <NavBtn
            onClick={() => (view === "timeline" ? goTimeline(1) : goWeek(1))}
          >
            <ChevronRight size={14} strokeWidth={1.8} />
          </NavBtn>
          <button
            onClick={jumpToday}
            className="ml-1 rounded-full border border-[var(--color-line)] px-3 py-1 text-[11px] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            Today
          </button>
        </div>

        {/* Status filter — timeline only */}
        {view === "timeline" && (
          <div className="flex items-center gap-1.5">
            {(["all", "open", "suspended", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition-all",
                  statusFilter === s
                    ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
                )}
              >
                {s !== "all" && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: STATUS_DOT[s] }}
                  />
                )}
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-[var(--color-text-lo)]">
          {(["open", "suspended", "closed"] as CaseStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block h-[10px] w-5 rounded-[3px]"
                style={{
                  background: BAR[s].bg,
                  border: `1px ${BAR[s].dashed ? "dashed" : "solid"} ${BAR[s].border}`,
                }}
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[10px] w-px bg-[rgba(74,127,255,0.7)]" />
            Today
          </span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="surface min-h-0 flex-1 overflow-hidden p-0">
        {view === "timeline" ? (
          <CaseTimeline
            days={rangeDays}
            cases={visibleCases}
            rangeStart={rangeStart}
            todayCol={todayCol}
            colW={COL_W}
            onCaseClick={(id) => navigate(`/cases/${id}`)}
          />
        ) : (
          <InvSchedule
            days={weekDays}
            cases={invCases}
            onCaseClick={(id) => navigate(`/cases/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Case Timeline (Gantt) ────────────────────────────────────────────────────

function CaseTimeline({
  days,
  cases,
  rangeStart,
  todayCol,
  colW,
  onCaseClick,
}: {
  days: Date[];
  cases: InvCase[];
  rangeStart: Date;
  todayCol: number;
  colW: number;
  onCaseClick: (id: string) => void;
}) {
  const totalPx = DAYS_VIEW * colW;

  return (
    <div className="h-full overflow-auto">
      <table
        className="border-collapse"
        style={{ minWidth: INFO_W + totalPx }}
      >
        {/* Sticky header */}
        <thead>
          <tr className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-ink-1)]">
            {/* Case info header */}
            <th
              className="sticky left-0 z-30 border-r border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3 text-left"
              style={{ width: INFO_W, minWidth: INFO_W }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-lo)]">
                Case / Subject
              </span>
            </th>
            {/* Day tick marks */}
            <th className="p-0" style={{ width: totalPx }}>
              <div className="relative flex h-[44px] items-end pb-2" style={{ width: totalPx }}>
                {/* Today column highlight */}
                {todayCol >= 0 && todayCol < DAYS_VIEW && (
                  <div
                    className="absolute inset-y-0 bg-[rgba(74,127,255,0.07)]"
                    style={{ left: todayCol * colW, width: colW }}
                  />
                )}
                {/* Day labels */}
                {days.map((d, i) => (
                  <div
                    key={i}
                    className="flex shrink-0 flex-col items-center justify-end gap-0.5"
                    style={{ width: colW }}
                  >
                    {/* Month label on 1st of month or first column */}
                    {(i === 0 || d.getDate() === 1) && (
                      <span className="font-mono text-[8px] uppercase tracking-widest text-[var(--color-text-lo)]">
                        {d.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    )}
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10.5px]",
                        isToday(d)
                          ? "bg-[rgba(74,127,255,0.25)] font-semibold text-[rgba(74,127,255,0.95)]"
                          : "text-[var(--color-text-lo)]",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {cases.length === 0 && (
            <tr>
              <td
                colSpan={2}
                className="px-6 py-16 text-center font-mono text-[11.5px] text-[var(--color-text-lo)]"
              >
                No cases in this date range.
              </td>
            </tr>
          )}
          {cases.map((c) => {
            const caseStart = parseYmd(c.dateOpened);
            const caseEnd = c.dateClosed ? parseYmd(c.dateClosed) : TODAY;
            const b = BAR[c.status];

            // Bar position: clamped to visible range
            const startCol = Math.max(0, dayDiff(rangeStart, caseStart));
            const endCol = Math.min(DAYS_VIEW - 1, dayDiff(rangeStart, caseEnd));
            const continuesLeft = dayDiff(rangeStart, caseStart) < 0;
            const continuesRight = dayDiff(rangeStart, caseEnd) >= DAYS_VIEW;

            const barLeft = startCol * colW + 3;
            const barWidth = Math.max(colW - 6, (endCol - startCol + 1) * colW - 6);

            return (
              <tr
                key={c.id}
                onClick={() => onCaseClick(c.id)}
                className="group cursor-pointer border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.025]"
              >
                {/* Sticky info cell */}
                <td
                  className="sticky left-0 border-r border-[var(--color-line)] bg-[var(--color-ink-0)] px-4 py-3 transition-colors group-hover:bg-[var(--color-ink-1)]"
                  style={{ width: INFO_W, minWidth: INFO_W }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[var(--color-text-lo)]">
                          {c.id}
                        </span>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: STATUS_DOT[c.status] }}
                        />
                        {c.tags.includes("Rush") && (
                          <span className="rounded-full bg-[rgba(239,68,68,0.2)] px-1.5 font-mono text-[8.5px] text-[#f87171]">
                            RUSH
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-[13px] font-medium text-[var(--color-text-hi)]">
                        {c.subject.name}
                      </div>
                      <div className="truncate font-mono text-[10px] text-[var(--color-text-lo)]">
                        {c.client}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-text-lo)]">
                      {c.daysOpen}d
                    </span>
                  </div>
                </td>

                {/* Timeline cell */}
                <td className="p-0" style={{ height: 60, width: totalPx }}>
                  <div className="relative h-full" style={{ width: totalPx }}>
                    {/* Today column highlight */}
                    {todayCol >= 0 && todayCol < DAYS_VIEW && (
                      <div
                        className="absolute inset-y-0 bg-[rgba(74,127,255,0.04)]"
                        style={{ left: todayCol * colW, width: colW }}
                      />
                    )}
                    {/* Vertical day grid lines */}
                    {days.map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-y-0 w-px bg-[var(--color-line)]"
                        style={{ left: i * colW }}
                      />
                    ))}
                    {/* The case bar */}
                    <div
                      className="absolute flex items-center overflow-hidden"
                      style={{
                        top: "50%",
                        transform: "translateY(-50%)",
                        left: barLeft,
                        width: barWidth,
                        height: 26,
                        background: b.bg,
                        border: `1px ${b.dashed ? "dashed" : "solid"} ${b.border}`,
                        borderRadius: `${continuesLeft ? 3 : 7}px ${continuesRight ? 3 : 7}px ${continuesRight ? 3 : 7}px ${continuesLeft ? 3 : 7}px`,
                        color: b.color,
                      }}
                    >
                      <span className="truncate px-2 font-mono text-[9.5px]">
                        {continuesLeft ? "← " : ""}
                        {c.subject.name.split(" ")[0]} · {c.service}
                        {continuesRight ? " →" : ""}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Investigator Schedule (Week) ─────────────────────────────────────────────

function InvSchedule({
  days,
  cases,
  onCaseClick,
}: {
  days: Date[];
  cases: InvCase[];
  onCaseClick: (id: string) => void;
}) {
  const CELL_MIN_W = 110;

  return (
    <div className="h-full overflow-auto">
      <table
        className="border-collapse"
        style={{ minWidth: INFO_W + 7 * CELL_MIN_W }}
      >
        {/* Sticky header */}
        <thead>
          <tr className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-ink-1)]">
            <th
              className="sticky left-0 z-30 border-r border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3 text-left"
              style={{ width: INFO_W, minWidth: INFO_W }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-lo)]">
                Investigator
              </span>
            </th>
            {days.map((d, i) => (
              <th
                key={i}
                className={cn(
                  "border-l border-[var(--color-line)] px-2 py-3 text-center",
                  isToday(d) && "bg-[rgba(74,127,255,0.07)]",
                )}
                style={{ minWidth: CELL_MIN_W }}
              >
                <div className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {DAY_NAMES[i]}
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[11.5px]",
                    isToday(d)
                      ? "font-semibold text-[rgba(74,127,255,0.9)]"
                      : "text-[var(--color-text-mid)]",
                  )}
                >
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {investigators.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              {/* Sticky investigator info */}
              <td
                className="sticky left-0 border-r border-[var(--color-line)] bg-[var(--color-ink-0)] px-3 py-3"
                style={{ width: INFO_W, minWidth: INFO_W }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white"
                    style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
                  >
                    {inv.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-medium text-[var(--color-text-hi)]">
                      {inv.name}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-text-lo)]">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          inv.status === "off_duty"
                            ? "bg-[#5b6680]"
                            : "bg-[#4ade80]",
                        )}
                      />
                      {inv.status === "off_duty" ? "Off duty" : `${inv.hoursToday}h today`}
                    </div>
                  </div>
                </div>
              </td>

              {/* Day cells */}
              {days.map((d, i) => {
                const dayCases = cases.filter(
                  (c) =>
                    c.assignedTo.includes(inv.id) && caseActiveOnDay(c, d),
                );
                return (
                  <td
                    key={i}
                    className={cn(
                      "border-l border-[var(--color-line)] px-1.5 py-2 align-top",
                      isToday(d) && "bg-[rgba(74,127,255,0.04)]",
                    )}
                    style={{ minWidth: CELL_MIN_W }}
                  >
                    <div className="flex flex-col gap-1">
                      {dayCases.map((c) => {
                        const b = BAR[c.status];
                        return (
                          <button
                            key={c.id}
                            onClick={() => onCaseClick(c.id)}
                            title={`${c.id} · ${c.subject.name}`}
                            className="w-full truncate rounded-[5px] px-2 py-1 text-left font-mono text-[9.5px] transition-opacity hover:opacity-75"
                            style={{
                              background: b.bg,
                              border: `1px ${b.dashed ? "dashed" : "solid"} ${b.border}`,
                              color: b.color,
                            }}
                          >
                            <div className="font-semibold">{c.id}</div>
                            <div className="truncate opacity-80">{c.subject.name.split(" ")[0]}</div>
                          </button>
                        );
                      })}
                      {dayCases.length === 0 && inv.status !== "off_duty" && (
                        <div className="py-1 text-center font-mono text-[9px] text-[var(--color-text-lo)] opacity-40">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-[8px] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
    >
      {children}
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[11.5px] transition-colors",
        active
          ? "border-[var(--color-line-2)] bg-[var(--color-ink-3)] text-[var(--color-text-hi)]"
          : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
      )}
    >
      {icon} {label}
    </button>
  );
}
