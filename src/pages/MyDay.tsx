import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Bike,
  Bus,
  Car,
  Clock,
  Footprints,
  Loader2,
  MapPin,
  Play,
  Square,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { placeholderPhotoFor, SERVICE_LABELS } from "@/lib/mock-data";
import { CaseGlanceCard, formatEarliestActive, glanceFromMyDay } from "@/components/cases/CaseGlanceCard";
import { transportLabel } from "@/components/cases/SubjectMobility";
import { useQuery, invalidateQueries } from "@/lib/query-cache";
import { useAuth } from "@/contexts/AuthContext";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { ENTRY_META, fmtTime, READABLE_DATE_CLASS } from "@/lib/journal";
import {
  casesApi,
  timeEntriesApi,
  ApiError,
  type CaseDayEntry,
  type CaseDetail,
  type MyCaseloadBucket,
  type MyCaseloadItem,
} from "@/lib/crm-api";

const BUCKET_META: Record<Exclude<MyCaseloadBucket, "today">, { title: string; hint: string; dot: string }> = {
  current: { title: "Coming up", hint: "Assigned, scheduled ahead", dot: "#60a5fa" },
  past: { title: "Worked before", hint: "Case is still open — may have moved to someone else's day", dot: "#60a5fa" },
  closed: { title: "Previously worked", hint: "Case closed — read-only", dot: "var(--color-text-lo)" },
};

