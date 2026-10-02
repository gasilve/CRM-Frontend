import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { useQuery, invalidateQueries } from "@/lib/query-cache";
import {
  casesApi,
  geocodeApi,
  investigatorsApi,
  scheduleApi,
  ApiError,
  type CaseAddress,
  type CaseDetail,
  type CasePattern,
  type SubjectAwareness,
  type SubjectSetting,
} from "@/lib/crm-api";
import { formatEarliestActive } from "@/components/cases/CaseGlanceCard";
import { transportLabel } from "@/components/cases/SubjectMobility";
import { CasePhoto, comparisonsFromEntries, type ComparisonRecord } from "@/components/case/EntityModal";
import { CaseMap } from "@/components/case/CaseMap";
import { ScheduleAssignmentModal, type AssignInvestigatorFlow } from "@/components/schedule/ScheduleAssignmentModal";
import { useAuth } from "@/contexts/AuthContext";

const LAYOUT_KEY = "accenty.crm.skyview.layout";

type SkyLayout = "board" | "horizon";

const TONE = {
  active: "var(--color-pos)",
  working: "var(--color-warn)",
  quiet: "var(--color-text-lo)",
  noticed: "var(--color-warn)",
  burned: "var(--color-neg)",
} as const;

/** Solid `.surface` when glass is off; glass.css restyles `.surface` when it is on. */
const card = "surface";
const slot = "surface sky-inset px-5 py-4";

const AREAS: { id: SubjectSetting; label: string; title: string; color: string }[] = [
  { id: "suburban", label: "suburban", title: "Suburban", color: "var(--color-accent)" },
  { id: "rural", label: "rural", title: "Rural", color: "var(--color-pos)" },
  { id: "dense", label: "dense", title: "Densely populated", color: "var(--color-warn)" },
];

const areaKey = (id: string) => `accenty.crm.skyview.area.${id}`;

const readArea = (id: string): SubjectSetting | null => {
  try {
    const raw = localStorage.getItem(areaKey(id));
    return raw === "suburban" || raw === "rural" || raw === "dense" ? raw : null;
  } catch {
    return null;
  }
};

const writeArea = (id: string, value: SubjectSetting) => {
  try {
    localStorage.setItem(areaKey(id), value);
  } catch {
    /* ignore */
  }
};

const readLayout = (): SkyLayout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "horizon" ? "horizon" : "board";
  } catch {
    return "board";
  }
};

