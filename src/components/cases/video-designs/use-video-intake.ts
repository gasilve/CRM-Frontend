import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseService } from "@/lib/crm-api";
import { readRecordedAt } from "@/components/cases/video-recorded-at";
import { listBatches, markDayCold, saveBatch, type SavedBatch, type SavedClip } from "@/components/cases/video-library";

export const ATTEST = [
  "I did not edit any video.",
  "This is all the video I am uploading today.",
  "I certify this under penalty of perjury.",
] as const;

export type VideoClip = {
  id: string;
  name: string;
  url: string;
  kind: string;
  seconds: number | null;
  recordedAt: string | null;
  blob: Blob;
};

export type VideoDayRow = {
  id: string;
  batchId: string;
  day: string;
  files: number;
  seconds: number;
  signerName: string;
  sentAt: string | null;
  where: "staging" | "cold";
};

export function useVideoIntake({
  caseId,
  signerName,
  onClose,
}: {
  caseId: string;
  signerName: string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<VideoClip[]>([]);
  const urlCache = useRef(new Map<string, string>());
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [minuteText, setMinuteText] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [signed, setSigned] = useState(false);
  const [signKey, setSignKey] = useState(0);
  const [batches, setBatches] = useState<SavedBatch[]>([]);
  const [selection, setSelection] = useState<{ batchId: string; day: string } | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const minutes = whole(minuteText);
  const measured = measuredMinutes(clips);
  const canCertify = clips.length > 0 && minutes >= 1 && checks.every(Boolean) && signed;
  clipsRef.current = clips;
  const rows = useMemo(() => dayRows(batches), [batches]);
  const saved = selection ? batches.find((batch) => batch.id === selection.batchId) : null;
  const review = saved ? saved.clips.filter((clip) => dayKey(clip.recordedAt, saved.certifiedAt) === selection?.day) : [];
  const shown = selection ? review.map((clip) => withUrl(clip, urlCache.current)) : clips;
  const activeRow = selection ? rows.find((row) => row.batchId === selection.batchId && row.day === selection.day) ?? null : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      for (const clip of clipsRef.current) URL.revokeObjectURL(clip.url);
      for (const url of urlCache.current.values()) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    listBatches(caseId)
      .then((found) => {
        if (alive) setBatches(found);
      })
      .catch(() => {
        if (alive) setLibraryError("Past video on this case could not be opened.");
      });
    return () => {
      alive = false;
    };
  }, [caseId]);

  const addFiles = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;
    setSelection(null);
    const next = files.map((file) => ({
      id: newId(),
      name: file.name,
      url: URL.createObjectURL(file),
      kind: kindLabel(file),
      seconds: null,
      recordedAt: null as string | null,
      blob: file,
    }));
    setClips((current) => [...current, ...next]);
    for (const clip of next) {
      void readRecordedAt(clip.blob).then((recorded) => {
        if (!recorded) return;
        setClips((current) =>
          current.map((item) =>
            item.id === clip.id && item.recordedAt == null ? { ...item, recordedAt: recorded.toISOString() } : item,
          ),
        );
      });
    }
  };

  const noteDuration = (id: string, seconds: number) => {
    setClips((current) =>
      current.map((clip) => (clip.id === id && clip.seconds == null && seconds > 0 ? { ...clip, seconds } : clip)),
    );
  };

  const removeClip = (id: string) => {
    setClips((current) => {
      const clip = current.find((item) => item.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      return current.filter((item) => item.id !== id);
    });
    setPlayingId((current) => (current === id ? null : current));
  };

  const certify = async () => {
    if (!canCertify || saving) return;
    setSaving(true);
    setLibraryError(null);
    const batch: SavedBatch = {
      id: newId(),
      caseId,
      signerName,
      certifiedAt: new Date().toISOString(),
      minutes,
      measured,
      sentOn: {},
      storeOn: {},
      clips: clips.map((clip) => ({
        id: clip.id,
        name: clip.name,
        kind: clip.kind,
        seconds: clip.seconds,
        recordedAt: clip.recordedAt,
        blob: clip.blob,
      })),
    };
    try {
      await saveBatch(batch);
      setBatches((current) => [batch, ...current]);
      const day = dayKey(clips[0]?.recordedAt ?? null, batch.certifiedAt);
      setClips((current) => {
        for (const clip of current) URL.revokeObjectURL(clip.url);
        return [];
      });
      setMinuteText("");
      setChecks([false, false, false]);
      setSigned(false);
      setSignKey((key) => key + 1);
      setPlayingId(null);
      setSelection({ batchId: batch.id, day });
    } catch {
      setLibraryError("Could not keep these clips on the case.");
    } finally {
      setSaving(false);
    }
  };

  const moveCold = async (row: VideoDayRow) => {
    if (row.where === "cold") return;
    setLibraryError(null);
    try {
      await markDayCold(row.batchId, row.day);
      setBatches((current) =>
        current.map((batch) =>
          batch.id === row.batchId ? { ...batch, storeOn: { ...(batch.storeOn ?? {}), [row.day]: "cold" } } : batch,
        ),
      );
    } catch {
      setLibraryError("Could not move that day to cold storage.");
    }
  };

  return {
    fileRef,
    clips,
    minuteText,
    setMinuteText,
    playingId,
    setPlayingId,
    dragging,
    setDragging,
    checks,
    toggleCheck: (index: number) => setChecks((current) => current.map((value, i) => (i === index ? !value : value))),
    signed,
    setSigned,
    signKey,
    rows,
    shown,
    activeRow,
    selection,
    selectToday: () => {
      setSelection(null);
      setPlayingId(null);
    },
    selectDay: (row: VideoDayRow) => {
      setSelection({ batchId: row.batchId, day: row.day });
      setPlayingId(null);
    },
    libraryError,
    saving,
    minutes,
    measured,
    canCertify,
    reviewing: Boolean(selection && activeRow),
    addFiles,
    noteDuration,
    removeClip,
    certify,
    moveCold,
    openPicker: () => fileRef.current?.click(),
  };
}