const fmtDuration = (ms: number): string => {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtToday = (): string => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** Due-date chip color: red once overdue, amber inside 3 days, muted otherwise. */
const dueTone = (iso: string | null): { label: string; color: string } | null => {
  if (!iso) return null;
  const due = new Date(iso);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  const label = `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric" })} (${due.toLocaleDateString(undefined, { weekday: "short" })})`;
  if (days < 0) return { label: `${label} · overdue`, color: "#f87171" };
  if (days <= 3) return { label, color: "#fb923c" };
  return { label, color: "var(--color-text-mid)" };
};

export default function MyDay() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWork = can("cases.work");
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [clockBusy, setClockBusy] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const { data: caseload, loading } = useQuery("cases:mine:caseload", () => casesApi.myCaseload(), {
    staleMs: 30_000,
  });
  const items = caseload?.cases ?? [];
  const todayItem = items.find((i) => i.bucket === "today") ?? null;
  const restItems = items.filter((i) => i.bucket !== "today");

  // Full case detail for just today's case — cheap (one item) and shares its cache
  // key with CaseWorkMode, so opening the case afterward is instant.
  const { data: todayDetailData } = useQuery(
    todayItem ? `case:${todayItem.caseId}` : null,
    () => casesApi.get(todayItem!.caseId),
    { staleMs: 30_000, enabled: !!todayItem },
  );
  const todayDetail = todayDetailData?.case ?? null;

  const activeKey = canWork ? "time-entries:active" : null;
  const { data: activeData, refresh: refreshActive } = useQuery(activeKey, () => timeEntriesApi.active(), {
    staleMs: 10_000,
    enabled: canWork,
  });
  const active = activeData?.active ?? null;
  const settledMs = activeData?.settledMsToday ?? 0;
  const runningSince = activeData?.runningSince ? new Date(activeData.runningSince).getTime() : null;
  const msToday = settledMs + (runningSince ? Math.max(0, now - runningSince) : 0);

  const grouped = useMemo(() => {
    const order: Exclude<MyCaseloadBucket, "today">[] = ["current", "past", "closed"];
    return order
      .map((bucket) => ({ bucket, items: restItems.filter((i) => i.bucket === bucket) }))
      .filter((g) => g.items.length > 0);
  }, [restItems]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 4000);
  };

  const startWorking = async () => {
    if (!todayItem) return;
    setClockBusy(true);
    try {
      await timeEntriesApi.start(todayItem.caseId);
      invalidateQueries("time-entries:active");
      await refreshActive();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Could not start the clock.");
    } finally {
      setClockBusy(false);
    }
  };

  const stopWorking = async () => {
    if (!active) return;
    setClockBusy(true);
    try {
      await timeEntriesApi.stop(active.id);
      invalidateQueries("time-entries:active");
      await refreshActive();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : "Could not clock out.");
    } finally {
      setClockBusy(false);
    }
  };

  return (
    <div className="investigator-surface flex h-full flex-col gap-4 overflow-hidden">
      {/* Page header — identical shape to Cases, Scheduling, Investigators */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">My Day</h1>
          <p className="mt-1 font-mono text-[0.75rem] text-[var(--color-text-lo)]">
            {fmtToday()}
            {todayItem ? ` · ${todayItem.case.subjectName}` : " · nothing scheduled"}
          </p>
        </div>

        {canWork && (
          <div
            className={cn(
              "flex h-11 w-[9.5rem] shrink-0 items-center gap-2 rounded-[0.75rem] border px-3",
              active ? "border-[rgba(74,222,128,0.45)] bg-[rgba(74,222,128,0.1)]" : "border-[var(--color-line-2)] bg-[var(--color-ink-2)]",
            )}
          >
            <Clock size={16} strokeWidth={1.9} className={cn("shrink-0", active ? "text-[#4ade80]" : "text-[var(--color-text-lo)]")} />
            <span className="min-w-0 flex-1 truncate text-center font-mono text-[1.0625rem] font-semibold tabular-nums text-[var(--color-text-hi)]">
              {fmtDuration(msToday)}
            </span>
            {active ? (
              <button
                type="button"
                onClick={() => void stopWorking()}
                disabled={clockBusy}
                title="Clock out"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-[var(--color-neg)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {clockBusy ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} strokeWidth={0} fill="currentColor" />}
              </button>
            ) : todayItem ? (
              <button
                type="button"
                onClick={() => void startWorking()}
                disabled={clockBusy}
                title="Start the clock on this case"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-[var(--color-accent)] text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                {clockBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} strokeWidth={0} fill="currentColor" />}
              </button>
            ) : (
              <span className="h-8 w-8 shrink-0" aria-hidden />
            )}
          </div>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="surface rounded-[1rem] p-8 text-center text-[0.875rem] text-[var(--color-text-mid)]">Loading your cases…</div>
      ) : items.length === 0 ? (
        <div className="surface rounded-[1rem] p-10 text-center">
          <p className="editorial text-[1.5rem] text-[var(--color-text-hi)]">No cases yet</p>
          <p className="mt-2 text-[0.875rem] text-[var(--color-text-mid)]">When you're assigned a case, it will show up here.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto xl:flex-row xl:overflow-hidden">
          {todayItem && (
            <TodayHero
              item={todayItem}
              detail={todayDetail}
              isActiveClock={!!active && active.caseId === todayItem.caseId}
              onOpen={() => navigate(`/cases/${todayItem.caseId}/work`)}
            />
          )}

          {/* The rest of the caseload. On a wide screen this column scrolls on its own;
              otherwise the whole page scrolls so these cards stay reachable. */}
          <div className="flex shrink-0 flex-col gap-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
            {grouped.map(({ bucket, items: groupItems }) => (
              <section key={bucket} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: BUCKET_META[bucket].dot }} />
                    {BUCKET_META[bucket].title}
                    <span className="text-[var(--color-text-mid)]">({groupItems.length})</span>
                  </h2>
                  <span className="hidden text-[0.75rem] text-[var(--color-text-lo)] sm:inline">{BUCKET_META[bucket].hint}</span>
                </div>
                <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {groupItems.map((item) => (
                    <CaseGlanceCard
                      key={item.caseId}
                      glance={glanceFromMyDay(item)}
                      muted={item.bucket === "closed"}
                      isActiveClock={!!active && active.caseId === item.caseId}
                      onOpen={() => navigate(`/cases/${item.caseId}/work`)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)] px-4 py-2 text-[0.875rem] text-[var(--color-text-hi)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Small "at a glance" tile — a captured vehicle or subject still, always 4:3 so the grid reads evenly. */
function GlanceTile({
  caseId,
  photoUrl,
  label,
  sublabel,
  icon: Icon,
}: {
  caseId: string;
  photoUrl: string | null | undefined;
  label: string;
  sublabel?: string;
  icon: typeof Car;
}) {
  const src = useCasePhoto(caseId, photoUrl);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Icon size={16} className="text-[var(--color-text-lo)] opacity-50" />}
      </div>
      <div className="min-w-0">
        <div className="truncate font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[var(--color-text-lo)]">{label}</div>
        {sublabel && <div className="truncate text-[0.6875rem] text-[var(--color-text-mid)]">{sublabel}</div>}
      </div>
    </div>
  );
}

const NOTES_LIMIT = 6;

/** Compact, scroll-free feed of the most recent journal entries — enough to catch up without opening the case. */
function HeroNotesFeed({ entries }: { entries: CaseDayEntry[] }) {
  const withBody = useMemo(
    () =>
      entries
        .filter((e) => e.body)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  );
  const shown = withBody.slice(0, NOTES_LIMIT);

  if (shown.length === 0) {
    return <p className="text-[0.8125rem] text-[var(--color-text-lo)]">No journal entries yet — this case is wide open.</p>;
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col divide-y divide-[var(--color-line)]">
        {shown.map((e) => {
          const meta = ENTRY_META[e.type] ?? ENTRY_META.note;
          const Icon = meta.icon;
          return (
            <div key={e.id} className="flex items-center gap-2 py-1.5">
              <Icon size={11} strokeWidth={1.9} style={{ color: meta.color }} className="shrink-0" />
              <span className={cn("shrink-0 text-[0.6875rem]", READABLE_DATE_CLASS)}>{fmtTime(e.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--color-text-mid)]">{e.body}</span>
            </div>
          );
        })}
      </div>
      {withBody.length > shown.length && (
        <div className="shrink-0 pt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          +{withBody.length - shown.length} more in the journal
        </div>
      )}
    </div>
  );
}

function TodayHero({
  item,
  detail,
  isActiveClock,
  onOpen,
}: {
  item: MyCaseloadItem;
  detail: CaseDetail | null;
  isActiveClock: boolean;
  onOpen: () => void;
}) {
  const k = item.case;
  const subjectSrc = useCasePhoto(k.id, k.subjectPhotoUrl) ?? k.subjectPhotoUrl ?? placeholderPhotoFor(k.id);

  const entries = useMemo(() => detail?.days.flatMap((d) => d.entries) ?? [], [detail]);
  const address = k.addresses?.find((a) => a.isPrimary) ?? k.addresses?.[0] ?? null;
  const due = dueTone(k.dueDate);
  const earliest = formatEarliestActive(k.earliestActiveAt);

  /** Gallery is specifically extra subject stills + every vehicle on the case — the two things worth a glance before walking in. */
  const gallery = useMemo(() => {
    const items: { key: string; photoUrl: string | null | undefined; label: string; sublabel?: string; icon: typeof Car }[] = [];
    for (const v of detail?.vehicles ?? []) {
      if (!v.photoUrl) continue;
      items.push({
        key: `v-${v.id}`,
        photoUrl: v.photoUrl,
        label: "Vehicle",
        sublabel: [v.color, v.make].filter(Boolean).join(" ") || v.licensePlate || undefined,
        icon: Car,
      });
    }
    const subjectShots = entries
      .filter((e) => e.type === "photo_person" && !e.personId && e.photoUrl)
      .slice()
      .reverse();
    for (const e of subjectShots) {
      items.push({ key: e.id, photoUrl: e.photoUrl, label: "Subject", sublabel: fmtTime(e.createdAt), icon: Users });
    }
    return items.slice(0, 8);
  }, [detail?.vehicles, entries]);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="surface anim-rise group flex shrink-0 cursor-pointer flex-col rounded-[1.25rem] border border-[var(--color-line-2)] p-5 text-left transition-shadow hover:border-[rgba(74,127,255,0.35)] hover:shadow-[0_0_0_0.125rem_rgba(74,127,255,0.12)] xl:max-h-full xl:w-[38rem] xl:overflow-y-auto"
    >
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-white">
            Today's case
          </span>
          {isActiveClock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(74,222,128,0.18)] px-2.5 py-0.5 font-mono text-[0.6875rem] text-[#4ade80]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
              Clocked in
            </span>
          )}
          {due && (
            <span className="font-mono text-[0.6875rem] font-semibold" style={{ color: due.color }}>
              {due.label}
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1 text-[0.6875rem]", READABLE_DATE_CLASS)}>
            <CalendarClock size={11} />
            Case day {Math.max(1, k._count?.days ?? 1)}
          </span>
      </div>

      <div className="flex shrink-0 gap-5">
        <div className="aspect-[4/3] w-[11rem] shrink-0 overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)] sm:w-[13.5rem]">
          <img src={subjectSrc} alt={k.subjectName} className="h-full w-full object-cover" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="editorial text-[1.75rem] leading-none text-[var(--color-text-hi)]">{k.subjectName}</h2>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.75rem] text-[var(--color-text-mid)]">
            {k.claimNumber && <span className="text-[#fbbf24]">{k.claimNumber}</span>}
            {k.claimNumber && <span>·</span>}
            <span>{SERVICE_LABELS[k.service]}</span>
          </div>

          {address && (
            <div className="flex items-start gap-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
              <MapPin size={12} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
              <span>{[address.line1, address.city, address.state, address.zip].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {k.subjectTransport && (
            <HeroFact
              icon={k.subjectTransport === "foot" ? Footprints : k.subjectTransport === "transit" ? Bus : k.subjectTransport === "other" ? Bike : Car}
              label="Gets around"
              value={transportLabel(k.subjectTransport)}
            />
          )}
          <HeroFact icon={Clock} label="EAT" value={earliest ? `${earliest.time} · ${earliest.date}` : "No investigator note yet"} />

          {k.subjectWorkStatus && (
            <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">
              <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Claim · </span>
              {k.subjectWorkStatus}
            </p>
          )}

          <div className="mt-auto pt-3">
            <span className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-[0.75rem] bg-[var(--color-accent)] px-4 py-2.5 text-[0.9375rem] font-semibold text-white shadow-[0_0_0.75rem_rgba(74,127,255,0.35)] transition-transform group-hover:translate-x-0.5">
              Open case
              <ArrowRight size={16} strokeWidth={2.2} />
            </span>
          </div>
        </div>
      </div>

      {/* Gallery — every vehicle plus any extra subject stills, not just the hero portrait */}
      {gallery.length > 0 && (
        <div className="mt-5 shrink-0 border-t border-[var(--color-line)] pt-4">
          <div className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
            Vehicles &amp; other stills
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
            {gallery.map((t) => (
              <GlanceTile key={t.key} caseId={k.id} photoUrl={t.photoUrl} label={t.label} sublabel={t.sublabel} icon={t.icon} />
            ))}
          </div>
        </div>
      )}

      {/* Recent journal — enough to catch up without opening the case, no inner scroll */}
      <div className="mt-5 flex flex-col border-t border-[var(--color-line)] pt-4">
        <div className="mb-2 shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
          Recent journal
        </div>
        <HeroNotesFeed entries={entries} />
      </div>
    </div>
  );
}

function HeroFact({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[var(--color-text-lo)]">
        <Icon size={9} />
        {label}
      </div>
      <div className="truncate text-[0.8125rem] text-[var(--color-text-hi)]">{value}</div>
    </div>
  );
}

