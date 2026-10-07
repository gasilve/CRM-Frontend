import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScanFace } from "lucide-react";
import { CaseMap } from "@/components/case/CaseMap";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { ScheduleAssignmentModal, type AssignInvestigatorFlow } from "@/components/schedule/ScheduleAssignmentModal";
import {
  ApiError,
  casesApi,
  investigatorsApi,
  scheduleApi,
  type CaseDetail,
  type CaseVehicle,
  type InvestigatorListItem,
} from "@/lib/crm-api";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { useQuery } from "@/lib/query-cache";
import { prodigyCaseDetailFull } from "@/lib/prodigy-api";

const USE_PRODIGY = import.meta.env.VITE_USE_PRODIGY_BACKEND === "true";
import "./sky-v6.css";

const CX = 230;
const CY = 230;
const OUTER = 212;
const GAP = 3;

const NAV = [
  { label: "Case", title: "Case", color: "#3ee08a", path: (id: string) => `/cases/${id}` },
  { label: "Investigator view", title: "Investigator view", color: "#ffc857", path: (id: string) => `/cases/${id}/work` },
  { label: "Video", title: "Video Custody", color: "#b18cff", path: (id: string) => `/cases/${id}?tab=video` },
  { label: "Reports", title: "Reports", color: "#5aa9ff", path: (_id: string) => `/reports` },
  { label: "Back", title: "Back to cases", color: "#ff9f45", path: (_id: string) => `/cases` },
] as const;

const SETTING_LABEL = { suburban: "suburban", rural: "rural", dense: "densely populated" } as const;
const TRANSPORT_LABEL = { vehicle: "Drives", foot: "On foot", transit: "Transit", other: "Other" } as const;

