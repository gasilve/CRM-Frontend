import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { weatherIcon, weatherColor, conditionLabel } from "@/components/cases/WeatherStrip";
import { cn } from "@/lib/cn";
import {
  ApiError,
  REGION_LABELS,
  scheduleApi,
  type CaseListItem,
  type InvestigatorListItem,
  type Region,
  type ScheduleBlock,
  type SchedulePriorWork,
  type WeatherDay,
  type WeeklyWeather,
} from "@/lib/crm-api";
import { MiniMonthCalendar } from "./MiniMonthCalendar";
import {
  CalendarDayRow,
  CaseAssignmentBand,
  CaseBoardColumn,
  CaseRowLabel,
  EmptyAssignSlot,
  InvestigatorAssignmentBand,
  InvestigatorBoardColumn,
  InvestigatorRowLabel,
} from "./CalendarDayRow";
import { priorKey } from "./AssignEntityModal";
import {
  ScheduleAssignmentModal,
  type AssignmentFlow,
} from "./ScheduleAssignmentModal";

const DAY_LS_KEY = "accenty.crm.schedule.calendar.day";
const REGION_OPTIONS: (Region | "all")[] = ["all", "tristate", "ca", "texas"];

export type CalendarAxis = "investigators" | "cases";

type DayDrag =
  | { kind: "case"; caseId: string }
  | { kind: "investigator"; userId: string }
  | { kind: "block"; block: ScheduleBlock };

const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

