import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Home,
  Info,
  ListChecks,
  Loader2,
  MapPin,
  Mic,
  Phone,
  Play,
  ScanFace,
  Sparkles,
  Square,
  StickyNote,
  Pencil,
  History,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@/lib/query-cache";
import { placeholderPhotoFor, SERVICE_LABELS } from "@/lib/mock-data";
import { ENTRY_META, fmtDate, fmtDayLabel, fmtTime, READABLE_DATE_CLASS } from "@/lib/journal";
import { PanelLoader } from "@/components/ui/LoadingState";
import { SubjectOverviewModal } from "@/components/case/SubjectOverviewModal";
import { PeopleModal } from "@/components/case/PeopleModal";
import { VehiclesModal } from "@/components/case/VehiclesModal";
import { HomeModal } from "@/components/case/HomeModal";
import { CasePhoto, EntityModal } from "@/components/case/EntityModal";
import {
  casesApi,
  timeEntriesApi,
  ApiError,
  noteVersionsOf,
  type CaseDay,
  type CaseDayEntry,
  type CaseDayEntryType,
  type CaseDetail,
  type CaseParticipant,
  type MatchedQuestionRule,
} from "@/lib/crm-api";

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtDuration = (ms: number): string => {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ─── Entry presentation ─────────────────────────────────────────────────────

type JournalFilter = "all" | "notes" | "photos" | "answers" | "office";

const FILTERS: { key: JournalFilter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "notes", label: "Field notes" },
  { key: "photos", label: "Photos" },
  { key: "answers", label: "Q&A + comparisons" },
  { key: "office", label: "Office" },
];

const inFilter = (type: CaseDayEntryType, filter: JournalFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "notes":
      return type === "note";
    case "photos":
      return type === "photo_person" || type === "photo_vehicle" || type === "photo_home";
    case "answers":
      return type === "qa" || type === "face_match";
    case "office":
      return type === "manager_note";
  }
};

// ─── Entity shortcuts (the right-hand rail) ─────────────────────────────────

type EntityKey = "subject" | "people" | "vehicles" | "home";

const ENTITY_META: Record<EntityKey, { label: string; hint: string; icon: typeof User; color: string; soft: string; border: string }> = {
  subject: {
    label: "Subject",
    hint: "Photos & comparison",
    icon: User,
    color: "#f87171",
    soft: "rgba(248,113,113,0.14)",
    border: "rgba(248,113,113,0.5)",
  },
  people: {
    label: "Cohabitants",
    hint: "Everyone else",
    icon: Users,
    color: "#facc15",
    soft: "rgba(250,204,21,0.14)",
    border: "rgba(250,204,21,0.5)",
  },
  vehicles: {
    label: "Vehicles",
    hint: "Plates & seats",
    icon: Car,
    color: "#34d399",
    soft: "rgba(52,211,153,0.14)",
    border: "rgba(52,211,153,0.5)",
  },
  home: {
    label: "Home",
    hint: "Residence stills",
    icon: Home,
    color: "#60a5fa",
    soft: "rgba(96,165,250,0.14)",
    border: "rgba(96,165,250,0.5)",
  },
};

const PING_FLUSH_MS = 60_000;

type PendingQuestion =
  | { kind: "dynamic"; ruleId: string; label: string; text: string; matchedOn: string; entryId?: string; answer?: string }
  | { kind: "standard"; standardQuestionId: string; text: string; entryId?: string; answer?: string };

