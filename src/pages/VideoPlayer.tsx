import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  MoreHorizontal,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CaseSubjectHeader } from "@/components/case/CaseSubjectHeader";
import {
  casesWithVideo,
  invCases,
  videosForCase,
  type CaseVideo,
} from "@/lib/mock-data";

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const KIND_LABEL: Record<CaseVideo["kind"], string> = {
  surveillance: "Surveillance",
  activity: "Activity",
  recon: "Recon",
};

export default function VideoPlayer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const caseIds = useMemo(() => casesWithVideo(), []);
  const paramCase = searchParams.get("case");
  const paramVideo = searchParams.get("v");

  const activeCaseId = useMemo(() => {
    if (paramCase && caseIds.includes(paramCase)) return paramCase;
    return caseIds[0] ?? "";
  }, [paramCase, caseIds]);

  const caseRecord = invCases.find((c) => c.id === activeCaseId);
  const library = useMemo(() => videosForCase(activeCaseId), [activeCaseId]);

  const activeVideoId = useMemo(() => {
    if (paramVideo && library.some((v) => v.id === paramVideo)) return paramVideo;
    return library[0]?.id ?? "";
  }, [paramVideo, library]);

  const media = library.find((v) => v.id === activeVideoId) ?? library[0];

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const setCase = (caseId: string) => {
    const vids = videosForCase(caseId);
    setSearchParams({ case: caseId, ...(vids[0] ? { v: vids[0].id } : {}) });
    setPlaying(false);
    setCurrent(0);
  };

  const setVideo = (videoId: string) => {
    setSearchParams({ case: activeCaseId, v: videoId });
    setPlaying(false);
    setCurrent(0);
  };

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true)).catch(() => {});
    else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const seekTo = (ratio: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    v.currentTime = Math.min(1, Math.max(0, ratio)) * v.duration;
    setCurrent(v.currentTime);
  };

  const restart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setCurrent(0);
    void v.play().then(() => setPlaying(true)).catch(() => {});
  };

  const skipAhead = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
    setCurrent(v.currentTime);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [media?.id]);

  // Sync URL if landed without params
  useEffect(() => {
    if (!activeCaseId || !activeVideoId) return;
    if (paramCase === activeCaseId && paramVideo === activeVideoId) return;
    setSearchParams({ case: activeCaseId, v: activeVideoId }, { replace: true });
  }, [activeCaseId, activeVideoId, paramCase, paramVideo, setSearchParams]);

  if (!media || !caseRecord) {
    return (
      <div className="video-player-page video-player-empty">
        <div className="vp-case-chrome">
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
            Case Video
          </h1>
          <p className="mt-2 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            No case evidence video yet.
          </p>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className="video-player-page">
      <CaseSubjectHeader
        className="vp-case-chrome"
        subject={caseRecord.subject}
        claimNumber={caseRecord.clientFileNum}
        actions={
          <Link
            to={`/cases/${caseRecord.id}`}
            className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <FolderOpen size={13} strokeWidth={1.8} />
            Open case
          </Link>
        }
      />

      <div className="video-player-stack">
        <button
          type="button"
          className="vp-stage"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          <video
            key={media.id}
            ref={videoRef}
            className="vp-video"
            src={media.src}
            playsInline
            preload="metadata"
          />
          {!playing && (
            <div className="vp-stage-overlay" aria-hidden>
              <div className="vp-stage-title">{media.title.toUpperCase()}</div>
              <div className="vp-stage-hint">{KIND_LABEL[media.kind]}</div>
            </div>
          )}
        </button>

        <div className="vp-bar" onClick={(e) => e.stopPropagation()}>
          <div className="vp-controls vp-controls-start">
            <button
              type="button"
              className={cn("vp-icon-btn", "vp-icon-btn-primary")}
              aria-label={playing ? "Pause" : "Play"}
              onClick={toggle}
            >
              {playing ? (
                <Pause size={20} strokeWidth={1.8} fill="currentColor" />
              ) : (
                <Play size={20} strokeWidth={1.8} fill="currentColor" />
              )}
            </button>
            <button type="button" className="vp-icon-btn" aria-label="Restart" onClick={restart}>
              <SkipBack size={18} strokeWidth={1.8} />
            </button>
            <button type="button" className="vp-icon-btn" aria-label="Skip 10s" onClick={skipAhead}>
              <SkipForward size={18} strokeWidth={1.8} />
            </button>
          </div>

          <div className="vp-bar-meta">
            <div className="vp-poster vp-poster-fallback" aria-hidden>
              {KIND_LABEL[media.kind].slice(0, 1)}
            </div>
            <div className="vp-meta-text">
              <div className="vp-title">{media.title}</div>
              <div className="vp-subtitle">
                {KIND_LABEL[media.kind]} · {media.durationLabel} · {media.recordedAt}
              </div>
            </div>
          </div>

          <div className="vp-scrub">
            <span className="vp-time">{formatTime(current)}</span>
            <input
              type="range"
              className="vp-range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              aria-label="Seek"
              onChange={(e) => seekTo(Number(e.target.value))}
              style={{ "--vp-progress": `${progress * 100}%` } as CSSProperties}
            />
            <span className="vp-time">{formatTime(duration)}</span>
          </div>

          <div className="vp-controls vp-controls-end">
            <div className="vp-more-wrap">
              <button
                type="button"
                className="vp-icon-btn"
                aria-label="More"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <MoreHorizontal size={18} strokeWidth={1.8} />
              </button>
              {menuOpen && (
                <div className="vp-menu" role="menu">
                  <button
                    type="button"
                    className="vp-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/cases/${caseRecord.id}`);
                    }}
                  >
                    <FolderOpen size={14} strokeWidth={1.8} />
                    View case file
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="vp-library" aria-label="Case evidence library">
        <div className="vp-library-label">Case</div>
        <select
          className="vp-case-select"
          value={activeCaseId}
          onChange={(e) => setCase(e.target.value)}
          aria-label="Select case"
        >
          {caseIds.map((id) => {
            const c = invCases.find((x) => x.id === id);
            if (!c) return null;
            return (
              <option key={id} value={id}>
                {c.clientFileNum} — {c.subject.name.split(" ").slice(-1)[0]}
              </option>
            );
          })}
        </select>

        <div className="vp-library-label">Clips · {library.length}</div>
        {library.map((item) => {
          const active = item.id === media.id;
          return (
            <button
              key={item.id}
              type="button"
              className={cn("vp-lib-card", active && "is-active")}
              onClick={() => setVideo(item.id)}
              aria-current={active ? "true" : undefined}
            >
              <div className="vp-lib-thumb vp-lib-thumb-fallback">
                <span>{KIND_LABEL[item.kind]}</span>
                <span className="vp-lib-dur">{item.durationLabel}</span>
              </div>
              <div className="vp-lib-meta">
                <div className="vp-lib-title">{item.title}</div>
                <div className="vp-lib-sub">{item.recordedAt}</div>
              </div>
            </button>
          );
        })}
      </aside>
    </div>
  );
}
