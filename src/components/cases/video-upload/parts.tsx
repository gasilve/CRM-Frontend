import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, Check, Eye, EyeOff, Pause, Play, SkipBack, SkipForward, Upload, Volume2, VolumeX, X } from "lucide-react";
import type { LeftOutReason } from "@/components/cases/video-library";
import {
  ATTEST,
  CAMERA,
  LEFT_OUT_LABEL,
  clock,
  dayKeyOf,
  dayName,
  timeOf,
} from "@/components/cases/video-upload/checks";
import type { VideoUpload } from "@/components/cases/video-upload/use-video-upload";

/** What the player and the clip cards need, whether the clip is new or already on the case. */
export type PlayClip = {
  id: string;
  name: string;
  kind: string;
  url: string;
  number: number | null;
  seconds: number | null;
  recordedAt: string | null;
  unreadable: boolean;
  inClientVideo: boolean;
  leftOutReason: LeftOutReason | null;
};

/** Kept across clips so muting once doesn't have to be repeated on every file. */
let mutedChoice = false;

/** The Case Video player: a big stage, and the bar under it. */
export function Player({ clip, onDuration, onUnreadable }: { clip: PlayClip; onDuration?: (s: number) => void; onUnreadable?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(clip.seconds ?? 0);
  const [muted, setMuted] = useState(mutedChoice);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(clip.seconds ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  useEffect(() => {
    mutedChoice = muted;
    if (ref.current) ref.current.muted = muted;
  }, [muted, clip.id]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  };
  const seek = (ratio: number) => {
    const video = ref.current;
    const length = video && Number.isFinite(video.duration) ? video.duration : clip.seconds;
    if (!video || !length) return;
    video.currentTime = Math.min(1, Math.max(0, ratio)) * length;
  };
  const restart = () => {
    const video = ref.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => setPlaying(false));
  };
  const skip = () => {
    const video = ref.current;
    if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
  };

  const total = duration > 0 && Number.isFinite(duration) ? duration : clip.seconds ?? 0;
  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const title = clip.name.replace(/\.[^.]+$/, "");

  return (
    <>
      <div className={clip.inClientVideo ? "vu-stage" : "vu-stage out"}>
        {clip.unreadable ? (
          <div className="vu-stage-msg">
            <strong>{clip.kind} can't play in this browser</strong>
            <span>It still uploads as recorded. The server checks its length.</span>
          </div>
        ) : (
          <button type="button" className="vu-stage-hit" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
            <video
              key={clip.id}
              ref={ref}
              src={clip.url}
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => {
                event.currentTarget.muted = muted;
                const value = event.currentTarget.duration;
                if (Number.isFinite(value) && value > 0) {
                  setDuration(value);
                  onDuration?.(value);
                }
              }}
              onError={onUnreadable}
              onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {!playing && (
              <span className="vu-stage-over" aria-hidden>
                <span className="vu-stage-title">{clip.number != null ? `CLIP ${clip.number}` : title.toUpperCase()}</span>
                <span className="vu-stage-hint">{clip.inClientVideo ? "Tap to play" : `Left out · ${LEFT_OUT_LABEL[clip.leftOutReason ?? "other"]}`}</span>
              </span>
            )}
          </button>
        )}
      </div>

      <div className="vu-bar">
        <div className="vu-controls">
          <button type="button" className="vu-icon big" aria-label={playing ? "Pause" : "Play"} onClick={toggle} disabled={clip.unreadable}>
            {playing ? <Pause size={20} strokeWidth={1.8} fill="currentColor" /> : <Play size={20} strokeWidth={1.8} fill="currentColor" />}
          </button>
          <button type="button" className="vu-icon" aria-label="Back to start" onClick={restart} disabled={clip.unreadable}>
            <SkipBack size={18} strokeWidth={1.8} />
          </button>
          <button type="button" className="vu-icon" aria-label="Skip 10 seconds" onClick={skip} disabled={clip.unreadable}>
            <SkipForward size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="vu-bar-meta">
          <span className="vu-poster">{clip.number ?? clip.kind.slice(0, 1)}</span>
          <span className="vu-meta-text">
            <span className="vu-title">{title}</span>
            <span className="vu-subtitle">
              {[clip.kind, clip.seconds != null ? clock(clip.seconds) : null, clip.recordedAt ? `${dayName(dayKeyOf(new Date(clip.recordedAt)))} · ${timeOf(clip.recordedAt)}` : "No date in the file"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>
        <div className="vu-scrub">
          <span className="vu-time">{clock(current)}</span>
          <input
            type="range"
            className="vu-range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            aria-label="Seek"
            disabled={clip.unreadable}
            onChange={(event) => seek(Number(event.target.value))}
            style={{ "--vu-progress": `${progress * 100}%` } as CSSProperties}
          />
          <span className="vu-time">{clock(total)}</span>
        </div>
        <button
          type="button"
          className={muted ? "vu-icon vu-sound off" : "vu-icon vu-sound"}
          aria-label={muted ? "Turn sound on" : "Mute"}
          aria-pressed={muted}
          title={muted ? "Turn sound on" : "Mute"}
          onClick={() => setMuted((value) => !value)}
          disabled={clip.unreadable}
        >
          {muted ? <VolumeX size={18} strokeWidth={1.8} /> : <Volume2 size={18} strokeWidth={1.8} />}
        </button>
      </div>
    </>
  );
}

export function ClipCard({
  clip,
  active,
  repeat,
  canRemove,
  canLeaveOut,
  onFocus,
  onRemove,
  onLeaveOut,
  onDuration,
  onUnreadable,
}: {
  clip: PlayClip;
  active: boolean;
  repeat: boolean;
  canRemove: boolean;
  canLeaveOut: boolean;
  onFocus: () => void;
  onRemove: () => void;
  onLeaveOut: (reason: LeftOutReason | null) => void;
  onDuration?: (s: number) => void;
  onUnreadable?: () => void;
}) {
  const posed = useRef(false);
  const [asking, setAsking] = useState(false);
  const pose = (video: HTMLVideoElement) => {
    posed.current = true;
    video.currentTime = Math.min(1, video.duration * 0.08);
  };
  const classes = ["vu-card", active && "on", !clip.inClientVideo && "out", repeat && "repeat"].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <button type="button" className="vu-thumb" onClick={onFocus} aria-label={`Show ${clip.name}`}>
        {clip.unreadable ? (
          <span className="vu-thumb-none">{clip.kind}</span>
        ) : (
          <video
            src={clip.url}
            muted
            playsInline
            preload="metadata"
            tabIndex={-1}
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              // Some recorders leave the length out of the header; seeking to the end makes the browser work it out.
              if (video.duration === Infinity) video.currentTime = 1e101;
              else if (Number.isFinite(video.duration) && video.duration > 0) posed.current || pose(video);
            }}
            onDurationChange={(event) => {
              const video = event.currentTarget;
              if (!Number.isFinite(video.duration) || video.duration <= 0) return;
              onDuration?.(video.duration);
              if (!posed.current) pose(video);
            }}
            onError={onUnreadable}
          />
        )}
        {clip.number != null && <span className="vu-num">#{clip.number}</span>}
        <span className="vu-dur">{clip.seconds != null ? clock(clip.seconds) : clip.unreadable ? "—" : "…"}</span>
      </button>

      <div className="vu-card-meta">
        <span className="vu-card-name">{clip.name}</span>
        <span className="vu-card-sub">
          {repeat ? "Already on this case" : !clip.inClientVideo ? `Left out · ${LEFT_OUT_LABEL[clip.leftOutReason ?? "other"]}` : clip.recordedAt ? timeOf(clip.recordedAt) : clip.kind}
        </span>
      </div>

      {(canLeaveOut || canRemove) && (
        <div className="vu-card-tools">
          {canLeaveOut && (
            <button
              type="button"
              className="vu-tool"
              aria-label={clip.inClientVideo ? "Leave out of the client video" : "Put back in the client video"}
              title={clip.inClientVideo ? "Leave out of the client video" : "Put back in the client video"}
              onClick={() => (clip.inClientVideo ? setAsking((open) => !open) : onLeaveOut(null))}
            >
              {clip.inClientVideo ? <Eye size={13} strokeWidth={1.8} /> : <EyeOff size={13} strokeWidth={1.8} />}
            </button>
          )}
          {canRemove && (
            <button type="button" className="vu-tool" aria-label={`Remove ${clip.name}`} title="Remove" onClick={onRemove}>
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {asking && (
        <div className="vu-ask-why" role="group" aria-label="Why leave it out?">
          <span>Leave out of the client video? The original is kept.</span>
          <div>
            {(Object.keys(LEFT_OUT_LABEL) as LeftOutReason[]).map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => {
                  setAsking(false);
                  onLeaveOut(reason);
                }}
              >
                {LEFT_OUT_LABEL[reason]}
              </button>
            ))}
            <button type="button" className="ghost" onClick={() => setAsking(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Questions({ up }: { up: VideoUpload }) {
  const today = dayKeyOf(new Date());
  const yesterday = dayKeyOf(new Date(Date.now() - 86_400_000));
  const other = up.workDate !== today && up.workDate !== yesterday;
  return (
    <div className="vu-ask">
      <h3>What are you uploading?</h3>
      <p className="vu-lede">Answer these first. We check the files against your answers.</p>

      <div className="vu-q">
        <span className="vu-q-label">Day you recorded</span>
        <div className="vu-days">
          <button type="button" className={up.workDate === today ? "on" : ""} onClick={() => up.setWorkDate(today)}>
            Today
          </button>
          <button type="button" className={up.workDate === yesterday ? "on" : ""} onClick={() => up.setWorkDate(yesterday)}>
            Yesterday
          </button>
          <label className={other ? "vu-day-other on" : "vu-day-other"}>
            <CalendarDays size={14} strokeWidth={1.8} aria-hidden />
            {other ? dayName(up.workDate) : "Other day"}
            <input
              type="date"
              aria-label="Pick another day"
              value={up.workDate}
              max={today}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker();
                } catch {
                  /* Older browsers open their own picker on click. */
                }
              }}
              onChange={(event) => event.target.value && up.setWorkDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="vu-q">
        <span className="vu-q-label">Camera</span>
        <div className="vu-cams">
          {(Object.keys(CAMERA) as (keyof typeof CAMERA)[]).map((kind) => (
            <button key={kind} type="button" className={up.camera === kind ? "vu-cam on" : "vu-cam"} aria-pressed={up.camera === kind} onClick={() => up.setCamera(kind)}>
              <strong>{CAMERA[kind].label}</strong>
              <span>{CAMERA[kind].note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="vu-q vu-q-row">
        <label className="vu-num-field">
          <span className="vu-q-label">Files</span>
          <span className="vu-box">
            <input inputMode="numeric" placeholder="0" value={up.filesText} onChange={(event) => up.setFilesText(digits(event.target.value, 4))} />
          </span>
        </label>
        <div className="vu-num-field">
          <span className="vu-q-label">Total length</span>
          <span className="vu-box">
            <input inputMode="numeric" aria-label="Minutes" placeholder="0" value={up.minText} onChange={(event) => up.setMinText(digits(event.target.value, 4))} />
            <em>min</em>
            <input inputMode="numeric" aria-label="Seconds" placeholder="00" value={up.secText} onChange={(event) => up.setSecText(digits(event.target.value, 2))} />
            <em>sec</em>
          </span>
        </div>
      </div>

      <button type="button" className="vu-pick" disabled={!up.ready} onClick={up.openPicker}>
        <Upload size={16} strokeWidth={1.8} />
        {up.ready ? (up.clips.length > 0 ? "Add more files" : `Choose the ${up.declared?.files === 1 ? "file" : `${up.declared?.files} files`}`) : up.missingAnswer}
      </button>
      <span className="vu-or">{up.ready ? "or drop them anywhere on this window" : "The upload opens once all four are answered."}</span>

      {up.clips.length > 0 && (
        <button type="button" className="vu-link" disabled={!up.ready} onClick={() => up.setEditing(false)}>
          Back to the clips
        </button>
      )}
    </div>
  );
}

export function SignSheet({ up, signerName }: { up: VideoUpload; signerName: string }) {
  const camera = up.camera ? CAMERA[up.camera].label : "";
  const length = up.measuredSeconds != null ? clock(up.measuredSeconds) : up.declared ? clock(up.declared.seconds) : "";
  return (
    <div className="vu-sign">
      <p className="vu-kicker">You are signing for</p>
      <h3>{dayName(up.workDate, true)}</h3>
      <p className="vu-facts">
        {camera} · {up.clips.length} {up.clips.length === 1 ? "file" : "files"} · {length}
        {up.series.kind === "run" && ` · clips ${up.series.first}–${up.series.last}`}
      </p>
      {up.needsExplanation && up.explanation.trim() && <p className="vu-explained">“{up.explanation.trim()}”</p>}

      <div className="vu-attest">
        {ATTEST.map((line, index) => (
          <button key={line} type="button" className={up.attest[index] ? "on" : ""} aria-pressed={up.attest[index]} onClick={() => up.toggleAttest(index)}>
            <i>{up.attest[index] && <Check size={12} strokeWidth={3} />}</i>
            {line}
          </button>
        ))}
      </div>

      <SignaturePad key={up.signKey} onChange={up.setSignature} />
      <p className="vu-signer">
        Signed by <b>{signerName}</b> · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
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
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f4f6fb";
  }, []);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const finish = () => {
    drawing.current = false;
    last.current = null;
    const canvas = ref.current;
    if (!canvas || distance.current <= 24) return;
    onChange(darkInk(canvas));
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
    onChange(null);
  };

  return (
    <div className="vu-pad">
      {!started && <span className="vu-pad-hint">Sign here with your finger or mouse</span>}
      <canvas
        ref={ref}
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
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <span className="vu-pad-line" aria-hidden />
      {started && (
        <button type="button" className="vu-pad-clear" onClick={clear}>
          Clear
        </button>
      )}
    </div>
  );
}

/** The pad draws light ink on glass; the saved copy has to read on white paper. */
function darkInk(canvas: HTMLCanvasElement) {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#14182a";
  ctx.fillRect(0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function digits(value: string, max: number) {
  return value.replace(/[^\d]/g, "").slice(0, max);
}
