import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Maximize2, ScanFace } from "lucide-react";
import { VideoUploadModal } from "@/components/cases/video-upload/VideoUploadModal";
import { StakeoutMapModal } from "@/components/stakeout/StakeoutMapModal";
import { StakeoutMiniMap } from "@/components/stakeout/StakeoutMiniMap";
import { loadStakeoutPlan } from "@/components/stakeout/building-footprints";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { useAuth } from "@/contexts/AuthContext";
import { ScheduleAssignmentModal, type AssignInvestigatorFlow } from "@/components/schedule/ScheduleAssignmentModal";
import {
  ApiError,
  casesApi,
  investigatorsApi,
  scheduleApi,
  stakeoutApi,
  type CaseDetail,
  type CaseVehicle,
  type InvestigatorListItem,
  type StakeoutPosition,
} from "@/lib/crm-api";
import { SERVICE_LABELS } from "@/lib/mock-data";
import { ageFromDob, calendarDateKey } from "@/lib/dates";
import { useQuery } from "@/lib/query-cache";
import { SkyFieldPop, useSkyFieldPop, type SkyEditor, type SkyFieldRequest, type SkyFields, type SkyMenuAction } from "@/components/cases/SkyFieldMenu";
import { MOBILITY_CHOICES, MobilityMark } from "@/components/cases/SubjectMobility";
import SkyCaseFile from "@/components/cases/SkyCaseFile";
import "./sky-modal.css";
import "./sky-v6.css";

const CX = 230;
const CY = 230;
const OUTER = 212;
const GAP = 3;

const NAV = [
  { label: "Case", title: "Case details", color: "#3ee08a", details: true },
  { label: "Investigator view", title: "Investigator view", color: "#ffc857", path: (id: string) => `/cases/${id}/work` },
  { label: "Video", title: "Video", color: "#b18cff", video: true },
  { label: "Reports", title: "Reports", color: "#5aa9ff", path: (_id: string) => `/reports` },
  { label: "Back", title: "Back to cases", color: "#ff9f45", path: (_id: string) => `/cases` },
] as const;

const SETTING_LABEL = { suburban: "suburban", rural: "rural", dense: "densely populated" } as const;

type SkyFieldId =
  | "name"
  | "age"
  | "work"
  | "address"
  | "area"
  | "client"
  | "service"
  | "eat"
  | "transport"
  | "vehicle"
  | "place"
  | "photo"
  | "ime"
  | "due"
  | "summary";

const CASE_FIELDS = new Set<SkyFieldId>(["name", "age", "work", "address", "client", "service", "due"]);

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