export function NewCalendarView({
  region,
  onRegionChange,
  cases,
  investigators,
  weekWeather,
  canManage,
  axis,
  vertical,
  reloadToken = 0,
  onToast,
  onRemoveBlock,
  onSaveBlockNotes,
  onGoToCase,
  onSyncWeekMonday,
}: {
  region: Region | "all";
  onRegionChange: (r: Region | "all") => void;
  cases: CaseListItem[];
  investigators: InvestigatorListItem[];
  weekWeather: WeeklyWeather[];
  canManage: boolean;
  /** Investigators vs cases. Vertical is independent, so both axes have a column layout. */
  axis: CalendarAxis;
  vertical: boolean;
  /** Bump from parent after modal save/remove so the day board refreshes. */
  reloadToken?: number;
  onToast: (text: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onSaveBlockNotes: (blockId: string, notes: string | null) => Promise<void>;
  onGoToCase: (caseId: string) => void;
  /** Keep week mode aligned when the selected day changes. */
  onSyncWeekMonday?: (mondayIso: string) => void;
}) {
  const today = isoOf(new Date());
  const [day, setDay] = useState(() => {
    try {
      return localStorage.getItem(DAY_LS_KEY) || today;
    } catch {
      return today;
    }
  });
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [priorWork, setPriorWork] = useState<SchedulePriorWork[]>([]);
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<AssignmentFlow | null>(null);
  const [drag, setDrag] = useState<DayDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [coveredIsos, setCoveredIsos] = useState<ReadonlySet<string>>(() => new Set());
  const [monthRange, setMonthRange] = useState<{ from: string; to: string } | null>(null);
  const [coverageTick, setCoverageTick] = useState(0);

  const pickDay = useCallback(
    (iso: string) => {
      setDay(iso);
      try {
        localStorage.setItem(DAY_LS_KEY, iso);
      } catch {
        /* ignore */
      }
      onSyncWeekMonday?.(mondayOf(iso));
    },
    [onSyncWeekMonday],
  );

  const regionInvestigators = useMemo(
    () => (region === "all" ? investigators : investigators.filter((i) => i.region === region)),
    [investigators, region],
  );

  const regionCases = useMemo(
    () => (region === "all" ? cases : cases.filter((c) => c.region === region)),
    [cases, region],
  );

  const priorCaseIdsKey = useMemo(() => regionCases.map((c) => c.id).join(","), [regionCases]);

  const loadDay = useCallback(() => {
    scheduleApi
      .list({
        from: day,
        to: day,
        region: region === "all" ? undefined : region,
        includePriorWork: true,
        priorWorkCaseIds: priorCaseIdsKey || undefined,
      })
      .then((res) => {
        setBlocks(res.blocks);
        setPriorWork(res.priorWork ?? []);
      })
      .catch((err) => {
        setBlocks([]);
        setPriorWork([]);
        onToast(err instanceof ApiError ? err.message : "Could not load the day schedule.");
      });
  }, [day, region, priorCaseIdsKey, onToast]);

  useEffect(loadDay, [loadDay, reloadToken]);

  const onMonthViewChange = useCallback(
    (view: { year: number; month: number; from: string; to: string }) => {
      setMonthRange((prev) =>
        prev && prev.from === view.from && prev.to === view.to ? prev : { from: view.from, to: view.to },
      );
    },
    [],
  );

  useEffect(() => {
    if (!monthRange) return;
    let cancelled = false;
    scheduleApi
      .list({
        from: monthRange.from,
        to: monthRange.to,
        region: region === "all" ? undefined : region,
      })
      .then((res) => {
        if (cancelled) return;
        setCoveredIsos(new Set(res.blocks.map((b) => b.date.slice(0, 10))));
      })
      .catch(() => {
        if (!cancelled) setCoveredIsos(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [monthRange, region, reloadToken, coverageTick]);

  const refreshCoverage = useCallback(() => setCoverageTick((t) => t + 1), []);

  const priorSet = useMemo(
    () => new Set(priorWork.map((p) => priorKey(p.caseId, p.userId))),
    [priorWork],
  );

  const blockByUser = useMemo(() => {
    const map = new Map<string, ScheduleBlock>();
    for (const b of blocks ?? []) map.set(b.userId, b);
    return map;
  }, [blocks]);

  const blocksByCase = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const b of blocks ?? []) {
      map.set(b.caseId, [...(map.get(b.caseId) ?? []), b]);
    }
    return map;
  }, [blocks]);

  const bookedUserIds = useMemo(() => new Set((blocks ?? []).map((b) => b.userId)), [blocks]);

  const sortedInvestigators = useMemo(() => {
    return [...regionInvestigators].sort((a, b) => {
      const aBlock = blockByUser.get(a.id);
      const bBlock = blockByUser.get(b.id);
      const aAssigned = aBlock ? 0 : 1;
      const bAssigned = bBlock ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      if (aBlock && bBlock) {
        const aRegion =
          a.region && aBlock.case.region && a.region === aBlock.case.region ? 0 : 1;
        const bRegion =
          b.region && bBlock.case.region && b.region === bBlock.case.region ? 0 : 1;
        if (aRegion !== bRegion) return aRegion - bRegion;
        const aPrior = priorSet.has(priorKey(aBlock.caseId, a.id)) ? 0 : 1;
        const bPrior = priorSet.has(priorKey(bBlock.caseId, b.id)) ? 0 : 1;
        if (aPrior !== bPrior) return aPrior - bPrior;
      }
      return a.name.localeCompare(b.name);
    });
  }, [regionInvestigators, blockByUser, priorSet]);

  const sortedCases = useMemo(() => {
    return [...regionCases].sort(
      (a, b) => a.caseNumber.localeCompare(b.caseNumber) || a.subjectName.localeCompare(b.subjectName),
    );
  }, [regionCases]);

  /** Vertical board: assigned cases first. */
  const boardCases = useMemo(() => {
    return [...sortedCases].sort((a, b) => {
      const aAssigned = (blocksByCase.get(a.id) ?? []).length > 0 ? 0 : 1;
      const bAssigned = (blocksByCase.get(b.id) ?? []).length > 0 ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return a.caseNumber.localeCompare(b.caseNumber) || a.subjectName.localeCompare(b.subjectName);
    });
  }, [sortedCases, blocksByCase]);

  const bookedInvestigatorCount = bookedUserIds.size;
  const coveredCaseCount = useMemo(() => {
    const ids = new Set((blocks ?? []).map((b) => b.caseId));
    return regionCases.reduce((n, c) => n + (ids.has(c.id) ? 1 : 0), 0);
  }, [blocks, regionCases]);

  const coverageLabel =
    axis === "investigators"
      ? `${bookedInvestigatorCount} / ${regionInvestigators.length} investigators booked`
      : `${coveredCaseCount} / ${regionCases.length} cases covered`;

  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dayWeather: WeatherDay | null = useMemo(() => {
    const groups =
      region === "all" ? weekWeather : weekWeather.filter((g) => g.group === region);
    for (const g of groups.length ? groups : weekWeather) {
      const match = g.days.find((d) => d.date === day);
      if (match) return match;
    }
    return null;
  }, [weekWeather, region, day]);

  const WxIcon = dayWeather ? weatherIcon(dayWeather.code) : null;

  const createAssignment = async (
    caseId: string,
    userId: string,
    notes: string | null,
  ) => {
    if (bookedUserIds.has(userId)) {
      const label = investigators.find((i) => i.id === userId)?.name ?? "That investigator";
      onToast(`${label} already has an assignment that day.`);
      return;
    }
    setSaving(true);
    try {
      const res = await scheduleApi.create({ caseId, userId, date: day });
      let block = res.block;
      if (notes) {
        const updated = await scheduleApi.update(block.id, { notes });
        block = updated.block;
      }
      setBlocks((prev) => [...(prev ?? []).filter((b) => b.id !== block.id), block]);
      setFlow(null);
      refreshCoverage();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not schedule.");
      throw err instanceof ApiError ? err : new Error("Could not schedule.");
    } finally {
      setSaving(false);
    }
  };

  const clearDrag = () => {
    setDrag(null);
    setDropTarget(null);
  };

  const startBlockDrag = (block: ScheduleBlock, e: DragEvent) => {
    if (!canManage) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", block.case.caseNumber);
    setDrag({ kind: "block", block });
  };

  const assignViaDrop = async (caseId: string, userId: string, dateIso = day) => {
    if (dateIso === day && bookedUserIds.has(userId)) {
      const label = investigators.find((i) => i.id === userId)?.name ?? "That investigator";
      onToast(`${label} already has an assignment that day.`);
      return;
    }
    setSaving(true);
    try {
      const res = await scheduleApi.create({ caseId, userId, date: dateIso });
      if (dateIso === day) {
        setBlocks((prev) => [...(prev ?? []).filter((b) => b.id !== res.block.id), res.block]);
        if (canManage) {
          setFlow({
            kind: "edit-notes",
            step: "notes",
            block: res.block,
            othersThatDay: (blocks ?? []).filter(
              (b) =>
                b.caseId === res.block.caseId &&
                b.date.slice(0, 10) === res.block.date.slice(0, 10) &&
                b.id !== res.block.id,
            ),
          });
        }
      } else {
        pickDay(dateIso);
      }
      refreshCoverage();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not schedule.");
    } finally {
      setSaving(false);
    }
  };

  const moveBlockToDay = async (block: ScheduleBlock, dateIso: string) => {
    if (block.date.slice(0, 10) === dateIso) return;
    setSaving(true);
    try {
      await scheduleApi.update(block.id, { date: dateIso });
      setBlocks((prev) => prev?.filter((b) => b.id !== block.id) ?? null);
      pickDay(dateIso);
      refreshCoverage();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not move assignment.");
    } finally {
      setSaving(false);
    }
  };

  const reassignBlock = async (block: ScheduleBlock, next: { userId?: string; caseId?: string }) => {
    const userId = next.userId ?? block.userId;
    const caseId = next.caseId ?? block.caseId;
    if (userId === block.userId && caseId === block.caseId) return;
    if (userId !== block.userId && bookedUserIds.has(userId)) {
      const label = investigators.find((i) => i.id === userId)?.name ?? "That investigator";
      onToast(`${label} already has an assignment that day.`);
      return;
    }
    setSaving(true);
    try {
      const res = await scheduleApi.create({
        caseId,
        userId,
        date: day,
        notes: block.notes,
      });
      setBlocks((prev) => [
        ...(prev ?? []).filter((b) => b.id !== block.id && b.id !== res.block.id),
        res.block,
      ]);
      onRemoveBlock(block.id);
      refreshCoverage();
      if (canManage) openNotes(res.block);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Could not reassign.");
    } finally {
      setSaving(false);
    }
  };

  const onDropInvestigatorRow = (userId: string) => {
    if (!drag) return;
    const payload = drag;
    clearDrag();
    if (payload.kind === "case") {
      void assignViaDrop(payload.caseId, userId);
    } else if (payload.kind === "block") {
      void reassignBlock(payload.block, { userId });
    }
  };

  const onDropCaseRow = (caseId: string) => {
    if (!drag) return;
    const payload = drag;
    clearDrag();
    if (payload.kind === "investigator") {
      void assignViaDrop(caseId, payload.userId);
    } else if (payload.kind === "block") {
      void reassignBlock(payload.block, { caseId });
    }
  };

  const acceptDropOnInvestigator =
    drag?.kind === "case" || (drag?.kind === "block" && axis === "investigators");
  const acceptDropOnCase =
    drag?.kind === "investigator" || (drag?.kind === "block" && axis === "cases");

  const openNotes = (block: ScheduleBlock) => {
    const dayBlocks = blocks ?? [];
    setFlow({
      kind: "edit-notes",
      step: "notes",
      block,
      othersThatDay: dayBlocks.filter(
        (b) =>
          b.caseId === block.caseId &&
          b.date.slice(0, 10) === block.date.slice(0, 10) &&
          b.id !== block.id,
      ),
    });
  };

  const openPickCase = (userId: string) => {
    const inv = regionInvestigators.find((i) => i.id === userId);
    if (!inv) return;
    setFlow({
      kind: "assign-case",
      step: "pick",
      investigator: inv,
      dayLabel,
      cases: regionCases,
      priorWork,
      draftNotes: "",
    });
  };

  const openPickInvestigator = (caseId: string) => {
    const kase = regionCases.find((c) => c.id === caseId);
    if (!kase) return;
    setFlow({
      kind: "assign-investigator",
      step: "pick",
      kase,
      dayLabel,
      investigators: regionInvestigators,
      priorWork,
      excludeUserIds: bookedUserIds,
      draftNotes: "",
    });
  };

  const draftOthers = useMemo(() => {
    if (!flow || flow.kind === "edit-notes" || flow.step !== "notes") return [];
    const caseId = flow.kind === "assign-case" ? flow.draftCase?.id : flow.kase.id;
    if (!caseId) return [];
    return (blocks ?? []).filter(
      (b) => b.caseId === caseId && b.date.slice(0, 10) === day,
    );
  }, [flow, blocks, day]);

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <div className="flex w-[16rem] shrink-0 flex-col gap-2 overflow-y-auto">
        <MiniMonthCalendar
          selectedIso={day}
          onSelect={pickDay}
          coveredIsos={coveredIsos}
          onViewChange={onMonthViewChange}
          dropActive={drag?.kind === "block"}
          onDayDragOver={(iso) => setDropTarget(`day:${iso}`)}
          onDayDrop={(iso) => {
            if (drag?.kind !== "block") return;
            const block = drag.block;
            clearDrag();
            void moveBlockToDay(block, iso);
          }}
        />
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {REGION_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRegionChange(r)}
              className={cn(
                "anim-toggle tap flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.65625rem] font-medium",
                region === r
                  ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                  : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
              )}
            >
              {r !== "all" && <MapPin size={10} strokeWidth={1.8} />}
              {r === "all" ? "All" : REGION_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="surface flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => pickDay(today)}
              className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65625rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => pickDay(shiftDay(day, -1))}
              aria-label="Previous day"
              className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ChevronLeft size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => pickDay(shiftDay(day, 1))}
              aria-label="Next day"
              className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              <ChevronRight size={14} strokeWidth={1.8} />
            </button>
            <h2 className="ml-1 editorial text-[1.35rem] leading-none text-[var(--color-text-hi)]">{dayLabel}</h2>
            {WxIcon && dayWeather && (
              <span
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2 py-0.5"
                title={`${conditionLabel(dayWeather.code)}${
                  dayWeather.highF != null ? ` · ${Math.round(dayWeather.highF)}°` : ""
                }${dayWeather.lowF != null ? ` / ${Math.round(dayWeather.lowF)}°` : ""}`}
              >
                <WxIcon size={13} strokeWidth={1.8} style={{ color: weatherColor(dayWeather.code) }} />
                {dayWeather.highF != null && (
                  <span className="font-mono text-[0.625rem] text-[var(--color-text-mid)]">
                    {Math.round(dayWeather.highF)}°
                  </span>
                )}
              </span>
            )}
            {saving && <Loader2 size={14} className="ml-1 animate-spin text-[var(--color-text-lo)]" />}
            {blocks !== null && (
              <span className="ml-2 hidden font-mono text-[0.625rem] text-[var(--color-text-lo)] sm:inline">
                {coverageLabel}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {blocks === null ? (
            <div className="grid place-items-center py-16 text-[var(--color-text-lo)]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : axis === "investigators" ? (
            sortedInvestigators.length === 0 ? (
              <EmptyState text="No investigators in this region." />
            ) : vertical ? (
              <div className="grid grid-cols-[repeat(auto-fill,20rem)] justify-start gap-2.5 pt-1">
                {sortedInvestigators.map((inv) => {
                  const block = blockByUser.get(inv.id);
                  const targetKey = `inv:${inv.id}`;
                  const highlight = acceptDropOnInvestigator && dropTarget === targetKey && !block;
                  return (
                    <InvestigatorBoardColumn
                      key={inv.id}
                      name={inv.name}
                      region={inv.region}
                      block={block}
                      canManage={canManage}
                      dropHighlight={highlight}
                      onDragOver={(e) => {
                        if (!acceptDropOnInvestigator || block) return;
                        e.preventDefault();
                        setDropTarget(targetKey);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === targetKey ? null : t))}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDropInvestigatorRow(inv.id);
                      }}
                      onBandDragStart={(b, e) => startBlockDrag(b, e)}
                      onBandDragEnd={clearDrag}
                      onAssign={() => openPickCase(inv.id)}
                      onOpenNotes={openNotes}
                      onUnassign={(blockId) => {
                        setBlocks((prev) => prev?.filter((b) => b.id !== blockId) ?? null);
                        onRemoveBlock(blockId);
                        refreshCoverage();
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              sortedInvestigators.map((inv) => {
                const block = blockByUser.get(inv.id);
                const targetKey = `inv:${inv.id}`;
                const highlight = acceptDropOnInvestigator && dropTarget === targetKey && !block;
                return (
                  <CalendarDayRow
                    key={inv.id}
                    label={<InvestigatorRowLabel name={inv.name} region={inv.region} />}
                  >
                    {block ? (
                      <CaseAssignmentBand
                        block={block}
                        draggable={canManage}
                        onDragStart={(e) => startBlockDrag(block, e)}
                        onDragEnd={clearDrag}
                        onClick={() => openNotes(block)}
                        onContextUnassign={
                          canManage
                            ? () => {
                                setBlocks((prev) => prev?.filter((b) => b.id !== block.id) ?? null);
                                onRemoveBlock(block.id);
                                refreshCoverage();
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <EmptyAssignSlot
                        label={canManage ? "Assign case" : "Unassigned"}
                        disabled={!canManage}
                        onClick={() => canManage && openPickCase(inv.id)}
                        dropHighlight={highlight}
                        onDragOver={(e) => {
                          if (!acceptDropOnInvestigator) return;
                          e.preventDefault();
                          setDropTarget(targetKey);
                        }}
                        onDragLeave={() => setDropTarget((t) => (t === targetKey ? null : t))}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDropInvestigatorRow(inv.id);
                        }}
                      />
                    )}
                  </CalendarDayRow>
                );
              })
            )
          ) : (
            sortedCases.length === 0 ? (
              <EmptyState text="No open cases in this region." />
            ) : vertical ? (
              <div className="grid grid-cols-[repeat(auto-fill,20rem)] justify-start gap-2.5 pt-1">
                {boardCases.map((c) => {
                  const dayBlocks = blocksByCase.get(c.id) ?? [];
                  const targetKey = `case:${c.id}`;
                  const highlight = acceptDropOnCase && dropTarget === targetKey;
                  return (
                    <CaseBoardColumn
                      key={c.id}
                      subjectName={c.subjectName}
                      caseNumber={c.caseNumber}
                      blocks={dayBlocks}
                      canManage={canManage}
                      dropHighlight={highlight}
                      onDragOver={(e) => {
                        if (!acceptDropOnCase) return;
                        e.preventDefault();
                        setDropTarget(targetKey);
                      }}
                      onDragLeave={() => setDropTarget((t) => (t === targetKey ? null : t))}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDropCaseRow(c.id);
                      }}
                      onBandDragStart={(block, e) => startBlockDrag(block, e)}
                      onBandDragEnd={clearDrag}
                      onAssign={() => openPickInvestigator(c.id)}
                      onOpenNotes={openNotes}
                      onUnassign={(blockId) => {
                        setBlocks((prev) => prev?.filter((b) => b.id !== blockId) ?? null);
                        onRemoveBlock(blockId);
                        refreshCoverage();
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              sortedCases.map((c) => {
                const dayBlocks = blocksByCase.get(c.id) ?? [];
                const targetKey = `case:${c.id}`;
                const highlight = acceptDropOnCase && dropTarget === targetKey;
                return (
                  <CalendarDayRow
                    key={c.id}
                    label={<CaseRowLabel subjectName={c.subjectName} caseNumber={c.caseNumber} region={c.region} />}
                  >
                    {dayBlocks.length > 0 ? (
                      <div
                        className={cn(
                          "flex flex-col gap-1.5 rounded-[0.5rem]",
                          highlight && "ring-1 ring-[rgba(74,127,255,0.45)]",
                        )}
                        onDragOver={(e) => {
                          if (!acceptDropOnCase) return;
                          e.preventDefault();
                          setDropTarget(targetKey);
                        }}
                        onDragLeave={() => setDropTarget((t) => (t === targetKey ? null : t))}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDropCaseRow(c.id);
                        }}
                      >
                        {dayBlocks.map((block) => (
                          <InvestigatorAssignmentBand
                            key={block.id}
                            block={block}
                            draggable={canManage}
                            onDragStart={(e) => startBlockDrag(block, e)}
                            onDragEnd={clearDrag}
                            onClick={() => openNotes(block)}
                            onContextUnassign={
                              canManage
                                ? () => {
                                    setBlocks((prev) => prev?.filter((b) => b.id !== block.id) ?? null);
                                    onRemoveBlock(block.id);
                                    refreshCoverage();
                                  }
                                : undefined
                            }
                          />
                        ))}
                        {canManage && (
                          <EmptyAssignSlot
                            label="Add investigator"
                            onClick={() => openPickInvestigator(c.id)}
                          />
                        )}
                      </div>
                    ) : (
                      <EmptyAssignSlot
                        label={canManage ? "Assign investigator" : "Unassigned"}
                        disabled={!canManage}
                        onClick={() => canManage && openPickInvestigator(c.id)}
                        dropHighlight={highlight}
                        onDragOver={(e) => {
                          if (!acceptDropOnCase) return;
                          e.preventDefault();
                          setDropTarget(targetKey);
                        }}
                        onDragLeave={() => setDropTarget((t) => (t === targetKey ? null : t))}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDropCaseRow(c.id);
                        }}
                      />
                    )}
                  </CalendarDayRow>
                );
              })
            )
          )}
        </div>
      </div>

      {flow && (
        <ScheduleAssignmentModal
          flow={flow}
          canManage={canManage}
          busy={saving}
          othersThatDay={draftOthers}
          onClose={() => setFlow(null)}
          onDraftCase={(caseId) => {
            if (flow.kind !== "assign-case") return;
            const draftCase = flow.cases.find((c) => c.id === caseId);
            if (!draftCase) return;
            if (!canManage) {
              void createAssignment(draftCase.id, flow.investigator.id, null);
              return;
            }
            setFlow({ ...flow, step: "notes", draftCase, draftNotes: "" });
          }}
          onDraftInvestigator={(userId) => {
            if (flow.kind !== "assign-investigator") return;
            const draftInvestigator = flow.investigators.find((i) => i.id === userId);
            if (!draftInvestigator) return;
            if (!canManage) {
              void createAssignment(flow.kase.id, draftInvestigator.id, null);
              return;
            }
            setFlow({ ...flow, step: "notes", draftInvestigator, draftNotes: "" });
          }}
          onBackToPick={() => {
            if (flow.kind === "assign-case") {
              setFlow({
                ...flow,
                step: "pick",
                draftCase: undefined,
                draftNotes: "",
              });
            } else if (flow.kind === "assign-investigator") {
              setFlow({
                ...flow,
                step: "pick",
                draftInvestigator: undefined,
                draftNotes: "",
              });
            }
          }}
          onConfirmAssign={async (notes) => {
            if (flow.kind === "assign-case" && flow.draftCase) {
              await createAssignment(flow.draftCase.id, flow.investigator.id, notes);
            } else if (flow.kind === "assign-investigator" && flow.draftInvestigator) {
              await createAssignment(flow.kase.id, flow.draftInvestigator.id, notes);
            }
          }}
          onSaveNotes={async (notes) => {
            if (flow.kind !== "edit-notes") return;
            await onSaveBlockNotes(flow.block.id, notes);
            setBlocks((prev) =>
              prev
                ? prev.map((b) => (b.id === flow.block.id ? { ...b, notes } : b))
                : prev,
            );
          }}
          onRemove={() => {
            if (flow.kind !== "edit-notes") return;
            const id = flow.block.id;
            setFlow(null);
            setBlocks((prev) => prev?.filter((b) => b.id !== id) ?? null);
            onRemoveBlock(id);
            refreshCoverage();
          }}
          onGoToCase={() => {
            if (flow.kind === "edit-notes") {
              onGoToCase(flow.block.caseId);
              return;
            }
            if (flow.kind === "assign-case" && flow.draftCase) {
              onGoToCase(flow.draftCase.id);
              return;
            }
            if (flow.kind === "assign-investigator") {
              onGoToCase(flow.kase.id);
            }
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="calendar-empty-slot grid place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-16 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
      {text}
    </div>
  );
}
