import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  investigators,
  invCases,
  timeEntries as seedTimeEntries,
  fieldNotes,
  GEO_GROUPS,
  GEO_GROUP_LABELS,
  type FieldNote,
  type GeoGroup,
  type Investigator,
  type InvStatus,
  type TimeEntry,
} from "@/lib/mock-data";
import { designPx } from "@/lib/rem";

/** Mock data is anchored to May 26 2026 */
const TODAY = new Date(2026, 4, 26);

/** Layout metrics as design-px @ 1920; convert with designPx() at use sites. */
const DESIGN_INFO_W = 220;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DESIGN_CELL_MIN_W = 148;
const DESIGN_HEAD_H = 40;
/** Target / max body row height; shrinks so MAX_VISIBLE_ROWS fit the viewport. */
const DESIGN_ROW_H_MAX = 88;
/** Show this many rows before the grid scrolls vertically. */
const MAX_VISIBLE_ROWS = 7;
const DESIGN_POSTIT_W = 112;
const DESIGN_POSTIT_H = 40;
/** Fallback when an entry has no startHour / clock-in. */
const DEFAULT_START_HOUR = 8;
/** Initial horizontal scroll target (hour column). */
const DEFAULT_VIEW_HOUR = 6;

/** Sticky name column — solid surface ink + theme line (works across themes). */
const INV_COL_STYLE = {
  backgroundColor: "var(--color-ink-2)",
  borderRight: "0.0625rem solid var(--color-line-2)",
  borderBottom: "0.0625rem solid var(--color-line-2)",
  boxShadow: "inset -0.0625rem 0 0 0 var(--color-line)",
} as const;

const INV_COL_HEAD_STYLE = {
  backgroundColor: "var(--color-ink-1)",
  borderRight: "0.0625rem solid var(--color-line-2)",
  borderBottom: "0.0625rem solid var(--color-line-2)",
  boxShadow: "inset -0.0625rem 0 0 0 var(--color-line)",
} as const;

const STATUS_LABEL: Record<InvStatus, string> = {
  clocked_in: "Clocked in",
  on_case: "On case",
  off_duty: "Off duty",
};

const STATUS_DOT: Record<InvStatus, string> = {
  clocked_in: "#4ade80",
  on_case: "#60a5fa",
  off_duty: "#5b6680",
};

type HourSlot = {
  caseId: string;
  claim: string;
  subjectFirst: string;
  subjectFull: string;
  location: string;
  entryId: string;
  summary: string;
  geoGroup: GeoGroup;
};

type BlockSegment = {
  kind: "block";
  startHour: number;
  span: number;
  slot: HourSlot;
  notes: FieldNote[];
};

type EmptySegment = {
  kind: "empty";
  hour: number;
};

type Segment = BlockSegment | EmptySegment;

// ─── Date / time helpers ──────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, d));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtDayHeader(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function fmtNoteTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (h === 0) return `12:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  if (h < 12) return `${h}:${m} AM`;
  return `${h - 12}:${m} PM`;
}

function noteHour(hhmm: string): number {
  return Number(hhmm.split(":")[0]) || 0;
}

function noteMinute(hhmm: string): number {
  return Number(hhmm.split(":")[1]) || 0;
}

/** Click-drag to scroll a container (horizontal + vertical), ignoring interactive targets. */
function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let active = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, input, textarea, select, label")) return;
      active = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = el.scrollLeft;
      scrollTop = el.scrollTop;
      el.setPointerCapture(e.pointerId);
      el.classList.add("cursor-grabbing");
    };

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      el.scrollLeft = scrollLeft - dx;
      el.scrollTop = scrollTop - dy;
    };

    const onUp = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      el.classList.remove("cursor-grabbing");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (moved) {
        // Suppress the click that follows a drag
        const suppress = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          el.removeEventListener("click", suppress, true);
        };
        el.addEventListener("click", suppress, true);
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.classList.add("cursor-grab");

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.classList.remove("cursor-grab", "cursor-grabbing");
    };
  }, [ref]);
}