function eatClock(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eatTimeValue(d: Date | null) {
  if (!d) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** EAT is a clock time. Keep the stored day if there is one; otherwise use today. */
function eatInstant(existing: Date | null, hhmm: string): string | null {
  if (!hhmm) return null;
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const base = existing ? new Date(existing.getTime()) : new Date();
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

function ageYears(iso: string | null) {
  const key = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!key) return null;
  const age = ageFromDob(`${key[1]}-${key[2]}-${key[3]}`);
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

/** End of the case window: the due date, or the open date plus the allotted days. */
function caseDeadline(kase: CaseDetail): Date | null {
  const dueKey = kase.dueDate ? calendarDateKey(kase.dueDate) : null;
  if (dueKey) {
    const [year, month, day] = dueKey.split("-").map(Number);
    return new Date(year, month - 1, day + 1);
  }
  if (kase.daysAllotted != null && kase.dateOpened) {
    const openKey = calendarDateKey(kase.dateOpened);
    if (!openKey) return null;
    const [year, month, day] = openKey.split("-").map(Number);
    return new Date(year, month - 1, day + kase.daysAllotted);
  }
  return null;
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

function NavRing({
  caseId,
  detailsOn,
  onGo,
  onVideo,
  onDetails,
}: {
  caseId: string;
  detailsOn: boolean;
  onGo: (path: string) => void;
  onVideo: () => void;
  onDetails: () => void;
}) {
  const seg = 360 / NAV.length;
  return (
    <svg viewBox="0 0 460 460" role="navigation" aria-label="Case pages">
      {NAV.map((item, index) => {
        const a0 = index * seg + GAP / 2;
        const a1 = (index + 1) * seg - GAP / 2;
        const mid = (a0 + a1) / 2;
        const [x, y] = polar(mid, OUTER + 20);
        const aim = ((mid - 90) * Math.PI) / 180;
        const openDetails = "details" in item;
        return (
          <g
            key={item.label}
            className={openDetails && detailsOn ? "nav-g on" : "nav-g"}
            style={{ ["--seg" as string]: item.color }}
            onClick={() => {
              if ("details" in item) onDetails();
              else if ("video" in item) onVideo();
              else onGo(item.path(caseId));
            }}
          >
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

function CompareShotThumb({ caseId, url }: { caseId: string; url: string | null }) {
  const src = useCasePhoto(caseId, url);
  return <span className="cmp-shot">{src ? <img src={src} alt="" /> : null}</span>;
}

function CompareDetails({
  caseId,
  kase,
  onClose,
}: {
  caseId: string;
  kase: CaseDetail;
  onClose: () => void;
}) {
  const records = kase.days
    .flatMap((day) => day.entries)
    .filter((entry) => entry.type === "face_match")
    .map((entry) => {
      const meta = entry.meta ?? {};
      const text = (value: unknown) => (typeof value === "string" ? value : null);
      return {
        id: entry.id,
        score: typeof meta.score === "number" ? meta.score : null,
        verdict: text(meta.verdict) ?? entry.body ?? "—",
        when: entry.createdAt,
        author: entry.author?.name ?? null,
        subjectUrl: text(meta.subjectPhotoUrl) ?? kase.subjectPhotoUrl,
        probeUrl: text(meta.probePhotoUrl) ?? entry.photoUrl,
      };
    })
    .sort((a, b) => b.when.localeCompare(a.when));

  return (
    <div className="confirm-layer">
      <button type="button" className="confirm-back" aria-label="Close comparison details" onClick={onClose} />
      <div className="confirm compare-sheet" role="dialog" aria-modal="true" aria-labelledby="compare-details-title">
        <h2 id="compare-details-title">Visual comparison</h2>
        {records.length === 0 ? (
          <p>No comparison yet.</p>
        ) : (
          <div className="cmp-list">
            {records.map((record) => {
              const match = record.verdict.toUpperCase().startsWith("MATCH");
              return (
                <div className="cmp-row" key={record.id}>
                  <CompareShotThumb caseId={caseId} url={record.subjectUrl} />
                  <CompareShotThumb caseId={caseId} url={record.probeUrl} />
                  <div className="cmp-copy">
                    <b style={{ color: match ? "var(--active)" : "var(--burned)" }}>{record.verdict}</b>
                    <span>
                      {record.score == null ? "No score" : `${Math.round(record.score)}%`}
                      {" · "}
                      {new Date(record.when).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {record.author ? ` · ${record.author}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="confirm-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
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
    <div className={shots.length === 0 ? "photo-row solo" : "photo-row"}>
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

function stakeoutSummary(positions: StakeoutPosition[], suggestions: number, planning: boolean) {
  const parts: string[] = [];
  if (positions.length) {
    const live = positions.filter((p) => p.status === "actual").length;
    const best = Math.max(...positions.map((p) => p.score ?? 0));
    parts.push(`${positions.length} saved spot${positions.length === 1 ? "" : "s"}`);
    if (live) parts.push(`${live} in use`);
    if (best > 0) parts.push(`best ${best}/100`);
  }
  if (suggestions) parts.push(`${suggestions} suggested`);
  else if (planning) parts.push("Finding spots…");
  return parts.length ? parts.join(" · ") : "Home address. Expand the map to plan the stakeout.";
}

/**
 * Unitless scale numbers for the 1101-1860px layout (see sky-v6.css). Computed
 * in JS because CSS typed division (1rem / 16px) is unsupported in many
 * browsers, which collapsed the page and left only the background visible.
 */
function useSkyScale() {
  const [vars, setVars] = useState<CSSProperties>({});
  const cleanup = useRef<(() => void) | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    const host = node?.parentElement;
    if (!host) return;
    const update = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const byWidth = rem / 16;
      const byHeight = Math.max(0.1, (host.clientHeight - 8) / 1080);
      const fit = Math.min(byWidth, byHeight);
      setVars({ ["--sky-w" as string]: byWidth, ["--sky-fit" as string]: fit } as CSSProperties);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    window.addEventListener("resize", update);
    cleanup.current = () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return { ref, vars };
}

export default function SkyViewPage() {
  const { id = "" } = useParams();
  const sky = useSkyScale();
  const navigate = useNavigate();
  const { user, can, canAny } = useAuth();
  const query = useQuery(id ? `case:${id}:sky` : null, () => casesApi.get(id, { view: "sky" }), {
    staleMs: 60_000,
  });
  const investigators = useQuery("investigators:list", () => investigatorsApi.list(), {
    staleMs: 5 * 60_000,
  });
  const kase = query.data?.case;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldPop = useSkyFieldPop();
  const canEditCase = can("cases.edit");
  const canCaptureFields = canAny("cases.edit", "cases.work", "cases.journal.write");
  const [flow, setFlow] = useState<AssignInvestigatorFlow | null>(null);
  const [assignDate, setAssignDate] = useState("");
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<LedgerRow | null>(null);
  const [designsOpen, setDesignsOpen] = useState(false);
  const [stakeoutOpen, setStakeoutOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailsOn, setDetailsOn] = useState(false);
  // The file stays mounted through its exit. Skyview only comes back once that exit has finished.
  const [boardShown, setBoardShown] = useState(false);
  const [fileLeaving, setFileLeaving] = useState(false);
  // Same cache key as the case screen, so a visit there makes this instant.
  const detailQuery = useQuery(id && boardShown ? `case:${id}` : null, () => casesApi.get(id), {
    staleMs: 60_000,
  });
  const pageRef = useRef<HTMLDivElement>(null);
  const toggleDetails = () => {
    if (fileLeaving) return;
    if (!detailsOn) {
      pageRef.current?.parentElement?.scrollTo({ top: 0 });
      setDetailsOn(true);
      return;
    }
    setFileLeaving(true);
  };
  useEffect(() => {
    if (!detailsOn) {
      setBoardShown(false);
      setFileLeaving(false);
      return;
    }
    setBoardShown(true);
  }, [detailsOn]);
  useEffect(() => {
    if (!fileLeaving) return;
    const timer = window.setTimeout(() => setDetailsOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [fileLeaving]);
  const portraitInput = useRef<HTMLInputElement>(null);
  const stakeouts = useQuery(id ? `case:${id}:stakeout` : null, () => stakeoutApi.list(id), {
    staleMs: 60_000,
  });
  const stakeoutPositions = useMemo(() => stakeouts.data?.positions ?? [], [stakeouts.data]);
  // Plan hits Overpass/Mapbox after the case paints — do not contend with the critical path.
  const [planReady, setPlanReady] = useState(false);
  useEffect(() => {
    if (!id || !query.data?.case) return;
    const t = window.setTimeout(() => setPlanReady(true), 400);
    return () => window.clearTimeout(t);
  }, [id, query.data?.case]);
  const stakeoutPlan = useQuery(
    planReady && id ? `case:${id}:stakeout-plan` : null,
    () => loadStakeoutPlan(id!),
    { staleMs: 5 * 60_000 },
  );
  const [stakeoutShown, setStakeoutShown] = useState(0);
  const stakeoutHome = useMemo(() => {
    const addresses = kase?.addresses ?? [];
    const home = addresses.find((a) => a.isPrimary && a.lat != null) ?? addresses.find((a) => a.lat != null);
    return home?.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng } : null;
  }, [kase?.addresses]);

  const videoFieldDays = useMemo(() => {
    const byDay = new Map<string, Set<string>>();
    for (const block of kase?.scheduleBlocks ?? []) {
      const day = block.date.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? new Set()).add(block.user.name));
    }
    return [...byDay].map(([day, names]) => ({ day, names: [...names] }));
  }, [kase?.scheduleBlocks]);
  const videoRecipients = useMemo(
    () => (kase?.adjusterEmail ? [{ role: kase.client?.company ? `Adjuster · ${kase.client.company}` : "Adjuster", name: kase.adjusterName, email: kase.adjusterEmail }] : []),
    [kase?.adjusterEmail, kase?.adjusterName, kase?.client],
  );

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
    const failed = !!query.error;
    return (
      <div className="sky-v6">
        <div className="sky-v6-scale" ref={sky.ref} style={sky.vars}>
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

          <div className="page sky-skel" role="status" aria-live="polite" aria-busy={!failed}>
            <div className="g id sky-skel-panel">
              <div className="sky-skel-bar sky-skel-name" />
              <div className="sky-skel-bar sky-skel-line" />
              <div className="sky-skel-bar sky-skel-line short" />
              <div className="sky-skel-facts">
                <div className="sky-skel-bar sky-skel-block" />
                <div className="sky-skel-bar sky-skel-block" />
                <div className="sky-skel-bar sky-skel-block" />
              </div>
            </div>

            <div className="center sky-skel-center">
              <div className="sky-skel-wheel g" aria-hidden />
              <div className="g sky-skel-panel sky-skel-assign">
                <div className="sky-skel-bar sky-skel-line" />
                <div className="sky-skel-bar sky-skel-line short" />
              </div>
              {[0, 1, 2, 3].map((row) => (
                <div className="sky-skel-bar sky-skel-row" key={row} />
              ))}
              <div className="sky-skel-status">
                <div className="sky-skel-beam" aria-hidden>
                  <span />
                </div>
                <p>{failed ? query.error : "Loading case"}</p>
              </div>
            </div>

            <div className="rail sky-skel-rail">
              <div className="g sky-skel-panel sky-skel-photo" />
              <div className="g sky-skel-panel">
                <div className="sky-skel-bar sky-skel-line" />
                <div className="sky-skel-bar sky-skel-line" />
                <div className="sky-skel-bar sky-skel-line short" />
              </div>
              <div className="g sky-skel-panel sky-skel-map" />
            </div>
          </div>
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
  const nameWords = kase.subjectName.trim().split(/\s+/).filter(Boolean);
  const nameLast = nameWords.pop() ?? "";
  const nameLead = nameWords.join(" ");
  const eat = kase.earliestActiveAt ? new Date(kase.earliestActiveAt) : null;
  const exam = kase.imeAt ? new Date(kase.imeAt) : null;
  const examRemaining = exam ? exam.getTime() - Date.now() : null;
  const examDays = examRemaining == null ? null : Math.max(0, Math.floor(examRemaining / 86_400_000));
  const examHours = examRemaining == null ? null : Math.max(0, Math.floor((examRemaining % 86_400_000) / 3_600_000));
  const until =
    exam == null
      ? null
      : examRemaining != null && examRemaining < 0
        ? "passed"
        : examDays === 0
          ? `in ${examHours} hr${examHours === 1 ? "" : "s"}`
          : `in ${examDays} day${examDays === 1 ? "" : "s"}`;
  const deadline = caseDeadline(kase);
  const caseRemaining = deadline ? deadline.getTime() - Date.now() : null;
  const daysLeft = caseRemaining == null ? null : Math.max(0, Math.floor(caseRemaining / 86_400_000));
  const hoursLeft = caseRemaining == null ? null : Math.max(0, Math.floor((caseRemaining % 86_400_000) / 3_600_000));
  const weekdayCount = kase.scheduleBlocks.filter((block) => !dayLabel(scheduleKey(block.date)).weekend).length;
  const weekendCount = kase.scheduleBlocks.filter((block) => dayLabel(scheduleKey(block.date)).weekend).length;

  const editable = (id: SkyFieldId) => {
    if (id === "photo") return true;
    if (id === "place") return canCaptureFields || canEditCase;
    return CASE_FIELDS.has(id) ? canEditCase : canCaptureFields;
  };
  const editClass = (id: SkyFieldId, base = "") => [base, editable(id) ? "sky-edit" : ""].filter(Boolean).join(" ");

  const persist = (patch: (current: CaseDetail) => CaseDetail, work: () => Promise<unknown>) => {
    const snapshot = query.data;
    if (snapshot) query.mutate({ case: patch(snapshot.case) });
    void (async () => {
      try {
        await work();
        void query.refresh();
      } catch (err) {
        if (snapshot) query.mutate(snapshot);
        setError(err instanceof Error ? err.message : "Could not save that.");
      }
    })();
  };

  const uploadPortrait = async (file: File) => {
    const preview = URL.createObjectURL(file);
    const snapshot = query.data;
    if (snapshot) query.mutate({ case: { ...snapshot.case, subjectPhotoUrl: preview } });
    try {
      const uploaded = await casesApi.uploadCapturePhoto(kase.id, file);
      await casesApi.update(kase.id, { subjectPhotoUrl: uploaded.url });
      await query.refresh();
      URL.revokeObjectURL(preview);
    } catch (err) {
      URL.revokeObjectURL(preview);
      if (snapshot) query.mutate(snapshot);
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    }
  };

  const openField = (event: ReactMouseEvent, id: SkyFieldId, direct = false) => {
    if (id === "photo") {
      const actions: SkyMenuAction[] = [];
      if (canEditCase) {
        actions.push({
          id: "upload",
          label: "Upload image",
          mark: "image",
          onRun: () => portraitInput.current?.click(),
        });
      }
      actions.push({
        id: "compare",
        label: "Visual comparison details",
        mark: "compare",
        onRun: () => setCompareOpen(true),
      });
      fieldPop.open(event, { title: "Image", actions });
      return;
    }
    if (!editable(id)) return;
    const blank = "";
    let request: SkyFieldRequest;
    const addressEditor = (): SkyEditor => ({
      kind: "address",
      title: "Address",
      line1: primary?.line1 ?? blank,
      city: primary?.city ?? blank,
      state: primary?.state ?? blank,
      zip: primary?.zip ?? blank,
    });
    const saveAddress = async (fields: SkyFields) => {
      const line1 = fields.line1.trim();
      if (!line1) throw new Error("A street address is required.");
      const body = {
        line1,
        city: fields.city.trim(),
        state: fields.state.trim(),
        zip: fields.zip.trim(),
        isPrimary: true,
      };
      const next = {
        id: primary?.id ?? `temp-address-${Date.now()}`,
        label: primary?.label ?? null,
        line1,
        city: body.city || null,
        state: body.state || null,
        zip: body.zip || null,
        lat: primary?.lat ?? null,
        lng: primary?.lng ?? null,
        isPrimary: true,
      };
      persist(
        (current) => ({
          ...current,
          addresses: primary
            ? current.addresses.map((item) => (item.id === primary.id ? { ...item, ...next } : { ...item, isPrimary: false }))
            : [next, ...current.addresses],
        }),
        () => (primary ? casesApi.updateAddress(kase.id, primary.id, body) : casesApi.addAddress(kase.id, body)),
      );
    };
    const clearAddress = primary
      ? async () => {
          persist(
            (current) => ({ ...current, addresses: current.addresses.filter((item) => item.id !== primary.id) }),
            () => casesApi.deleteAddress(kase.id, primary.id),
          );
        }
      : undefined;

    if (id === "name" || id === "age") {
      const dobKey = kase.subjectDob ? calendarDateKey(kase.subjectDob) ?? blank : blank;
      request = {
        title: "Subject",
        actions: [
          {
            id: "name",
            label: "Name",
            editor: { kind: "text", title: "Subject name", value: kase.subjectName, required: true },
            onSave: async (fields) => {
              const subjectName = fields.value.trim();
              if (!subjectName) throw new Error("A subject name is required.");
              persist((current) => ({ ...current, subjectName }), () => casesApi.update(kase.id, { subjectName }));
            },
          },
          {
            id: "age",
            label: "Age",
            editor: { kind: "date", title: "Date of birth", value: dobKey },
            onSave: async (fields) => {
              const subjectDob = fields.value ? `${fields.value}T00:00:00.000Z` : null;
              persist((current) => ({ ...current, subjectDob }), () => casesApi.update(kase.id, { subjectDob: fields.value || null }));
            },
            onClear: kase.subjectDob
              ? async () => {
                  persist((current) => ({ ...current, subjectDob: null }), () => casesApi.update(kase.id, { subjectDob: null }));
                }
              : undefined,
          },
        ],
      };
    } else if (id === "work") {
      request = {
        title: "Work",
        editor: { kind: "text", title: "Work", value: kase.subjectJobTitle ?? blank, placeholder: "Job title" },
        onSave: async (fields) => {
          const subjectJobTitle = fields.value.trim();
          persist((current) => ({ ...current, subjectJobTitle }), () => casesApi.update(kase.id, { subjectJobTitle }));
        },
        onClear: kase.subjectJobTitle
          ? async () => {
              persist((current) => ({ ...current, subjectJobTitle: "" }), () => casesApi.update(kase.id, { subjectJobTitle: "" }));
            }
          : undefined,
      };
    } else if (id === "address") {
      request = {
        title: "Address",
        editor: addressEditor(),
        onSave: saveAddress,
        onClear: clearAddress,
      };
    } else if (id === "area") {
      request = {
        title: "Area",
        editor: {
          kind: "choice",
          title: "Area",
          value: kase.subjectSetting ?? blank,
          emptyLabel: "Not set",
          options: (Object.entries(SETTING_LABEL) as [keyof typeof SETTING_LABEL, string][]).map(([value, label]) => ({ value, label })),
        },
        onSave: async (fields) => {
          const subjectSetting = fields.value ? (fields.value as typeof kase.subjectSetting) : null;
          persist(
            (current) => ({ ...current, subjectSetting }),
            () => casesApi.setSubjectSetting(kase.id, subjectSetting),
          );
        },
        onClear: kase.subjectSetting
          ? async () => {
              persist((current) => ({ ...current, subjectSetting: null }), () => casesApi.setSubjectSetting(kase.id, null));
            }
          : undefined,
      };
    } else if (id === "client") {
      request = {
        title: "Client",
        editor: { kind: "client", title: "Client", value: kase.clientId ?? blank },
        onSave: async (fields) => {
          const clientId = fields.value || null;
          persist(
            (current) => ({
              ...current,
              clientId,
              client: clientId ? { id: clientId, company: fields.label || "Client" } : null,
            }),
            () => casesApi.update(kase.id, { clientId }),
          );
        },
        onClear: kase.clientId
          ? async () => {
              persist(
                (current) => ({ ...current, clientId: null, client: null }),
                () => casesApi.update(kase.id, { clientId: null }),
              );
            }
          : undefined,
      };
    } else if (id === "service") {
      request = {
        title: "Type",
        editor: {
          kind: "choice",
          title: "Case type",
          value: kase.service,
          options: (Object.entries(SERVICE_LABELS) as [typeof kase.service, string][]).map(([value, label]) => ({ value, label })),
        },
        onSave: async (fields) => {
          const service = fields.value as typeof kase.service;
          persist((current) => ({ ...current, service }), () => casesApi.update(kase.id, { service }));
        },
      };
    } else if (id === "eat") {
      request = {
        title: "EAT",
        editor: { kind: "time", title: "Earliest active time", value: eatTimeValue(eat) },
        onSave: async (fields) => {
          const earliestActiveAt = eatInstant(eat, fields.value);
          if (fields.value && !earliestActiveAt) throw new Error("Pick a time.");
          persist(
            (current) => ({ ...current, earliestActiveAt }),
            () => casesApi.setEarliestActive(kase.id, earliestActiveAt),
          );
        },
        onClear: eat
          ? async () => {
              persist(
                (current) => ({ ...current, earliestActiveAt: null }),
                () => casesApi.setEarliestActive(kase.id, null),
              );
            }
          : undefined,
      };
    } else if (id === "transport" || id === "vehicle") {
      const blankVehicle = (): SkyEditor => ({
        kind: "vehicle",
        title: "New vehicle",
        color: blank,
        year: blank,
        make: blank,
        model: blank,
        plate: blank,
        plateState: blank,
      });
      const saveVehicle = (existing: CaseVehicle | null, fields: SkyFields) => {
        const yearText = fields.year.trim();
        const year = yearText ? Number(yearText) : null;
        if (yearText && !Number.isInteger(year)) throw new Error("Year should be a number.");
        const body = {
          color: fields.color.trim(),
          year,
          make: fields.make.trim(),
          model: fields.model.trim(),
          licensePlate: fields.plate.trim(),
          state: fields.plateState.trim(),
        };
        const next: CaseVehicle = {
          id: existing?.id ?? `temp-vehicle-${Date.now()}`,
          make: body.make || null,
          model: body.model || null,
          year,
          color: body.color || null,
          licensePlate: body.licensePlate || null,
          state: body.state || null,
          vin: existing?.vin ?? null,
          photoUrl: existing?.photoUrl ?? null,
          notes: existing?.notes ?? null,
          registeredOwner: existing?.registeredOwner ?? null,
          seatCount: existing?.seatCount ?? 5,
          kind: existing?.kind ?? "subject",
          personLinks: existing?.personLinks,
        };
        persist(
          (current) => ({
            ...current,
            vehicles: existing
              ? current.vehicles.map((item) => (item.id === existing.id ? { ...item, ...next } : item))
              : [...current.vehicles, next],
          }),
          () => (existing ? casesApi.updateVehicle(kase.id, existing.id, body) : casesApi.addVehicle(kase.id, body)),
        );
      };
      const vehicleEditor = (existing: CaseVehicle): SkyEditor => ({
        kind: "vehicle",
        title: vehicleTitle(existing),
        color: existing.color ?? blank,
        year: existing.year != null ? String(existing.year) : blank,
        make: existing.make ?? blank,
        model: existing.model ?? blank,
        plate: existing.licensePlate ?? blank,
        plateState: existing.state ?? blank,
      });
      const actions: SkyMenuAction[] = [
        {
          id: "mode",
          label: "Mode",
          editor: {
            kind: "choice",
            title: "Mode",
            value: kase.subjectTransport ?? blank,
            emptyLabel: "Not set",
            options: MOBILITY_CHOICES.map((choice) => ({ value: choice.value, label: choice.label })),
          },
          onSave: async (fields) => {
            const subjectTransport = fields.value ? (fields.value as typeof kase.subjectTransport) : null;
            persist(
              (current) => ({ ...current, subjectTransport }),
              () => casesApi.setTransport(kase.id, subjectTransport),
            );
          },
        },
        {
          id: "new-vehicle",
          label: "New vehicle",
          mark: "new",
          editor: blankVehicle(),
          onSave: async (fields) => saveVehicle(null, fields),
        },
      ];
      kase.vehicles.forEach((item, index) => {
        actions.push({
          id: item.id,
          label: vehicleTitle(item),
          ruleBefore: index === 0,
          editor: vehicleEditor(item),
          onSave: async (fields) => saveVehicle(item, fields),
          onClear: async () => {
            persist(
              (current) => ({ ...current, vehicles: current.vehicles.filter((row) => row.id !== item.id) }),
              () => casesApi.deleteVehicle(kase.id, item.id),
            );
          },
        });
      });
      request = { title: "Transport", actions };
    } else if (id === "place") {
      const savePlace = (pattern: (typeof kase.patterns)[number] | null, fields: SkyFields) => {
        const title = fields.name.trim();
        const whenLabel = fields.when.trim();
        if (!title) throw new Error("Give the place a name.");
        if (!whenLabel) throw new Error("Say when they return.");
        const body = { title, whenLabel, place: fields.place.trim() || null };
        const next = {
          id: pattern?.id ?? `temp-place-${Date.now()}`,
          caseId: kase.id,
          title,
          place: body.place,
          whenLabel,
          detail: pattern?.detail ?? null,
          travel: pattern?.travel ?? null,
          source: pattern?.source ?? ("manual" as const),
          createdAt: pattern?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persist(
          (current) => ({
            ...current,
            patterns: pattern
              ? current.patterns.map((item) => (item.id === pattern.id ? { ...item, ...next } : item))
              : [...current.patterns, next],
          }),
          () => (pattern ? casesApi.updatePattern(kase.id, pattern.id, body) : casesApi.addPattern(kase.id, body)),
        );
      };
      const placeEditor = (pattern: (typeof kase.patterns)[number] | null): SkyEditor => ({
        kind: "place",
        title: pattern ? pattern.title : "New place",
        name: pattern?.title ?? blank,
        when: pattern?.whenLabel ?? blank,
        place: pattern?.place ?? blank,
      });
      const actions: SkyMenuAction[] = [];
      if (canCaptureFields) {
        actions.push({
          id: "new-place",
          label: "New place",
          mark: "new",
          editor: placeEditor(null),
          onSave: async (fields) => savePlace(null, fields),
        });
      }
      const records: SkyMenuAction[] = [];
      if (canEditCase && knownPlaces.some((place) => place.id.startsWith("home-"))) {
        records.push({
          id: "home",
          label: "Home",
          editor: addressEditor(),
          onSave: saveAddress,
          onClear: clearAddress,
        });
      }
      if (canCaptureFields) {
        for (const pattern of kase.patterns) {
          records.push({
            id: pattern.id,
            label: pattern.title,
            editor: placeEditor(pattern),
            onSave: async (fields) => savePlace(pattern, fields),
            onClear: async () => {
              persist(
                (current) => ({ ...current, patterns: current.patterns.filter((item) => item.id !== pattern.id) }),
                () => casesApi.deletePattern(kase.id, pattern.id),
              );
            },
          });
        }
      }
      if (records[0] && actions.length > 0) records[0].ruleBefore = true;
      if (actions.length + records.length === 0) return;
      request = { title: "Known places", actions: [...actions, ...records] };
    } else if (id === "ime") {
      request = {
        title: "IME",
        editor: { kind: "datetime", title: "Exam", value: exam ? toLocalInput(exam.toISOString()) : blank },
        onSave: async (fields) => {
          const imeAt = fields.value ? new Date(fields.value).toISOString() : null;
          persist((current) => ({ ...current, imeAt }), () => casesApi.setIme(kase.id, imeAt));
        },
        onClear: exam
          ? async () => {
              persist((current) => ({ ...current, imeAt: null }), () => casesApi.setIme(kase.id, null));
            }
          : undefined,
      };
    } else if (id === "due") {
      const dueKey = kase.dueDate ? calendarDateKey(kase.dueDate) ?? blank : blank;
      request = {
        title: "Due",
        editor: { kind: "date", title: "Due date", value: dueKey },
        onSave: async (fields) => {
          const dueDate = fields.value ? `${fields.value}T00:00:00.000Z` : null;
          persist((current) => ({ ...current, dueDate }), () => casesApi.update(kase.id, { dueDate: fields.value || null }));
        },
        onClear: kase.dueDate
          ? async () => {
              persist((current) => ({ ...current, dueDate: null }), () => casesApi.update(kase.id, { dueDate: null }));
            }
          : undefined,
      };
    } else {
      request = {
        title: "Summary",
        editor: {
          kind: "text",
          title: "Summary",
          value: kase.situationSummary ?? blank,
          placeholder: "Where things stand",
          multiline: true,
        },
        onSave: async (fields) => {
          const situationSummary = fields.value.trim() || null;
          persist(
            (current) => ({ ...current, situationSummary }),
            () => casesApi.updateSituationSummary(kase.id, situationSummary),
          );
        },
        onClear: kase.situationSummary?.trim()
          ? async () => {
              persist(
                (current) => ({ ...current, situationSummary: null }),
                () => casesApi.updateSituationSummary(kase.id, null),
              );
            }
          : undefined,
      };
    }

    fieldPop.open(event, request, direct);
  };

  return (
    <div className="sky-v6">
      <div className="sky-v6-scale" ref={sky.ref} style={sky.vars}>
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

      <div ref={pageRef} className={detailsOn ? "page details-on" : "page"}>
        <div className="id-col">
          <div className="g id">
            <h1
              className={editClass("name", "name")}
              title={editable("name") ? "Right-click for options" : undefined}
              onContextMenu={(event) => openField(event, "name")}
            >
              {nameLead ? <span className="name-lead">{nameLead} </span> : null}
              <span className="name-end">
                {nameLast}
                <span className="age">{age ?? "—"}</span>
              </span>
            </h1>
            <p
              className={editClass("work", kase.subjectJobTitle ? "occ" : "occ sky-empty")}
              title={editable("work") ? "Right-click to edit" : undefined}
              onContextMenu={(event) => openField(event, "work")}
            >
              {kase.subjectJobTitle || "No work on file"}
            </p>
            <p className="addr">
              <b
                className={editClass("address", primary ? "" : "sky-empty")}
                title={editable("address") ? "Right-click to edit" : undefined}
                onContextMenu={(event) => openField(event, "address")}
              >
                {address}
              </b>
              <span
                className={editClass("area", kase.subjectSetting ? "cap d" : "cap ghost")}
                title={editable("area") ? "Right-click to edit" : undefined}
                onContextMenu={(event) => openField(event, "area")}
              >
                {kase.subjectSetting ? SETTING_LABEL[kase.subjectSetting] : "area"}
              </span>
            </p>
            <p className="client">
              <span
                className={editClass("client", kase.client ? "" : "sky-empty")}
                title={editable("client") ? "Right-click to edit" : undefined}
                onContextMenu={(event) => openField(event, "client")}
              >
                {kase.client?.company ?? "No client"}
              </span>
              <span
                className={editClass("service", "cap c")}
                title={editable("service") ? "Right-click to edit" : undefined}
                onContextMenu={(event) => openField(event, "service")}
              >
                {SERVICE_LABELS[kase.service]}
              </span>
            </p>

            <div className="facts">
              <div
                className={editClass("eat", "fact eat")}
                title={editable("eat") ? "Right-click to edit" : undefined}
                onContextMenu={(event) => openField(event, "eat")}
              >
                <div className="big">
                  <span>{eat ? eatClock(eat) : "—"}</span>
                  <span className="eat-lab">EAT</span>
                </div>
              </div>

              <div
                className={editClass("transport", "fact")}
                title={editable("transport") ? "Right-click for options" : undefined}
                onContextMenu={(event) => openField(event, "transport")}
              >
                <div className="sec transport-head">
                  <span>Transport</span>
                  <MobilityMark transport={kase.subjectTransport} empty />
                </div>
                {kase.vehicles.length === 0 && (
                  <div className="pl">
                    <span className="a">No vehicles on file</span>
                  </div>
                )}
                {kase.vehicles.map((vehicle) => (
                  <div className="pl" key={vehicle.id}>
                    <span className="k">{vehicleTitle(vehicle)}</span>
                    <span className="t">{shareLabel(vehicle)}</span>
                  </div>
                ))}
              </div>

              <div
                className={editClass("place", "fact")}
                title={editable("place") ? "Right-click for options" : undefined}
                onContextMenu={(event) => openField(event, "place")}
              >
                <div className="sec">Known places — returns to</div>
                {knownPlaces.length === 0 && (
                  <div className="pl">
                    <span className="a">No known places</span>
                  </div>
                )}
                {knownPlaces.map((place) => (
                  <div className="pl" key={place.id}>
                    <span className="k">{place.title}</span>
                    <span className="t">{place.when}</span>
                    {place.place && <span className="a">{place.place}</span>}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

        <div className="center">
          <div className="wheel">
            <NavRing
              caseId={kase.id}
              detailsOn={detailsOn}
              onGo={(path) => navigate(path)}
              onVideo={() => {
                if (can("video.use")) setDesignsOpen(true);
              }}
              onDetails={toggleDetails}
            />
            <div className="core g">
              <button
                type="button"
                className={editClass("ime")}
                title={editable("ime") ? "Right-click to edit" : undefined}
                onClick={(event) => openField(event, "ime", true)}
                onContextMenu={(event) => openField(event, "ime")}
                style={{ background: "none", border: 0, color: "inherit", cursor: editable("ime") ? "pointer" : "default", font: "inherit" }}
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
            </div>
          </div>

          <div className="assign">
            <div className="items">
              <span className="ai done">{weekdayCount} weekday{weekdayCount === 1 ? "" : "s"}</span>
              <span className="ai done">{weekendCount} weekend day{weekendCount === 1 ? "" : "s"}</span>
              {exam && (
                <span className="ai med">
                  IME <b>{exam.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</b> · before, day of, after
                </span>
              )}
            </div>
            <div
              className={editClass("due", "rem")}
              title={editable("due") ? "Right-click to edit the due date" : undefined}
              onContextMenu={(event) => openField(event, "due")}
            >
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
          <div
            className={editClass("photo", "photo-stack")}
            title="Right-click for options"
            onContextMenu={(event) => openField(event, "photo")}
          >
            <PhotoCompare caseId={kase.id} subjectUrl={kase.subjectPhotoUrl} shots={comparisonShots(kase)} />
            <input
              ref={portraitInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadPortrait(file);
              }}
            />
          </div>
          <div className="g idl">
            <div className="sec">Summary</div>
            <p
              className={editClass("summary", kase.situationSummary?.trim() ? "sum" : "sum sky-empty")}
              title={editable("summary") ? "Right-click to edit" : undefined}
              onContextMenu={(event) => openField(event, "summary")}
            >
              {kase.situationSummary?.trim() || "No case summary yet."}
            </p>
          </div>

          <div className="g stake">
            <div className="stake-head">
              <div className="sec">Stakeout</div>
              <button
                type="button"
                className="stake-expand"
                title="Open the investigator map"
                aria-label="Open the investigator map"
                onClick={() => setStakeoutOpen(true)}
              >
                <Maximize2 size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="stake-map">
              <StakeoutMiniMap
                plan={stakeoutPlan.data ?? null}
                positions={stakeoutPositions}
                home={stakeoutHome}
                onSuggestionsShown={setStakeoutShown}
              />
            </div>
            <p className="wait">{stakeoutSummary(stakeoutPositions, stakeoutShown, stakeoutPlan.loading)}</p>
          </div>

        </div>
        {boardShown && <SkyCaseFile kase={detailQuery.data?.case ?? kase} leaving={fileLeaving} />}
      </div>

      {stakeoutOpen && (
        <StakeoutMapModal
          caseId={kase.id}
          subjectName={kase.subjectName}
          addresses={kase.addresses}
          canEdit={canAny("cases.edit", "cases.work", "cases.journal.write")}
          onChanged={(positions) => stakeouts.mutate({ positions })}
          onClose={() => setStakeoutOpen(false)}
        />
      )}

      {designsOpen && (
        <VideoUploadModal
          caseId={kase.id}
          subjectName={kase.subjectName}
          claimNumber={kase.claimNumber}
          caseNumber={kase.caseNumber}
          service={kase.service}
          state={(kase.addresses.find((address) => address.isPrimary) ?? kase.addresses[0])?.state || kase.state}
          signerName={user?.name || "Investigator"}
          canManage={can("cases.edit")}
          fieldDays={videoFieldDays}
          recipients={videoRecipients}
          onClose={() => setDesignsOpen(false)}
        />
      )}

      {compareOpen && <CompareDetails caseId={kase.id} kase={kase} onClose={() => setCompareOpen(false)} />}

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
          skyVeil
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
          onGoToCase={() => setDetailsOn(true)}
        />
      )}
      </div>
      <SkyFieldPop
        pop={fieldPop.pop}
        busy={fieldPop.busy}
        fault={fieldPop.fault}
        onEdit={fieldPop.toEdit}
        onNew={fieldPop.toNew}
        onPick={fieldPop.pick}
        onClear={fieldPop.clear}
        onCommit={fieldPop.commit}
        onClose={fieldPop.close}
      />
    </div>
  );
}
