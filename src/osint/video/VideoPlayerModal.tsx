import { useEffect, useRef, useState, useCallback } from "react";
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Download } from "lucide-react";
import type { VideoRecord } from "./useVideoState";

const BASE = "/api-proxy";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayerModal({
  record,
  onClose,
}: {
  record: VideoRecord;
  onClose: () => void;
}) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted,    setMuted]    = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Use published URL if delivered, otherwise stream the raw
  const src = record.deliver_link
    ?? `${BASE}/api/video-custody/${record.id}/stream`;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  }, []);

  const restart  = () => { if (videoRef.current) { videoRef.current.currentTime = 0; } };
  const skipFwd  = () => { if (videoRef.current) { videoRef.current.currentTime += 10; } };
  const fullsc   = () => { videoRef.current?.requestFullscreen?.(); };

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[1rem] bg-black shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.875rem] font-semibold text-white">
              {record.original_filename}
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[0.625rem] text-white/40">
              {record.investigator_override && <span>{record.investigator_override}</span>}
              {record.media_created_at && (
                <span>{new Date(record.media_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              )}
              <span className="rounded-full px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase"
                style={{
                  background: record.status === "delivered" ? "rgba(16,185,129,0.2)" :
                               record.status === "published" ? "rgba(59,130,246,0.2)" : "rgba(100,116,139,0.2)",
                  color: record.status === "delivered" ? "#10b981" :
                         record.status === "published" ? "#3b82f6" : "#94a3b8",
                }}>
                {record.status}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Video */}
        <div className="relative flex-1 bg-black" style={{ minHeight: 0 }}>
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span className="text-[0.75rem] text-white/40">Loading video…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-[0.875rem] text-white/60">{error}</div>
                <div className="mt-2 text-[0.625rem] text-white/30 font-mono">{src}</div>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            src={src}
            className="block max-h-[60vh] w-full"
            playsInline
            preload="metadata"
            muted={muted}
            onClick={toggle}
            onLoadedMetadata={e => { setDuration(e.currentTarget.duration); setLoading(false); }}
            onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onWaiting={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onError={() => { setError("Could not load video — it may still be processing or not available."); setLoading(false); }}
          />

          {/* Play overlay when paused */}
          {!playing && !loading && !error && (
            <button type="button" onClick={toggle}
              className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Play size={28} fill="white" className="text-white ml-1" />
              </div>
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a] px-4 py-3">
          {/* Scrub bar */}
          <div className="mb-3 flex items-center gap-2">
            <span className="w-10 text-right font-mono text-[0.625rem] text-white/40">{fmt(current)}</span>
            <div className="relative flex-1">
              <input
                type="range" min={0} max={1} step={0.001} value={progress}
                onChange={e => {
                  const v = videoRef.current;
                  if (v && duration) v.currentTime = Number(e.target.value) * duration;
                }}
                className="w-full cursor-pointer appearance-none"
                style={{
                  height: "4px", borderRadius: "2px",
                  background: `linear-gradient(to right, var(--color-accent) ${progress * 100}%, rgba(255,255,255,0.2) ${progress * 100}%)`,
                  accentColor: "var(--color-accent)",
                }}
              />
            </div>
            <span className="w-10 font-mono text-[0.625rem] text-white/40">{fmt(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1">
            {/* Playback */}
            <button type="button" onClick={restart}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              <SkipBack size={16} strokeWidth={1.8} />
            </button>
            <button type="button" onClick={toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors">
              {playing
                ? <Pause size={18} strokeWidth={2} fill="currentColor" />
                : <Play  size={18} strokeWidth={2} fill="currentColor" className="ml-0.5" />}
            </button>
            <button type="button" onClick={skipFwd}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              <SkipForward size={16} strokeWidth={1.8} />
            </button>

            <div className="flex-1" />

            {/* Mute */}
            <button type="button" onClick={() => setMuted(m => !m)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              {muted ? <VolumeX size={16} strokeWidth={1.8} /> : <Volume2 size={16} strokeWidth={1.8} />}
            </button>

            {/* Download processed if available */}
            {record.wasabi_pub_key && (
              <a href={record.deliver_link ?? `${BASE}/api/video-custody/${record.id}/stream`}
                download={record.output_filename ?? record.original_filename}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                <Download size={16} strokeWidth={1.8} />
              </a>
            )}

            {/* Fullscreen */}
            <button type="button" onClick={fullsc}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              <Maximize2 size={16} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
