import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowUpRight, Cake, CalendarDays, ChevronLeft, ChevronRight, Clock, Columns3,
  Droplets, GripVertical, Info, Loader2, MapPin, Rows3, Search, Trash2, Wind, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { weatherIcon, weatherColor, conditionLabel } from "@/components/cases/WeatherStrip";
import {
  casesApi,
  investigatorsApi,
  scheduleApi,
  weatherApi,
  ApiError,
  REGION_LABELS,
  type CaseDetail,
  type CaseListItem,
  type CrmUser,
  type Region,
  type ScheduleBlock,
  type WeatherDay,
  type WeeklyWeather,
} from "@/lib/crm-api";

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function mondayOf(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return isoOf(copy);
}

const shiftWeek = (monday: string, weeks: number): string => {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return mondayOf(d);
};

const fmtRange = (monday: string): string => {
  const start = new Date(`${monday}T00:00:00`);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
};

/** Does the subject's birthday (month+day) fall on this date? */
const isBirthday = (dobIso: string | null | undefined, dateIso: string): boolean => {
  if (!dobIso) return false;
  const dob = new Date(dobIso);
  const d = new Date(`${dateIso}T00:00:00`);
  return dob.getUTCMonth() === d.getMonth() && dob.getUTCDate() === d.getDate();
};

/** Next occurrence of the subject's birthday, from today (local). */
function nextBirthday(dobIso: string): Date {
  const dob = new Date(dobIso);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate());
  if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

/**
 * Pull appointment sentences out of intel/notes for the reminders box.
 * Deliberately narrow — only ordinary, verifiable stuff (medical, court, etc).
 */
const APPOINTMENT_RE = /appointment|court|doctor|dentist|therapy|checkup|hearing/i;

function extractHints(detail: CaseDetail | null): string[] {
  if (!detail) return [];
  const out: string[] = [];
  const scan = (text: string | null | undefined) => {
    if (!text) return;
    for (const sentence of text.split(/(?<=\.)\s+|\n/)) {
      if (APPOINTMENT_RE.test(sentence) && sentence.trim().length > 8) out.push(sentence.trim());
    }
  };
  scan(detail.presurveillance?.summary);
  for (const day of detail.days) for (const e of day.entries) scan(e.body);
  return [...new Set(out)].slice(0, 4);
}

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Hints that explicitly mention this weekday ("…Tuesdays at 09:00…"). */
const hintsForWeekday = (hints: string[], weekday: number): string[] =>
  hints.filter((h) => h.toLowerCase().includes(WEEKDAY_NAMES[weekday]));

// ─── Hour grid ────────────────────────────────────────────────────────────────

const GRID_START_MIN = 6 * 60; // 06:00
const GRID_END_MIN = 22 * 60; //  22:00
const GRID_TOTAL_MIN = GRID_END_MIN - GRID_START_MIN;
const SNAP_MIN = 30;
const DEFAULT_DURATION_MIN = 120;
const MIN_BLOCK_MIN = 30;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

const toHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const clampToGrid = (min: number): number => Math.max(GRID_START_MIN, Math.min(GRID_END_MIN, min));

const pctOf = (min: number): number => ((clampToGrid(min) - GRID_START_MIN) / GRID_TOTAL_MIN) * 100;

/** Raw (unsnapped) minute-of-day for a pointer position inside a day body. */
function rawMinuteAtPointer(clientX: number, clientY: number, rect: DOMRect, horizontal: boolean): number {
  const ratio = horizontal
    ? (clientX - rect.left) / rect.width
    : (clientY - rect.top) / rect.height;
  return GRID_START_MIN + Math.min(1, Math.max(0, ratio)) * GRID_TOTAL_MIN;
}

const snapMinute = (min: number): number => clampToGrid(Math.round(min / SNAP_MIN) * SNAP_MIN);

/**
 * Blocks stack in pairs: the first two overlapping schedules use the theme
 * accent, the next pair gets the next color, and so on. Isolated blocks are
 * always group 0 (theme color).
 */
const GROUP_PALETTE = ["#34d399", "#fbbf24", "#f472b6", "#22d3ee"];

function groupStyle(group: number): { background: string; borderColor: string; text: string; solid: string } {
  if (group === 0) {
    return {
      background: "color-mix(in srgb, var(--color-accent) 20%, transparent)",
      borderColor: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
      text: "var(--color-accent-2)",
      solid: "var(--color-accent)",
    };
  }
  const c = GROUP_PALETTE[(group - 1) % GROUP_PALETTE.length];
  return { background: `${c}30`, borderColor: `${c}80`, text: c, solid: c };
}

interface PositionedBlock {
  block: ScheduleBlock;
  startMin: number;
  endMin: number;
  openEnd: boolean;
  lane: number;
  laneCount: number;
  group: number;
}

/**
 * Assign overlapping blocks to lanes (interval partitioning). Visually the
 * lanes wrap in pairs: lanes 0-1 render side by side in group 0, lanes 2-3
 * overlap them in group 1 (different color), etc.
 */