/** Parse "08:14 AM" → hour (0–23). Falls back to DEFAULT_START_HOUR. */
function parseClockInHour(clockIn?: string): number {
  if (!clockIn) return DEFAULT_START_HOUR;
  const m = clockIn.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return DEFAULT_START_HOUR;
  let h = Number(m[1]);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h;
}

function caseMeta(caseId: string): { first: string; full: string; claim: string } {
  const c = invCases.find((x) => x.id === caseId);
  if (!c) return { first: caseId, full: caseId, claim: caseId };
  return {
    first: c.subject.name.split(" ")[0] ?? caseId,
    full: c.subject.name,
    claim: c.clientFileNum,
  };
}

/**
 * Place each time entry into hour cells (0–23) from startHour / clock-in.
 * Entries with explicit startHour use that; otherwise continue after prior
 * cursor anchored at clock-in.
 */
function buildHourMap(
  inv: Investigator,
  dayEntries: TimeEntry[],
): Map<number, HourSlot> {
  const map = new Map<number, HourSlot>();
  if (dayEntries.length === 0) return map;

  let cursor = parseClockInHour(inv.clockInTime);
  const sorted = [...dayEntries].sort((a, b) => {
    const aStart = a.startHour ?? 99;
    const bStart = b.startHour ?? 99;
    if (aStart !== bStart) return aStart - bStart;
    return a.id.localeCompare(b.id);
  });

  for (const entry of sorted) {
    const start = entry.startHour ?? cursor;
    const span = Math.max(1, Math.ceil(entry.hours));
    const meta = caseMeta(entry.caseId);
    for (let i = 0; i < span; i++) {
      const hour = start + i;
      if (hour < 0 || hour > 23) continue;
      if (map.has(hour)) continue;
      map.set(hour, {
        caseId: entry.caseId,
        claim: meta.claim,
        subjectFirst: meta.first,
        subjectFull: meta.full,
        location: entry.location,
        entryId: entry.id,
        summary: entry.notes,
        geoGroup: entry.geoGroup,
      });
    }
    cursor = Math.max(cursor, start + span);
  }
  return map;
}

