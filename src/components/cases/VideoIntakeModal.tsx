import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CaseService } from "@/lib/crm-api";
import { readRecordedAt } from "@/components/cases/video-recorded-at";
import { listBatches, markDayCold, saveBatch, type SavedBatch, type SavedClip } from "@/components/cases/video-library";

const ATTEST = [
  "I did not edit any video.",
  "This is all the video I am uploading today.",
  "I certify this under penalty of perjury.",
] as const;

type Clip = {
  id: string;
  name: string;
  url: string;
  kind: string;
  seconds: number | null;
  recordedAt: string | null;
  blob: Blob;
};

type DayRow = {
  id: string;
  batchId: string;
  day: string;
  files: number;
  seconds: number;
  signerName: string;
  sentAt: string | null;
  where: "staging" | "cold";
};

export function VideoIntakeModal({
  caseId,
  subjectName,
  claimNumber,
  caseNumber,
  service,
  signerName,
  crew = [],
  onClose,
}: {
  caseId: string;
  subjectName: string;
  claimNumber: string | null;
  caseNumber: string;
  service: CaseService;
  signerName: string;
  crew?: string[];
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const clipsRef = useRef<Clip[]>([]);
  const urlCache = useRef(new Map<string, string>());
  const [clips, setClips] = useState<Clip[]>([]);
  const [minuteText, setMinuteText] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [signed, setSigned] = useState(false);
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
  const review = saved
    ? saved.clips.filter((clip) => dayKey(clip.recordedAt, saved.certifiedAt) === selection?.day)
    : [];
  const shown = selection ? review.map((clip) => withUrl(clip, urlCache.current)) : clips;
  const activeRow = selection ? rows.find((row) => row.batchId === selection.batchId && row.day === selection.day) : null;

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
      setPlayingId(null);
      setSelection({ batchId: batch.id, day });
    } catch {
      setLibraryError("Could not keep these clips on the case.");
    } finally {
      setSaving(false);
    }
  };

  const moveCold = async (row: DayRow) => {
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

  const claim = claimNumber ? `Claim ${claimNumber}` : caseNumber;
  const finish = packageNote(service);
  const reviewing = Boolean(selection && activeRow);

  return (
    <div className="confirm-layer video-layer">
      <button type="button" className="confirm-back" aria-label="Close video" onClick={onClose} />
      <div
        className={dragging ? "g video-sheet over" : "g video-sheet"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-intake-title"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <div className="video-head">
          <div>
            <p className="video-kicker">Video</p>
            <h2 id="video-intake-title">{subjectName}</h2>
            <p className="video-sub">{claim}</p>
          </div>
          <button type="button" className="video-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="video-split">
          <div className="video-col stage">
            <div className="video-stage">
              <div className="video-clips">
                {shown.map((clip) => (
                  <ClipTile
                    key={clip.id}
                    clip={clip}
                    active={playingId === clip.id}
                    onPlay={() => setPlayingId(clip.id)}
                    onPause={() => setPlayingId((current) => (current === clip.id ? null : current))}
                    onDuration={selection ? undefined : (seconds) => noteDuration(clip.id, seconds)}
                    onRemove={selection ? undefined : () => removeClip(clip.id)}
                  />
                ))}
                {!selection && (
                  <button
                    type="button"
                    className={clips.length === 0 ? "clip-add empty" : "clip-add"}
                    onClick={() => fileRef.current?.click()}
                  >
                    <b>+</b>
                    <span>{clips.length === 0 ? "Upload" : "Add"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="video-col side">
            <div className="video-book">
              <div className="video-book-head">
                <span>Date</span>
                <span>Files</span>
                <span>Where</span>
                <span>Investigator</span>
              </div>
              <button
                type="button"
                className={selection ? "video-book-row" : "video-book-row on"}
                onClick={() => {
                  setSelection(null);
                  setPlayingId(null);
                }}
              >
                <b>Today</b>
                <span>{clips.length || "—"}</span>
                <span>New</span>
                <span>{signerName.split(" ")[0]}</span>
              </button>
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={selection?.batchId === row.batchId && selection.day === row.day ? "video-book-row on" : "video-book-row"}
                  onClick={() => {
                    setSelection({ batchId: row.batchId, day: row.day });
                    setPlayingId(null);
                  }}
                >
                  <b>{dayLabel(row.day)}</b>
                  <span>{row.files}</span>
                  <span>{row.where === "cold" ? "Cold" : "Staging"}</span>
                  <span>{row.signerName.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            {reviewing && activeRow ? (
              <div className="video-side-foot">
                {libraryError && <p className="video-aside">{libraryError}</p>}
                <p className="video-aside">
                  {activeRow.where === "cold"
                    ? "This day is the immutable copy on this computer."
                    : "Staging stays on this computer until you move it to cold storage."}
                </p>
                <button
                  type="button"
                  className="video-go"
                  disabled={activeRow.where === "cold"}
                  onClick={() => void moveCold(activeRow)}
                >
                  {activeRow.where === "cold" ? "In cold storage" : "Move to cold storage"}
                </button>
                <button type="button" className="video-go" disabled>
                  Send to client
                </button>
              </div>
            ) : (
              <>
                <div className="video-side-body">
                  {crew.length > 1 && <p className="video-aside">Scheduled today: {crew.join(", ")}</p>}
                  {finish && <p className="video-aside">{finish}</p>}
                  {clips.length > 0 && (
                    <div className="video-minutes">
                      <label>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="Minutes you shot"
                          placeholder="—"
                          value={minuteText}
                          onChange={(event) => setMinuteText(event.target.value.replace(/[^\d]/g, ""))}
                        />
                        <span>minutes</span>
                      </label>
                      <button
                        type="button"
                        className="video-run"
                        disabled={measured == null}
                        onClick={() => measured != null && setMinuteText(String(measured))}
                      >
                        <b>{measured ?? "—"}</b>
                        <span>{clips.length === 1 ? "clip" : "clips"}</span>
                      </button>
                    </div>
                  )}
                  {clips.length > 0 && (
                    <div className="video-attest">
                      {ATTEST.map((line, index) => (
                        <button
                          key={line}
                          type="button"
                          className={checks[index] ? "attest on" : "attest"}
                          aria-pressed={checks[index]}
                          onClick={() => setChecks((current) => current.map((value, i) => (i === index ? !value : value)))}
                        >
                          <i />
                          <span>{line}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {clips.length > 0 && <SignPad onInk={setSigned} />}
                  {measured != null && minutes >= 1 && measured !== minutes && (
                    <p className="video-aside">The clips run {measured} min.</p>
                  )}
                </div>
                <div className="video-side-foot">
                  {libraryError && <p className="video-aside">{libraryError}</p>}
                  <button type="button" className="video-go" disabled={!canCertify || saving} onClick={() => void certify()}>
                    {saving ? "Saving" : "Certify"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,.mp4,.m4v,.mov,.mts,.m2ts,.avi,.mkv,.wmv,.webm"
          multiple
          hidden
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>
    </div>
  );
}

function withUrl(clip: SavedClip, cache: Map<string, string>): Clip {
  const blob = clip.blob ?? new Blob();
  let url = cache.get(clip.id);
  if (!url && clip.blob) {
    url = URL.createObjectURL(clip.blob);
    cache.set(clip.id, url);
  }
  return { ...clip, blob, url: url ?? "" };
}

function ClipTile({
  clip,
  active,
  onPlay,
  onPause,
  onDuration,
  onRemove,
}: {
  clip: Clip;
  active: boolean;
  onPlay: () => void;
  onPause: () => void;
  onDuration?: (seconds: number) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const posed = useRef(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || active || video.paused) return;
    video.pause();
  }, [active]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      onPlay();
      void video.play().catch(() => onPause());
    } else {
      video.pause();
      onPause();
    }
  };

  return (
    <div className={active ? "clip on" : "clip"}>
      <video
        ref={ref}
        src={clip.url}
        muted
        playsInline
        preload="metadata"
        aria-label={clip.name}
        onClick={toggle}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (!Number.isFinite(duration) || duration <= 0) return;
          onDuration?.(duration);
          if (!posed.current && duration > 0.2) {
            posed.current = true;
            event.currentTarget.currentTime = Math.min(0.4, duration * 0.08);
          }
        }}
      />
      {!active && <span className="clip-play">▶</span>}
      {onRemove && (
        <button type="button" className="clip-x" aria-label={`Remove ${clip.name}`} onClick={onRemove}>
          ×
        </button>
      )}
      <div className="clip-foot">
        <b title={clip.name}>{clip.name.replace(/\.[^.]+$/, "")}</b>
        <span>
          <em>{clip.recordedAt ? clipWhen(clip.recordedAt) : ""}</em>
          <em>{clip.seconds == null ? clip.kind : `${clip.kind} · ${clock(clip.seconds)}`}</em>
        </span>
      </div>
    </div>
  );
}

function SignPad({ onInk }: { onInk: (has: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const distance = useRef(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f4f6fb";
  }, []);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const clear = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    distance.current = 0;
    setStarted(false);
    onInk(false);
  };

  return (
    <div className="sign-block">
      {!started && <span className="sign-hint">Draw to sign</span>}
      <canvas
        ref={ref}
        className="sign-pad"
        aria-label="Draw your signature"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          last.current = point(event);
          setStarted(true);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = ref.current?.getContext("2d");
          const prev = last.current;
          if (!ctx || !prev) return;
          const next = point(event);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
          distance.current += Math.hypot(next.x - prev.x, next.y - prev.y);
          last.current = next;
          if (distance.current > 24) onInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = false;
          last.current = null;
        }}
      />
      {started && (
        <button type="button" className="sign-clear" onClick={clear}>
          Clear
        </button>
      )}
    </div>
  );
}

function dayRows(batches: SavedBatch[]): DayRow[] {
  const rows: DayRow[] = [];
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

function dayKey(recordedAt: string | null, fallbackIso: string) {
  const source = recordedAt ? new Date(recordedAt) : new Date(fallbackIso);
  if (Number.isNaN(source.getTime())) return fallbackIso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(source.getDate())}`;
}

function dayLabel(key: string) {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function packageNote(service: CaseService) {
  if (service === "WC") return "Workers' comp. A title page and trailer will be added.";
  if (service === "LIA") return "Liability. No title page and no trailer.";
  return null;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function kindLabel(file: Blob & { name?: string }) {
  const name = file.name ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext && ext.length <= 4 && ext !== name.toLowerCase()) return ext.toUpperCase();
  return "VIDEO";
}

function clipWhen(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function whole(value: string) {
  return /^\d+$/.test(value) ? Number(value) : 0;
}

function measuredMinutes(clips: Clip[]) {
  if (clips.length === 0 || clips.some((clip) => clip.seconds == null)) return null;
  const seconds = clips.reduce((sum, clip) => sum + (clip.seconds ?? 0), 0);
  return Math.max(1, Math.round(seconds / 60));
}