const polar = (angle: number, radius: number): [number, number] => {
  const a = ((angle - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
};

const BAND_MID = 194;
const BAND_MID_HOVER = 201;

/** Arc through the middle of a segment. Stroke width grows around this line. */
const midArc = (a0: number, a1: number, radius: number) => {
  const [x0, y0] = polar(a0, radius);
  const [x1, y1] = polar(a1, radius);
  return `M${x0},${y0} A${radius},${radius} 0 0 1 ${x1},${y1}`;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function scheduleKey(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return localKey(new Date(iso));
}

function compareDateKeys(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return ay - by || am - bm || ad - bd;
}

function clock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ageYears(iso: string | null) {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  return {
    wd: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    n: d.getUTCDate(),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
  };
}

function shareLabel(vehicle: CaseVehicle) {
  const others = (vehicle.personLinks ?? []).filter((link) => !link.person.isSubject);
  if (others.length === 0) return "not shared";
  const rels = [...new Set(others.map((link) => link.person.relationship.replaceAll("_", " ")))];
  return `shared, ${rels.join(", ")}`;
}

function vehicleTitle(vehicle: CaseVehicle) {
  const name = [vehicle.color, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const plate = [vehicle.state, vehicle.licensePlate].filter(Boolean).join(" ");
  return [name || "Vehicle", plate].filter(Boolean).join(" · ");
}

type Face = { ok: boolean; score: number | null };

function faceFromEntries(entries: { type: string; meta: Record<string, unknown> | null }[]): Face {
  const scores = entries
    .filter((entry) => entry.type === "face_match")
    .map((entry) => entry.meta?.score)
    .filter((score): score is number => typeof score === "number");
  if (scores.length === 0) return { ok: false, score: null };
  const best = Math.max(...scores);
  return { ok: best >= 80, score: best };
}

function NavRing({ caseId, onGo }: { caseId: string; onGo: (path: string) => void }) {
  const seg = 360 / NAV.length;
  return (
    <svg viewBox="0 0 460 460" role="navigation" aria-label="Case pages">
      {NAV.map((item, index) => {
        const a0 = index * seg + GAP / 2;
        const a1 = (index + 1) * seg - GAP / 2;
        const mid = (a0 + a1) / 2;
        const [x, y] = polar(mid, OUTER + 20);
        const aim = ((mid - 90) * Math.PI) / 180;
        const path = item.path(caseId);
        return (
          <g key={item.label} className="nav-g" style={{ ["--seg" as string]: item.color }} onClick={() => onGo(path)}>
            <title>{item.title}</title>
            <path
              className="nav-seg"
              d={midArc(a0, a1, BAND_MID)}
              style={{
                ["--arc" as string]: `path("${midArc(a0, a1, BAND_MID)}")`,
                ["--arc-hot" as string]: `path("${midArc(a0, a1, BAND_MID_HOVER)}")`,
              }}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="dlab"
              style={{
                ["--nx" as string]: `${Math.cos(aim) * 18}px`,
                ["--ny" as string]: `${Math.sin(aim) * 18}px`,
              }}
            >
              {item.label.split(" ").map((line, index, lines) => (
                <tspan
                  key={line}
                  x={x}
                  dy={index === 0 ? (lines.length > 1 ? "-0.55em" : "0") : "1.15em"}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DayRow({
  row,
  onOpen,
  onRemove,
}: {
  row: LedgerRow;
  onOpen: (row: LedgerRow) => void;
  onRemove: (row: LedgerRow) => void;
}) {
  const label = dayLabel(row.key);
  const passed = compareDateKeys(row.key, localKey(new Date())) <= 0;
  const removable = !passed && !row.worked && (row.blockIds.length > 0 || !!row.openDayId);
  return (
    <div className="row-wrap">
      <div
        className={row.open ? "r open" : "r"}
        onClick={() => row.open && onOpen(row)}
        style={{ cursor: row.open ? "pointer" : "default" }}
      >
        <div className="d">
          <b>{label.wd}</b> {label.month} {label.n}
        </div>
        <div className="i">
          {row.dot && <i style={{ background: row.dot, color: row.dot }} />}
          {row.names}
        </div>
        <div className="o" style={{ color: row.color }}>{row.outcome}</div>
        <FaceMark face={row.face} />
      </div>
      {removable && (
        <button
          type="button"
          className="day-x"
          aria-label="Remove day"
          onClick={() => onRemove(row)}
        >
          ×
        </button>
      )}
    </div>
  );
}

type CompareShot = { url: string; score: number | null };

function comparisonShots(kase: CaseDetail): CompareShot[] {
  const scores = new Map<string, number>();
  const urls: string[] = [];
  const push = (url: string | null | undefined) => {
    if (!url || url === kase.subjectPhotoUrl || urls.includes(url)) return;
    urls.push(url);
  };
  for (const day of kase.days) {
    for (const entry of day.entries) {
      if (entry.type === "face_match" && typeof entry.meta?.score === "number") {
        const probe =
          (typeof entry.meta.probePhotoUrl === "string" && entry.meta.probePhotoUrl) || entry.photoUrl;
        if (probe) scores.set(probe, Math.max(scores.get(probe) ?? 0, entry.meta.score));
      }
      if (entry.photoUrl && (entry.type === "photo_person" || entry.type === "face_match")) push(entry.photoUrl);
    }
  }
  return urls
    .map((url) => ({ url, score: scores.get(url) ?? null }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

function ShotThumb({
  caseId,
  url,
  score,
  selected,
  onSelect,
}: {
  caseId: string;
  url: string;
  score: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const src = useCasePhoto(caseId, url);
  const tone = score == null ? "var(--ink2)" : score >= 80 ? "var(--active)" : "var(--burned)";
  return (
    <button type="button" className={selected ? "on" : ""} onClick={onSelect} aria-label="Select photo">
      {src && <img src={src} alt="" />}
      <span className="shot-score" style={{ color: tone }}>
        {score == null ? "—" : `${Math.round(score)}%`}
      </span>
    </button>
  );
}

function PhotoCompare({
  caseId,
  subjectUrl,
  shots,
}: {
  caseId: string;
  subjectUrl: string | null;
  shots: CompareShot[];
}) {
  const subject = useCasePhoto(caseId, subjectUrl);
  const [selected, setSelected] = useState("");
  const [split, setSplit] = useState<number | null>(null);
  const chosen = shots.find((shot) => shot.url === selected) ?? null;
  const shown = useCasePhoto(caseId, chosen?.url ?? subjectUrl);
  const hovering = split != null && !!chosen;
  const comparing = hovering && !!subject && !!shown;
  const verdict =
    !chosen || chosen.score == null ? "No facial comparison performed" : chosen.score >= 80 ? "Match" : "No match";
  const verdictColor = !chosen || chosen.score == null ? "var(--ink2)" : chosen.score >= 80 ? "var(--active)" : "var(--burned)";

  return (
    <div className="photo-row">
      <div
        className="photo"
        onMouseMove={(event) => {
          if (!chosen) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setSplit(Math.max(0, Math.min(rect.width, event.clientX - rect.left)));
        }}
        onMouseLeave={() => setSplit(null)}
      >
        {shown && <img src={shown} alt="" />}
        {comparing && (
          <img className="probe" src={subject} alt="" style={{ clipPath: `inset(0 0 0 ${split}px)` }} />
        )}
        {comparing && <div className="scan" style={{ left: split }} />}
        {hovering && (
          <>
            <div className="verdict" style={{ color: verdictColor }}>{verdict}</div>
            {chosen?.score != null && <div className="score" style={{ color: verdictColor }}>{Math.round(chosen.score)}%</div>}
          </>
        )}
      </div>
      {shots.length > 0 && (
        <div className="shots">
          {shots.map((shot) => (
            <ShotThumb
              key={shot.url}
              caseId={caseId}
              url={shot.url}
              score={shot.score}
              selected={shot.url === selected}
              onSelect={() => {
                setSelected(shot.url);
                setSplit(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FaceMark({ face }: { face: Face }) {
  return (
    <div className="face" style={{ color: face.ok ? "var(--active)" : "var(--burned)" }}>
      <ScanFace size={15} strokeWidth={1.8} />
      <span>{face.score == null ? "—" : `${Math.round(face.score)}%`}</span>
    </div>
  );
}

type LedgerRow = {
  key: string;
  names: string;
  open: boolean;
  openDayId?: string;
  blockIds: string[];
  outcome: string;
  color: string;
  dot: string | null;
  face: Face;
  /** Notes, photos, or an awareness answer — the day cannot be unscheduled. */
  worked: boolean;
};

type DaySection = { key: string; label: string; color: string; specialId?: string };

const ACTIVITY = new Set(["note", "manager_note", "photo_person", "photo_vehicle", "photo_home", "face_match"]);

function entryIsWork(entry: { type: string; body: string | null }) {
  return ACTIVITY.has(entry.type) || (entry.type === "qa" && !!entry.body?.trim());
}

function dayWasWorked(day: { awareness: string | null; entries: { type: string; body: string | null }[] } | undefined) {
  if (!day) return false;
  if (day.awareness) return true;
  return day.entries.some(entryIsWork);
}

function dayStatus(entries: { type: string; body: string | null }[] | undefined, awareness: string | null | undefined) {
  if (awareness === "aware") return { outcome: "Burned", color: "var(--burned)", dot: "var(--burned)" };
  if (awareness === "suspicious") return { outcome: "Noticed", color: "var(--noticed)", dot: "var(--noticed)" };
  const active = (entries ?? []).some(entryIsWork);
  if (active) return { outcome: "Active", color: "var(--active)", dot: "var(--active)" };
  return { outcome: "No activity", color: "var(--noact)", dot: "var(--noact)" };
}

function nextBirthdayKey(dobIso: string | null): string | null {
  if (!dobIso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dobIso);
  if (!match) return null;
  const now = new Date();
  let year = now.getFullYear();
  let key = `${year}-${match[2]}-${match[3]}`;
  if (compareDateKeys(key, localKey(now)) < 0) {
    year += 1;
    key = `${year}-${match[2]}-${match[3]}`;
  }
  return key;
}

function blankRow(key: string, day: CaseDetail["days"][number] | undefined): LedgerRow {
  return {
    key,
    names: "unassigned",
    open: true,
    blockIds: [],
    outcome: "Open",
    color: "var(--ink3)",
    dot: null,
    face: faceFromEntries(day?.entries ?? []),
    worked: dayWasWorked(day),
  };
}

function buildLedger(kase: CaseDetail): { rows: LedgerRow[]; sections: Map<string, DaySection> } {
  const byDay = new Map<string, LedgerRow>();
  const days = new Map(kase.days.map((day) => [scheduleKey(day.date), day]));
  const sections = new Map<string, DaySection>();

  const grouped = new Map<string, typeof kase.scheduleBlocks>();
  for (const block of kase.scheduleBlocks) {
    const key = scheduleKey(block.date);
    grouped.set(key, [...(grouped.get(key) ?? []), block]);
  }
  for (const [key, blocks] of grouped) {
    const day = days.get(key);
    const status = dayStatus(day?.entries, day?.awareness);
    byDay.set(key, {
      key,
      names: blocks.map((block) => block.user.name?.split(" ")[0] || "Investigator").join(", "),
      open: false,
      blockIds: blocks.map((block) => block.id),
      ...status,
      face: faceFromEntries(day?.entries ?? []),
      worked: dayWasWorked(day),
    });
  }

  for (const open of kase.openDays) {
    const key = scheduleKey(open.date);
    if (byDay.has(key)) continue;
    const day = days.get(key);
    byDay.set(key, { ...blankRow(key, day), openDayId: open.id });
  }

  const imeKeys = new Set<string>();
  if (kase.imeAt) {
    const exam = new Date(kase.imeAt);
    const examKey = localKey(exam);
    const window = [
      { key: addDays(examKey, -1), tag: "day before" },
      { key: examKey, tag: `IME ${clock(exam)}` },
      { key: addDays(examKey, 1), tag: "day after" },
    ];
    for (const slot of window) {
      imeKeys.add(slot.key);
      const existing = byDay.get(slot.key) ?? blankRow(slot.key, days.get(slot.key));
      byDay.set(slot.key, {
        ...existing,
        outcome: slot.tag,
        color: slot.key === examKey ? "var(--working)" : existing.color,
      });
      sections.set(slot.key, {
        key: "ime",
        label: "IME set — day before · exam · day after",
        color: "var(--working)",
      });
    }
  }

  const birthdayKey = nextBirthdayKey(kase.subjectDob);
  if (birthdayKey && !imeKeys.has(birthdayKey)) {
    const existing = byDay.get(birthdayKey);
    const row = existing ?? blankRow(birthdayKey, days.get(birthdayKey));
    if (row.open && row.outcome === "Open") {
      row.outcome = "Birthday";
      row.color = "#c084fc";
    }
    byDay.set(birthdayKey, row);
    sections.set(birthdayKey, { key: `birthday-${birthdayKey}`, label: "Birthday", color: "#c084fc" });
  } else if (birthdayKey && imeKeys.has(birthdayKey)) {
    for (const key of imeKeys) {
      const section = sections.get(key);
      if (section) section.label = "IME · birthday — day before · exam · day after";
    }
  }

  for (const special of kase.specialDates ?? []) {
    const key = scheduleKey(special.date);
    if (imeKeys.has(key)) continue;
    const existing = byDay.get(key);
    const row = existing ?? blankRow(key, days.get(key));
    if (row.open && (row.outcome === "Open" || row.outcome === "Birthday")) {
      row.outcome = special.name;
      row.color = special.color;
    }
    byDay.set(key, row);
    sections.set(key, { key: special.id, label: special.name, color: special.color, specialId: special.id });
  }

  const rows = [...byDay.values()].sort((a, b) => compareDateKeys(a.key, b.key));
  return { rows, sections };
}

export default function SkyViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const query = useQuery(id ? `case-detail:${id}` : null, () => USE_PRODIGY ? prodigyCaseDetailFull(id) : casesApi.get(id));
  const investigators = useQuery("investigators:list", () => investigatorsApi.list());
  const kase = query.data?.case;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIme, setEditingIme] = useState(false);
  const [imeDraft, setImeDraft] = useState("");
  const [flow, setFlow] = useState<AssignInvestigatorFlow | null>(null);
  const [assignDate, setAssignDate] = useState("");
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<LedgerRow | null>(null);

  const ledger = useMemo(() => (kase ? buildLedger(kase) : { rows: [], sections: new Map<string, DaySection>() }), [kase]);
  const rows = ledger.rows;
  const chunks = useMemo(() => {
    const groups: { section: DaySection | null; rows: LedgerRow[] }[] = [];
    for (const row of rows) {
      const section = ledger.sections.get(row.key) ?? null;
      const last = groups[groups.length - 1];
      const same = last && (section ? last.section?.key === section.key : last.section == null);
      if (same && last) last.rows.push(row);
      else groups.push({ section, rows: [row] });
    }
    return groups;
  }, [rows, ledger.sections]);

  const removeDay = async (row: LedgerRow) => {
    if (!kase || row.worked || compareDateKeys(row.key, localKey(new Date())) <= 0) return;
    setBusy(true);
    setError(null);
    setPendingRemove(null);
    try {
      if (row.blockIds.length > 0) {
        await Promise.all(row.blockIds.map((blockId) => scheduleApi.remove(blockId)));
      } else if (row.openDayId) {
        await casesApi.removeOpenDay(kase.id, row.openDayId);
      }
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that day.");
    } finally {
      setBusy(false);
    }
  };

  const createSpecial = async (input: { date: string; name: string; color: string }) => {
    if (!kase) return;
    setBusy(true);
    setError(null);
    try {
      await casesApi.addSpecialDate(kase.id, input);
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that date.");
    } finally {
      setBusy(false);
    }
  };

  const removeSpecial = async (specialId: string) => {
    if (!kase) return;
    setBusy(true);
    setError(null);
    try {
      await casesApi.removeSpecialDate(kase.id, specialId);
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that date.");
    } finally {
      setBusy(false);
    }
  };

  const saveIme = async (value: string | null) => {
    if (!kase) return;
    setBusy(true);
    setError(null);
    try {
      await casesApi.setIme(kase.id, value);
      setEditingIme(false);
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the exam.");
    } finally {
      setBusy(false);
    }
  };

  const addDay = async () => {
    if (!kase) return;
    const taken = [
      ...kase.scheduleBlocks.map((block) => scheduleKey(block.date)),
      ...kase.openDays.map((day) => scheduleKey(day.date)),
    ].sort(compareDateKeys);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    let date = taken.length > 0 ? addDays(taken[taken.length - 1], 1) : localKey(tomorrow);
    const used = new Set(taken);
    for (let i = 0; i < 120 && used.has(date); i++) date = addDays(date, 1);
    if (used.has(date)) {
      setError("No free day after the last one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await casesApi.addOpenDay(kase.id, date);
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the day.");
    } finally {
      setBusy(false);
    }
  };

  const openAssign = (row: LedgerRow) => {
    if (!kase || !row.open) return;
    const list = investigators.data?.investigators ?? [];
    const booked = new Set(
      kase.scheduleBlocks.filter((block) => scheduleKey(block.date) === row.key).map((block) => block.user.id),
    );
    setAssignDate(row.key);
    setOpenDayId(row.openDayId ?? null);
    setFlow({
      kind: "assign-investigator",
      step: "pick",
      kase,
      dayLabel: row.key,
      investigators: list,
      priorWork: [],
      excludeUserIds: booked,
      draftNotes: "",
    });
  };

  const remapOpenDay = async (next: string) => {
    if (!kase || next === assignDate) return;
    if (kase.scheduleBlocks.some((block) => scheduleKey(block.date) === next)) {
      setError("That day already has an investigator.");
      return;
    }
    const previous = assignDate;
    const previousId = openDayId;
    setAssignDate(next);
    setFlow((current) =>
      current?.kind === "assign-investigator" ? { ...current, dayLabel: next } : current,
    );
    setError(null);
    const existing = kase.openDays.find((day) => scheduleKey(day.date) === next);
    if (existing) {
      if (!previousId || existing.id === previousId) {
        setOpenDayId(existing.id);
        return;
      }
      setBusy(true);
      try {
        await casesApi.removeOpenDay(kase.id, previousId);
        setOpenDayId(existing.id);
        await query.refresh();
      } catch (err) {
        setAssignDate(previous);
        setFlow((current) =>
          current?.kind === "assign-investigator" ? { ...current, dayLabel: previous } : current,
        );
        setError(err instanceof ApiError ? err.message : "Could not move that day.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const { openDay } = await casesApi.addOpenDay(kase.id, next);
      if (previousId) await casesApi.removeOpenDay(kase.id, previousId);
      setOpenDayId(openDay.id);
      await query.refresh();
    } catch (err) {
      setAssignDate(previous);
      setFlow((current) =>
        current?.kind === "assign-investigator" ? { ...current, dayLabel: previous } : current,
      );
      setError(err instanceof ApiError ? err.message : "Could not move that day.");
    } finally {
      setBusy(false);
    }
  };

  const confirmAssign = async (notes: string | null) => {
    if (!kase || !flow?.draftInvestigator) return;
    setBusy(true);
    setError(null);
    try {
      await scheduleApi.create({
        caseId: kase.id,
        userId: flow.draftInvestigator.id,
        date: assignDate,
        notes,
      });
      if (openDayId) await casesApi.removeOpenDay(kase.id, openDayId).catch(() => {});
      setFlow(null);
      setOpenDayId(null);
      await query.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign that investigator.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  if (!kase) {
    return (
      <div className="sky-v6">
        <div className="page">
          <p className="occ">{query.error ?? "Loading case…"}</p>
        </div>
      </div>
    );
  }

  const primary = kase.addresses.find((item) => item.isPrimary) ?? kase.addresses[0];
  const address = primary
    ? [primary.line1, [primary.city, primary.state].filter(Boolean).join(", "), primary.zip].filter(Boolean).join(", ")
    : "No address on file";
  const homeListed = primary
    ? kase.patterns.some((pattern) => pattern.place?.toLowerCase().includes(primary.line1.toLowerCase()))
    : true;
  const knownPlaces = [
    ...(!homeListed && primary
      ? [{ id: `home-${primary.id}`, title: "Home", when: "Lives here", place: address }]
      : []),
    ...kase.patterns.map((pattern) => ({
      id: pattern.id,
      title: pattern.title,
      when: pattern.whenLabel,
      place: pattern.place,
    })),
  ];
  const age = ageYears(kase.subjectDob);
  const eat = kase.earliestActiveAt ? new Date(kase.earliestActiveAt) : null;
  const deploy = eat ? new Date(eat.getTime() - 60 * 60 * 1000) : null;
  const observed = kase.days.filter((day) => day.entries.length > 0).length;
  const exam = kase.imeAt ? new Date(kase.imeAt) : null;
  const remaining = exam ? exam.getTime() - Date.now() : null;
  const daysLeft = remaining == null ? null : Math.max(0, Math.floor(remaining / 86_400_000));
  const hoursLeft = remaining == null ? null : Math.max(0, Math.floor((remaining % 86_400_000) / 3_600_000));
  const until =
    exam == null
      ? null
      : remaining != null && remaining < 0
        ? "passed"
        : daysLeft === 0
          ? `in ${hoursLeft} hr${hoursLeft === 1 ? "" : "s"}`
          : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const weekdayCount = kase.scheduleBlocks.filter((block) => !dayLabel(scheduleKey(block.date)).weekend).length;
  const weekendCount = kase.scheduleBlocks.filter((block) => dayLabel(scheduleKey(block.date)).weekend).length;

  return (
    <div className="sky-v6">
      <div className="scene" aria-hidden>
        <div className="scene-fill">
          <div className="sky">
            <div className="orb o1" />
            <div className="orb o2" />
            <div className="orb o3" />
          </div>
          <div className="scrim" />
          <div className="grain" />
        </div>
      </div>

      <div className="page">
        <div>
          <div className="g id">
            <h1 className="name">
              {kase.subjectName}
              {age != null && <span>{age}</span>}
            </h1>
            {kase.subjectJobTitle && <p className="occ">{kase.subjectJobTitle}</p>}
            <p className="addr">
              <b>{address}</b>
              {kase.subjectSetting && <span className="cap d">{SETTING_LABEL[kase.subjectSetting]}</span>}
            </p>
            <p className="client">
              {kase.client?.company ?? "No client"}
              <span className="cap c">{SERVICE_LABELS[kase.service]}</span>
            </p>

            <div className="facts">
              <div className="fact">
                <div className="big">
                  {eat ? clock(eat) : "—"}
                  {deploy && <small>deploy {clock(deploy)}</small>}
                </div>
                earliest active time, {observed} day{observed === 1 ? "" : "s"} observed
              </div>

              <div className="fact">
                <div className="sec">Transport</div>
                {kase.subjectTransport && (
                  <div className="line">
                    <span>Mode</span>
                    <span>{TRANSPORT_LABEL[kase.subjectTransport]}</span>
                  </div>
                )}
                {kase.vehicles.length === 0 && <div className="line"><span>No vehicles on file</span><span /></div>}
                {kase.vehicles.map((vehicle) => (
                  <div className="line" key={vehicle.id}>
                    <span>{vehicleTitle(vehicle)}</span>
                    <span>{shareLabel(vehicle)}</span>
                  </div>
                ))}
              </div>

              {knownPlaces.length > 0 && (
                <div className="fact">
                  <div className="sec">Known places — returns to</div>
                  {knownPlaces.map((place) => (
                    <div className="pl" key={place.id}>
                      <span className="k">{place.title}</span>
                      <span className="t">{place.when}</span>
                      {place.place && <span className="a">{place.place}</span>}
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>

        <div className="center">
          <div className="wheel">
            <NavRing caseId={kase.id} onGo={(path) => navigate(path)} />
            <div className="core g">
              {editingIme ? (
                <form
                  className="ime-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveIme(imeDraft ? new Date(imeDraft).toISOString() : null);
                  }}
                >
                  <div className="ime-core">IME</div>
                  <input type="datetime-local" value={imeDraft} onChange={(event) => setImeDraft(event.target.value)} />
                  <button type="submit" className="btn" disabled={busy}>Save</button>
                  <button type="button" className="btn" onClick={() => setEditingIme(false)}>Cancel</button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setImeDraft(exam ? toLocalInput(exam.toISOString()) : "");
                    setEditingIme(true);
                  }}
                  style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }}
                >
                  <div className="ime-core">IME</div>
                  {exam ? (
                    <>
                      <div className="n">{exam.toLocaleDateString("en-US", { weekday: "short" })} {exam.getDate()}</div>
                      <div className="l">
                        {exam.toLocaleDateString("en-US", { month: "short" })} · {clock(exam)}
                        {until ? ` · ${until}` : ""}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="n">—</div>
                      <div className="l">Set exam</div>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="g assign">
            <div className="items">
              <span className="ai done">{weekdayCount} weekday{weekdayCount === 1 ? "" : "s"}</span>
              <span className="ai done">{weekendCount} weekend day{weekendCount === 1 ? "" : "s"}</span>
              {exam && (
                <span className="ai med">
                  IME <b>{exam.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</b> · before, day of, after
                </span>
              )}
            </div>
            <div className="rem">
              <div>
                <div className="n">{daysLeft ?? "—"}</div>
                <div className="l">days</div>
              </div>
              <div>
                <div className="n">{hoursLeft ?? "—"}</div>
                <div className="l">hours</div>
              </div>
            </div>
          </div>

          {error && <p className="occ">{error}</p>}

          {chunks.map((chunk, index) =>
            chunk.section ? (
              <div
                className="ime"
                key={`mark-${chunk.section.key}-${chunk.rows[0]?.key ?? index}`}
                style={{ ["--mark" as string]: chunk.section.color }}
              >
                <div className="ime-lab">
                  {chunk.section.label}
                  {chunk.section.specialId && (
                    <button type="button" className="x" aria-label="Remove special date" onClick={() => void removeSpecial(chunk.section!.specialId!)}>
                      ×
                    </button>
                  )}
                </div>
                {chunk.rows.map((row) => (
                  <DayRow key={row.key} row={row} onOpen={openAssign} onRemove={setPendingRemove} />
                ))}
              </div>
            ) : (
              <div className="ledger" key={`days-${chunk.rows[0]?.key ?? index}`}>
                {chunk.rows.map((row) => (
                  <DayRow key={row.key} row={row} onOpen={openAssign} onRemove={setPendingRemove} />
                ))}
              </div>
            ),
          )}
          <button type="button" className="r add-day" disabled={busy} aria-label="Add day" onClick={() => void addDay()}>
            +
          </button>
        </div>

        <div className="rail">
          <PhotoCompare caseId={kase.id} subjectUrl={kase.subjectPhotoUrl} shots={comparisonShots(kase)} />
          <div className="g idl">
            <div className="sec">Summary</div>
            <p className="sum">{kase.situationSummary?.trim() || "No case summary yet."}</p>
          </div>

          <div className="g stake">
            <div className="sec">Stakeout</div>
            <div className="stake-map">
              <CaseMap addresses={kase.addresses} frameClassName="h-full min-h-0 rounded-none border-0" />
            </div>
            <p className="wait">Home address. Stakeout positions are not placed yet.</p>
          </div>

        </div>
      </div>

      {pendingRemove && (
        <div className="confirm-layer">
          <button type="button" className="confirm-back" aria-label="Keep the day" onClick={() => setPendingRemove(null)} />
          <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="remove-day-title">
            <h2 id="remove-day-title">Remove this day?</h2>
            <p>
              {dayLabel(pendingRemove.key).wd} {dayLabel(pendingRemove.key).month} {dayLabel(pendingRemove.key).n} will leave the schedule.
              The field record stays.
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setPendingRemove(null)}>Keep</button>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void removeDay(pendingRemove)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {flow && (
        <ScheduleAssignmentModal
          flow={flow}
          canManage
          busy={busy}
          dateValue={assignDate}
          onDateChange={(iso) => void remapOpenDay(iso)}
          onCreateSpecial={createSpecial}
          onClose={() => setFlow(null)}
          onDraftInvestigator={(userId) => {
            const draftInvestigator = flow.investigators.find((person: InvestigatorListItem) => person.id === userId);
            if (!draftInvestigator) return;
            setFlow({ ...flow, step: "notes", draftInvestigator, draftNotes: "" });
          }}
          onBackToPick={() => setFlow({ ...flow, step: "pick", draftInvestigator: undefined, draftNotes: "" })}
          onConfirmAssign={confirmAssign}
          onSaveNotes={async () => {}}
          onRemove={() => setFlow(null)}
          onGoToCase={() => navigate(`/cases/${kase.id}`)}
        />
      )}
    </div>
  );
}