function layoutDay(blocks: ScheduleBlock[]): PositionedBlock[] {
  const items = blocks
    .map((block) => {
      const startMin = clampToGrid(toMinutes(block.startTime ?? "00:00"));
      const rawEnd = block.endTime ? toMinutes(block.endTime) : startMin + DEFAULT_DURATION_MIN;
      return {
        block,
        startMin,
        endMin: Math.max(startMin + MIN_BLOCK_MIN, clampToGrid(rawEnd)),
        openEnd: !block.endTime,
        lane: 0,
        laneCount: 1,
        group: 0,
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cluster: PositionedBlock[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const item of cluster) {
      item.group = Math.floor(item.lane / 2);
      item.lane = item.lane % 2;
      item.laneCount = Math.min(laneEnds.length, 2);
    }
    cluster = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (item.startMin >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    item.lane = lane;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return items;
}

type DragPayload = { kind: "investigator"; userId: string } | { kind: "block"; block: ScheduleBlock };

type ResizeState = {
  block: ScheduleBlock;
  edge: "start" | "end";
  rect: DOMRect;
  horizontal: boolean;
  startMin: number;
  endMin: number;
};

type Orientation = "vertical" | "horizontal";

const ORIENTATION_LS_KEY = "accenty.crm.schedule.orientation";

// ─── Page ─────────────────────────────────────────────────────────────────────

const REGION_OPTIONS: (Region | "all")[] = ["all", "tristate", "ca", "texas"];

export default function Schedule() {
  const { can } = useAuth();
  const canManage = can("schedule.manage");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [region, setRegion] = useState<Region | "all">("all");
  const [caseSearch, setCaseSearch] = useState("");
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [investigators, setInvestigators] = useState<CrmUser[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(searchParams.get("case"));
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [weekWeather, setWeekWeather] = useState<WeeklyWeather[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [dayInfo, setDayInfo] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(() => {
    try {
      return localStorage.getItem(ORIENTATION_LS_KEY) === "vertical" ? "vertical" : "horizontal";
    } catch {
      return "horizontal";
    }
  });

  const pickOrientation = (o: Orientation) => {
    setOrientation(o);
    try {
      localStorage.setItem(ORIENTATION_LS_KEY, o);
    } catch {
      /* ignore */
    }
  };

  // Drag & drop / resize
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [hover, setHover] = useState<{ iso: string; startMin: number } | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const resizingRef = useRef<ResizeState | null>(null);
  const suppressClickRef = useRef(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    resizingRef.current = resizing;
  }, [resizing]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null;

  // Case rail
  useEffect(() => {
    casesApi
      .list({ status: "open", region: region === "all" ? undefined : region, search: caseSearch || undefined, page: 1, pageSize: 50 })
      .then((res) => setCases(res.cases))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load cases."));
  }, [region, caseSearch]);

  useEffect(() => {
    investigatorsApi.list().then((res) => setInvestigators(res.investigators)).catch(() => {});
  }, []);

  // Weekly weather for the day-header markers
  useEffect(() => {
    weatherApi.weekly(monday).then((res) => setWeekWeather(res.groups)).catch(() => setWeekWeather([]));
  }, [monday]);

  // Selected case detail (for reminders + birthday markers)
  useEffect(() => {
    if (!selectedCaseId) {
      setCaseDetail(null);
      return;
    }
    let cancelled = false;
    casesApi.get(selectedCaseId).then((res) => {
      if (!cancelled) setCaseDetail(res.case);
    }).catch(() => {
      if (!cancelled) {
        setSelectedCaseId(null);
        setCaseDetail(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCaseId]);

  const weekEnd = useMemo(() => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return isoOf(d);
  }, [monday]);

  const loadBlocks = useCallback(() => {
    scheduleApi
      .list({
        from: monday,
        to: weekEnd,
        region: region === "all" ? undefined : region,
        caseId: selectedCaseId ?? undefined,
      })
      .then((res) => {
        setBlocks(res.blocks);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the schedule."));
  }, [monday, weekEnd, region, selectedCaseId]);

  useEffect(loadBlocks, [loadBlocks]);

  // Blocks for the whole week regardless of case/region — used for busy markers.
  const [weekAllBlocks, setWeekAllBlocks] = useState<ScheduleBlock[]>([]);
  useEffect(() => {
    scheduleApi.list({ from: monday, to: weekEnd }).then((res) => setWeekAllBlocks(res.blocks)).catch(() => {});
  }, [monday, weekEnd, blocks]);

  const selectCase = (id: string | null) => {
    setSelectedCaseId(id);
    setSearchParams(id ? { case: id } : {}, { replace: true });
  };

  // Always keep a case selected — default to the first one in the rail.
  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) selectCase(cases[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, selectedCaseId]);

  const days = useMemo(() => {
    const start = new Date(`${monday}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [monday]);

  const today = isoOf(new Date());
  const hints = useMemo(() => extractHints(caseDetail), [caseDetail]);
  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks ?? []) {
      const key = b.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [blocks]);

  // Weather group for the day markers: selected case's region, else the filter.
  const weatherRegion: Region | null = selectedCase?.region ?? (region !== "all" ? region : null);
  const weatherDays = useMemo(() => {
    if (!weatherRegion) return new Map<string, WeatherDay>();
    const group = weekWeather.find((g) => g.group === weatherRegion);
    return new Map((group?.days ?? []).map((d) => [d.date, d]));
  }, [weekWeather, weatherRegion]);

  // Birthday reminder only when it's actually coming up (within a week).
  const birthdaySoon = useMemo(() => {
    if (!caseDetail?.subjectDob) return null;
    const next = nextBirthday(caseDetail.subjectDob);
    const daysAway = Math.round((next.getTime() - new Date(new Date().toDateString()).getTime()) / DAY_MS);
    if (daysAway > 7) return null;
    return { date: next, daysAway };
  }, [caseDetail]);

  // Investigators sorted so region matches come first when a case is picked.
  const sortedInvestigators = useMemo(() => {
    if (!selectedCase?.region) return investigators;
    return [...investigators].sort((a, b) => {
      const am = a.region === selectedCase.region ? 0 : 1;
      const bm = b.region === selectedCase.region ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
  }, [investigators, selectedCase]);

  /** Apply a local mutation to the block list (optimistic UI). */
  const patchBlocks = (fn: (blocks: ScheduleBlock[]) => ScheduleBlock[]) =>
    setBlocks((prev) => (prev ? fn(prev) : prev));

  const removeBlock = async (id: string) => {
    setEditing(null);
    patchBlocks((bs) => bs.filter((x) => x.id !== id));
    try {
      await scheduleApi.remove(id);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the schedule block.");
      loadBlocks();
    }
  };

  /** Drop an investigator chip at a specific time → schedule instantly. */
  const dropInvestigator = async (userId: string, dateIso: string, startMin: number) => {
    const kase = selectedCase;
    if (!kase) return;
    const inv = investigators.find((i) => i.id === userId);
    const startTime = toHHMM(startMin);
    const endMin = Math.min(startMin + DEFAULT_DURATION_MIN, GRID_END_MIN);
    const endTime = toHHMM(endMin);

    // Same investigator, same case, overlapping time → refuse the duplicate.
    const duplicate = weekAllBlocks.some((b) => {
      if (b.userId !== userId || b.caseId !== kase.id || b.date.slice(0, 10) !== dateIso) return false;
      const s = toMinutes(b.startTime ?? "00:00");
      const e = b.endTime ? toMinutes(b.endTime) : s + DEFAULT_DURATION_MIN;
      return startMin < e && endMin > s;
    });
    if (duplicate) {
      setError(`${inv?.name ?? "That investigator"} is already on this case at that time.`);
      return;
    }

    // Show it immediately; the real row replaces the temp one when saved.
    const tempId = `temp-${Date.now()}`;
    const hadList = blocks !== null;
    if (inv) {
      patchBlocks((bs) => [
        ...bs,
        {
          id: tempId,
          caseId: kase.id,
          userId,
          date: dateIso,
          startTime,
          endTime,
          notes: null,
          createdAt: new Date().toISOString(),
          case: {
            id: kase.id,
            caseNumber: kase.caseNumber,
            claimNumber: kase.claimNumber,
            subjectName: kase.subjectName,
            subjectDob: kase.subjectDob,
            region: kase.region,
            status: kase.status,
            priority: kase.priority,
            dueDate: kase.dueDate,
          },
          user: { id: inv.id, name: inv.name, email: inv.email, region: inv.region },
          createdBy: null,
        } as ScheduleBlock,
      ]);
    }

    setSaving(true);
    try {
      const res = await scheduleApi.create({ caseId: kase.id, userId, date: dateIso, startTime, endTime, notes: null });
      setError(null);
      if (inv && hadList) patchBlocks((bs) => bs.map((x) => (x.id === tempId ? res.block : x)));
      else loadBlocks();
    } catch (err) {
      patchBlocks((bs) => bs.filter((x) => x.id !== tempId));
      setError(err instanceof ApiError ? err.message : "Could not schedule.");
    } finally {
      setSaving(false);
    }
  };

  /** Drag a block elsewhere → move it, preserving its duration. */
  const dropBlock = async (block: ScheduleBlock, dateIso: string, startMin: number) => {
    const oldStart = toMinutes(block.startTime ?? "00:00");
    const duration = block.endTime ? toMinutes(block.endTime) - oldStart : null;
    const startTime = toHHMM(startMin);
    const endTime = duration != null ? toHHMM(Math.min(startMin + duration, GRID_END_MIN)) : null;
    if (block.date.slice(0, 10) === dateIso && startMin === oldStart) return;

    patchBlocks((bs) => bs.map((x) => (x.id === block.id ? { ...x, date: dateIso, startTime, endTime } : x)));
    try {
      await scheduleApi.update(block.id, { date: dateIso, startTime, endTime });
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not move the schedule block.");
      loadBlocks();
    }
  };

  /** Start an edge-drag resize on a block. */
  const beginResize = (e: React.PointerEvent, item: PositionedBlock) => {
    if (!canManage) return;
    const edge = (e.currentTarget as HTMLElement).dataset.edge as "start" | "end";
    const bodyEl = (e.currentTarget as HTMLElement).closest("[data-daybody]");
    if (!bodyEl) return;
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      block: item.block,
      edge,
      rect: (bodyEl as HTMLElement).getBoundingClientRect(),
      horizontal: orientation === "horizontal",
      startMin: item.startMin,
      endMin: item.endMin,
    });
  };

  const isResizing = resizing !== null;
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: PointerEvent) => {
      setResizing((r) => {
        if (!r) return r;
        const min = snapMinute(rawMinuteAtPointer(e.clientX, e.clientY, r.rect, r.horizontal));
        if (r.edge === "start") return { ...r, startMin: Math.min(min, r.endMin - MIN_BLOCK_MIN) };
        return { ...r, endMin: Math.max(min, r.startMin + MIN_BLOCK_MIN) };
      });
    };
    const onUp = () => {
      const r = resizingRef.current;
      setResizing(null);
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 200);
      if (!r) return;
      const startTime = toHHMM(r.startMin);
      const endTime = toHHMM(r.endMin);
      // Apply locally right away — no waiting on the server round-trip.
      setBlocks((prev) => prev?.map((x) => (x.id === r.block.id ? { ...x, startTime, endTime } : x)) ?? prev);
      scheduleApi
        .update(r.block.id, { startTime, endTime })
        .then(() => setError(null))
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : "Could not resize the schedule block.");
          loadBlocks();
        });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isResizing, loadBlocks]);

  const canDrop = drag != null && (drag.kind === "block" || !!selectedCase);

  const hourMarks = useMemo(() => {
    const out: number[] = [];
    for (let m = GRID_START_MIN; m <= GRID_END_MIN; m += 60) out.push(m);
    return out;
  }, []);

  const ghostDuration =
    drag?.kind === "block" && drag.block.endTime
      ? toMinutes(drag.block.endTime) - toMinutes(drag.block.startTime ?? "00:00")
      : DEFAULT_DURATION_MIN;

  // ── Shared per-day render data ──────────────────────────────────────────────

  const dayMeta = (d: Date) => {
    const iso = isoOf(d);
    return {
      iso,
      isToday: iso === today,
      birthday: selectedCase ? isBirthday(caseDetail?.subjectDob, iso) : false,
      dayHints: selectedCase ? hintsForWeekday(hints, d.getDay()) : [],
      wx: weatherDays.get(iso) ?? null,
    };
  };

  /** Effective start/end for a block, accounting for a live resize preview. */
  const effectiveSpan = (item: PositionedBlock): { startMin: number; endMin: number } =>
    resizing && resizing.block.id === item.block.id
      ? { startMin: resizing.startMin, endMin: resizing.endMin }
      : { startMin: item.startMin, endMin: item.endMin };

  const blockDragHandlers = (b: ScheduleBlock) => {
    const isTemp = b.id.startsWith("temp-");
    return {
      draggable: canManage && !isTemp,
      onDragStart: (e: React.DragEvent) => {
        if (resizingRef.current) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", b.user.name);
        setDrag({ kind: "block", block: b });
      },
      onDragEnd: () => {
        setDrag(null);
        setHover(null);
      },
      onClick: () => {
        if (canManage && !isTemp && !suppressClickRef.current) setEditing(b);
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (!canManage || isTemp) return;
        e.preventDefault();
        void removeBlock(b.id);
      },
    };
  };

  const blockTitle = (b: ScheduleBlock) =>
    `${b.user.name} · ${b.startTime}${b.endTime ? `–${b.endTime}` : " (no end)"} · ${b.case.caseNumber} ${b.case.subjectName}${b.notes ? `\n${b.notes}` : ""}${canManage ? "\nClick to edit · drag to move · drag edges to resize · right-click to remove" : ""}`;

  /** Center the dragged block on the cursor, snapped and kept inside the grid. */
  const centeredStart = (pointerRawMin: number): number => {
    const dur = ghostDuration;
    const snapped = Math.round((pointerRawMin - dur / 2) / SNAP_MIN) * SNAP_MIN;
    return Math.max(GRID_START_MIN, Math.min(snapped, Math.max(GRID_START_MIN, GRID_END_MIN - dur)));
  };

  const dropHandlersFor = (iso: string) => ({
    droppable: canDrop,
    onHover: (pointerRawMin: number) => setHover({ iso, startMin: centeredStart(pointerRawMin) }),
    onLeave: () => setHover((h) => (h?.iso === iso ? null : h)),
    onDrop: (pointerRawMin: number) => {
      const payload = drag;
      const startMin = centeredStart(pointerRawMin);
      setDrag(null);
      setHover(null);
      if (!payload) return;
      if (payload.kind === "investigator") void dropInvestigator(payload.userId, iso, startMin);
      else void dropBlock(payload.block, iso, startMin);
    },
  });

  const dayInfoMeta = dayInfo ? dayMeta(new Date(`${dayInfo}T00:00:00`)) : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Scheduling</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            Pick a case, then drag investigators onto the week
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-2 flex overflow-hidden rounded-[0.5rem] border border-[var(--color-line)]">
            <button
              type="button"
              onClick={() => pickOrientation("vertical")}
              title="Vertical — days as columns"
              aria-pressed={orientation === "vertical"}
              className={cn(
                "anim-toggle tap grid h-8 w-9 place-items-center",
                orientation === "vertical"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
              )}
            >
              <Columns3 size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => pickOrientation("horizontal")}
              title="Horizontal — days as rows"
              aria-pressed={orientation === "horizontal"}
              className={cn(
                "anim-toggle tap grid h-8 w-9 place-items-center border-l border-[var(--color-line)]",
                orientation === "horizontal"
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
              )}
            >
              <Rows3 size={14} strokeWidth={1.8} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMonday((m) => shiftWeek(m, -1))}
            aria-label="Previous week"
            className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ChevronLeft size={14} strokeWidth={1.8} />
          </button>
          <span className="min-w-[10.5rem] text-center font-mono text-[0.75rem] text-[var(--color-text-mid)]">
            {fmtRange(monday)}
          </span>
          <button
            type="button"
            onClick={() => setMonday((m) => shiftWeek(m, 1))}
            aria-label="Next week"
            className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ChevronRight size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOpen(true)}
            title="Month overview"
            aria-label="Month overview"
            className="ml-1 grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
          >
            <CalendarDays size={14} strokeWidth={1.8} />
          </button>
          {monday !== mondayOf(new Date()) && (
            <button
              type="button"
              onClick={() => setMonday(mondayOf(new Date()))}
              className="ml-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              This week
            </button>
          )}
          {saving && <Loader2 size={14} className="ml-1 animate-spin text-[var(--color-text-lo)]" />}
        </div>
      </div>

      {/* Region filter */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {REGION_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={cn(
              "anim-toggle tap flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.71875rem] font-medium",
              region === r
                ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
            )}
          >
            {r !== "all" && <MapPin size={11} strokeWidth={1.8} />}
            {r === "all" ? "All regions" : REGION_LABELS[r]}
          </button>
        ))}
      </div>

      {error && (
        <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      {/* Body: case rail + board */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Case rail */}
        <div className="flex w-[16rem] shrink-0 flex-col gap-2 overflow-hidden">
          <div className="relative shrink-0">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
            <input
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Find a case…"
              className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {selectedCase && (
            <button
              type="button"
              onClick={() => navigate(`/cases/${selectedCase.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
            >
              <ArrowUpRight size={12} strokeWidth={1.8} />
              Go to case
              <span className="ml-auto font-mono text-[0.59375rem] text-[var(--color-text-lo)]">{selectedCase.caseNumber}</span>
            </button>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-1">
            {cases.map((c) => {
              const active = c.id === selectedCaseId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCase(c.id)}
                  className={cn(
                    "shrink-0 rounded-[0.75rem] border p-3 text-left transition-colors",
                    active
                      ? "border-[rgba(74,127,255,0.45)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-[var(--color-ink-1)]/50 hover:border-[var(--color-line-2)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</span>
                    {c.region && (
                      <span className="shrink-0 rounded-full bg-[var(--color-ink-3)] px-2 py-0.5 font-mono text-[0.53125rem] uppercase tracking-wider text-[var(--color-text-mid)]">
                        {REGION_LABELS[c.region]}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                    <span>{c.claimNumber ?? c.caseNumber}</span>
                    {c.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={9} strokeWidth={1.8} />
                        due {new Date(c.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {cases.length === 0 && (
              <div className="grid place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-10 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                No open cases here.
              </div>
            )}
          </div>

          {/* Reminders for the selected case — upcoming birthday + plain appointments */}
          {caseDetail && (birthdaySoon || hints.length > 0) && (
            <div className="shrink-0 rounded-[0.75rem] border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.05)] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.59375rem] uppercase tracking-wider text-[#fbbf24]">
                <Info size={11} strokeWidth={1.8} />
                Good to know
              </div>
              <ul className="flex flex-col gap-1 text-[0.6875rem] leading-snug text-[var(--color-text-mid)]">
                {birthdaySoon && (
                  <li className="flex items-start gap-1.5">
                    <Cake size={11} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#fbbf24]" />
                    Birthday {birthdaySoon.daysAway === 0 ? "today" : birthdaySoon.daysAway === 1 ? "tomorrow" : `in ${birthdaySoon.daysAway} days`} (
                    {birthdaySoon.date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}) — subjects are usually out and about.
                  </li>
                )}
                {hints.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#fbbf24]" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: investigator tray + board */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {/* Investigator tray */}
          {canManage && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 overflow-x-auto rounded-[0.75rem] border px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                selectedCase ? "border-[var(--color-line)] bg-[var(--color-ink-1)]/50" : "border-dashed border-[var(--color-line)]",
              )}
            >
              <span className="shrink-0 pr-1 font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {selectedCase ? "Drag onto the board ↓" : "Investigators — pick a case first"}
              </span>
              {sortedInvestigators.map((inv) => {
                const matched = !!selectedCase?.region && inv.region === selectedCase.region;
                const draggable = !!selectedCase;
                return (
                  <div
                    key={inv.id}
                    draggable={draggable}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("text/plain", inv.name);
                      setDrag({ kind: "investigator", userId: inv.id });
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setHover(null);
                    }}
                    title={draggable ? `Drag ${inv.name} onto the board` : "Select a case first"}
                    className={cn(
                      "flex shrink-0 select-none items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors",
                      draggable ? "cursor-grab active:cursor-grabbing hover:border-[rgba(74,127,255,0.45)]" : "opacity-55",
                      matched ? "border-[rgba(74,222,128,0.4)] bg-[rgba(74,222,128,0.06)]" : "border-[var(--color-line)] bg-[var(--color-ink-2)]",
                    )}
                  >
                    {draggable && <GripVertical size={11} strokeWidth={1.8} className="-mr-0.5 text-[var(--color-text-lo)]" />}
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.5625rem] font-medium text-white"
                      style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
                    >
                      {getInitials(inv.name)}
                    </span>
                    <span className="leading-tight">
                      <span className="block whitespace-nowrap text-[0.71875rem] font-medium text-[var(--color-text-hi)]">{inv.name}</span>
                      <span className={cn("block font-mono text-[0.5rem] uppercase tracking-wider", matched ? "text-[#4ade80]" : "text-[var(--color-text-lo)]")}>
                        {inv.region ? REGION_LABELS[inv.region] : "No region"}
                        {matched && " · match"}
                      </span>
                    </span>
                  </div>
                );
              })}
              {investigators.length === 0 && (
                <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                  No investigators yet — invite some from the Investigators page.
                </span>
              )}
            </div>
          )}

          {orientation === "vertical" ? (
            /* ── Vertical board: days as columns, time flows down ──────────── */
            <div className="min-h-0 flex-1 overflow-y-auto rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
                {/* Header row */}
                <div className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-ink-1)]" />
                {days.map((d) => {
                  const meta = dayMeta(d);
                  return (
                    <div
                      key={`head-${meta.iso}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDayInfo(meta.iso)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setDayInfo(meta.iso);
                      }}
                      title="Day details"
                      className="sticky top-0 z-20 flex cursor-pointer items-center justify-between gap-1 border-b border-l border-[var(--color-line)] bg-[var(--color-ink-1)] px-2 py-1.5 transition-colors hover:bg-[var(--color-ink-2)]"
                    >
                      <div className="leading-tight">
                        <span className={cn("font-mono text-[0.5625rem] uppercase tracking-wider", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]")}>
                          {d.toLocaleDateString(undefined, { weekday: "short" })}
                        </span>
                        <span className={cn("ml-1 text-[0.8125rem] font-medium", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-hi)]")}>
                          {d.getDate()}
                        </span>
                      </div>
                      <DayBadges meta={meta} />
                    </div>
                  );
                })}

                {/* Time gutter */}
                <div className="relative h-[80rem] select-none">
                  {hourMarks.map((m) => (
                    <span
                      key={m}
                      className="absolute right-1.5 -translate-y-1/2 font-mono text-[0.625rem] text-[var(--color-text-lo)]"
                      style={{ top: `${pctOf(m)}%` }}
                    >
                      {toHHMM(m)}
                    </span>
                  ))}
                </div>

                {/* Day columns */}
                {days.map((d) => {
                  const meta = dayMeta(d);
                  const positioned = layoutDay(blocksByDay.get(meta.iso) ?? []);
                  const isHover = canDrop && drag?.kind === "investigator" && hover?.iso === meta.iso;

                  return (
                    <DayBody
                      key={meta.iso}
                      horizontal={false}
                      isToday={meta.isToday}
                      className="h-[80rem] border-l border-[var(--color-line)]"
                      {...dropHandlersFor(meta.iso)}
                    >
                      {hourMarks.map((m) => (
                        <div
                          key={m}
                          className="pointer-events-none absolute inset-x-0 border-t border-[var(--color-line)]/50"
                          style={{ top: `${pctOf(m)}%` }}
                        />
                      ))}

                      {blocks === null && (
                        <div className="absolute inset-0 grid place-items-center">
                          <Loader2 size={14} className="animate-spin text-[var(--color-text-lo)]" />
                        </div>
                      )}

                      {positioned.map((item) => {
                        const b = item.block;
                        const { startMin, endMin } = effectiveSpan(item);
                        const gs = groupStyle(item.group);
                        return (
                          <div
                            key={b.id}
                            {...blockDragHandlers(b)}
                            title={blockTitle(b)}
                            className={cn(
                              "absolute overflow-hidden rounded-[0.4375rem] border px-1.5 py-1 leading-tight transition-colors",
                              canManage && "cursor-grab active:cursor-grabbing",
                            )}
                            style={{
                              top: `${pctOf(startMin)}%`,
                              height: `calc(${((endMin - startMin) / GRID_TOTAL_MIN) * 100}% - 0.125rem)`,
                              left: `calc(${(item.lane / item.laneCount) * 100}% + 0.1875rem)`,
                              width: `calc(${100 / item.laneCount}% - 0.375rem)`,
                              background: gs.background,
                              borderColor: gs.borderColor,
                              zIndex: item.group + 1,
                            }}
                          >
                            <div className="truncate font-mono text-[0.5625rem]" style={{ color: gs.text }}>
                              {toHHMM(startMin)}–{toHHMM(endMin)}
                              {item.openEnd && !resizing && " →"}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1">
                              <span
                                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.4375rem] font-medium text-white"
                                style={{ background: gs.solid }}
                              >
                                {getInitials(b.user.name)}
                              </span>
                              <span className="truncate text-[0.625rem] font-medium text-[var(--color-text-hi)]">{b.user.name}</span>
                            </div>
                            {!selectedCase && (
                              <div className="mt-0.5 truncate font-mono text-[0.5rem] text-[var(--color-text-lo)]">
                                {b.case.caseNumber} · {b.case.subjectName.split(" ")[0]}
                              </div>
                            )}
                            {canManage && (
                              <>
                                <div
                                  data-edge="start"
                                  onPointerDown={(e) => beginResize(e, item)}
                                  className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
                                />
                                <div
                                  data-edge="end"
                                  onPointerDown={(e) => beginResize(e, item)}
                                  className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                                />
                              </>
                            )}
                          </div>
                        );
                      })}

                      {isHover && hover && (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-10 rounded-[0.4375rem] border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-1.5 py-1"
                          style={{
                            top: `${pctOf(hover.startMin)}%`,
                            height: `${(Math.min(ghostDuration, GRID_END_MIN - hover.startMin) / GRID_TOTAL_MIN) * 100}%`,
                          }}
                        >
                          <span className="font-mono text-[0.5625rem] text-[var(--color-accent-2)]">
                            {toHHMM(hover.startMin)}–{toHHMM(Math.min(hover.startMin + ghostDuration, GRID_END_MIN))}
                          </span>
                        </div>
                      )}
                    </DayBody>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Horizontal board: days as rows, time flows right ──────────── */
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50">
              {/* Hour header */}
              <div className="grid shrink-0 grid-cols-[9rem_1fr] border-b border-[var(--color-line)]">
                <div />
                <div className="relative h-6 select-none border-l border-[var(--color-line)]">
                  {hourMarks.filter((m) => m % 120 === 0).map((m) => (
                    <span
                      key={m}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[0.625rem] text-[var(--color-text-lo)]"
                      style={{ left: `${pctOf(m)}%` }}
                    >
                      {toHHMM(m)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Day rows */}
              <div className="flex min-h-0 flex-1 flex-col">
                {days.map((d) => {
                  const meta = dayMeta(d);
                  const positioned = layoutDay(blocksByDay.get(meta.iso) ?? []);
                  const isHover = canDrop && drag?.kind === "investigator" && hover?.iso === meta.iso;

                  return (
                    <div key={meta.iso} className="grid min-h-[4.25rem] flex-1 grid-cols-[9rem_1fr] border-b border-[var(--color-line)] last:border-b-0">
                      {/* Day label cell */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setDayInfo(meta.iso)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setDayInfo(meta.iso);
                        }}
                        title="Day details"
                        className="flex cursor-pointer items-center justify-between gap-1 px-2.5 py-1.5 transition-colors hover:bg-[var(--color-ink-2)]"
                      >
                        <div className="leading-tight">
                          <div className={cn("font-mono text-[0.5625rem] uppercase tracking-wider", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]")}>
                            {d.toLocaleDateString(undefined, { weekday: "short" })}
                          </div>
                          <div className={cn("text-[0.875rem] font-medium", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-hi)]")}>
                            {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                        </div>
                        <DayBadges meta={meta} />
                      </div>

                      {/* Timeline */}
                      <DayBody
                        horizontal
                        isToday={meta.isToday}
                        className="border-l border-[var(--color-line)]"
                        {...dropHandlersFor(meta.iso)}
                      >
                        {hourMarks.map((m) => (
                          <div
                            key={m}
                            className="pointer-events-none absolute inset-y-0 border-l border-[var(--color-line)]/50"
                            style={{ left: `${pctOf(m)}%` }}
                          />
                        ))}

                        {blocks === null && (
                          <div className="absolute inset-0 grid place-items-center">
                            <Loader2 size={14} className="animate-spin text-[var(--color-text-lo)]" />
                          </div>
                        )}

                        {positioned.map((item) => {
                          const b = item.block;
                          const { startMin, endMin } = effectiveSpan(item);
                          const gs = groupStyle(item.group);
                          return (
                            <div
                              key={b.id}
                              {...blockDragHandlers(b)}
                              title={blockTitle(b)}
                              className={cn(
                                "absolute flex items-center gap-1 overflow-hidden rounded-[0.4375rem] border px-1.5 leading-tight transition-colors",
                                canManage && "cursor-grab active:cursor-grabbing",
                              )}
                              style={{
                                left: `calc(${pctOf(startMin)}% + 0.0625rem)`,
                                width: `calc(${((endMin - startMin) / GRID_TOTAL_MIN) * 100}% - 0.125rem)`,
                                top: `calc(${(item.lane / item.laneCount) * 100}% + 0.1875rem)`,
                                height: `calc(${100 / item.laneCount}% - 0.375rem)`,
                                background: gs.background,
                                borderColor: gs.borderColor,
                                zIndex: item.group + 1,
                              }}
                            >
                              <span
                                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.4375rem] font-medium text-white"
                                style={{ background: gs.solid }}
                              >
                                {getInitials(b.user.name)}
                              </span>
                              <span className="min-w-0 truncate text-[0.625rem] font-medium text-[var(--color-text-hi)]">{b.user.name}</span>
                              <span className="ml-auto shrink-0 truncate font-mono text-[0.5rem]" style={{ color: gs.text }}>
                                {toHHMM(startMin)}–{toHHMM(endMin)}
                              </span>
                              {canManage && (
                                <>
                                  <div
                                    data-edge="start"
                                    onPointerDown={(e) => beginResize(e, item)}
                                    className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
                                  />
                                  <div
                                    data-edge="end"
                                    onPointerDown={(e) => beginResize(e, item)}
                                    className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}

                        {isHover && hover && (
                          <div
                            className="pointer-events-none absolute inset-y-0.5 z-10 flex items-center rounded-[0.4375rem] border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-1.5"
                            style={{
                              left: `${pctOf(hover.startMin)}%`,
                              width: `${(Math.min(ghostDuration, GRID_END_MIN - hover.startMin) / GRID_TOTAL_MIN) * 100}%`,
                            }}
                          >
                            <span className="truncate font-mono text-[0.5625rem] text-[var(--color-accent-2)]">
                              {toHHMM(hover.startMin)}–{toHHMM(Math.min(hover.startMin + ghostDuration, GRID_END_MIN))}
                            </span>
                          </div>
                        )}
                      </DayBody>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditBlockModal
          block={editing}
          othersThatDay={weekAllBlocks.filter((b) => b.date.slice(0, 10) === editing.date.slice(0, 10) && b.userId === editing.userId && b.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadBlocks();
          }}
          onRemove={() => removeBlock(editing.id)}
          onGoToCase={() => navigate(`/cases/${editing.caseId}`)}
        />
      )}

      {monthOpen && (
        <MonthOverviewModal
          anchorMonday={monday}
          caseName={selectedCase ? `${selectedCase.subjectName} · ${selectedCase.caseNumber}` : null}
          subjectDob={caseDetail?.subjectDob ?? null}
          hints={hints}
          weatherRegion={weatherRegion}
          onClose={() => setMonthOpen(false)}
          onPickDay={(iso) => {
            setMonthOpen(false);
            setMonday(mondayOf(new Date(`${iso}T00:00:00`)));
            setDayInfo(iso);
          }}
        />
      )}

      {dayInfoMeta && (
        <DayInfoModal
          meta={dayInfoMeta}
          caseName={selectedCase?.subjectName ?? null}
          regionLabel={weatherRegion ? REGION_LABELS[weatherRegion] : null}
          onClose={() => setDayInfo(null)}
        />
      )}
    </div>
  );
}

// ─── Day badges (weather / birthday / appointments) ───────────────────────────

interface DayMeta {
  iso: string;
  isToday: boolean;
  birthday: boolean;
  dayHints: string[];
  wx: WeatherDay | null;
}

function DayBadges({ meta }: { meta: DayMeta }) {
  const WxIcon = meta.wx ? weatherIcon(meta.wx.code) : null;
  if (!WxIcon && !meta.birthday && meta.dayHints.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 p-0.5">
      {WxIcon && meta.wx && (
        <span
          className="grid h-5 w-5 place-items-center rounded-full"
          style={{ background: `${weatherColor(meta.wx.code)}1f` }}
        >
          <WxIcon size={12} strokeWidth={1.8} style={{ color: weatherColor(meta.wx.code) }} />
        </span>
      )}
      {meta.birthday && (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(251,191,36,0.18)]">
          <Cake size={11} strokeWidth={1.8} className="text-[#fbbf24]" />
        </span>
      )}
      {meta.dayHints.length > 0 && (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(251,146,60,0.18)]">
          <AlertCircle size={11} strokeWidth={1.8} className="text-[#fb923c]" />
        </span>
      )}
    </span>
  );
}

// ─── Day info modal ───────────────────────────────────────────────────────────

function DayInfoModal({
  meta,
  caseName,
  regionLabel,
  onClose,
}: {
  meta: DayMeta;
  caseName: string | null;
  regionLabel: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = new Date(`${meta.iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
  const WxIcon = meta.wx ? weatherIcon(meta.wx.code) : null;
  const wxColor = meta.wx ? weatherColor(meta.wx.code) : null;

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(24rem,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="surface anim-modal flex flex-col gap-4 rounded-[0.875rem] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.25rem] leading-tight text-[var(--color-text-hi)]">{dateLabel}</h2>
              {caseName && (
                <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{caseName}</p>
              )}
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={16} />
            </button>
          </div>

          {WxIcon && meta.wx && wxColor && (
            <div
              className="flex items-center gap-3 rounded-[0.75rem] border p-3"
              style={{ background: `${wxColor}14`, borderColor: `${wxColor}40` }}
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                style={{ background: `${wxColor}24`, boxShadow: `0 0 1.125rem ${wxColor}45` }}
              >
                <WxIcon size={22} strokeWidth={1.7} style={{ color: wxColor }} />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">
                  {conditionLabel(meta.wx.code)}
                  {regionLabel && <span className="ml-1.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">{regionLabel}</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-3 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
                  <span>
                    {meta.wx.highF != null ? `${meta.wx.highF}°` : "—"}
                    {meta.wx.lowF != null && <span className="text-[var(--color-text-lo)]"> / {meta.wx.lowF}°</span>}
                  </span>
                  {meta.wx.precipChance != null && (
                    <span className="inline-flex items-center gap-1">
                      <Droplets size={10} strokeWidth={1.8} />
                      {meta.wx.precipChance}%
                    </span>
                  )}
                  {meta.wx.windMph != null && (
                    <span className="inline-flex items-center gap-1">
                      <Wind size={10} strokeWidth={1.8} />
                      {meta.wx.windMph} mph
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {meta.birthday && (
            <div className="flex items-start gap-2.5 rounded-[0.75rem] border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.07)] p-3 text-[0.75rem] leading-snug text-[var(--color-text-mid)]">
              <Cake size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#fbbf24]" />
              <span>
                <span className="font-medium text-[var(--color-text-hi)]">Subject's birthday.</span>{" "}
                Subjects are usually out and about — a good day to be on station.
              </span>
            </div>
          )}

          {meta.dayHints.length > 0 && (
            <div className="rounded-[0.75rem] border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.07)] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.59375rem] uppercase tracking-wider text-[#fb923c]">
                <AlertCircle size={11} strokeWidth={1.8} />
                Appointments on file
              </div>
              <ul className="flex flex-col gap-1.5 text-[0.75rem] leading-snug text-[var(--color-text-mid)]">
                {meta.dayHints.map((h) => (
                  <li key={h} className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#fb923c]" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!meta.wx && !meta.birthday && meta.dayHints.length === 0 && (
            <div className="rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-6 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              Nothing on file for this day.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Day body (drop target for both orientations) ─────────────────────────────

function DayBody({
  horizontal,
  isToday,
  droppable,
  onHover,
  onLeave,
  onDrop,
  className,
  children,
}: {
  horizontal: boolean;
  isToday: boolean;
  droppable: boolean;
  onHover: (startMin: number) => void;
  onLeave: () => void;
  onDrop: (startMin: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      data-daybody
      onDragOver={(e) => {
        if (!droppable || !ref.current) return;
        e.preventDefault();
        onHover(rawMinuteAtPointer(e.clientX, e.clientY, ref.current.getBoundingClientRect(), horizontal));
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        onLeave();
      }}
      onDrop={(e) => {
        if (!ref.current) return;
        e.preventDefault();
        onDrop(rawMinuteAtPointer(e.clientX, e.clientY, ref.current.getBoundingClientRect(), horizontal));
      }}
      className={cn("relative", isToday && "bg-[var(--color-accent-soft)]/25", className)}
    >
      {children}
    </div>
  );
}

// ─── Edit-block modal ─────────────────────────────────────────────────────────

function EditBlockModal({
  block,
  othersThatDay,
  onClose,
  onSaved,
  onRemove,
  onGoToCase,
}: {
  block: ScheduleBlock;
  othersThatDay: ScheduleBlock[];
  onClose: () => void;
  onSaved: () => void;
  onRemove: () => void;
  onGoToCase: () => void;
}) {
  const [startTime, setStartTime] = useState(block.startTime);
  const [endTime, setEndTime] = useState(block.endTime ?? "");
  const [notes, setNotes] = useState(block.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Date(`${block.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await scheduleApi.update(block.id, {
        startTime,
        endTime: endTime || null,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the changes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="surface anim-modal flex flex-col gap-4 rounded-[0.875rem] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.25rem] leading-tight text-[var(--color-text-hi)]">{block.user.name}</h2>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                {dateLabel} · {block.case.caseNumber} · {block.case.subjectName}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onGoToCase}
                className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
              >
                <ArrowUpRight size={11} strokeWidth={1.8} />
                Go to case
              </button>
              <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                <X size={16} />
              </button>
            </div>
          </div>

          {othersThatDay.length > 0 && (
            <div className="rounded-[0.5rem] border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.07)] px-3 py-2 text-[0.6875rem] text-[#fb923c]">
              Also scheduled that day on {othersThatDay.map((b) => `${b.case.caseNumber} (${b.case.subjectName}) at ${b.startTime}`).join(", ")}.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
                Start time
              </label>
              <input
                type="time"
                value={startTime ?? ""}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
                End time <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
              Notes <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Meet at the Wawa on Route 9, bring the long lens…"
              className="min-h-[3.5rem] w-full resize-none rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && <div className="text-[0.75rem] text-[var(--color-neg)]">{error}</div>}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 rounded-[0.625rem] border border-[rgba(248,113,113,0.3)] px-3 py-2 text-[0.75rem] text-[var(--color-neg)] transition-colors hover:bg-[rgba(248,113,113,0.08)]"
            >
              <Trash2 size={12} strokeWidth={1.8} />
              Remove
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
              >
                {busy && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Month overview modal ─────────────────────────────────────────────────────

function MonthOverviewModal({
  anchorMonday,
  caseName,
  subjectDob,
  hints,
  weatherRegion,
  onClose,
  onPickDay,
}: {
  anchorMonday: string;
  caseName: string | null;
  subjectDob: string | null;
  hints: string[];
  weatherRegion: Region | null;
  onClose: () => void;
  onPickDay: (iso: string) => void;
}) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date(`${anchorMonday}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [wxByDay, setWxByDay] = useState<Map<string, WeatherDay>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 6-week grid starting on the Monday on/before the 1st
  const gridDays = useMemo(() => {
    const start = new Date(`${mondayOf(monthStart)}T00:00:00`);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [monthStart]);

  useEffect(() => {
    if (!weatherRegion) {
      setWxByDay(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    const mondays = [...new Set(gridDays.map((d) => mondayOf(d)))];
    Promise.all(
      mondays.map((m) =>
        weatherApi.weekly(m).catch(() => ({ start: m, groups: [] as WeeklyWeather[] })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, WeatherDay>();
        for (const r of results) {
          const g = r.groups.find((x) => x.group === weatherRegion);
          for (const day of g?.days ?? []) map.set(day.date, day);
        }
        setWxByDay(map);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gridDays, weatherRegion]);

  const today = isoOf(new Date());
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shiftMonth = (n: number) =>
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + n, 1));

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(46rem,94vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="surface anim-modal flex max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-[0.875rem] p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.375rem] leading-tight text-[var(--color-text-hi)]">Month overview</h2>
              {caseName && <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{caseName}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
              >
                <ChevronLeft size={13} strokeWidth={1.8} />
              </button>
              <span className="min-w-[9rem] text-center font-mono text-[0.71875rem] text-[var(--color-text-mid)]">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
              >
                <ChevronRight size={13} strokeWidth={1.8} />
              </button>
              {loading && <Loader2 size={13} className="animate-spin text-[var(--color-text-lo)]" />}
              <button type="button" onClick={onClose} aria-label="Close" className="ml-2 text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
              <div key={w} className="text-center font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {gridDays.map((d) => {
              const iso = isoOf(d);
              const inMonth = d.getMonth() === monthStart.getMonth();
              const isToday = iso === today;
              const birthday = isBirthday(subjectDob, iso);
              const dayHints = hintsForWeekday(hints, d.getDay());
              const wx = wxByDay.get(iso);
              const WxIcon = wx ? weatherIcon(wx.code) : null;
              const tooltip = [
                wx ? `${conditionLabel(wx.code)} — ${wx.highF ?? "—"}° / ${wx.lowF ?? "—"}°` : null,
                birthday ? "Subject's birthday" : null,
                ...dayHints,
              ]
                .filter(Boolean)
                .join("\n");

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPickDay(iso)}
                  title={tooltip || undefined}
                  className={cn(
                    "flex min-h-[3.75rem] flex-col items-start gap-1 rounded-[0.5rem] border p-1.5 text-left transition-colors",
                    inMonth ? "border-[var(--color-line)] bg-[var(--color-ink-1)]/50" : "border-transparent opacity-40",
                    "hover:border-[rgba(74,127,255,0.45)]",
                    isToday && "ring-1 ring-[var(--color-accent)]",
                  )}
                >
                  <span className={cn("font-mono text-[0.65625rem]", isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-mid)]")}>
                    {d.getDate()}
                  </span>
                  <span className="flex flex-wrap items-center gap-0.5">
                    {WxIcon && wx && (
                      <span className="grid h-4 w-4 place-items-center rounded-full" style={{ background: `${weatherColor(wx.code)}1f` }}>
                        <WxIcon size={10} strokeWidth={1.8} style={{ color: weatherColor(wx.code) }} />
                      </span>
                    )}
                    {birthday && (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-[rgba(251,191,36,0.18)]">
                        <Cake size={9} strokeWidth={1.8} className="text-[#fbbf24]" />
                      </span>
                    )}
                    {dayHints.length > 0 && (
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-[rgba(251,146,60,0.18)]">
                        <AlertCircle size={9} strokeWidth={1.8} className="text-[#fb923c]" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
            Click a day to jump to its week and see the details. Forecasts only exist for roughly the last 12 weeks and the next week.
          </p>
        </div>
      </div>
    </>
  );
}
