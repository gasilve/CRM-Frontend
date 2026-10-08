import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Play, X } from "lucide-react";
import type { VideoClip } from "@/components/cases/video-designs/use-video-intake";

export function useClipFocus(clips: VideoClip[]) {
  const [id, setId] = useState<string | null>(null);
  const focus = clips.find((clip) => clip.id === id) ?? clips[0] ?? null;
  return { focus, setFocusId: setId };
}

export function Film({
  clip,
  active,
  onPlay,
  onPause,
  onDuration,
  onRemove,
  previewOnly,
  className,
  videoClassName,
  playClassName,
  removeClassName,
}: {
  clip: VideoClip;
  active: boolean;
  onPlay: () => void;
  onPause: () => void;
  onDuration?: (seconds: number) => void;
  onRemove?: () => void;
  previewOnly?: boolean;
  className: string;
  videoClassName: string;
  playClassName: string;
  removeClassName: string;
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
    <div className={className}>
      <video
        ref={ref}
        className={videoClassName}
        src={clip.url}
        muted
        playsInline
        preload="metadata"
        aria-label={clip.name}
        onClick={previewOnly ? onPlay : toggle}
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
      {!active && !previewOnly && (
        <span className={playClassName}>
          <Play size={14} strokeWidth={1.75} fill="currentColor" />
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className={removeClassName}
          aria-label={`Remove ${clip.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export function InkPad({
  onInk,
  stroke,
  className,
  canvasClassName,
  hintClassName,
  clearClassName,
}: {
  onInk: (has: boolean) => void;
  stroke: string;
  className: string;
  canvasClassName: string;
  hintClassName: string;
  clearClassName: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const distance = useRef(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke;
    };
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [stroke]);

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
    <div className={className}>
      {!started && <span className={hintClassName}>Draw your signature</span>}
      <canvas
        ref={ref}
        className={canvasClassName}
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
        <button type="button" className={clearClassName} onClick={clear}>
          Clear
        </button>
      )}
    </div>
  );
}