const ageOf = (iso: string | null): number | null => {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday = now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

const dayKey = (iso: string) => iso.slice(0, 10);

const shortDay = (iso: string) => {
  const d = new Date(`${dayKey(iso)}T12:00:00`);
  return { weekday: d.toLocaleDateString(undefined, { weekday: "short" }), day: d.getDate() };
};

const toneOf = (awareness: SubjectAwareness | null, hasNotes: boolean): { label: string; color: string } => {
  if (awareness === "aware") return { label: "Aware", color: TONE.burned };
  if (awareness === "suspicious") return { label: "Noticed", color: TONE.noticed };
  if (awareness === "unnoticed") return { label: "Active", color: TONE.active };
  if (hasNotes) return { label: "Working", color: TONE.working };
  return { label: "No activity", color: TONE.quiet };
};


const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

export default function SkyViewPage() {
  const { id: caseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<SkyLayout>(readLayout);
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const { data, loading, error, refresh } = useQuery(caseId ? `case:${caseId}` : null, () => casesApi.get(caseId!), {
    staleMs: 15_000,
    enabled: !!caseId,
  });
  const patternsQuery = useQuery(caseId ? `case:${caseId}:patterns` : null, () => casesApi.listPatterns(caseId!), {
    staleMs: 15_000,
    enabled: !!caseId,
  });
  const kase = data?.case ?? null;

  const pickLayout = (next: SkyLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const refreshSummary = async () => {
    setWriting(true);
    setWriteError(null);
    try {
      if (!caseId) return;
      await casesApi.generateSituationSummary(caseId);
      await refresh();
      invalidateQueries("cases:list");
    } catch (err) {
      setWriteError(err instanceof ApiError ? err.message : "Could not write the case summary.");
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="skyview flex h-full min-h-0 w-full flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/cases")}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-3 py-1.5 text-[0.8125rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={14} />
            Cases
          </button>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-[var(--color-text-lo)]">Skyview</span>
          <div className="flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-ink-2)] p-0.5">
            {(["board", "horizon"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => pickLayout(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-[0.75rem] font-medium capitalize transition-colors",
                  layout === id ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
                )}
              >
                {id}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => caseId && navigate(`/cases/${caseId}`)}
              className="rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-4 py-1.5 text-[0.8125rem] font-medium text-[var(--color-text-hi)] hover:border-[var(--color-accent)]"
            >
              Open case
            </button>
          </div>
        </div>

        {loading && !kase ? (
          <div className={cn(card, "grid min-h-0 flex-1 place-items-center text-[var(--color-text-mid)]")}>
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : error || !kase ? (
          <div className={cn(card, "px-5 py-8 text-[0.8125rem] text-[var(--color-text-mid)]")}>{error ?? "Case not found."}</div>
        ) : layout === "board" ? (
          <Board
            kase={kase}
            patterns={patternsQuery.data?.patterns ?? []}
            writing={writing}
            writeError={writeError}
            onRefresh={() => void refreshSummary()}
            onChanged={() => void refresh()}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Horizon
              kase={kase}
              patterns={patternsQuery.data?.patterns ?? []}
              writing={writing}
              writeError={writeError}
              onRefresh={() => void refreshSummary()}
            />
          </div>
        )}
    </div>
  );
}

function Board({
  kase,
  patterns,
  writing,
  writeError,
  onRefresh,
  onChanged,
}: {
  kase: CaseDetail;
  patterns: CasePattern[];
  writing: boolean;
  writeError: string | null;
  onRefresh: () => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const canSchedule = can("schedule.manage");
  const days = useMemo(() => [...kase.days].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date))), [kase.days]);
  const rows = useMemo(() => scheduleRows(kase), [kase]);
  const summary = kase.situationSummary?.trim() ?? "";
  const notes = useMemo(() => investigatorNotes(kase), [kase]);
  const records = useMemo(
    () => comparisonsFromEntries(kase.days.flatMap((day) => day.entries.map((entry) => ({ ...entry, date: day.date })))),
    [kase.days],
  );
  const worked = days.filter((day) => day.entries.some((entry) => entry.type === "note") || day.summary).length;
  const dueIn = daysUntil(kase.dueDate);
  const eac = formatEarliestActive(kase.earliestActiveAt);
  const age = ageOf(kase.subjectDob);
  const primary = kase.addresses.find((address) => address.isPrimary) ?? kase.addresses[0] ?? null;
  const latest = records[0];
  const latestScore = scoreOf(latest);
  const photo = useCasePhoto(kase.id, kase.subjectPhotoUrl);
  const [area, setArea] = useState<SubjectSetting | null>(() => kase.subjectSetting ?? readArea(kase.id));
  useEffect(() => setArea(kase.subjectSetting ?? readArea(kase.id)), [kase.id, kase.subjectSetting]);
  const weekdays = rows.filter((row) => {
    const n = new Date(`${dayKey(row.date)}T12:00:00`).getDay();
    return n !== 0 && n !== 6;
  }).length;
  const weekend = rows.length - weekdays;
  const vehicles = kase.vehicles.slice(0, 2);
  const addressLine = primary ? [primary.city, primary.state, primary.zip].filter(Boolean).join(" ") : "";
  const [addDate, setAddDate] = useState<string | null>(null);
  const [flow, setFlow] = useState<AssignInvestigatorFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const investigators = useQuery(canSchedule ? "investigators:list" : null, () => investigatorsApi.list(), { enabled: canSchedule });
  const openDate = useMemo(() => nextOpenDate(rows), [rows]);

  const pickArea = async (next: SubjectSetting) => {
    setArea(next);
    writeArea(kase.id, next);
    try {
      await casesApi.setSubjectSetting(kase.id, next);
    } catch {
      /* The choice still sticks in this browser until the case field is available. */
    }
  };

  const openAdd = async () => {
    if (!canSchedule) return;
    setAddError(null);
    const date = openDate;
    setAddDate(date);
    let people = investigators.data?.investigators;
    if (!people) {
      try {
        people = (await investigatorsApi.list()).investigators;
      } catch (err) {
        setAddError(err instanceof ApiError ? err.message : "Could not load investigators.");
        return;
      }
    }
    const booked = new Set(kase.scheduleBlocks.filter((block) => dayKey(block.date) === date).map((block) => block.user.id));
    setFlow({
      kind: "assign-investigator",
      step: "pick",
      kase,
      dayLabel: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
      investigators: people,
      priorWork: [],
      excludeUserIds: booked,
      draftNotes: "",
    });
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-6 overflow-hidden text-[var(--color-text-hi)] xl:grid-cols-[minmax(18rem,0.92fr)_minmax(0,1.2fr)_minmax(19rem,22rem)]">
      <section className={cn(card, "flex min-h-0 flex-col p-6")}>
        <h2 className="truncate text-[2.35rem] font-light leading-none tracking-[-0.04em] text-[var(--color-text-hi)]">
          {kase.subjectName}
          {age != null && <span className="ml-2 text-[1.15rem] font-light text-[var(--color-text-lo)]">{age}</span>}
        </h2>
        <p className="mt-1.5 truncate text-[0.95rem] text-[var(--color-text-mid)]">{kase.subjectJobTitle || "Subject"}</p>
        <p className="mt-3 text-[0.95rem] leading-snug text-[var(--color-text-mid)]">
          {primary ? (
            <>
              <b className="font-medium text-[var(--color-text-hi)]">{primary.line1}</b>
              {addressLine ? `, ${addressLine}` : ""}
            </>
          ) : (
            <span className="text-[var(--color-text-lo)]">No address on file</span>
          )}
          <AreaChip value={area} onPick={(next) => void pickArea(next)} />
        </p>
        <p className="mt-1.5 truncate text-[0.95rem] text-[var(--color-text-mid)]">
          {kase.client?.company || "No client"}
          <span className="ml-2 inline-block rounded-full border border-[var(--color-line)] bg-[var(--color-accent-soft)] px-2.5 py-0.5 align-middle text-[0.75rem] text-[var(--color-accent)]">
            {SERVICE_LABELS[kase.service]}
          </span>
        </p>

        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
          <div className={slot}>
            <div className="text-[1.85rem] font-light leading-none tracking-tight text-[var(--color-text-hi)]">
              {eac ? eac.time : "—"}
              {eac && <small className="ml-2.5 text-[0.85rem] tracking-normal text-[var(--color-text-lo)]">{eac.date}</small>}
            </div>
            <div className="mt-1.5 text-[0.85rem] text-[var(--color-text-mid)]">earliest active · {worked} days observed</div>
          </div>

          <div className={slot}>
            <div className="eyebrow">Transport</div>
            <Line k="Mode" v={kase.subjectTransport ? transportLabel(kase.subjectTransport) : "Not set"} />
            {vehicles.length > 0 ? (
              vehicles.map((vehicle) => (
                <Line
                  key={vehicle.id}
                  k={[vehicle.color, vehicle.make, vehicle.model, vehicle.licensePlate].filter(Boolean).join(" · ") || "Vehicle"}
                  v={vehicle.registeredOwner || vehicle.personLinks?.[0]?.person.name || ""}
                />
              ))
            ) : (
              <p className="pt-1.5 text-[0.85rem] text-[var(--color-text-lo)]">No vehicles on file</p>
            )}
          </div>

          <div className={cn(slot, "shrink-0")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="eyebrow">Case summary</span>
              <button type="button" onClick={onRefresh} disabled={writing} className="text-[0.75rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] disabled:opacity-50">
                {writing ? "Writing…" : "Refresh"}
              </button>
            </div>
            <p className="max-h-[5.5rem] overflow-y-auto text-[0.9rem] leading-relaxed text-[var(--color-text-mid)]">
              {summary || "No case summary yet."}
            </p>
            {writeError && <p className="mt-1 text-[0.75rem] text-[var(--color-neg)]">{writeError}</p>}
          </div>

          <div className={cn(slot, "flex min-h-0 flex-1 flex-col")}>
            <div className="eyebrow mb-3">Notes</div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              {notes.length === 0 && <p className="text-[0.9rem] leading-relaxed text-[var(--color-text-lo)]">No investigator notes yet.</p>}
              {notes.map((item) => (
                <div key={item.id}>
                  <div className="text-[0.75rem] font-medium text-[var(--color-accent)]">{item.label}</div>
                  <p className="mt-1 line-clamp-3 text-[0.9rem] leading-relaxed text-[var(--color-text-mid)]">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-[34%] min-h-[9.5rem] shrink-0 gap-4">
          <div className="aspect-[4/3] h-full overflow-hidden rounded-[1.75rem] border border-[var(--color-line)]">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[3rem] font-light text-[var(--color-text-lo)]">{kase.subjectName.slice(0, 1)}</div>
            )}
          </div>
          <div className={cn(card, "flex min-w-0 flex-1 flex-col justify-center px-5 py-4")}>
            <div className="flex items-baseline gap-2">
              <span className="text-[1.85rem] font-light leading-none text-[var(--color-pos)]">{latestScore != null ? `${latestScore}%` : "—"}</span>
              <span className="text-[0.8rem] text-[var(--color-text-mid)]">{latest ? "latest comparison" : "no comparison yet"}</span>
            </div>
            <p className="mt-2 text-[0.85rem] text-[var(--color-text-mid)]">
              {eac ? `${eac.time} earliest active` : "Earliest active not set"} · {worked} days observed
            </p>
            <div className="mt-3 text-[1.65rem] font-light leading-none">{dueIn == null ? "—" : dueIn}</div>
            <div className="text-[0.72rem] text-[var(--color-text-lo)]">days to due</div>
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col justify-end gap-3">
          <div className={cn(card, "sky-inset flex shrink-0 flex-wrap items-center gap-2 px-5 py-3")}>
            {rows.length === 0 ? (
              <span className="text-[0.8rem] text-[var(--color-text-lo)]">Nothing scheduled yet</span>
            ) : (
              <>
                {weekdays > 0 && <Chip done>{weekdays} weekdays</Chip>}
                {weekend > 0 && <Chip done>{weekend} weekend {weekend === 1 ? "day" : "days"}</Chip>}
              </>
            )}
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {rows.length === 0 && <p className="px-1 text-[0.85rem] text-[var(--color-text-lo)]">Schedule a day to put someone on this case.</p>}
            {rows.map((row) => (
              <LedgerRow key={row.key} row={row} />
            ))}
            {canSchedule && <AddDayRow onClick={() => void openAdd()} />}
            {addError && <p className="px-1 text-[0.75rem] text-[var(--color-neg)]">{addError}</p>}
          </div>
          <div className="flex shrink-0 justify-end">
            <Legend />
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-5 overflow-hidden">
        <div className={cn(card, "flex min-h-0 flex-1 flex-col overflow-hidden p-5")}>
          <div className="eyebrow mb-4">Comparison history</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SkyComparisons caseId={kase.id} subjectPhotoUrl={kase.subjectPhotoUrl} records={records} />
          </div>
        </div>
        <div className={cn(card, "flex min-h-[9rem] flex-[0.85] flex-col p-5")}>
          <div className="eyebrow mb-3">Map</div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-[1.25rem]">
            <SkyMap addresses={kase.addresses} />
          </div>
        </div>
        <Places patterns={patterns} addresses={kase.addresses.filter((address) => !address.isPrimary)} compact />
      </aside>
      {flow && addDate && (
        <ScheduleAssignmentModal
          flow={flow}
          canManage={canSchedule}
          busy={saving}
          onClose={() => setFlow(null)}
          onDraftInvestigator={(userId) => {
            const draftInvestigator = flow.investigators.find((person) => person.id === userId);
            if (!draftInvestigator) return;
            setFlow({ ...flow, step: "notes", draftInvestigator, draftNotes: "" });
          }}
          onBackToPick={() => setFlow({ ...flow, step: "pick", draftInvestigator: undefined, draftNotes: "" })}
          onConfirmAssign={async (notes) => {
            if (!flow.draftInvestigator) return;
            setSaving(true);
            setAddError(null);
            try {
              await scheduleApi.create({
                caseId: kase.id,
                userId: flow.draftInvestigator.id,
                date: addDate,
                notes,
              });
              setFlow(null);
              onChanged();
            } catch (err) {
              setAddError(err instanceof ApiError ? err.message : "Could not schedule that day.");
              setFlow(null);
            } finally {
              setSaving(false);
            }
          }}
          onSaveNotes={async () => {}}
          onRemove={() => setFlow(null)}
          onGoToCase={() => navigate(`/cases/${kase.id}`)}
          dateValue={addDate}
          onDateChange={(iso) => {
            setAddDate(iso);
            const booked = new Set(kase.scheduleBlocks.filter((block) => dayKey(block.date) === iso).map((block) => block.user.id));
            setFlow((current) =>
              current
                ? {
                    ...current,
                    dayLabel: new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
                    excludeUserIds: booked,
                    step: "pick",
                    draftInvestigator: undefined,
                  }
                : current,
            );
          }}
        />
      )}
    </div>
  );
}

type ScheduleRow = {
  key: string;
  date: string;
  who: string;
  tone: { label: string; color: string };
  detail: string;
};

function nextOpenDate(rows: ScheduleRow[]): string {
  const last = rows.map((row) => dayKey(row.date)).sort().at(-1);
  const base = last ? new Date(`${last}T12:00:00`) : new Date();
  base.setDate(base.getDate() + 1);
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${base.getFullYear()}-${month}-${day}`;
}

function scheduleRows(kase: CaseDetail): ScheduleRow[] {
  const blocks = new Map<string, { names: string[]; note: string | null }>();
  for (const block of kase.scheduleBlocks) {
    const key = dayKey(block.date);
    const cur = blocks.get(key) ?? { names: [], note: null };
    const name = block.user.name.split(" ")[0];
    if (name && !cur.names.includes(name)) cur.names.push(name);
    if (!cur.note && block.notes) cur.note = block.notes;
    blocks.set(key, cur);
  }
  const dayBy = new Map(kase.days.map((day) => [dayKey(day.date), day]));
  return [...new Set([...blocks.keys(), ...dayBy.keys()])].sort().map((key) => {
    const day = dayBy.get(key);
    const sched = blocks.get(key);
    const hasNotes = !!day?.entries.some((entry) => entry.type === "note");
    const tone = toneOf(day?.awareness ?? null, hasNotes || !!day?.summary);
    const author = day?.entries.find((entry) => entry.author)?.author?.name.split(" ")[0];
    return {
      key: day?.id ?? key,
      date: day?.date ?? key,
      who: sched?.names.join(", ") || author || "Unassigned",
      tone,
      detail: sched?.note || "",
    };
  });
}

function investigatorNotes(kase: CaseDetail): { id: string; label: string; body: string }[] {
  const items: { id: string; label: string; body: string }[] = [];
  const ordered = [...kase.days].sort((a, b) => dayKey(b.date).localeCompare(dayKey(a.date)));
  for (const day of ordered) {
    const stamp = shortDay(day.date);
    const when = `${stamp.weekday} ${stamp.day}`;
    for (const entry of [...day.entries].reverse()) {
      if (entry.type === "note" && entry.body?.trim()) {
        items.push({
          id: entry.id,
          label: `${when}${entry.author?.name ? ` · ${entry.author.name}` : ""}`,
          body: entry.body.trim(),
        });
      }
    }
  }
  return items;
}

function scoreOf(record: ComparisonRecord | undefined): number | null {
  if (!record) return null;
  if (record.score != null) return Math.round(record.score);
  const parsed = Number(record.verdict.match(/(\d+(?:\.\d+)?)\s*%/)?.[1]);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function AddDayRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Add day"
      onClick={onClick}
      className={cn(
        card,
        "sky-inset sky-add relative grid shrink-0 place-items-center border-dashed border-[var(--color-line-2)] px-5 py-3 text-[var(--color-text-mid)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-hi)]",
      )}
    >
      <Plus size={18} strokeWidth={1.75} />
    </button>
  );
}

function SkyComparisons({
  caseId,
  subjectPhotoUrl,
  records,
}: {
  caseId: string;
  subjectPhotoUrl: string | null;
  records: ComparisonRecord[];
}) {
  if (records.length === 0) {
    return <p className="text-[0.9rem] leading-relaxed text-[var(--color-text-lo)]">No comparisons yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {records.map((record) => {
        const score = scoreOf(record);
        const color = score == null ? "var(--color-text-lo)" : score >= 80 ? "var(--color-pos)" : "var(--color-neg)";
        return (
          <div key={record.id} className="flex items-center justify-between gap-4">
            <CasePhoto
              caseId={caseId}
              photoUrl={record.subjectUrl || subjectPhotoUrl}
              className="h-[5.25rem] w-[5.25rem] rounded-[1.15rem]"
            />
            <span className="text-[1.85rem] font-light leading-none tabular-nums" style={{ color }}>
              {score != null ? `${score}%` : "—"}
            </span>
            <CasePhoto caseId={caseId} photoUrl={record.probeUrl} className="h-[5.25rem] w-[5.25rem] rounded-[1.15rem]" />
          </div>
        );
      })}
    </div>
  );
}

function LedgerRow({ row }: { row: ScheduleRow }) {
  const label = shortDay(row.date);
  return (
    <div className={cn(card, "sky-inset grid shrink-0 grid-cols-[4rem_minmax(0,1fr)_6.2rem_minmax(0,7rem)] items-center gap-3 px-5 py-3 text-[0.9rem]")}>
      <div className="text-[var(--color-text-mid)]">
        <b className="font-medium text-[var(--color-text-hi)]">{label.weekday}</b> {label.day}
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.tone.color }} />
        <span className="truncate">{row.who}</span>
      </div>
      <div className="font-medium" style={{ color: row.tone.color }}>
        {row.tone.label === "Aware" ? "Burned" : row.tone.label}
      </div>
      <div className="truncate text-right text-[0.8rem] text-[var(--color-text-lo)]">{row.detail}</div>
    </div>
  );
}

function Horizon({
  kase,
  patterns,
  writing,
  writeError,
  onRefresh,
}: {
  kase: CaseDetail;
  patterns: CasePattern[];
  writing: boolean;
  writeError: string | null;
  onRefresh: () => void;
}) {
  const days = useMemo(() => [...kase.days].sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date))), [kase.days]);
  const age = ageOf(kase.subjectDob);
  const dueIn = daysUntil(kase.dueDate);
  const eac = formatEarliestActive(kase.earliestActiveAt);

  return (
    <div className="flex flex-col gap-5 text-[var(--color-text-hi)]">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <h2 className="text-[3.4rem] font-light leading-[0.9] tracking-[-0.04em]">
          {kase.subjectName}
          {age != null && <span className="ml-3 align-middle text-[1.25rem] text-[var(--color-text-lo)]">{age}</span>}
        </h2>
        <div className="text-right text-[0.9rem] text-[var(--color-text-mid)]">
          <div>
            {kase.client?.company ?? "No client"}
            <span className="ml-2 rounded-full border border-[var(--color-line)] bg-[var(--color-accent-soft)] px-2 py-0.5 text-[0.7rem] text-[var(--color-accent)]">{SERVICE_LABELS[kase.service]}</span>
          </div>
          <div className="mt-2 text-[2rem] font-light leading-none">{dueIn == null ? "—" : dueIn}</div>
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--color-text-lo)]">days to due</div>
        </div>
      </div>

      <div className={cn(card, "px-6 py-6")}>
        <div className="relative flex min-h-[11rem] items-end gap-2 overflow-x-auto pb-2">
          <div className="pointer-events-none absolute bottom-10 left-0 right-0 h-px bg-[var(--color-line)]" />
          {days.length === 0 && <p className="text-[0.85rem] text-[var(--color-text-lo)]">No field days yet.</p>}
          {days.map((day) => {
            const label = shortDay(day.date);
            const tone = toneOf(day.awareness, day.entries.some((entry) => entry.type === "note"));
            return (
              <div key={day.id} className="relative z-[1] w-[6.5rem] shrink-0 text-center">
                <div
                  className="mx-auto h-8 w-8 rounded-full border border-[var(--color-line-2)]"
                  style={{ background: `radial-gradient(circle at 35% 30%, white, ${tone.color} 62%)`, boxShadow: `0 0 18px ${tone.color}` }}
                />
                <div className="mt-2 text-[0.8rem] font-medium">
                  {label.weekday} {label.day}
                </div>
                <div className="text-[0.68rem] uppercase tracking-wide" style={{ color: tone.color }}>
                  {tone.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Fact>
          <div className="text-[1.8rem] font-light leading-none">{eac ? `${eac.time}` : "—"}</div>
          <div className="mt-1 text-[0.8rem] text-[var(--color-text-mid)]">earliest active{eac ? ` · ${eac.date}` : ""}</div>
        </Fact>
        <Fact>
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Case summary</span>
            <button type="button" onClick={onRefresh} disabled={writing} className="text-[0.7rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] disabled:opacity-50">
              {writing ? "Writing…" : "Refresh"}
            </button>
          </div>
          <p className="text-[0.85rem] leading-relaxed text-[var(--color-text-mid)]">{kase.situationSummary?.trim() || "No case summary yet."}</p>
          {writeError && <p className="mt-1 text-[0.75rem] text-[var(--color-neg)]">{writeError}</p>}
        </Fact>
        <Places patterns={patterns} addresses={kase.addresses} />
      </div>
      <Legend />
    </div>
  );
}

function Places({
  patterns,
  addresses,
  compact = false,
}: {
  patterns: CasePattern[];
  addresses: { id: string; label: string | null; line1: string; city: string | null; state: string | null }[];
  compact?: boolean;
}) {
  const recorded = [
    ...patterns.map((pattern) => ({
      id: pattern.id,
      title: pattern.place || pattern.title,
      meta: pattern.whenLabel,
      detail: pattern.detail,
    })),
    ...addresses.map((address) => ({
      id: address.id,
      title: address.label || "Address",
      meta: "",
      detail: [address.line1, address.city, address.state].filter(Boolean).join(", "),
    })),
  ];
  const rows = recorded.slice(0, compact ? 3 : 5);
  return (
    <div className={cn(card, "shrink-0 overflow-hidden px-5 py-4 text-[0.85rem]")}>
      <div className="eyebrow mb-1">Known places</div>
      {rows.length === 0 && <p className="text-[var(--color-text-lo)]">None recorded.</p>}
      {rows.map((row) => (
        <div key={row.id} className="border-t border-[var(--color-line)] py-1.5 first:border-0 first:pt-0">
          <div className="flex justify-between gap-2">
            <span className="truncate font-medium text-[var(--color-text-hi)]">{row.title}</span>
            {row.meta && <span className="shrink-0 text-[0.72rem] text-[var(--color-text-lo)]">{row.meta}</span>}
          </div>
          {row.detail && <div className="truncate text-[0.78rem] text-[var(--color-text-mid)]">{row.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function AreaChip({ value, onPick }: { value: SubjectSetting | null; onPick: (next: SubjectSetting) => void }) {
  const [open, setOpen] = useState(false);
  const current = AREAS.find((area) => area.id === value);
  return (
    <span className="relative ml-1.5 inline-block align-middle">
      <button
        type="button"
        title="Suburban, rural, or densely populated"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[var(--color-line)] bg-[var(--color-ink-2)] px-2.5 py-0.5 text-[0.75rem]"
        style={{ color: current?.color ?? "var(--color-text-lo)" }}
      >
        {current?.label ?? "set area"}
      </button>
      {open && (
        <span className="surface absolute left-0 top-full z-20 mt-1 flex w-max flex-col rounded-xl border border-[var(--color-line)] p-1 shadow-lg">
          {AREAS.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => {
                onPick(area.id);
                setOpen(false);
              }}
              className="rounded-lg px-2.5 py-1 text-left text-[0.8rem] hover:bg-[var(--color-ink-3)]"
              style={{ color: area.color }}
            >
              {area.title}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function SkyMap({ addresses }: { addresses: CaseAddress[] }) {
  const key = addresses.map((address) => `${address.id}:${address.lat ?? ""}:${address.lng ?? ""}:${address.line1}`).join("|");
  const [resolved, setResolved] = useState(addresses);
  useEffect(() => {
    let cancel = false;
    setResolved(addresses);
    const missing = addresses.filter((address) => (address.lat == null || address.lng == null) && address.line1);
    if (missing.length === 0) return;
    void (async () => {
      const next = addresses.map((address) => ({ ...address }));
      for (const address of missing.slice(0, 5)) {
        try {
          const res = await geocodeApi.lookup({
            line1: address.line1,
            city: address.city ?? undefined,
            state: address.state ?? undefined,
            zip: address.zip ?? undefined,
          });
          if (!res.result || cancel) continue;
          const index = next.findIndex((item) => item.id === address.id);
          if (index >= 0) next[index] = { ...address, lat: res.result.lat, lng: res.result.lng };
        } catch {
          /* leave this address ungeocoded */
        }
      }
      if (!cancel) setResolved(next);
    })();
    return () => {
      cancel = true;
    };
  }, [key, addresses]);
  return <CaseMap addresses={resolved} frameClassName="rounded-[1.25rem] border-0" />;
}

function Fact({ children, hot = false }: { children: ReactNode; hot?: boolean }) {
  return (
    <div className={cn(card, "px-4 py-4", hot && "border-[var(--color-warn)]")}>{children}</div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-[var(--color-line)] py-1.5 text-[0.85rem] first:border-0">
      <span className="text-[var(--color-text-mid)]">{k}</span>
      <span className="text-right font-medium text-[var(--color-text-hi)]">{v}</span>
    </div>
  );
}

function Chip({ children, done = false, tone }: { children: ReactNode; done?: boolean; tone?: "med" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[0.78rem] font-medium",
        tone === "med" && "border-[var(--color-warn)] bg-[var(--color-ink-2)] text-[var(--color-warn)]",
        !tone && done && "border-[var(--color-pos)] text-[var(--color-pos)]",
        !tone && !done && "border-[var(--color-line)] text-[var(--color-text-lo)]",
      )}
    >
      {done ? "✓ " : ""}
      {children}
    </span>
  );
}

function Legend() {
  const items = [
    ["Active", TONE.active],
    ["Working", TONE.working],
    ["No activity", TONE.quiet],
    ["Noticed", TONE.noticed],
    ["Aware", TONE.burned],
  ] as const;
  return (
    <div className="flex flex-wrap justify-end gap-3 text-[0.72rem] text-[var(--color-text-mid)]">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          {label}
        </span>
      ))}
    </div>
  );
}