export default function CaseWorkMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can, canSee } = useAuth();
  const canWork = can("cases.work");
  const canCapture = can("cases.edit") || canWork || can("cases.journal.write");

  const caseKey = id ? `case:${id}` : null;
  const { data: caseData, loading: caseLoading, refresh: refreshCase, mutate: mutateCase, error: caseError } = useQuery(caseKey, () =>
    casesApi.get(id!),
  );
  const kase = caseData?.case;

  const { data: activeData, refresh: refreshActive } = useQuery(
    canWork ? "time-entries:active" : null,
    () => timeEntriesApi.active(),
    { staleMs: 10_000, enabled: canWork },
  );
  const active = activeData?.active ?? null;
  const isActiveHere = !!active && !!id && active.caseId === id;
  // Photos/seat assignments are field work — gate them behind the clock (still visible, just
  // greyed out). Notes, question answers, and the day summary are just typing and are open all
  // day for whoever's assigned today, clocked in or not.
  const captureUnlocked = isActiveHere || !canWork;

  // Investigators can only clock into whichever single case their schedule assigns them
  // for today — mirrors the same rule the backend enforces on `POST /time-entries/start`.
  const { data: caseloadData } = useQuery(canWork ? "cases:myCaseload" : null, () => casesApi.myCaseload(), {
    staleMs: 30_000,
    enabled: canWork,
  });
  const isTodaysCase = !canWork || !caseloadData || caseloadData.todayCaseId === id;
  // Notes, question answers, and the day summary don't need the clock running — just today's
  // assignment. Photos still go through `captureUnlocked` below.
  const canWriteText = canCapture && isTodaysCase;

  const [entity, setEntity] = useState<EntityKey | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [checklist, setChecklist] = useState<{ open: boolean; intent: "view" | "clockout" }>({ open: false, intent: "view" });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 4500);
  }, []);

  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const bufferRef = useRef<{ lat: number; lng: number; accuracy: number | null; capturedAt: string }[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const activeEntryIdRef = useRef<string | null>(null);

  const flushPings = useCallback(() => {
    const entryId = activeEntryIdRef.current;
    const batch = bufferRef.current;
    if (!entryId || batch.length === 0) return;
    bufferRef.current = [];
    timeEntriesApi.addPings(entryId, batch).catch(() => {});
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (flushTimerRef.current != null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flushPings();
    activeEntryIdRef.current = null;
  }, [flushPings]);

  const startTracking = useCallback(
    (entryId: string) => {
      activeEntryIdRef.current = entryId;
      if (!("geolocation" in navigator)) {
        setLocationNote("This browser can't share location — clock still runs.");
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setLocationNote(null);
          bufferRef.current.push({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            capturedAt: new Date(pos.timestamp).toISOString(),
          });
        },
        () => setLocationNote("Location off — clock still runs, no breadcrumbs."),
        { enableHighAccuracy: false, maximumAge: 30_000 },
      );
      flushTimerRef.current = window.setInterval(flushPings, PING_FLUSH_MS);
    },
    [flushPings],
  );

  useEffect(() => {
    if (isActiveHere && active) {
      if (activeEntryIdRef.current !== active.id) {
        stopTracking();
        startTracking(active.id);
      }
    } else {
      stopTracking();
    }
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveHere, active?.id]);

  const startWorking = async () => {
    if (!id) return;
    setStartBusy(true);
    try {
      await timeEntriesApi.start(id);
      await refreshActive();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not start the clock.");
    } finally {
      setStartBusy(false);
    }
  };

  const stopWorking = async () => {
    if (!active) return;
    setStartBusy(true);
    try {
      await timeEntriesApi.stop(active.id);
      stopTracking();
      await refreshActive();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not clock out.");
    } finally {
      setStartBusy(false);
    }
  };

  // ─── Journal + questions ──────────────────────────────────────────────────

  const today = isoOf(new Date());
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  // Lifted so saving a note can force the journal onto Today (notes always land on today).
  const [journalDayFocus, setJournalDayFocus] = useState<string | "all">(() => today);

  const dayKey = (iso: string | Date | null | undefined): string => {
    if (!iso) return "";
    if (typeof iso === "string") return iso.slice(0, 10);
    return isoOf(iso);
  };

  const todaysDay = kase?.days.find((d) => dayKey(d.date) === today);
  const todaysNoteText = useMemo(
    () =>
      (todaysDay?.entries ?? [])
        .filter((e) => e.type === "note")
        .map((e) => e.body ?? "")
        .join("\n"),
    [todaysDay],
  );

  /**
   * Load the question bank once (and whenever notes change, so dynamic follow-ups
   * appear). Answered status is overlaid from today's journal — never drop a bank
   * item, never reorder: standard bank order, then dynamic rules.
   */
  const loadQuestionBank = useCallback(async () => {
    if (!id) return;
    try {
      const res = await casesApi.suggestQuestions(id, { date: today, text: todaysNoteText });
      const standard: PendingQuestion[] = res.standardQuestions.map((q) => ({
        kind: "standard" as const,
        standardQuestionId: q.standardQuestionId,
        text: q.text,
      }));
      const dynamic: PendingQuestion[] = res.dynamicMatches.flatMap((m: MatchedQuestionRule) =>
        m.followUpQuestions.map((q) => ({
          kind: "dynamic" as const,
          ruleId: m.ruleId,
          label: m.label,
          text: q,
          matchedOn: m.matchedOn,
        })),
      );
      const seen = new Set<string>();
      const bank = [...standard, ...dynamic].filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true)));
      setQuestions((prev) => {
        // Preserve any answers already attached (optimistic / from journal overlay)
        const prevByText = new Map(prev.map((q) => [q.text, q]));
        return bank.map((q) => {
          const old = prevByText.get(q.text);
          return old?.entryId ? { ...q, entryId: old.entryId, answer: old.answer } : q;
        });
      });
    } catch {
      /* non-blocking */
    }
  }, [id, today, todaysNoteText]);

  useEffect(() => {
    void loadQuestionBank();
  }, [loadQuestionBank]);

  // Overlay answers from today's journal onto the stable bank — keeps order fixed
  // and marks items done as soon as the case payload refreshes.
  useEffect(() => {
    const answeredQa = (todaysDay?.entries ?? []).filter((e) => e.type === "qa" && e.question?.trim());
    const byText = new Map(answeredQa.map((e) => [e.question!.trim(), e]));
    setQuestions((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((q) => {
        const hit = byText.get(q.text);
        if (hit) {
          if (q.entryId !== hit.id || q.answer !== (hit.body ?? "")) {
            changed = true;
            return { ...q, entryId: hit.id, answer: hit.body ?? "" };
          }
          return q;
        }
        // Real journal id gone (reset) — clear. Keep optimistic `pending:` marks until refresh lands.
        if (q.entryId && !q.entryId.startsWith("pending:")) {
          changed = true;
          if (q.kind === "dynamic") {
            const { entryId: _e, answer: _a, ...rest } = q;
            return rest;
          }
          const { entryId: _e, answer: _a, ...rest } = q;
          return rest;
        }
        return q;
      });
      return changed ? next : prev;
    });
  }, [todaysDay?.entries]);

  const checklistQuestions = questions;
  const unansweredCount = checklistQuestions.filter((q) => !q.entryId).length;

  const saveNote = async () => {
    if (!id || !noteDraft.trim()) return;
    const body = noteDraft.trim();
    setNoteBusy(true);
    try {
      const { days } = await casesApi.addDayEntry(id, { date: today, type: "note", body });
      setNoteDraft("");
      setJournalDayFocus(today);
      // Write the returned journal straight into the cache — don't wait on a full case
      // refresh (and don't lose the note if that refresh fails silently).
      if (caseData && kase) {
        mutateCase({ ...caseData, case: { ...kase, days } });
      }
      void refreshCase();
      showToast("Note saved");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not save note.");
    } finally {
      setNoteBusy(false);
    }
  };

  const answerQuestion = async (q: PendingQuestion, answer: string) => {
    if (!id) return;

    // Optimistic mark-as-done so the sidebar flips to green immediately (and the
    // item doesn't vanish while refresh/bank reload race).
    setQuestions((prev) =>
      prev.map((x) => (x.text === q.text ? { ...x, entryId: x.entryId ?? `pending:${x.text}`, answer } : x)),
    );

    try {
      if (q.entryId && !q.entryId.startsWith("pending:") && todaysDay) {
        const { days } = await casesApi.updateDayEntry(id, todaysDay.id, q.entryId, answer);
        if (caseData && kase) mutateCase({ ...caseData, case: { ...kase, days } });
      } else {
        const { days } = await casesApi.addDayEntry(id, {
          date: today,
          type: "qa",
          question: q.text,
          body: answer,
          questionSource: q.kind,
          ...(q.kind === "dynamic" ? { ruleId: q.ruleId } : { standardQuestionId: q.standardQuestionId }),
        });
        if (caseData && kase) mutateCase({ ...caseData, case: { ...kase, days } });
      }
      void refreshCase();
    } catch (err) {
      // Roll back optimistic mark on failure
      setQuestions((prev) =>
        prev.map((x) =>
          x.text === q.text && x.entryId?.startsWith("pending:")
            ? (() => {
                const { entryId: _e, answer: _a, ...rest } = x as PendingQuestion & { entryId?: string; answer?: string };
                return rest as PendingQuestion;
              })()
            : x,
        ),
      );
      throw err;
    }
  };

  const editNote = async (dayId: string, entryId: string, body: string) => {
    if (!id) return;
    const { days } = await casesApi.updateDayEntry(id, dayId, entryId, body);
    if (caseData && kase) mutateCase({ ...caseData, case: { ...kase, days } });
    void refreshCase();
  };

  const saveDaySummary = async (summary: string) => {
    if (!id) return;
    await casesApi.setDaySummary(id, today, summary.trim() || null);
    await refreshCase();
  };

  if (caseLoading && !kase) return <PanelLoader message="Loading the case" />;
  if (caseError || !kase) {
    return (
      <div className="grid h-full place-items-center gap-2 text-center">
        <p className="text-[0.875rem] text-[var(--color-neg)]">{caseError ?? "Case not found."}</p>
        <button type="button" onClick={() => navigate("/my-day")} className="text-[0.75rem] text-[var(--color-accent-2)]">
          Back to My Day
        </button>
      </div>
    );
  }

  const primaryAddress = kase.addresses.find((a) => a.isPrimary) ?? kase.addresses[0] ?? null;
  const showDob = canSee("case.subjectDob");
  const showSsn = canSee("case.subjectSsn");
  const showEmployment = canSee("case.subjectEmployment");
  const showAliases = canSee("case.subjectAliases");
  const showDescription = canSee("case.subjectDescription");

  const settledMs = activeData?.settledMsToday ?? 0;
  const runningSince = isActiveHere && activeData?.runningSince ? new Date(activeData.runningSince).getTime() : null;
  const msToday = settledMs + (runningSince ? Math.max(0, now - runningSince) : 0);

  const entityCounts: Record<EntityKey, number> = {
    subject: kase.days.flatMap((d) => d.entries).filter((e) => e.type === "photo_person" && !e.personId).length + (kase.subjectPhotoUrl ? 1 : 0),
    people: kase.people.length,
    vehicles: kase.vehicles.length,
    home: kase.days.flatMap((d) => d.entries).filter((e) => e.type === "photo_home").length,
  };

  const hasComparisonToday = (todaysDay?.entries ?? []).some((e) => e.type === "face_match");
  const checklistPendingCount = unansweredCount + (hasComparisonToday ? 0 : 1);

  return (
    <div className="investigator-surface flex h-full flex-col gap-4 overflow-hidden">
      {/* Page header — same shape as every other page: title left, actions right, nav button leftmost of the actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">{kase.subjectName}</h1>
            <span
              className="rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider"
              style={{
                background:
                  kase.priority === "rush" ? "rgba(248,113,113,0.18)" : kase.priority === "asap" ? "rgba(251,146,60,0.18)" : "var(--color-ink-3)",
                color: kase.priority === "rush" ? "#f87171" : kase.priority === "asap" ? "#fb923c" : "var(--color-text-mid)",
              }}
            >
              {kase.priority}
            </span>
          </div>
          <p className="mt-1 font-mono text-[0.75rem] text-[var(--color-text-lo)]">
            {kase.caseNumber}
            {kase.claimNumber ? ` · ${kase.claimNumber}` : ""} · {SERVICE_LABELS[kase.service]}
            {primaryAddress ? ` · ${[primaryAddress.line1, primaryAddress.city, primaryAddress.state].filter(Boolean).join(", ")}` : ""}
          </p>
        </div>

        <div className="case-subject-actions flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/my-day")}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-[0.75rem] border border-[var(--color-line)] px-3.5 text-[0.875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={14} strokeWidth={1.9} />
            My Day
          </button>

          <button
            type="button"
            onClick={() => showToast("Voice agent is next — Vapi wiring comes after this core UI is solid.")}
            className="flex h-11 shrink-0 items-center gap-2 rounded-[0.75rem] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3.5 text-[0.875rem] font-medium text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0.75rem_rgba(74,127,255,0.3)]"
            title="Talk to the case voice agent"
          >
            <Phone size={15} strokeWidth={1.9} className="text-[var(--color-accent-2)]" />
            <span className="hidden sm:inline">Call agent</span>
            <Mic size={12} className="text-[var(--color-accent-2)] opacity-70" />
          </button>

          {/* Checklist — icon button with an overlapping notification-style badge, sits left of the clock */}
          <button
            type="button"
            onClick={() => setChecklist({ open: true, intent: "view" })}
            title="Open the checklist"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[0.75rem] border border-[rgba(192,132,252,0.45)] bg-[rgba(192,132,252,0.12)] text-[#c084fc] transition-colors hover:bg-[rgba(192,132,252,0.2)]"
          >
            <ListChecks size={18} strokeWidth={1.9} />
            {checklistPendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full border-2 border-[var(--color-ink-1)] bg-[var(--color-neg)] px-1 font-mono text-[0.625rem] font-bold leading-none text-white shadow-[0_0_0.5rem_rgba(248,113,113,0.6)] animate-pulse">
                {checklistPendingCount}
              </span>
            )}
          </button>

          {/* Clock — one number: time worked today, picking up where the last session left off */}
          <div
            className={cn(
              "flex h-11 w-[9.5rem] shrink-0 items-center gap-2 rounded-[0.75rem] border px-3",
              isActiveHere ? "border-[rgba(74,222,128,0.45)] bg-[rgba(74,222,128,0.1)]" : "border-[var(--color-line-2)] bg-[var(--color-ink-2)]",
            )}
          >
            <Clock size={16} strokeWidth={1.9} className={cn("shrink-0", isActiveHere ? "text-[#4ade80]" : "text-[var(--color-text-lo)]")} />
            <span className="min-w-0 flex-1 truncate text-center font-mono text-[1.0625rem] font-semibold tabular-nums text-[var(--color-text-hi)]">
              {fmtDuration(msToday)}
            </span>
            {canWork &&
              (isActiveHere && active ? (
                <button
                  type="button"
                  onClick={() => setChecklist({ open: true, intent: "clockout" })}
                  disabled={startBusy}
                  title="Clock out"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-[var(--color-neg)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {startBusy ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} strokeWidth={0} fill="currentColor" />}
                </button>
              ) : isTodaysCase ? (
                <button
                  type="button"
                  onClick={() => void startWorking()}
                  disabled={startBusy}
                  title="Start the clock on this case"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-[var(--color-accent)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  {startBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} strokeWidth={0} fill="currentColor" />}
                </button>
              ) : (
                <span className="h-8 w-8 shrink-0" aria-hidden title="You can only clock into today's assigned case" />
              ))}
          </div>
        </div>
      </div>

      {active && !isActiveHere && (
        <div className="shrink-0 rounded-[0.625rem] border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.07)] px-3 py-2 text-[0.75rem] text-[#fb923c]">
          You're clocked into {active.case?.subjectName ?? "another case"}. Starting here clocks you out there first.
        </div>
      )}

      {/* Body — content left, entity + view rail on the right (stacks above on narrow screens) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-2 lg:order-2 lg:w-[13.5rem]">
          <div className="grid grid-cols-4 gap-2 lg:grid-cols-1">
            {(Object.keys(ENTITY_META) as EntityKey[]).map((key) => {
              const meta = ENTITY_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEntity(key)}
                  title={`${meta.label} — ${meta.hint}`}
                  className="group flex flex-col items-center gap-1 rounded-[0.875rem] border-2 px-2 py-2.5 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg lg:flex-row lg:gap-2.5 lg:px-2.5 lg:text-left"
                  style={{ background: meta.soft, borderColor: meta.border }}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white shadow-sm"
                    style={{ background: meta.color }}
                  >
                    <Icon size={17} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 lg:flex-1">
                    <span className="block truncate text-[0.8125rem] font-semibold text-[var(--color-text-hi)]">{meta.label}</span>
                    <span className="hidden truncate font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)] lg:block">
                      {entityCounts[key]} on file
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden h-px bg-[var(--color-line)] lg:block" />

          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex items-center justify-center gap-2 rounded-[0.75rem] border border-dashed border-[var(--color-line-2)] px-3 py-2.5 text-[0.8125rem] font-medium text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-text-lo)] hover:text-[var(--color-text-hi)] lg:justify-start"
          >
            <Info size={15} strokeWidth={1.9} />
            Case info
          </button>

          {!captureUnlocked && canWork && (
            <p className="hidden font-mono text-[0.625rem] leading-relaxed text-[var(--color-text-lo)] lg:block">
              Start the clock to add photos — notes and the checklist are open all day.
            </p>
          )}
          {isActiveHere && locationNote && (
            <p className="hidden items-center gap-1 font-mono text-[0.625rem] text-[var(--color-text-lo)] lg:flex">
              <MapPin size={10} strokeWidth={1.8} />
              {locationNote}
            </p>
          )}
        </aside>

        <main className="surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] lg:order-1">
          <JournalTab
            kase={kase}
            today={today}
            dayFocus={journalDayFocus}
            setDayFocus={setJournalDayFocus}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            saveNote={saveNote}
            noteBusy={noteBusy}
            canWrite={canWriteText}
            editNote={editNote}
          />
        </main>
      </div>

      {entity === "subject" && (
        <SubjectOverviewModal
          caseId={kase.id}
          kase={kase}
          showAliases={showAliases}
          showDob={showDob}
          showEmployment={showEmployment}
          showSsn={showSsn}
          showDescription={showDescription}
          canCapture={canCapture && captureUnlocked}
          onClose={() => setEntity(null)}
          onChanged={refreshCase}
          onError={showToast}
        />
      )}
      {entity === "people" && (
        <PeopleModal
          caseId={kase.id}
          kase={kase}
          canCapture={canCapture && captureUnlocked}
          onClose={() => setEntity(null)}
          onChanged={refreshCase}
          onError={showToast}
        />
      )}
      {entity === "vehicles" && (
        <VehiclesModal
          caseId={kase.id}
          kase={kase}
          canWrite={canCapture && captureUnlocked}
          onClose={() => setEntity(null)}
          onChanged={refreshCase}
          onError={showToast}
        />
      )}
      {entity === "home" && (
        <HomeModal
          caseId={kase.id}
          kase={kase}
          canCapture={canCapture && captureUnlocked}
          onClose={() => setEntity(null)}
          onChanged={refreshCase}
          onError={showToast}
        />
      )}
      {infoOpen && (
        <CaseInfoModal
          kase={kase}
          showAliases={showAliases}
          showDob={showDob}
          showEmployment={showEmployment}
          showSsn={showSsn}
          showDescription={showDescription}
          onClose={() => setInfoOpen(false)}
        />
      )}
      {checklist.open && (
        <ChecklistModal
          intent={checklist.intent}
          caseId={kase.id}
          subjectName={kase.subjectName}
          subjectPhotoUrl={kase.subjectPhotoUrl}
          hasComparisonToday={hasComparisonToday}
          onOpenSubject={() => {
            setChecklist({ open: false, intent: "view" });
            setEntity("subject");
          }}
          questions={checklistQuestions}
          answered={(todaysDay?.entries ?? []).filter((e) => e.type === "qa")}
          todaysEntries={todaysDay?.entries ?? []}
          canWrite={canWriteText}
          onAnswer={answerQuestion}
          onDismiss={(q) => void answerQuestion(q, "Not applicable today")}
          daySummary={todaysDay?.summary ?? null}
          entryCounts={{
            notes: (todaysDay?.entries ?? []).filter((e) => e.type === "note").length,
            photos: (todaysDay?.entries ?? []).filter((e) => e.type.startsWith("photo")).length,
            qa: (todaysDay?.entries ?? []).filter((e) => e.type === "qa").length,
          }}
          onSaveSummary={saveDaySummary}
          onClose={() => setChecklist({ open: false, intent: "view" })}
          onClockOut={
            checklist.intent === "clockout"
              ? async () => {
                  await stopWorking();
                  setChecklist({ open: false, intent: "view" });
                }
              : undefined
          }
          clockOutBusy={startBusy}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[95] -translate-x-1/2 rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-text-hi)] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Journal ────────────────────────────────────────────────────────────────

function JournalTab({
  kase,
  today,
  dayFocus,
  setDayFocus,
  noteDraft,
  setNoteDraft,
  saveNote,
  noteBusy,
  canWrite,
  editNote,
}: {
  kase: CaseDetail;
  today: string;
  dayFocus: string | "all";
  setDayFocus: (v: string | "all") => void;
  noteDraft: string;
  setNoteDraft: (v: string) => void;
  saveNote: () => Promise<void>;
  noteBusy: boolean;
  canWrite: boolean;
  editNote: (dayId: string, entryId: string, body: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<JournalFilter>("all");
  // Only used in "All days" mode: which day sections are collapsed.
  const [closedKeys, setClosedKeys] = useState<string[]>(() =>
    kase.days.filter((d) => d.date.slice(0, 10) !== today).map((d) => d.date.slice(0, 10)),
  );
  const toggleDay = (key: string) => setClosedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const feedRef = useRef<HTMLDivElement>(null);

  // When a note lands on Today, jump the feed to the top so the new entry is visible.
  useEffect(() => {
    if (dayFocus === today || dayFocus === "all") {
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [kase.days, dayFocus, today]);

  const dayKey = (iso: string) => iso.slice(0, 10);

  /** Who was on the case each date — scheduled field crew (up to three a day) first, then
   *  anyone else who wrote into that day (office staff, an investigator covering ad hoc). */
  const crewByDate = useMemo(() => {
    const map = new Map<string, Map<string, { name: string; scheduled: boolean; fieldWork: boolean }>>();
    const at = (key: string) => {
      const existing = map.get(key);
      if (existing) return existing;
      const fresh = new Map<string, { name: string; scheduled: boolean; fieldWork: boolean }>();
      map.set(key, fresh);
      return fresh;
    };
    for (const b of kase.scheduleBlocks ?? []) {
      at(b.date.slice(0, 10)).set(b.user.id, { name: b.user.name, scheduled: true, fieldWork: true });
    }
    for (const day of kase.days) {
      const key = day.date.slice(0, 10);
      for (const e of day.entries) {
        if (!e.author) continue;
        const people = at(key);
        const prev = people.get(e.author.id);
        const fieldWork = e.type !== "manager_note";
        people.set(e.author.id, {
          name: e.author.name,
          scheduled: prev?.scheduled ?? false,
          fieldWork: (prev?.fieldWork ?? false) || fieldWork,
        });
      }
    }
    return new Map([...map].map(([key, people]) => [key, [...people.values()]]));
  }, [kase.scheduleBlocks, kase.days]);

  const days: CaseDay[] = useMemo(
    () => kase.days.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [kase.days],
  );

  const totals = useMemo(() => {
    const all = kase.days.flatMap((d) => d.entries);
    return {
      entries: all.length,
      notes: all.filter((e) => e.type === "note").length,
      photos: all.filter((e) => e.type.startsWith("photo")).length,
      office: all.filter((e) => e.type === "manager_note").length,
    };
  }, [kase.days]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Composer */}
      <div className="shrink-0 border-b border-[var(--color-line)] p-3.5">
        <div className="flex items-end gap-2">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            disabled={!canWrite}
            placeholder={canWrite ? "What are you seeing right now? e.g. Subject left the house at 2:10 carrying a black backpack…" : "This case isn't on your schedule today…"}
            className="min-w-0 flex-1 resize-none rounded-[0.875rem] border-2 border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-2.5 text-[0.9375rem] leading-relaxed text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void saveNote()}
            disabled={!canWrite || noteBusy || !noteDraft.trim()}
            className="flex h-[4.25rem] w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[0.875rem] bg-[var(--color-accent)] text-[0.75rem] font-semibold text-white shadow-[0_0_0.75rem_rgba(74,127,255,0.3)] disabled:opacity-40 disabled:shadow-none"
          >
            {noteBusy ? <Loader2 size={17} className="animate-spin" /> : <StickyNote size={17} strokeWidth={1.9} />}
            Save note
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--color-line)] px-3.5 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.75rem] transition-colors",
              filter === f.key
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {totals.entries} entries · {totals.notes} notes · {totals.photos} photos · {totals.office} office
        </span>
      </div>

      {/* Day filter — pick one day (or all). Exclusive selection, not sticky scroll shortcuts. */}
      {days.length > 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--color-line)] px-3.5 py-2">
          <button
            type="button"
            onClick={() => setDayFocus("all")}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors",
              dayFocus === "all"
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
            )}
          >
            All days
          </button>
          {days.map((day) => {
            const key = dayKey(day.date);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => setDayFocus(key)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors",
                  dayFocus === key
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
                )}
              >
                {key === today ? "Today" : new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed — newest day first, one section per day */}
      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {days.length === 0 && (
          <p className="text-[0.8125rem] text-[var(--color-text-lo)]">
            Nothing in the journal yet. Write the first note above, or use the buttons on the right to log a photo.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {days
            .filter((day) => dayFocus === "all" || dayKey(day.date) === dayFocus)
            .map((day) => {
            const key = dayKey(day.date);
            const entries = day.entries
              .filter((e) => inFilter(e.type, filter))
              .slice()
              .sort((a, b) => {
                // Just-saved entries (last 5 min) float to the top so seeded demo timestamps
                // with later clock times can't bury a note the investigator just wrote.
                const now = Date.now();
                const aFresh = now - new Date(a.createdAt).getTime() < 5 * 60_000;
                const bFresh = now - new Date(b.createdAt).getTime() < 5 * 60_000;
                if (aFresh !== bFresh) return aFresh ? -1 : 1;
                return b.createdAt.localeCompare(a.createdAt);
              });
            const isToday = key === today;
            // Single-day focus is always expanded; in "all" mode, respect the collapse toggles.
            const isCollapsed = dayFocus === "all" && closedKeys.includes(key);
            const crew = crewByDate.get(key) ?? [];
            const counts = {
              note: day.entries.filter((e) => e.type === "note").length,
              photo: day.entries.filter((e) => e.type.startsWith("photo")).length,
              qa: day.entries.filter((e) => e.type === "qa").length,
              office: day.entries.filter((e) => e.type === "manager_note").length,
            };

            if (entries.length === 0 && filter !== "all") return null;

            return (
              <section key={day.id} id={`journal-day-${day.id}`} className="rounded-[1rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]">
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  {isCollapsed ? <ChevronRight size={14} className="text-[var(--color-text-lo)]" /> : <ChevronDown size={14} className="text-[var(--color-text-lo)]" />}
                  <span className="text-[0.9375rem] font-medium text-[var(--color-text-hi)]">
                    {fmtDayLabel(day.date, today)}
                  </span>
                  <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{fmtDate(day.date)}</span>

                  {crew.length > 0 && (
                    <span className="ml-1 hidden min-w-0 items-center gap-1 font-mono text-[0.625rem] text-[var(--color-text-lo)] sm:flex">
                      <Users size={10} strokeWidth={2} />
                      <span className="truncate">
                        {crew.map((p) => (p.fieldWork ? p.name : `${p.name} (office)`)).join(", ")}
                      </span>
                    </span>
                  )}

                  <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {counts.note > 0 && <span>{counts.note} notes</span>}
                    {counts.photo > 0 && <span style={{ color: "#34d399" }}>{counts.photo} photos</span>}
                    {counts.qa > 0 && <span style={{ color: "#60a5fa" }}>{counts.qa} Q&amp;A</span>}
                    {counts.office > 0 && <span style={{ color: "#fbbf24" }}>{counts.office} office</span>}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="px-3 pb-3">
                    {day.summary && (
                      <p className="mb-2.5 rounded-[0.625rem] border-l-2 border-[var(--color-accent)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] italic text-[var(--color-text-mid)]">
                        {day.summary}
                      </p>
                    )}
                    {entries.length === 0 ? (
                      <p className="text-[0.75rem] text-[var(--color-text-lo)]">Nothing logged on this day yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {entries.map((e) => (
                          <EntryRow
                            key={e.id}
                            caseId={kase.id}
                            entry={e}
                            canEdit={isToday && canWrite}
                            onEditNote={
                              (e.type === "note" || e.type === "manager_note") && isToday && canWrite
                                ? (body) => editNote(day.id, e.id, body)
                                : undefined
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  caseId,
  entry,
  canEdit,
  onEditNote,
}: {
  caseId: string;
  entry: CaseDayEntry;
  canEdit?: boolean;
  onEditNote?: (body: string) => Promise<void>;
}) {
  const meta = ENTRY_META[entry.type] ?? ENTRY_META.note;
  const Icon = meta.icon;
  const isOffice = entry.type === "manager_note";
  const canEditBody = entry.type === "note" || entry.type === "manager_note";
  const priorVersions = noteVersionsOf(entry);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body ?? "");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(entry.body ?? "");
  }, [entry.body, editing]);

  const saveEdit = async () => {
    if (!onEditNote || !draft.trim() || draft.trim() === (entry.body ?? "").trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEditNote(draft.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex gap-2.5 rounded-[0.75rem] border p-2.5",
        isOffice ? "border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.06)]" : "border-[var(--color-line)] bg-[var(--color-ink-3)]",
      )}
    >
      <div
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[0.5rem]"
        style={{ background: "var(--color-ink-2)", color: meta.color }}
      >
        <Icon size={13} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className={cn("text-[0.9375rem] tabular-nums", READABLE_DATE_CLASS)}>{fmtTime(entry.createdAt)}</span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-wider" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {entry.author && <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">· {entry.author.name}</span>}
          {priorVersions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ink-2)] px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
              title="Show prior versions"
            >
              <History size={10} strokeWidth={2} />
              Edited · {priorVersions.length} prior
            </button>
          )}
        </div>
        {entry.question && <p className="mt-0.5 text-[0.75rem] text-[var(--color-accent-2)]">Q: {entry.question}</p>}
        {editing ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-[0.625rem] border-2 border-[var(--color-accent)] bg-[var(--color-ink-2)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--color-text-hi)] focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void saveEdit()}
                className="rounded-[0.5rem] bg-[var(--color-accent)] px-3 py-1.5 text-[0.75rem] font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save edit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(entry.body ?? "");
                  setEditing(false);
                }}
                className="text-[0.75rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          entry.body && <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-[var(--color-text-hi)]">{entry.body}</p>
        )}
        {showHistory && priorVersions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-[var(--color-line)] pt-2">
            <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Earlier versions</div>
            {[...priorVersions].reverse().map((v, i) => (
              <div key={`${v.at}-${i}`} className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-2.5 py-1.5">
                <div className={cn("text-[0.6875rem]", READABLE_DATE_CLASS)}>
                  {fmtTime(v.at)}
                  {v.authorName ? ` · ${v.authorName}` : ""}
                </div>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">{v.body}</p>
              </div>
            ))}
          </div>
        )}
        {entry.photoUrl && (
          <CasePhoto
            caseId={caseId}
            photoUrl={entry.photoUrl}
            className="mt-2 max-h-40 rounded-[0.5rem] border border-[var(--color-line)]"
          />
        )}
      </div>
      {canEditBody && onEditNote && canEdit && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit note (keeps prior versions)"
          className="hidden shrink-0 self-start text-[var(--color-text-lo)] hover:text-[var(--color-accent-2)] group-hover:block"
        >
          <Pencil size={12} strokeWidth={1.9} />
        </button>
      )}
    </div>
  );
}

