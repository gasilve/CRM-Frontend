import type { SavedBatch, VideoSend } from "@/components/cases/video-library";
import { LENGTH_SLACK_SECONDS, dayKeyOf } from "@/components/cases/video-upload/checks";

export type Mark = "ok" | "warn" | "bad" | "none";

export type FieldDay = { day: string; names: string[] };

/** One surveillance date: every certified upload for it, rolled up for the ledger. */
export type DayRow = {
  day: string;
  batches: SavedBatch[];
  investigators: string[];
  cameras: string[];
  files: number;
  declaredFiles: number | null;
  seconds: number;
  declaredSeconds: number | null;
  filesMark: Mark;
  lengthMark: Mark;
  orderMark: Mark;
  sealedMark: Mark;
  storage: "staging" | "cold" | "mixed" | "none";
  inClient: number;
  lastSend: VideoSend | null;
  flags: { by: string; note: string; at: string }[];
};

export function batchDay(batch: SavedBatch) {
  if (batch.workDate) return batch.workDate;
  const first = batch.clips.find((clip) => clip.recordedAt)?.recordedAt;
  return dayKeyOf(new Date(first ?? batch.certifiedAt));
}

export function batchStorage(batch: SavedBatch): "staging" | "cold" {
  if (batch.storage) return batch.storage;
  return Object.values(batch.storeOn ?? {}).includes("cold") ? "cold" : "staging";
}

export function clipLocked(clip: { coldAt?: string | null }, batch: SavedBatch) {
  return Boolean(clip.coldAt) || batchStorage(batch) === "cold";
}

export function clipSent(clip: { id: string }, batch: SavedBatch) {
  return batchSends(batch).some((send) => !send.clipIds || send.clipIds.includes(clip.id));
}

/** The same days, reduced to the clips that were picked. */
export function narrowToClips(rows: DayRow[], clipIds: string[]): DayRow[] {
  const ids = new Set(clipIds);
  return rows.flatMap((row) => {
    const batches = row.batches
      .map((batch) => ({ ...batch, clips: batch.clips.filter((clip) => ids.has(clip.id)) }))
      .filter((batch) => batch.clips.length > 0);
    if (batches.length === 0) return [];
    const clips = batches.flatMap((batch) => batch.clips);
    const sends = batches
      .flatMap(batchSends)
      .filter((send) => !send.clipIds || send.clipIds.some((id) => ids.has(id)))
      .sort((a, b) => a.at.localeCompare(b.at));
    return [
      {
        ...row,
        batches,
        files: clips.length,
        seconds: clips.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0),
        inClient: clips.filter((clip) => clip.inClientVideo !== false).length,
        lastSend: sends[sends.length - 1] ?? null,
      },
    ];
  });
}

export function batchSends(batch: SavedBatch): VideoSend[] {
  if (batch.sends) return batch.sends;
  return Object.values(batch.sentOn ?? {}).map((at) => ({ at, to: [], note: "", by: "" }));
}

export function buildLedger(batches: SavedBatch[], fieldDays: FieldDay[], today: string) {
  const byDay = new Map<string, SavedBatch[]>();
  for (const batch of batches) {
    const day = batchDay(batch);
    byDay.set(day, [...(byDay.get(day) ?? []), batch]);
  }
  const rows: DayRow[] = [...byDay.entries()].map(([day, group]) => rollUp(day, group));
  const missing = fieldDays
    .filter((field) => field.day <= today && !byDay.has(field.day))
    .map((field) => ({ day: field.day, names: field.names }));
  rows.sort((a, b) => b.day.localeCompare(a.day));
  missing.sort((a, b) => b.day.localeCompare(a.day));
  return { rows, missing };
}

function rollUp(day: string, batches: SavedBatch[]): DayRow {
  const clips = batches.flatMap((batch) => batch.clips);
  const seconds = clips.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0);
  const known = batches.every((batch) => batch.declared);
  const declaredFiles = known ? batches.reduce((sum, batch) => sum + (batch.declared?.files ?? 0), 0) : null;
  const declaredSeconds = known ? batches.reduce((sum, batch) => sum + (batch.declared?.seconds ?? 0), 0) : null;
  const unmeasured = clips.some((clip) => clip.seconds == null);

  const storages = new Set(batches.map(batchStorage));
  const sends = batches.flatMap(batchSends).sort((a, b) => a.at.localeCompare(b.at));

  return {
    day,
    batches,
    investigators: [...new Set(batches.map((batch) => batch.signerName))],
    cameras: [...new Set(batches.map((batch) => (batch.camera === "covert" ? "Covert" : batch.camera === "camcorder" ? "Camcorder" : "Video")))],
    files: clips.length,
    declaredFiles,
    seconds,
    declaredSeconds,
    filesMark: declaredFiles == null ? "none" : declaredFiles === clips.length ? "ok" : "bad",
    lengthMark:
      declaredSeconds == null ? "none" : unmeasured ? "warn" : Math.abs(seconds - declaredSeconds) <= LENGTH_SLACK_SECONDS * batches.length ? "ok" : "bad",
    orderMark: batches.some((batch) => batch.series && batch.series.missing.length > 0)
      ? batches.every((batch) => !batch.series?.missing.length || batch.series.explanation)
        ? "warn"
        : "bad"
      : batches.every((batch) => batch.series)
        ? "ok"
        : "none",
    sealedMark: clips.length > 0 && clips.every((clip) => clip.sha256) ? "ok" : clips.some((clip) => clip.sha256) ? "warn" : "none",
    storage: storages.size > 1 ? "mixed" : storages.has("cold") ? "cold" : "staging",
    inClient: clips.filter((clip) => clip.inClientVideo !== false).length,
    lastSend: sends[sends.length - 1] ?? null,
    flags: batches.flatMap((batch) => (batch.flag ? [{ by: batch.signerName, note: batch.flag.note, at: batch.flag.at }] : [])),
  };
}

export function shortAt(iso: string) {
  return shortDay(dayKeyOf(new Date(iso)));
}

export function shortDay(key: string) {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