function coalesceSegments(
  hourMap: Map<number, HourSlot>,
  notes: FieldNote[],
): Segment[] {
  const segments: Segment[] = [];
  let h = 0;
  while (h < 24) {
    const slot = hourMap.get(h);
    if (!slot) {
      segments.push({ kind: "empty", hour: h });
      h += 1;
      continue;
    }
    let span = 1;
    while (h + span < 24) {
      const next = hourMap.get(h + span);
      if (!next || next.caseId !== slot.caseId) break;
      span += 1;
    }
    const blockNotes = notes
      .filter((n) => n.caseId === slot.caseId)
      .filter((n) => {
        const nh = noteHour(n.time);
        return nh >= h && nh < h + span;
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    segments.push({
      kind: "block",
      startHour: h,
      span,
      slot,
      notes: blockNotes,
    });
    h += span;
  }
  return segments;
}

function hoursLoggedToday(dayEntries: TimeEntry[]): number {
  return dayEntries.reduce((sum, e) => sum + e.hours, 0);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(TODAY));
  /** Which regional calendar you're looking at (Todd: one calendar per geo group). */
  const [calendarGroup, setCalendarGroup] = useState<GeoGroup | "all">("tristate");
  const [entries, setEntries] = useState<TimeEntry[]>(() =>
    seedTimeEntries.map((e) => ({ ...e })),
  );
  const dateInputRef = useRef<HTMLInputElement>(null);

  const dayKey = toYmd(selectedDay);
  const isToday = isSameDay(selectedDay, TODAY);

  const assignGroup = (entryId: string, geoGroup: GeoGroup) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, geoGroup } : e)),
    );
  };

  const rows = useMemo(() => {
    const roster =
      calendarGroup === "all"
        ? investigators
        : investigators.filter((inv) => inv.geoGroup === calendarGroup);

    return roster.map((inv) => {
      const dayEntries = entries.filter(
        (e) =>
          e.investigatorId === inv.id &&
          e.date === dayKey &&
          (calendarGroup === "all" || e.geoGroup === calendarGroup),
      );
      const dayNotes = fieldNotes.filter(
        (n) => n.investigatorId === inv.id && n.date === dayKey,
      );
      const hourMap = buildHourMap(inv, dayEntries);
      return {
        inv,
        hoursLogged: hoursLoggedToday(dayEntries),
        segments: coalesceSegments(hourMap, dayNotes),
      };
    });
  }, [dayKey, calendarGroup, entries]);

  const availRef = useRef<HTMLDivElement>(null);
  const [availH, setAvailH] = useState(0);

  useEffect(() => {
    const el = availRef.current;
    if (!el) return;
    const measure = () => setAvailH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleRows = Math.min(Math.max(rows.length, 1), MAX_VISIBLE_ROWS);
  const headH = designPx(DESIGN_HEAD_H);
  const rowHMax = designPx(DESIGN_ROW_H_MAX);
  const infoW = designPx(DESIGN_INFO_W);
  const cellMinW = designPx(DESIGN_CELL_MIN_W);
  const postitW = designPx(DESIGN_POSTIT_W);
  const postitH = designPx(DESIGN_POSTIT_H);
  /** Sized so 7 rows always fit the available pane (then shrink for fewer). */
  const rowH =
    availH > headH
      ? Math.min(rowHMax, Math.max(designPx(56), Math.floor((availH - headH) / MAX_VISIBLE_ROWS)))
      : rowHMax;

  const surfaceH =
    availH > 0
      ? Math.min(availH, headH + visibleRows * rowH)
      : headH + visibleRows * rowHMax;

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  };

  const groupLabel =
    calendarGroup === "all" ? "All groups" : GEO_GROUP_LABELS[calendarGroup];

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
            Calendar
          </h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {groupLabel} · investigator daily schedule · hour by hour
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <label className="font-mono text-[0.5625rem] uppercase tracking-widest text-[var(--color-text-lo)]">
            Calendar group
          </label>
          <div className="flex flex-wrap justify-end gap-1">
            <GroupChip
              active={calendarGroup === "all"}
              onClick={() => setCalendarGroup("all")}
            >
              All
            </GroupChip>
            {GEO_GROUPS.map((g) => (
              <GroupChip
                key={g}
                active={calendarGroup === g}
                onClick={() => setCalendarGroup(g)}
              >
                {GEO_GROUP_LABELS[g]}
              </GroupChip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => setSelectedDay((d) => addDays(d, -1))}>
            <ChevronLeft size={14} strokeWidth={1.8} />
          </NavBtn>
          <span className="min-w-[16.25rem] text-center font-mono text-[0.71875rem] text-[var(--color-text-hi)]">
            {fmtDayHeader(selectedDay)}
          </span>
          <NavBtn onClick={() => setSelectedDay((d) => addDays(d, 1))}>
            <ChevronRight size={14} strokeWidth={1.8} />
          </NavBtn>
          <button
            type="button"
            onClick={() => setSelectedDay(startOfDay(TODAY))}
            className="ml-1 rounded-full border border-[var(--color-line)] px-3 py-1 text-[0.6875rem] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            Today
          </button>
          <div className="relative ml-0.5">
            <button
              type="button"
              onClick={openDatePicker}
              title="Pick a date"
              className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <CalendarDays size={14} strokeWidth={1.8} />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={dayKey}
              onChange={(e) => {
                if (!e.target.value) return;
                setSelectedDay(parseYmd(e.target.value));
              }}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              tabIndex={-1}
              aria-hidden
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {(["clocked_in", "on_case", "off_duty"] as InvStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STATUS_DOT[s] }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
          {isToday && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[0.625rem] w-[0.0625rem] bg-[var(--color-accent)]" />
              Today
            </span>
          )}
        </div>
      </div>

      <div ref={availRef} className="min-h-0 flex-1 overflow-hidden">
        {rows.length === 0 ? (
          <div className="surface flex h-full min-h-[12.5rem] items-center justify-center p-8">
            <p className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">
              No investigators on the {groupLabel} calendar.
            </p>
          </div>
        ) : (
          <div
            className="surface isolate overflow-hidden p-0"
            style={{ height: surfaceH, maxHeight: "100%" }}
          >
            <DailyHourGrid
              rows={rows}
              rowH={rowH}
              headH={headH}
              infoW={infoW}
              cellMinW={cellMinW}
              postitW={postitW}
              postitH={postitH}
              isToday={isToday}
              onCaseClick={(id) => navigate(`/cases/${id}`)}
              onAssignGroup={assignGroup}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function DailyHourGrid({
  rows,
  rowH,
  headH,
  infoW,
  cellMinW,
  postitW,
  postitH,
  isToday,
  onCaseClick,
  onAssignGroup,
}: {
  rows: {
    inv: Investigator;
    hoursLogged: number;
    segments: Segment[];
  }[];
  rowH: number;
  headH: number;
  infoW: number;
  cellMinW: number;
  postitW: number;
  postitH: number;
  isToday: boolean;
  onCaseClick: (id: string) => void;
  onAssignGroup: (entryId: string, group: GeoGroup) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useDragScroll(scrollRef);
  const nowHour = isToday ? new Date().getHours() : -1;
  const noteTop = Math.min(
    designPx(28),
    Math.max(designPx(22), rowH - postitH - designPx(8)),
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = DEFAULT_VIEW_HOUR * cellMinW;
  }, [cellMinW]);

  return (
    <div
      ref={scrollRef}
      className="calendar-scroll h-full overflow-auto select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <table
        className="border-separate border-spacing-0"
        style={{ minWidth: infoW + HOURS.length * cellMinW }}
      >
        <thead>
          {/*
            Local stacking: names above timeline/post-its, header above names.
            Keep values low so app chrome (TopBar) still wins.
          */}
          <tr
            className="sticky top-0 z-[4] border-b border-[var(--color-line)]"
            style={{ backgroundColor: "var(--color-ink-1)" }}
          >
            <th
              className="sticky left-0 top-0 z-[5] px-4 text-left"
              style={{
                width: infoW,
                minWidth: infoW,
                height: headH,
                ...INV_COL_HEAD_STYLE,
              }}
            >
              <span className="font-mono text-[0.5625rem] uppercase tracking-widest text-[var(--color-text-lo)]">
                Investigator
              </span>
            </th>
            {HOURS.map((hour) => (
              <th
                key={hour}
                className="border-l border-[var(--color-line)] px-1 text-center"
                style={{
                  minWidth: cellMinW,
                  width: cellMinW,
                  height: headH,
                  backgroundColor:
                    nowHour === hour
                      ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-ink-1))"
                      : "var(--color-ink-1)",
                }}
              >
                <span
                  className={cn(
                    "font-mono text-[0.625rem]",
                    nowHour === hour
                      ? "font-semibold text-[var(--color-accent-2)]"
                      : "text-[var(--color-text-lo)]",
                  )}
                >
                  {fmtHour(hour)}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(({ inv, hoursLogged, segments }) => (
            <tr key={inv.id} style={{ height: rowH }}>
              <td
                className="sticky left-0 z-[3] px-3 align-middle"
                style={{
                  width: infoW,
                  minWidth: infoW,
                  height: rowH,
                  ...INV_COL_STYLE,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.65625rem] font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))",
                    }}
                  >
                    {inv.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
                      {inv.name}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_DOT[inv.status] }}
                      />
                      {inv.status === "off_duty"
                        ? "Off duty"
                        : `${hoursLogged > 0 ? hoursLogged.toFixed(1) : inv.hoursToday}h`}
                      <span className="text-[var(--color-text-lo)]">·</span>
                      <span className="truncate text-[var(--color-text-mid)]">
                        {GEO_GROUP_LABELS[inv.geoGroup]}
                      </span>
                    </div>
                  </div>
                </div>
              </td>

              {segments.map((seg) => {
                if (seg.kind === "empty") {
                  return (
                    <td
                      key={`e-${seg.hour}`}
                      className={cn(
                        "border-b border-l border-[var(--color-line-2)] px-1 align-middle",
                        nowHour === seg.hour &&
                          "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
                      )}
                      style={{
                        minWidth: cellMinW,
                        width: cellMinW,
                        height: rowH,
                      }}
                    >
                      <div className="flex h-full items-center justify-center font-mono text-[0.5625rem] text-[var(--color-text-lo)] opacity-30">
                        —
                      </div>
                    </td>
                  );
                }

                const coversNow =
                  nowHour >= seg.startHour && nowHour < seg.startHour + seg.span;
                const blockW = cellMinW * seg.span;

                return (
                  <td
                    key={`b-${seg.startHour}-${seg.slot.entryId}`}
                    colSpan={seg.span}
                    className={cn(
                      "border-b border-l border-[var(--color-line-2)] p-1 align-middle",
                      coversNow &&
                        "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
                    )}
                    style={{ minWidth: blockW, height: rowH }}
                  >
                    <div className="relative z-0 h-full w-full overflow-hidden rounded-[0.5rem]">
                      <div
                        className="absolute inset-0 flex flex-col justify-start gap-0.5 border border-[var(--color-line-2)] px-2.5 pt-1.5 text-left"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--color-accent) 16%, var(--color-ink-2))",
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-x-2">
                          <button
                            type="button"
                            onClick={() => onCaseClick(seg.slot.caseId)}
                            className="flex min-w-0 flex-1 items-baseline gap-x-2 text-left transition-opacity hover:opacity-90"
                          >
                            <span className="shrink-0 font-mono text-[0.625rem] font-semibold text-[var(--color-accent-2)]">
                              {seg.slot.claim}
                            </span>
                            <span className="truncate text-[0.6875rem] font-medium text-[var(--color-text-hi)]">
                              {seg.slot.subjectFull}
                            </span>
                          </button>
                          <span className="shrink-0 font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
                            {fmtHour(seg.startHour)}
                            {seg.span > 1
                              ? ` – ${fmtHour(seg.startHour + seg.span - 1)}`
                              : ""}
                          </span>
                        </div>
                        <div className="relative z-[1] mt-0.5 flex items-center gap-1.5">
                          <label className="sr-only" htmlFor={`group-${seg.slot.entryId}`}>
                            Assign calendar group
                          </label>
                          <select
                            id={`group-${seg.slot.entryId}`}
                            value={seg.slot.geoGroup}
                            title="Assign to calendar group"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onAssignGroup(seg.slot.entryId, e.target.value as GeoGroup)
                            }
                            className="max-w-[7.375rem] cursor-pointer rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] px-1.5 py-0.5 font-mono text-[0.59375rem] text-[var(--color-text-hi)] outline-none hover:border-[var(--color-line-3)] focus:border-[var(--color-accent)]"
                          >
                            {GEO_GROUPS.map((g) => (
                              <option key={g} value={g}>
                                {GEO_GROUP_LABELS[g]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Timed post-its — fixed size, anchored to their hour */}
                      {seg.notes.map((n) => {
                        const h = noteHour(n.time);
                        const mins = noteMinute(n.time);
                        const leftPx =
                          (h - seg.startHour) * cellMinW +
                          (mins / 60) * cellMinW +
                          4;
                        const maxLeft = Math.max(4, blockW - postitW - 4);
                        const left = Math.max(4, Math.min(leftPx, maxLeft));

                        return (
                          <div
                            key={n.id}
                            title={`${fmtNoteTime(n.time)} — ${n.text}`}
                            className="pointer-events-none absolute overflow-hidden rounded-[0.3125rem] border border-[#e8c278] bg-[#fff4d6] px-1.5 py-1 shadow-sm"
                            style={{
                              left,
                              top: noteTop,
                              width: postitW,
                              height: postitH,
                            }}
                          >
                            <div className="font-mono text-[0.53125rem] font-semibold leading-none text-[#b45309]">
                              {fmtNoteTime(n.time)}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-[0.59375rem] leading-tight text-[#78350f]">
                              {n.text}
                            </div>
                          </div>
                        );
                      })}
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

function GroupChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[0.5rem] border px-3 py-1.5 text-[0.71875rem] transition-colors",
        active
          ? "border-[color-mix(in_srgb,var(--color-accent)_55%,var(--color-line))] bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-text-hi)]"
          : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
      )}
    >
      {children}
    </button>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
    >
      {children}
    </button>
  );
}