// ─── Checklist (modal) ──────────────────────────────────────────────────────
// One item at a time — visual comparison, then each open question, then the
// end-of-day summary — instead of a long scrolling list. Opens from the clock's
// stop button (clock-out gate) or the icon next to the clock any other time.

type ChecklistStep = { kind: "comparison" } | { kind: "question"; q: PendingQuestion } | { kind: "summary" };

function ChecklistModal({
  intent,
  caseId,
  subjectName,
  subjectPhotoUrl,
  hasComparisonToday,
  onOpenSubject,
  questions,
  answered,
  canWrite,
  onAnswer,
  onDismiss,
  daySummary,
  entryCounts,
  todaysEntries,
  onSaveSummary,
  onClose,
  onClockOut,
  clockOutBusy,
}: {
  intent: "view" | "clockout";
  caseId: string;
  subjectName: string;
  subjectPhotoUrl: string | null;
  hasComparisonToday: boolean;
  onOpenSubject: () => void;
  questions: PendingQuestion[];
  answered: CaseDayEntry[];
  canWrite: boolean;
  onAnswer: (q: PendingQuestion, answer: string) => Promise<void>;
  onDismiss: (q: PendingQuestion) => void;
  daySummary: string | null;
  entryCounts: { notes: number; photos: number; qa: number };
  todaysEntries: CaseDayEntry[];
  onSaveSummary: (summary: string) => Promise<void>;
  onClose: () => void;
  onClockOut?: () => Promise<void>;
  clockOutBusy: boolean;
}) {
  const [comparisonSkipped, setComparisonSkipped] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(daySummary ?? "");
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [clockOutBusyLocal, setClockOutBusyLocal] = useState(false);

  const comparisonDone = hasComparisonToday || comparisonSkipped;
  const summaryDone = summaryDraft.trim().length > 0;

  // Keep every question in the list (answered stay marked). Advance manually / via Next.
  const steps: ChecklistStep[] = [
    { kind: "comparison" },
    ...questions.map((q) => ({ kind: "question" as const, q })),
    { kind: "summary" },
  ];

  const firstPendingIndex = (() => {
    if (!comparisonDone) return 0;
    const qi = questions.findIndex((q) => !q.entryId);
    if (qi >= 0) return qi + 1; // +1 for comparison step
    return steps.length - 1; // summary
  })();

  const [stepIndex, setStepIndex] = useState(firstPendingIndex);
  const unansweredQ = questions.filter((q) => !q.entryId).length;
  const pendingCount = unansweredQ + (comparisonDone ? 0 : 1);

  const idx = Math.min(stepIndex, steps.length - 1);
  const step = steps[idx];
  const goTo = (i: number) => setStepIndex(Math.max(0, Math.min(i, steps.length - 1)));

  const stepIcon = (s: ChecklistStep) => (s.kind === "comparison" ? ScanFace : s.kind === "summary" ? Sparkles : s.q.kind === "dynamic" ? StickyNote : ListChecks);
  const stepLabel = (s: ChecklistStep) => (s.kind === "comparison" ? "Visual comparison" : s.kind === "summary" ? "End-of-day summary" : s.q.text);
  const stepSub = (s: ChecklistStep) =>
    s.kind === "question" ? (s.q.entryId ? "Answered" : s.q.kind === "dynamic" ? s.q.label : "Daily question") : null;
  const stepDone = (s: ChecklistStep) =>
    s.kind === "comparison" ? comparisonDone : s.kind === "summary" ? summaryDone : !!s.q.entryId;

  const answerAndAdvance = async (q: PendingQuestion, answer: string) => {
    await onAnswer(q, answer);
    const qIndex = questions.findIndex((x) => x.text === q.text);
    const nextOpen = questions.findIndex((x, i) => i > qIndex && !x.entryId);
    if (nextOpen >= 0) goTo(nextOpen + 1);
    else if (idx < steps.length - 1) goTo(idx + 1);
  };

  // Pulls together everything actually written/logged today into a real narrative paragraph —
  // not just a note/photo tally — so there's something worth proofreading here. Real AI
  // drafting replaces this later; for now it's a straightforward assembly of today's entries.
  const draftSummary = () => {
    const notes = todaysEntries.filter((e) => e.type === "note" && e.body?.trim()).map((e) => e.body!.trim());
    const personPhotos = todaysEntries.filter((e) => e.type === "photo_person");
    const vehiclePhotos = todaysEntries.filter((e) => e.type === "photo_vehicle");
    const homePhotos = todaysEntries.filter((e) => e.type === "photo_home");
    const qas = todaysEntries.filter((e) => e.type === "qa" && e.question);

    const photoBits: string[] = [];
    if (personPhotos.length) photoBits.push(`${personPhotos.length} subject/cohabitant photo${personPhotos.length === 1 ? "" : "s"}`);
    if (vehiclePhotos.length) photoBits.push(`${vehiclePhotos.length} vehicle photo${vehiclePhotos.length === 1 ? "" : "s"}`);
    if (homePhotos.length) photoBits.push(`${homePhotos.length} residence photo${homePhotos.length === 1 ? "" : "s"}`);

    const paragraphs: string[] = [];

    const opener = [
      `Surveillance conducted on ${subjectName} today.`,
      hasComparisonToday ? "Ran a visual comparison against the file photo — see the comparison log for the result." : null,
      photoBits.length ? `Captured ${photoBits.join(", ")}.` : "No photos were captured during today's coverage.",
    ]
      .filter(Boolean)
      .join(" ");
    paragraphs.push(opener);

    if (notes.length > 0) {
      paragraphs.push(`Field observations, in order: ${notes.map((n) => (n.endsWith(".") ? n : `${n}.`)).join(" ")}`);
    } else {
      paragraphs.push("No free-text field notes were logged today — activity is limited to what's captured above.");
    }

    if (qas.length > 0) {
      paragraphs.push(
        `Checklist responses: ${qas.map((q) => `${q.question} ${q.body ?? "—"}`.trim()).map((s) => (s.endsWith(".") ? s : `${s}.`)).join(" ")}`,
      );
    }

    if (entryCounts.photos === 0 && notes.length === 0 && qas.length === 0 && !hasComparisonToday) {
      paragraphs.push("Overall, a quiet day with minimal logged activity — confirm with the field investigator if that's expected before this is filed.");
    }

    return paragraphs.join("\n\n");
  };

  const submitSummary = async () => {
    setSummaryBusy(true);
    try {
      await onSaveSummary(summaryDraft);
    } finally {
      setSummaryBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="surface flex h-[min(88vh,46rem)] w-full max-w-[min(60rem,95vw)] flex-col overflow-hidden rounded-[1.25rem] border border-[rgba(74,127,255,0.4)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-accent-soft)] px-5 py-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white">
            <ListChecks size={19} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-[var(--color-accent-2)]">Checklist</div>
            <div className="truncate text-[1.1875rem] font-semibold leading-tight text-[var(--color-text-hi)]">
              {intent === "clockout" ? "Before you clock out" : "Today's checklist"}
            </div>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/60 px-3 py-1 font-mono text-[0.75rem] text-[var(--color-text-mid)] sm:flex">
            Step {idx + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.625rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Every item, in order — click one to jump straight to it */}
          <nav className="hidden w-[16.5rem] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/40 p-2.5 sm:flex">
            {steps.map((s, i) => {
              const Icon = stepIcon(s);
              const on = i === idx;
              const done = stepDone(s);
              const sub = stepSub(s);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex items-start gap-2 rounded-[0.625rem] px-2.5 py-2 text-left transition-colors",
                    on ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-ink-2)]",
                  )}
                >
                  {done ? (
                    <CheckCircle2 size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[#4ade80]" />
                  ) : (
                    <Icon size={15} strokeWidth={1.8} className={cn("mt-0.5 shrink-0", on ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]")} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("line-clamp-2 text-[0.8125rem] leading-snug", on ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]")}>
                      {stepLabel(s)}
                    </span>
                    {sub && <span className="mt-0.5 block truncate font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{sub}</span>}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step.kind === "comparison" && (
            <div className="flex flex-col items-center gap-4 pt-2 text-center">
              <div
                className="h-40 w-40 overflow-hidden rounded-[1rem] border-2"
                style={{ borderColor: hasComparisonToday ? "#4ade80" : "#fb923c" }}
              >
                <CasePhoto caseId={caseId} photoUrl={subjectPhotoUrl || placeholderPhotoFor(caseId)} alt={subjectName} className="h-full w-full" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-center gap-2">
                  <ScanFace size={18} strokeWidth={1.8} className={hasComparisonToday ? "text-[#4ade80]" : "text-[#fb923c]"} />
                  <p className="text-[1.0625rem] font-semibold text-[var(--color-text-hi)]">Visual comparison</p>
                </div>
                {hasComparisonToday ? (
                  <p className="text-[0.875rem] text-[var(--color-text-mid)]">Done — you logged a comparison against {subjectName} today.</p>
                ) : (
                  <p className="max-w-sm text-[0.875rem] text-[var(--color-text-mid)]">
                    Compare today's subject photo against the file photo using CFR before you wrap up.
                  </p>
                )}
              </div>
              {!hasComparisonToday && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenSubject}
                    className="rounded-[0.625rem] bg-[var(--color-accent)] px-4 py-2 text-[0.875rem] font-semibold text-white"
                  >
                    Open Subject to compare
                  </button>
                  {!comparisonSkipped ? (
                    <button
                      type="button"
                      onClick={() => {
                        setComparisonSkipped(true);
                        goTo(idx + 1);
                      }}
                      className="text-[0.8125rem] text-[var(--color-text-lo)] underline decoration-dotted hover:text-[var(--color-text-mid)]"
                    >
                      Not possible today
                    </button>
                  ) : (
                    <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-lo)]">Skipped for today</span>
                  )}
                </div>
              )}
            </div>
          )}

          {step.kind === "question" && (
            <StepQuestion key={step.q.text + (step.q.entryId ?? "")} q={step.q} canWrite={canWrite} onAnswer={answerAndAdvance} onDismiss={(q) => void answerAndAdvance(q, "Not applicable today")} />
          )}

          {step.kind === "summary" && (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Sparkles size={18} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
                <p className="text-[1.0625rem] font-semibold text-[var(--color-text-hi)]">End-of-day summary</p>
              </div>
              <p className="text-[0.8125rem] text-[var(--color-text-lo)]">
                Wrap up today in a couple sentences — this becomes the day's proofread summary in the journal. Real AI drafting comes later; for now, write it or use the quick draft.
              </p>
              <textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                rows={12}
                disabled={!canWrite}
                placeholder="What happened today — field observations, photos captured, checklist answers, anything the next reader needs…"
                className="w-full resize-none rounded-[0.75rem] border-2 border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSummaryDraft(draftSummary())}
                  disabled={!canWrite}
                  className="flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-40"
                  title="Fill in a quick draft from today's activity — full AI summaries are coming later"
                >
                  <Sparkles size={14} strokeWidth={1.8} />
                  Draft for me
                </button>
                <button
                  type="button"
                  onClick={() => void submitSummary()}
                  disabled={!canWrite || summaryBusy || summaryDraft.trim() === (daySummary ?? "")}
                  className="ml-auto rounded-[0.625rem] bg-[var(--color-accent)] px-4 py-2 text-[0.8125rem] font-semibold text-white disabled:opacity-40"
                >
                  {summaryBusy ? "Saving…" : "Save summary"}
                </button>
              </div>

              {answered.length > 0 && (
                <div className="mt-2 border-t border-[var(--color-line)] pt-3">
                  <div className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                    Answered today · {answered.length}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {answered.map((e) => (
                      <div key={e.id} className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2">
                        <div className="text-[0.75rem] text-[var(--color-text-mid)]">{e.question}</div>
                        <div className="mt-0.5 text-[0.8125rem] text-[var(--color-text-hi)]">{e.body}</div>
                        <div className={cn("mt-0.5 text-[0.75rem]", READABLE_DATE_CLASS)}>
                          {fmtTime(e.createdAt)}
                          {e.author ? ` · ${e.author.name}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-[var(--color-line)] px-4 py-3.5">
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-2 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] disabled:opacity-30"
          >
            Back
          </button>
          {idx < steps.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(idx + 1)}
              className="rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-2 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              Next
            </button>
          )}

          {pendingCount > 0 ? (
            <span className="ml-1 font-mono text-[0.75rem] text-[var(--color-text-lo)]">{pendingCount} item{pendingCount === 1 ? "" : "s"} still open</span>
          ) : (
            <span className="ml-1 flex items-center gap-1.5 font-mono text-[0.75rem] text-[#4ade80]">
              <CheckCircle2 size={14} strokeWidth={2} />
              All caught up
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2 text-[0.8125rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              {onClockOut ? "Not yet" : "Close"}
            </button>
            {onClockOut && (
              <button
                type="button"
                onClick={() => {
                  setClockOutBusyLocal(true);
                  void onClockOut().finally(() => setClockOutBusyLocal(false));
                }}
                disabled={clockOutBusy || clockOutBusyLocal}
                className="flex items-center gap-1.5 rounded-[0.625rem] bg-[var(--color-neg)] px-4 py-2 text-[0.8125rem] font-semibold text-white disabled:opacity-50"
              >
                {clockOutBusy || clockOutBusyLocal ? <Loader2 size={14} className="animate-spin" /> : <Square size={11} strokeWidth={0} fill="currentColor" />}
                {pendingCount > 0 ? "Clock out anyway" : "Clock out"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StepQuestion({
  q,
  canWrite,
  onAnswer,
  onDismiss,
}: {
  q: PendingQuestion;
  canWrite: boolean;
  onAnswer: (q: PendingQuestion, answer: string) => Promise<void>;
  onDismiss: (q: PendingQuestion) => void;
}) {
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [busy, setBusy] = useState(false);
  const editing = !!q.entryId;

  const submit = () => {
    if (!answer.trim()) return;
    setBusy(true);
    void onAnswer(q, answer.trim()).finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider",
            q.kind === "dynamic" ? "bg-[rgba(74,127,255,0.16)] text-[var(--color-accent-2)]" : "bg-[var(--color-ink-3)] text-[var(--color-text-lo)]",
          )}
        >
          {q.kind === "dynamic" ? <StickyNote size={12} /> : <ListChecks size={12} />}
          {q.kind === "dynamic" ? `From what you wrote · ${q.label}` : "Daily question"}
        </span>
        {editing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(74,222,128,0.14)] px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-[#4ade80]">
            <CheckCircle2 size={12} strokeWidth={2} />
            Answered — you can edit
          </span>
        )}
      </div>

      {q.kind === "dynamic" && q.matchedOn && (
        <div className="rounded-[0.75rem] border-l-[0.1875rem] border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3.5 py-2.5">
          <div className="mb-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Your note</div>
          <p className="text-[0.8125rem] italic leading-relaxed text-[var(--color-text-mid)]">&ldquo;{q.matchedOn}&rdquo;</p>
        </div>
      )}

      <p className="text-[1.375rem] font-medium leading-snug text-[var(--color-text-hi)]">{q.text}</p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        autoFocus
        disabled={!canWrite}
        placeholder={canWrite ? "Type your answer…" : "This case isn't on your schedule today…"}
        className="w-full resize-none rounded-[0.75rem] border-2 border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={busy || !answer.trim() || !canWrite || (editing && answer.trim() === (q.answer ?? "").trim())}
          onClick={submit}
          className="flex items-center gap-1.5 rounded-[0.625rem] bg-[var(--color-accent)] px-4 py-2.5 text-[0.875rem] font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} strokeWidth={2} />}
          {editing ? "Update answer" : "Save & continue"}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => onDismiss(q)}
            className="text-[0.8125rem] text-[var(--color-text-lo)] underline decoration-dotted hover:text-[var(--color-text-mid)]"
          >
            Not applicable today
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Case info ──────────────────────────────────────────────────────────────

function CaseInfoModal({
  kase,
  showAliases,
  showDob,
  showEmployment,
  showSsn,
  showDescription,
  onClose,
}: {
  kase: CaseDetail;
  showAliases: boolean;
  showDob: boolean;
  showEmployment: boolean;
  showSsn: boolean;
  showDescription: boolean;
  onClose: () => void;
}) {
  const openTodos = kase.todos.filter((t) => t.status === "open");

  return (
    <EntityModal
      accent="#818cf8"
      soft="rgba(129,140,248,0.14)"
      eyebrow="Case info"
      title={kase.subjectName}
      subtitle={`${kase.caseNumber} · ${SERVICE_LABELS[kase.service]}`}
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.8125rem] sm:grid-cols-3">
        <Field label="Client" value={kase.client?.company} />
        <Field label="Adjuster" value={kase.adjusterName} />
        <Field label="Due" value={fmtDate(kase.dueDate)} />
        <Field label="Work status" value={kase.subjectWorkStatus} />
        {showAliases && <Field label="Aliases" value={kase.subjectAliases.join(", ")} />}
        {showDob && <Field label="DOB" value={fmtDate(kase.subjectDob)} />}
        {showEmployment && (
          <>
            <Field label="Employer" value={kase.subjectEmployer} />
            <Field label="Job" value={kase.subjectJobTitle} />
          </>
        )}
        <Field label="SSN" value={showSsn ? kase.subjectSsn : "Hidden for your role"} />
      </div>

      {showDescription && kase.subjectDescription && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Physical description</div>
          <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{kase.subjectDescription}</p>
        </div>
      )}

      {kase.presurveillance?.summary && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Pre-surveillance</div>
          <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{kase.presurveillance.summary}</p>
        </div>
      )}

      {kase.situationSummary && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Where things stand</div>
          <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{kase.situationSummary}</p>
        </div>
      )}

      {openTodos.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Still to do</div>
          <ul className="flex flex-col gap-1">
            {openTodos.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[0.8125rem] text-[var(--color-text-mid)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </EntityModal>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div className="mt-0.5 break-words text-[var(--color-text-hi)]">{value || "—"}</div>
    </div>
  );
}