export type VideoIntake = ReturnType<typeof useVideoIntake>;

function withUrl(clip: SavedClip, cache: Map<string, string>): VideoClip {
  const blob = clip.blob ?? new Blob();
  let url = cache.get(clip.id);
  if (!url && clip.blob) {
    url = URL.createObjectURL(clip.blob);
    cache.set(clip.id, url);
  }
  return { ...clip, blob, url: url ?? "" };
}

function dayRows(batches: SavedBatch[]): VideoDayRow[] {
  const rows: VideoDayRow[] = [];
  for (const batch of batches) {
    const groups = new Map<string, SavedClip[]>();
    for (const clip of batch.clips) {
      const day = dayKey(clip.recordedAt, batch.certifiedAt);
      groups.set(day, [...(groups.get(day) ?? []), clip]);
    }
    for (const [day, group] of groups) {
      rows.push({
        id: `${batch.id}:${day}`,
        batchId: batch.id,
        day,
        files: group.length,
        seconds: group.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0),
        signerName: batch.signerName,
        sentAt: batch.sentOn?.[day] ?? null,
        where: batch.storeOn?.[day] === "cold" ? "cold" : "staging",
      });
    }
  }
  return rows.sort((a, b) => b.day.localeCompare(a.day));
}

export function dayKey(recordedAt: string | null, fallbackIso: string) {
  const source = recordedAt ? new Date(recordedAt) : new Date(fallbackIso);
  if (Number.isNaN(source.getTime())) return fallbackIso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}`;
}

export function dayLabel(key: string, withWeekday = false) {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", withWeekday ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}

export function dayParts(key: string) {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { n: key, wd: "", month: "" };
  return {
    n: String(date.getDate()),
    wd: date.toLocaleDateString("en-US", { weekday: "short" }),
    month: date.toLocaleDateString("en-US", { month: "short" }),
  };
}

export function packageNote(service: CaseService) {
  if (service === "WC") return "Workers' comp. A title page and trailer will be added.";
  if (service === "LIA") return "Liability. No title page and no trailer.";
  return null;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function kindLabel(file: Blob & { name?: string }) {
  const name = file.name ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext && ext.length <= 4 && ext !== name.toLowerCase()) return ext.toUpperCase();
  return "VIDEO";
}

export function clipWhen(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function whole(value: string) {
  return /^\d+$/.test(value) ? Number(value) : 0;
}

function measuredMinutes(clips: VideoClip[]) {
  if (clips.length === 0 || clips.some((clip) => clip.seconds == null)) return null;
  const seconds = clips.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0);
  return Math.max(1, Math.round(seconds / 60));
}
