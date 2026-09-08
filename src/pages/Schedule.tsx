import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight, Briefcase, Cake, CalendarDays, ChevronLeft, ChevronRight,
  Droplets, Folder, GripVertical, Info, Loader2, MapPin, Search, Trash2, User, Users, Wind, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/contexts/AuthContext";
import { ViewToggle, ViewToggleGroup } from "@/components/ui/ViewToggle";
import { weatherIcon, weatherColor, conditionLabel } from "@/components/cases/WeatherStrip";
import {
  casesApi,
  investigatorsApi,
  scheduleApi,
  weatherApi,
  ApiError,
  REGION_LABELS,
  type CaseListItem,
  type InvestigatorListItem,
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

/** Next occurrence of a birthday (month+day), from today (local). */
function nextBirthday(dobIso: string): Date {
  const dob = new Date(dobIso);
  const now = new Date();
  const candidate = new Date(now.getFullYear(), dob.getUTCMonth(), dob.getUTCDate());
  if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

type Mode = "investigators" | "cases";
type DragPayload = { kind: "add"; otherId: string } | { kind: "block"; block: ScheduleBlock };

const MODE_LS_KEY = "accenty.crm.schedule.mode";

// Investigators = person icon / blue. Cases = folder icon / amber.
const INVESTIGATOR_BG = "linear-gradient(135deg,#4a7fff,#7aa1ff)";
const CASE_BG = "linear-gradient(135deg,#f59e0b,#fbbf24)";

/** Always-translucent glass look for the schedule's big panels — independent
 * of the app-wide glass theme toggle, which leaves `.surface` fully opaque. */
const glassPanel: React.CSSProperties = {
  background:
    "linear-gradient(145deg, rgb(from var(--color-accent-2) r g b / 0.07), rgb(from var(--color-ink-2) r g b / 0.4) 55%, rgb(from var(--color-accent) r g b / 0.07))",
  backdropFilter: "blur(1rem) saturate(1.4)",
  WebkitBackdropFilter: "blur(1rem) saturate(1.4)",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const REGION_OPTIONS: (Region | "all")[] = ["all", "tristate", "ca", "texas"];

export default function Schedule() {
  const { can } = useAuth();
  const canManage = can("schedule.manage");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [region, setRegion] = useState<Region | "all">("all");
  const [railSearch, setRailSearch] = useState("");
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [investigators, setInvestigators] = useState<InvestigatorListItem[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get("user"));
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(searchParams.get("case"));
  const [weekWeather, setWeekWeather] = useState<WeeklyWeather[]>([]);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [dayInfo, setDayInfo] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);

  const [mode, setMode] = useState<Mode>(() => {
    if (searchParams.get("case")) return "cases";
    if (searchParams.get("user")) return "investigators";
    try {
      return localStorage.getItem(MODE_LS_KEY) === "cases" ? "cases" : "investigators";
    } catch {
      return "investigators";
    }
  });

  const pickMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_LS_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Toast — floats over the UI, never reflows layout.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 4500);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const selectedUser = investigators.find((i) => i.id === selectedUserId) ?? null;
  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null;
  const selectedId = mode === "investigators" ? selectedUserId : selectedCaseId;

  // Case list (also the investigator-mode tray)
  useEffect(() => {
    casesApi
      .list({ status: "open", region: region === "all" ? undefined : region, page: 1, pageSize: 100 })
      .then((res) => setCases(res.cases))
      .catch((err) => showToast(err instanceof ApiError ? err.message : "Could not load cases."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // Investigator list (also the case-mode tray)
  useEffect(() => {
    investigatorsApi.list().then((res) => setInvestigators(res.investigators)).catch(() => {});
  }, []);

  // Weekly weather for the day-header markers
  useEffect(() => {
    weatherApi.weekly(monday).then((res) => setWeekWeather(res.groups)).catch(() => setWeekWeather([]));
  }, [monday]);

  const weekEnd = useMemo(() => {
    const d = new Date(`${monday}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return isoOf(d);
  }, [monday]);

  const loadBlocks = useCallback(() => {
    if (!selectedId) {
      setBlocks([]);
      return;
    }
    const params =
      mode === "investigators"
        ? { from: monday, to: weekEnd, userId: selectedId }
        : { from: monday, to: weekEnd, caseId: selectedId };
    scheduleApi
      .list(params)
      .then((res) => setBlocks(res.blocks))
      .catch((err) => showToast(err instanceof ApiError ? err.message : "Could not load the schedule."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, monday, weekEnd]);

  useEffect(loadBlocks, [loadBlocks]);

  const selectUser = (id: string | null) => {
    setSelectedUserId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set("user", id);
    else next.delete("user");
    setSearchParams(next, { replace: true });
  };

  const selectCase = (id: string | null) => {
    setSelectedCaseId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set("case", id);
    else next.delete("case");
    setSearchParams(next, { replace: true });
  };

  // Always keep something selected in each mode — prefer an entry with a
  // region set, so the weather markers have something to show by default.
  useEffect(() => {
    if (!selectedUserId && investigators.length > 0) {
      const preferred = investigators.find((i) => i.region) ?? investigators[0];
      selectUser(preferred.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigators, selectedUserId]);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      const preferred = cases.find((c) => c.region) ?? cases[0];
      selectCase(preferred.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases, selectedCaseId]);

  const days = useMemo(() => {
    const start = new Date(`${monday}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS));
  }, [monday]);

  const today = isoOf(new Date());
  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks ?? []) {
      const key = b.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), b]);
    }
    return map;
  }, [blocks]);

  // Weather group for the day markers: selected entity's region, else fall back to
  // wherever their assigned cases actually are, else the region filter.
  const weatherRegion: Region | null =
    (mode === "investigators"
      ? selectedUser?.region ?? (blocks ?? []).find((b) => b.case.region)?.case.region ?? null
      : selectedCase?.region) ?? (region !== "all" ? region : null);
  const weatherDays = useMemo(() => {
    if (!weatherRegion) return new Map<string, WeatherDay>();
    const group = weekWeather.find((g) => g.group === weatherRegion);
    return new Map((group?.days ?? []).map((d) => [d.date, d]));
  }, [weekWeather, weatherRegion]);

  // Upcoming (within a week) birthdays across the selected entity's cases.
  const birthdaysSoon = useMemo(() => {
    const seen = new Map<string, { caseNumber: string; subjectName: string; date: Date; daysAway: number }>();
    for (const b of blocks ?? []) {
      if (!b.case.subjectDob || seen.has(b.caseId)) continue;
      const next = nextBirthday(b.case.subjectDob);
      const daysAway = Math.round((next.getTime() - new Date(new Date().toDateString()).getTime()) / DAY_MS);
      if (daysAway <= 7) seen.set(b.caseId, { caseNumber: b.case.caseNumber, subjectName: b.case.subjectName, date: next, daysAway });
    }
    return [...seen.values()];
  }, [blocks]);

  const regionFilteredInvestigators = useMemo(
    () => (region === "all" ? investigators : investigators.filter((i) => i.region === region)),
    [investigators, region],
  );

  // Cases sorted so region matches come first, for the investigator-mode tray.
  const sortedCases = useMemo(() => {
    if (!selectedUser?.region) return cases;
    return [...cases].sort((a, b) => {
      const am = a.region === selectedUser.region ? 0 : 1;
      const bm = b.region === selectedUser.region ? 0 : 1;
      return am - bm || a.caseNumber.localeCompare(b.caseNumber);
    });
  }, [cases, selectedUser]);

  // Investigators sorted so region matches come first, for the case-mode tray.
  const sortedInvestigators = useMemo(() => {
    if (!selectedCase?.region) return regionFilteredInvestigators;
    return [...regionFilteredInvestigators].sort((a, b) => {
      const am = a.region === selectedCase.region ? 0 : 1;
      const bm = b.region === selectedCase.region ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
  }, [regionFilteredInvestigators, selectedCase]);

  const filteredInvestigators = useMemo(() => {
    const q = railSearch.trim().toLowerCase();
    if (!q) return regionFilteredInvestigators;
    return regionFilteredInvestigators.filter((i) => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));
  }, [regionFilteredInvestigators, railSearch]);

  const filteredCases = useMemo(() => {
    const q = railSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => c.caseNumber.toLowerCase().includes(q) || c.subjectName.toLowerCase().includes(q));
  }, [cases, railSearch]);

  const patchBlocks = (fn: (blocks: ScheduleBlock[]) => ScheduleBlock[]) =>
    setBlocks((prev) => (prev ? fn(prev) : prev));

  const removeBlock = async (id: string) => {
    setEditing(null);
    patchBlocks((bs) => bs.filter((x) => x.id !== id));
    try {
      await scheduleApi.remove(id);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not remove the schedule block.");
      loadBlocks();
    }
  };

  /** Drop a tray chip onto a day → pair the selected entity with the dragged one, instantly. */
  const assign = async (otherId: string, dateIso: string) => {
    if (!selectedId) return;
    const caseId = mode === "investigators" ? otherId : selectedId;
    const userId = mode === "investigators" ? selectedId : otherId;

    // Investigators only ever hold one slot per day — any existing block that day
    // (for any case) blocks a new one. Cases can have several investigators per day.
    if (mode === "investigators") {
      const existing = (blocks ?? []).find((b) => b.date.slice(0, 10) === dateIso);
      if (existing) {
        showToast(
          existing.caseId === otherId
            ? `${existing.case.caseNumber} is already assigned on that day.`
            : `Already assigned to ${existing.case.caseNumber} that day — remove it first.`,
        );
        return;
      }
    } else {
      const duplicate = (blocks ?? []).some((b) => b.userId === otherId && b.date.slice(0, 10) === dateIso);
      if (duplicate) {
        const label = investigators.find((i) => i.id === otherId)?.name ?? "That investigator";
        showToast(`${label} is already assigned on that day.`);
        return;
      }
    }

    const kase = cases.find((c) => c.id === caseId);
    const inv = investigators.find((i) => i.id === userId);
    const tempId = `temp-${Date.now()}`;
    if (kase && inv) {
      patchBlocks((bs) => [
        ...bs,
        {
          id: tempId,
          caseId: kase.id,
          userId: inv.id,
          date: dateIso,
          startTime: null,
          endTime: null,
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
        },
      ]);
    }

    setSaving(true);
    try {
      const res = await scheduleApi.create({ caseId, userId, date: dateIso });
      patchBlocks((bs) => bs.map((x) => (x.id === tempId ? res.block : x)));
    } catch (err) {
      patchBlocks((bs) => bs.filter((x) => x.id !== tempId));
      showToast(err instanceof ApiError ? err.message : "Could not schedule.");
    } finally {
      setSaving(false);
    }
  };

  /** Drag an existing chip to another day → move it. */
  const moveBlock = async (block: ScheduleBlock, dateIso: string) => {
    if (block.date.slice(0, 10) === dateIso) return;
    // Investigator-mode blocks are already scoped to one investigator, so any other
    // block on the target date is a clash, regardless of case.
    const duplicate = (blocks ?? []).some(
      (b) =>
        b.id !== block.id &&
        b.date.slice(0, 10) === dateIso &&
        (mode === "investigators" ? true : b.userId === block.userId),
    );
    if (duplicate) {
      showToast(`${block.case.caseNumber} is already assigned on that day.`);
      return;
    }
    patchBlocks((bs) => bs.map((x) => (x.id === block.id ? { ...x, date: dateIso } : x)));
    try {
      await scheduleApi.update(block.id, { date: dateIso });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not move the assignment.");
      loadBlocks();
    }
  };

  const canDrop = drag != null && !!selectedId;

  const dayMeta = (d: Date) => {
    const iso = isoOf(d);
    const dayBlocks = blocksByDay.get(iso) ?? [];
    return {
      iso,
      isToday: iso === today,
      birthday: dayBlocks.some((b) => isBirthday(b.case.subjectDob, iso)),
      wx: weatherDays.get(iso) ?? null,
    };
  };

  const chipDragHandlers = (b: ScheduleBlock) => {
    const isTemp = b.id.startsWith("temp-");
    return {
      draggable: canManage && !isTemp,
      onDragStart: (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", b.case.caseNumber);
        setDrag({ kind: "block", block: b });
      },
      onDragEnd: () => {
        setDrag(null);
        setDragOverIso(null);
      },
      onClick: () => {
        if (!isTemp) setEditing(b);
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (!canManage || isTemp) return;
        e.preventDefault();
        void removeBlock(b.id);
      },
    };
  };

  const dropHandlersFor = (iso: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDrop) return;
      e.preventDefault();
      setDragOverIso(iso);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setDragOverIso((cur) => (cur === iso ? null : cur));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const payload = drag;
      setDrag(null);
      setDragOverIso(null);
      if (!payload) return;
      if (payload.kind === "add") void assign(payload.otherId, iso);
      else void moveBlock(payload.block, iso);
    },
  });

  const dayInfoMeta = dayInfo ? dayMeta(new Date(`${dayInfo}T00:00:00`)) : null;
  const contextLabel =
    mode === "investigators" ? selectedUser?.name ?? null : selectedCase ? `${selectedCase.subjectName} · ${selectedCase.caseNumber}` : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Scheduling</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {mode === "investigators" ? "Pick an investigator, then drag cases onto their week" : "Pick a case, then drag investigators onto its week"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ViewToggleGroup>
            <ViewToggle
              active={mode === "investigators"}
              onClick={() => pickMode("investigators")}
              icon={<Users size={13} strokeWidth={1.8} />}
              label="Investigators"
            />
            <ViewToggle
              active={mode === "cases"}
              onClick={() => pickMode("cases")}
              icon={<Briefcase size={13} strokeWidth={1.8} />}
              label="Cases"
            />
          </ViewToggleGroup>
          <button
            type="button"
            onClick={() => setMonday((m) => shiftWeek(m, -1))}
            aria-label="Previous week"
            className="ml-1 grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
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

      {/* Body: rail + board */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Rail — investigators or cases, depending on mode */}
        <div className="flex w-[16rem] shrink-0 flex-col gap-2 overflow-hidden">
          <div className="relative shrink-0">
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
            <input
              value={railSearch}
              onChange={(e) => setRailSearch(e.target.value)}
              placeholder={mode === "investigators" ? "Find an investigator…" : "Find a case…"}
              className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] py-1.5 pl-8 pr-3 text-[0.75rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {mode === "investigators" && selectedUser && (
            <button
              type="button"
              onClick={() => navigate(`/investigators/${selectedUser.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
            >
              <ArrowUpRight size={12} strokeWidth={1.8} />
              Go to investigator
              <span className="ml-auto truncate text-[0.65625rem] text-[var(--color-text-lo)]">{selectedUser.name.split(" ")[0]}</span>
            </button>
          )}
          {mode === "cases" && selectedCase && (
            <button
              type="button"
              onClick={() => navigate(`/cases/${selectedCase.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
            >
              <ArrowUpRight size={12} strokeWidth={1.8} />
              Go to case
              <span className="ml-auto truncate text-[0.65625rem] text-[var(--color-text-lo)]">{selectedCase.caseNumber}</span>
            </button>
          )}

          <div className="surface flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2" style={glassPanel}>
            {mode === "investigators" ? (
              <>
                {filteredInvestigators.map((inv) => {
                  const active = inv.id === selectedUserId;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => selectUser(inv.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2.5 rounded-[0.75rem] border p-2.5 text-left transition-colors",
                        active
                          ? "border-[rgba(74,127,255,0.45)] bg-[var(--color-accent-soft)]"
                          : "border-transparent hover:border-[var(--color-line-2)]",
                      )}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
                        style={{ background: INVESTIGATOR_BG }}
                      >
                        <User size={15} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{inv.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                          {inv.region ? REGION_LABELS[inv.region] : "No region"}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredInvestigators.length === 0 && (
                  <div className="grid place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-10 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                    No investigators match.
                  </div>
                )}
              </>
            ) : (
              <>
                {filteredCases.map((c) => {
                  const active = c.id === selectedCaseId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCase(c.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-2.5 rounded-[0.75rem] border p-2.5 text-left transition-colors",
                        active
                          ? "border-[rgba(74,127,255,0.45)] bg-[var(--color-accent-soft)]"
                          : "border-transparent hover:border-[var(--color-line-2)]",
                      )}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ background: CASE_BG }}>
                        <Folder size={15} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</div>
                        <div className="mt-0.5 truncate font-mono text-[0.65625rem] text-[var(--color-text-lo)]">{c.caseNumber}</div>
                      </div>
                    </button>
                  );
                })}
                {filteredCases.length === 0 && (
                  <div className="grid place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-10 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                    No cases match.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reminders for the selected entity — upcoming birthdays across its cases */}
          {selectedId && birthdaysSoon.length > 0 && (
            <div className="shrink-0 rounded-[0.75rem] border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.05)] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[0.59375rem] uppercase tracking-wider text-[#fbbf24]">
                <Info size={11} strokeWidth={1.8} />
                Good to know
              </div>
              <ul className="flex flex-col gap-1 text-[0.6875rem] leading-snug text-[var(--color-text-mid)]">
                {birthdaysSoon.map((b) => (
                  <li key={b.caseNumber} className="flex items-start gap-1.5">
                    <Cake size={11} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#fbbf24]" />
                    {b.subjectName}'s birthday {b.daysAway === 0 ? "today" : b.daysAway === 1 ? "tomorrow" : `in ${b.daysAway} days`}
                    {" "}({b.caseNumber}) — subjects are usually out and about.
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column: tray + board */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          {/* Tray — draggable cases or investigators, the opposite of the rail */}
          {canManage && (
            <div
              className={cn(
                "surface flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                !selectedId && "opacity-70",
              )}
              style={glassPanel}
            >
              <span className="shrink-0 pr-1 font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {selectedId ? "Drag onto the board ↓" : mode === "investigators" ? "Cases" : "Investigators"}
              </span>
              {mode === "investigators"
                ? sortedCases.map((c) => {
                    const matched = !!selectedUser?.region && c.region === selectedUser.region;
                    const draggable = !!selectedId;
                    return (
                      <div
                        key={c.id}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData("text/plain", c.caseNumber);
                          setDrag({ kind: "add", otherId: c.id });
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setDragOverIso(null);
                        }}
                        title={draggable ? `Drag ${c.caseNumber} onto the board` : "Select an investigator first"}
                        className={cn(
                          "flex shrink-0 select-none items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors",
                          draggable ? "cursor-grab active:cursor-grabbing hover:border-[rgba(74,127,255,0.45)]" : "opacity-55",
                          matched ? "border-[rgba(74,222,128,0.4)]" : "border-[var(--color-line)]",
                        )}
                        style={matched ? { background: "rgb(from #4ade80 r g b / 0.08)" } : undefined}
                      >
                        {draggable && <GripVertical size={11} strokeWidth={1.8} className="-mr-0.5 text-[var(--color-text-lo)]" />}
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ background: CASE_BG }}>
                          <Folder size={12} strokeWidth={1.8} />
                        </span>
                        <span className="leading-tight">
                          <span className="block whitespace-nowrap text-[0.6875rem] font-medium text-[var(--color-text-hi)]">{c.subjectName}</span>
                          <span className={cn("block max-w-[8rem] truncate font-mono text-[0.5625rem]", matched ? "text-[#4ade80]" : "text-[var(--color-text-lo)]")}>
                            {c.caseNumber}
                            {matched && " · match"}
                          </span>
                        </span>
                      </div>
                    );
                  })
                : sortedInvestigators.map((inv) => {
                    const matched = !!selectedCase?.region && inv.region === selectedCase.region;
                    const draggable = !!selectedId;
                    return (
                      <div
                        key={inv.id}
                        draggable={draggable}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData("text/plain", inv.name);
                          setDrag({ kind: "add", otherId: inv.id });
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setDragOverIso(null);
                        }}
                        title={draggable ? `Drag ${inv.name} onto the board` : "Select a case first"}
                        className={cn(
                          "flex shrink-0 select-none items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors",
                          draggable ? "cursor-grab active:cursor-grabbing hover:border-[rgba(74,127,255,0.45)]" : "opacity-55",
                          matched ? "border-[rgba(74,222,128,0.4)]" : "border-[var(--color-line)]",
                        )}
                        style={matched ? { background: "rgb(from #4ade80 r g b / 0.08)" } : undefined}
                      >
                        {draggable && <GripVertical size={11} strokeWidth={1.8} className="-mr-0.5 text-[var(--color-text-lo)]" />}
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
                          style={{ background: INVESTIGATOR_BG }}
                        >
                          <User size={12} strokeWidth={1.8} />
                        </span>
                        <span className="leading-tight">
                          <span className="block max-w-[8rem] truncate text-[0.6875rem] font-medium text-[var(--color-text-hi)]">{inv.name}</span>
                          <span className={cn("block max-w-[8rem] truncate text-[0.5625rem]", matched ? "text-[#4ade80]" : "text-[var(--color-text-lo)]")}>
                            {inv.region ? REGION_LABELS[inv.region] : "No region"}
                            {matched && " · match"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
              {(mode === "investigators" ? cases.length === 0 : investigators.length === 0) && (
                <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                  {mode === "investigators" ? "No open cases here." : "No investigators here."}
                </span>
              )}
            </div>
          )}

          {/* Day board — one consistent week grid for both modes, glass surface */}
          <div className="surface min-h-0 flex-1 overflow-hidden" style={glassPanel}>
            <div className="grid h-full auto-rows-fr grid-cols-7">
              {days.map((d) => {
                const meta = dayMeta(d);
                const dayBlocks = blocksByDay.get(meta.iso) ?? [];
                const isOver = canDrop && dragOverIso === meta.iso;
                // One slot per day for investigators — fall back to the compact list only
                // if legacy data somehow left more than one block on the same day.
                const singleSlot = mode === "investigators" && dayBlocks.length <= 1;
                return (
                  <div key={meta.iso} className="flex min-h-0 flex-col border-l border-[var(--color-line)] first:border-l-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDayInfo(meta.iso)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setDayInfo(meta.iso);
                      }}
                      title="Day details"
                      className="flex shrink-0 cursor-pointer items-center justify-between gap-1 border-b border-[var(--color-line)] px-2.5 py-2.5 transition-colors"
                      style={{ background: meta.isToday ? "rgb(from var(--color-accent) r g b / 0.16)" : undefined }}
                    >
                      <div className="leading-tight">
                        <span className={cn("font-mono text-[0.625rem] uppercase tracking-wider", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]")}>
                          {d.toLocaleDateString(undefined, { weekday: "short" })}
                        </span>
                        <span className={cn("ml-1.5 text-[0.9375rem] font-medium", meta.isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-hi)]")}>
                          {d.getDate()}
                        </span>
                      </div>
                      <DayBadges meta={meta} />
                    </div>

                    <div
                      {...dropHandlersFor(meta.iso)}
                      className={cn(
                        "flex min-h-0 flex-1 p-1.5 transition-colors",
                        singleSlot ? "flex-col" : "flex-col gap-1.5 overflow-y-auto",
                      )}
                      style={{
                        background: isOver
                          ? "rgb(from var(--color-accent) r g b / 0.22)"
                          : meta.isToday
                            ? "rgb(from var(--color-accent) r g b / 0.06)"
                            : undefined,
                        boxShadow: isOver ? "inset 0 0 0 0.0625rem var(--color-accent)" : undefined,
                      }}
                    >
                      {!selectedId || blocks === null ? (
                        <div className="grid flex-1 place-items-center">
                          <Loader2 size={14} className="animate-spin text-[var(--color-text-lo)]" />
                        </div>
                      ) : singleSlot ? (
                        dayBlocks[0] ? (
                          <AssignmentSlot block={dayBlocks[0]} {...chipDragHandlers(dayBlocks[0])} canManage={canManage} />
                        ) : (
                          <EmptySlot canManage={canManage} />
                        )
                      ) : (
                        <>
                          {dayBlocks.map((b) => (
                            <AssignmentChip
                              key={b.id}
                              block={b}
                              variant={mode === "investigators" ? "case" : "investigator"}
                              {...chipDragHandlers(b)}
                              canManage={canManage}
                            />
                          ))}
                          {dayBlocks.length === 0 && (
                            <div className="grid flex-1 place-items-center py-2 font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                              {canManage ? "Drop an investigator" : "—"}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <AssignmentModal
          block={editing}
          othersThatDay={(blocks ?? []).filter((b) => b.date.slice(0, 10) === editing.date.slice(0, 10) && b.id !== editing.id)}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaveNotes={async (notes) => {
            try {
              const res = await scheduleApi.update(editing.id, { notes });
              patchBlocks((bs) => bs.map((x) => (x.id === editing.id ? res.block : x)));
            } catch (err) {
              throw err instanceof ApiError ? err : new Error("Could not save the changes.");
            }
          }}
          onRemove={() => removeBlock(editing.id)}
          onGoToCase={() => navigate(`/cases/${editing.caseId}`)}
        />
      )}

      {monthOpen && (
        <MonthOverviewModal
          anchorMonday={monday}
          contextLabel={contextLabel}
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
          contextLabel={contextLabel}
          regionLabel={weatherRegion ? REGION_LABELS[weatherRegion] : null}
          onClose={() => setDayInfo(null)}
        />
      )}

      {/* Toast — fixed, floats over the UI, never shifts layout */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
          <div
            className="anim-banner surface pointer-events-auto flex items-center gap-3 rounded-full border border-[rgba(248,113,113,0.4)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-text-hi)]"
            style={{ background: "rgb(from var(--color-neg) r g b / 0.2)" }}
          >
            <span>{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignment chip ────────────────────────────────────────────────────────

function AssignmentChip({
  block,
  variant,
  canManage,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  onContextMenu,
}: {
  block: ScheduleBlock;
  variant: "case" | "investigator";
  canManage: boolean;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isTemp = block.id.startsWith("temp-");
  const isCase = variant === "case";
  const primary = isCase ? block.case.subjectName : block.user.name;
  const secondary = isCase ? block.case.caseNumber : block.user.region ? REGION_LABELS[block.user.region] : "No region";
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${block.case.subjectName} · ${block.case.caseNumber} · ${block.user.name}${block.notes ? `\n${block.notes}` : ""}${canManage ? "\nClick to edit · drag to move · right-click to remove" : ""}`}
      className={cn(
        "flex w-full items-center gap-2 rounded-[0.5rem] border border-[rgba(74,127,255,0.4)] px-2 py-1.5 text-left leading-tight transition-colors",
        canManage && !isTemp && "cursor-grab active:cursor-grabbing",
        isTemp && "opacity-60",
      )}
      style={{ background: "rgb(from var(--color-accent) r g b / 0.28)" }}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
        style={{ background: isCase ? CASE_BG : INVESTIGATOR_BG }}
      >
        {isCase ? <Folder size={12} strokeWidth={1.8} /> : <User size={12} strokeWidth={1.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.75rem] font-medium text-[var(--color-text-hi)]">{primary}</span>
        <span className={cn("block truncate text-[0.625rem] text-[var(--color-text-mid)]", isCase && "font-mono")}>{secondary}</span>
      </span>
    </div>
  );
}

// ─── Assignment slot (investigator mode — one per day, filled or empty) ───────

function AssignmentSlot({
  block,
  canManage,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  onContextMenu,
}: {
  block: ScheduleBlock;
  canManage: boolean;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isTemp = block.id.startsWith("temp-");
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${block.case.subjectName} · ${block.case.caseNumber}${block.notes ? `\n${block.notes}` : ""}${canManage ? "\nClick to edit · drag to move · right-click to remove" : ""}`}
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-[0.625rem] border border-[rgba(245,158,11,0.4)] p-2 text-center transition-colors",
        canManage && !isTemp && "cursor-grab active:cursor-grabbing",
        isTemp && "opacity-60",
      )}
      style={{ background: "rgb(from #f59e0b r g b / 0.16)" }}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: CASE_BG }}>
        <Folder size={17} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[9rem] truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{block.case.subjectName}</span>
        <span className="block truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">{block.case.caseNumber}</span>
      </span>
    </div>
  );
}

function EmptySlot({ canManage }: { canManage: boolean }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-1.5 rounded-[0.625rem] border border-dashed border-[var(--color-line)] p-2 text-center">
      <Folder size={18} strokeWidth={1.6} className="text-[var(--color-text-lo)] opacity-60" />
      <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">{canManage ? "Drop a case" : "—"}</span>
    </div>
  );
}

// ─── Day badges (weather / birthday) ───────────────────────────────────────────

interface DayMeta {
  iso: string;
  isToday: boolean;
  birthday: boolean;
  wx: WeatherDay | null;
}

function DayBadges({ meta }: { meta: DayMeta }) {
  const WxIcon = meta.wx ? weatherIcon(meta.wx.code) : null;
  if (!WxIcon && !meta.birthday) return null;
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
    </span>
  );
}

// ─── Day info modal ───────────────────────────────────────────────────────────

function DayInfoModal({
  meta,
  contextLabel,
  regionLabel,
  onClose,
}: {
  meta: DayMeta;
  contextLabel: string | null;
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
              {contextLabel && (
                <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{contextLabel}</p>
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
                <span className="font-medium text-[var(--color-text-hi)]">A subject's birthday.</span>{" "}
                Subjects are usually out and about — a good day to be on station.
              </span>
            </div>
          )}

          {!meta.wx && !meta.birthday && (
            <div className="rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-6 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              Nothing on file for this day.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Assignment modal (replaces the time-based editor) ────────────────────────

function AssignmentModal({
  block,
  othersThatDay,
  canManage,
  onClose,
  onSaveNotes,
  onRemove,
  onGoToCase,
}: {
  block: ScheduleBlock;
  othersThatDay: ScheduleBlock[];
  canManage: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string | null) => Promise<void>;
  onRemove: () => void;
  onGoToCase: () => void;
}) {
  const [notes, setNotes] = useState(block.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = new Date(`${block.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSaveNotes(notes.trim() || null);
      onClose();
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
              <h2 className="editorial text-[1.25rem] leading-tight text-[var(--color-text-hi)]">{block.case.subjectName}</h2>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                {block.case.caseNumber} · {dateLabel} · {block.user.name}
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
              Also assigned that day: {othersThatDay.map((b) => `${b.user.name} — ${b.case.subjectName} (${b.case.caseNumber})`).join(", ")}.
            </div>
          )}

          {canManage ? (
            <div>
              <label className="mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
                Notes <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Meet at the Wawa on Route 9, bring the long lens…"
                className="min-h-[4.5rem] w-full resize-none rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          ) : block.notes ? (
            <p className="rounded-[0.5rem] bg-[var(--color-ink-2)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-mid)]">{block.notes}</p>
          ) : null}

          {error && <div className="text-[0.75rem] text-[var(--color-neg)]">{error}</div>}

          {canManage && (
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
                  disabled={busy || notes === (block.notes ?? "")}
                  className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy && <Loader2 size={13} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Month overview modal ─────────────────────────────────────────────────────

function MonthOverviewModal({
  anchorMonday,
  contextLabel,
  weatherRegion,
  onClose,
  onPickDay,
}: {
  anchorMonday: string;
  contextLabel: string | null;
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
      mondays.map((m) => weatherApi.weekly(m).catch(() => ({ start: m, groups: [] as WeeklyWeather[] }))),
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="editorial text-[1.375rem] leading-tight text-[var(--color-text-hi)]">Month overview</h2>
              {contextLabel && <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{contextLabel}</p>}
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

          <div className="grid grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
              <div key={w} className="text-center font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {gridDays.map((d) => {
              const iso = isoOf(d);
              const inMonth = d.getMonth() === monthStart.getMonth();
              const isToday = iso === today;
              const wx = wxByDay.get(iso);
              const WxIcon = wx ? weatherIcon(wx.code) : null;
              const tooltip = wx ? `${conditionLabel(wx.code)} — ${wx.highF ?? "—"}° / ${wx.lowF ?? "—"}°` : undefined;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onPickDay(iso)}
                  title={tooltip}
                  className={cn(
                    "flex min-h-[3.75rem] flex-col items-start gap-1 rounded-[0.5rem] border p-1.5 text-left transition-colors",
                    inMonth ? "border-[var(--color-line)] bg-[var(--color-ink-1)]" : "border-transparent opacity-40",
                    "hover:border-[rgba(74,127,255,0.45)]",
                    isToday && "ring-1 ring-[var(--color-accent)]",
                  )}
                >
                  <span className={cn("font-mono text-[0.65625rem]", isToday ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-mid)]")}>
                    {d.getDate()}
                  </span>
                  {WxIcon && wx && (
                    <span className="grid h-4 w-4 place-items-center rounded-full" style={{ background: `${weatherColor(wx.code)}1f` }}>
                      <WxIcon size={10} strokeWidth={1.8} style={{ color: weatherColor(wx.code) }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
            Click a day to jump to its week. Forecasts only exist for roughly the last 12 weeks and the next week.
          </p>
        </div>
      </div>
    </>
  );
}
