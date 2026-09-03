// @ts-nocheck


import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { prodigyApi as api } from "@/osint/lib/api";
import {
  useVideoScanStatus, useVideoFrames, useStartVideoScan,
  useFlagVideoFrame, useVideoSummaries, useUploadReferencePhoto,
} from "@/osint/lib/queries";
import { VideoSelector } from "@/osint/components/investigations/VideoSelector";
import type { VideoFrame, VideoScanJob, VideoSummary, TimelineEvent } from "@/osint/lib/types";
import { toast } from "sonner";
import {
  Film, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Flag, FlagOff, Clock, User, Activity, ChevronDown, ChevronUp,
  Maximize2, X, Upload, Camera,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function scoreBg(score: number | null) {
  if (!score) return "bg-slate-100 text-slate-500";
  if (score >= 0.55) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (score >= 0.40) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-slate-100 text-slate-500";
}

const ACTIVITY: Record<string, { label: string; icon: string; color: string }> = {
  lift_heavy:     { label: "Lifting",        icon: "🏋️", color: "text-red-600 bg-red-50 border-red-200" },
  bend_crouch:    { label: "Bending",        icon: "🧎", color: "text-orange-600 bg-orange-50 border-orange-200" },
  carry:          { label: "Carrying",       icon: "📦", color: "text-red-500 bg-red-50 border-red-100" },
  reach_overhead: { label: "Overhead reach", icon: "🙋", color: "text-orange-500 bg-orange-50 border-orange-100" },
  fast_walk:      { label: "Fast walk",      icon: "🚶", color: "text-amber-600 bg-amber-50 border-amber-200" },
  none:           { label: "Observed",       icon: "👁", color: "text-slate-500 bg-slate-50 border-slate-200" },
};

function apiBase() {
  if (typeof window === "undefined") return "http://localhost:8000";
  return !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
}

// ─── Reference photo upload banner ───────────────────────────────────────────

function RefPhotoBanner({ investigationId, onUploaded }: {
  investigationId: number; onUploaded: () => void;
}) {
  const uploadMut = useUploadReferencePhoto();
  const inputRef  = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    uploadMut.mutate(
      { investigationId, files: Array.from(files) },
      {
        onSuccess: (data) => {
          const ok = data.filter((r: any) => r.status === "ok").length;
          if (ok > 0) { toast.success(`${ok} reference photo uploaded`); onUploaded(); }
          else toast.error("No face detected in uploaded photo");
        },
        onError: () => toast.error("Upload failed"),
      }
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <Camera className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">No reference photo</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Upload a clear face photo of the subject to enable face matching.
            Without it, the scan runs in <b>general mode</b> — detects persons and activity,
            but cannot confirm if it's the subject.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploadMut.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold
                         text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
              {uploadMut.isPending
                ? <><RefreshCw className="h-3 w-3 animate-spin" /> Uploading…</>
                : <><Upload className="h-3 w-3" /> Upload reference photo</>}
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video summary card ───────────────────────────────────────────────────────

function VideoSummaryCard({ summary, investigationId }: {
  summary: VideoSummary; investigationId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<TimelineEvent | null>(null);
  const base = apiBase();

  const bestThumbUrl = summary.best_frame_thumb
    ? `${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(summary.best_frame_thumb)}`
    : null;

  const isGeneral   = summary.scan_mode === "general";
  const hasActivity = summary.activity_frames > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header row */}
      <div className="flex items-stretch">
        {/* Best frame thumbnail */}
        <div className="w-28 shrink-0 bg-slate-100 relative">
          {bestThumbUrl
            ? <img src={bestThumbUrl} alt="" className="w-full h-full object-cover"
                style={{ minHeight: 80 }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <div className="flex items-center justify-center h-full min-h-[80px]">
                <Film className="h-6 w-6 text-slate-300" />
              </div>
          }
          {summary.best_face_score != null && (
            <div className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold py-0.5"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
              {Math.round(summary.best_face_score * 100)}% match
            </div>
          )}
        </div>

        {/* Face crop — shown when available */}
        {summary.best_face_crop && (
          <div className="w-16 shrink-0 bg-slate-900 relative border-l border-slate-200"
            title={`Best face — quality ${summary.best_face_quality ?? "?"}/100`}>
            <img
              src={`${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(summary.best_face_crop.replace(".jpg","_thumb.jpg"))}`}
              alt="Best face"
              className="w-full h-full object-cover"
              style={{ minHeight: 80 }}
              onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
            />
            {summary.best_face_quality != null && (
              <div className="absolute bottom-0 inset-x-0 text-center text-[9px] font-bold py-0.5"
                style={{ background: "rgba(0,0,0,0.6)", color: summary.best_face_quality >= 60 ? "#4ade80" : summary.best_face_quality >= 30 ? "#fbbf24" : "#f87171" }}>
                Q:{summary.best_face_quality}
              </div>
            )}
            <div className="absolute top-0.5 left-0.5 text-[8px] px-1 rounded"
              style={{ background:"rgba(0,0,0,0.5)", color:"#fff" }}>face</div>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{summary.video_filename}</p>
              {summary.video_folder && (
                <p className="text-[10px] text-slate-400 truncate">{summary.video_folder}</p>
              )}
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
              isGeneral ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600 border border-blue-200"
            }`}>
              {isGeneral ? "general" : "face match"}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDuration(summary.duration_seconds)}
            </span>
            <span className="text-[10px] text-slate-500">
              {summary.fps?.toFixed(0)}fps · {summary.resolution}
            </span>
            <span className="text-[10px] text-slate-500">
              {summary.file_size_mb?.toFixed(0)}MB
            </span>
            {summary.person_detected_pct != null && (
              <span className="text-[10px] text-slate-500">
                <User className="h-3 w-3 inline mr-0.5" />
                Person: {summary.person_detected_pct?.toFixed(0)}% of frames
              </span>
            )}
            {hasActivity && (
              <span className="text-[10px] text-red-600 font-semibold">
                <Activity className="h-3 w-3 inline mr-0.5" />
                {summary.activity_frames} activity event{summary.activity_frames !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button onClick={() => setExpanded(v => !v)}
          className="px-3 flex items-center text-slate-400 hover:text-slate-600 border-l border-slate-100">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Timeline */}
      {expanded && summary.timeline_events?.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Timeline — {summary.timeline_events.length} event{summary.timeline_events.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {summary.timeline_events.map((ev, i) => {
              const act = ACTIVITY[ev.type] ?? ACTIVITY.none;
              const thumbUrl = ev.thumb
                ? `${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(ev.thumb)}`
                : null;
              return (
                <div key={i}
                  className="flex items-center gap-2.5 py-1 rounded-lg hover:bg-slate-50 cursor-pointer px-1"
                  onClick={() => setLightbox(ev)}>
                  {/* Thumbnails: scene + face crop */}
                  <div className="flex gap-1 shrink-0">
                    <div className="w-12 h-8 rounded bg-slate-100 overflow-hidden">
                      {thumbUrl && (
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                    </div>
                    {ev.face_crop && (
                      <div className="w-6 h-8 rounded bg-slate-900 overflow-hidden"
                        title={`Face quality: ${ev.face_quality ?? "?"}/100`}>
                        <img
                          src={`${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(ev.face_crop)}`}
                          alt="face" className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                  </div>
                  {/* Timestamp */}
                  <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0 w-12">
                    {ev.ts_fmt}
                  </span>
                  {/* Activity badge */}
                  {ev.type !== "none" && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border shrink-0 ${act.color}`}>
                      {act.icon} {act.label}
                    </span>
                  )}
                  {/* Description */}
                  <span className="text-[10px] text-slate-500 truncate flex-1">{ev.desc}</span>
                  {/* Face score */}
                  {ev.score != null && ev.score > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${scoreBg(ev.score)}`}>
                      {Math.round(ev.score * 100)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expanded && (!summary.timeline_events || summary.timeline_events.length === 0) && (
        <div className="border-t border-slate-100 px-3 py-4 text-center text-[10px] text-slate-400">
          No events captured for this video
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-lg"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800 font-mono">{lightbox.ts_fmt}</span>
                {lightbox.type !== "none" && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${ACTIVITY[lightbox.type]?.color}`}>
                    {ACTIVITY[lightbox.type]?.icon} {ACTIVITY[lightbox.type]?.label}
                  </span>
                )}
                {lightbox.score != null && lightbox.score > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${scoreBg(lightbox.score)}`}>
                    {Math.round(lightbox.score * 100)}% match
                  </span>
                )}
              </div>
              <button onClick={() => setLightbox(null)}
                className="h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-slate-900 flex items-center justify-center" style={{ minHeight: 280 }}>
              {lightbox.thumb
                ? <img src={`${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(lightbox.thumb)}`}
                    alt="" className="max-h-96 max-w-full object-contain" />
                : <Film className="h-12 w-12 text-slate-600" />}
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t space-y-2">
              <p className="text-xs text-slate-600">{lightbox.desc}</p>
              {lightbox.person_count > 1 && (
                <p className="text-[10px] text-slate-400">{lightbox.person_count} persons in frame</p>
              )}
              {lightbox.face_crop && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-20 rounded overflow-hidden bg-slate-200 shrink-0">
                    <img
                      src={`${base}/api/photos/video-frame-by-path?path=${encodeURIComponent(lightbox.face_crop)}`}
                      alt="Face crop" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-600">Face crop</p>
                    {lightbox.face_quality != null && (
                      <p className="text-[10px] text-slate-400">
                        Quality: <span className={`font-bold ${lightbox.face_quality >= 60 ? "text-emerald-600" : lightbox.face_quality >= 30 ? "text-amber-500" : "text-red-500"}`}>
                          {lightbox.face_quality}/100
                        </span>
                      </p>
                    )}
                    <p className="text-[9px] text-slate-400 mt-1">
                      {lightbox.face_quality != null && lightbox.face_quality >= 60 ? "Clear — usable for identification" :
                       lightbox.face_quality != null && lightbox.face_quality >= 30 ? "Moderate — may be usable" :
                       "Low quality — too blurry"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Job status bar ───────────────────────────────────────────────────────────

function JobBar({ job }: { job: VideoScanJob }) {
  const pct = job.videos_found
    ? Math.round((job.videos_processed ?? 0) / job.videos_found * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
          {job.status === "running" && <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin" />}
          {job.status === "done"    && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          {job.status === "error"   && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          <span>
            {job.status === "running" ? `Scanning ${job.videos_processed ?? 0}/${job.videos_found ?? 0} videos…` :
             job.status === "done"    ? `Done — ${job.frames_matched ?? 0} notable frames in ${job.videos_found} video${job.videos_found !== 1 ? "s" : ""}` :
             job.status === "error"   ? (job.error_message || "Error") : job.status}
          </span>
        </div>
        {(job.best_match_score ?? 0) > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${scoreBg(job.best_match_score ?? null)}`}>
            Best: {Math.round((job.best_match_score ?? 0) * 100)}%
          </span>
        )}
      </div>
      {(job.status === "running" || job.status === "done") && (job.videos_found ?? 0) > 0 && (
        <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ff6a1a,#ff3d00)" }} />
        </div>
      )}
      {job.status === "done" && (
        <div className="flex gap-4 text-[10px] text-slate-500">
          <span>📹 {job.videos_found} video{job.videos_found !== 1 ? "s" : ""}</span>
          <span>🎞 {job.frames_scanned?.toLocaleString()} frames scanned</span>
          <span>💪 {job.frames_activity} activity events</span>
          {(job.frames_matched ?? 0) > 0 && <span>👤 {job.frames_matched} face matches</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main VideoTab ────────────────────────────────────────────────────────────

export function VideoTab({ investigationId, hasReferencePhotos }: {
  investigationId: number;
  hasReferencePhotos: boolean;
}) {
  const [polling, setPolling]   = useState(false);
  const [hasRef, setHasRef]     = useState(hasReferencePhotos);
  const [showSelector, setShowSelector] = useState(false);
  const [subjectName, setSubjectName]   = useState("");

  const { data: inv } = useQuery({ queryKey: ["investigations", investigationId], queryFn: async () => { const data = await api.get(`/api/investigations/${investigationId}`); return data; } });
  useEffect(() => { if (inv?.subject_name) setSubjectName(inv.subject_name); }, [inv?.subject_name]);
  const { data: job,      refetch: refetchJob }      = useVideoScanStatus(investigationId, polling ? 2000 : undefined);
  const { data: summaries, refetch: refetchSummaries } = useVideoSummaries(investigationId);
  const startScan = useStartVideoScan();

  useEffect(() => {
    const running = job?.status === "running" || job?.status === "pending";
    setPolling(running);
    if (job?.status === "done" || job?.status === "error") {
      refetchSummaries();
    }
  }, [job?.status]);

  const handleStart = (paths: string[] = []) => {
    setShowSelector(false);
    startScan.mutate({ investigationId, videoPaths: paths }, {
      onSuccess: (data) => {
        toast.success(`Scan started — mode: ${data.scan_mode}`);
        setPolling(true);
        setTimeout(() => refetchJob(), 500);
      },
      onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to start scan"),
    });
  };

  const isRunning = job?.status === "running" || job?.status === "pending";
  const hasSummaries = (summaries ?? []).length > 0;

  return (
    <div className="space-y-4 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Video Evidence</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasRef ? "Face matching + activity detection" : "General activity analysis"}
          </p>
        </div>
        <button
          onClick={() => isRunning ? null : setShowSelector(true)}
          disabled={isRunning || startScan.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                     text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isRunning ? "#9ca3af" : "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
          {isRunning
            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
            : <><Play className="h-3.5 w-3.5" /> {hasSummaries ? "Re-scan" : "Scan Videos"}</>
          }
        </button>
      </div>

      {/* Reference photo upload banner */}
      {!hasRef && (
        <RefPhotoBanner
          investigationId={investigationId}
          onUploaded={() => setHasRef(true)}
        />
      )}

      {/* Scan mode info */}
      {hasRef && (
        <div className="flex items-center gap-2 text-[10px] text-blue-600 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          Reference photo detected — scan will use <b className="ml-0.5">face matching mode</b>
        </div>
      )}

      {/* Job status */}
      {job && job.status !== "never_run" && <JobBar job={job} />}

      {/* Empty state */}
      {(!job || job.status === "never_run") && !hasSummaries && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Film className="h-12 w-12 opacity-30" />
          <p className="text-sm">No scan run yet</p>
          <p className="text-xs text-center max-w-xs">
            Click <b>Scan Videos</b> to search VIDEO TRANSFER for surveillance footage matching this subject.
          </p>
        </div>
      )}

      {/* Video summaries */}
      {hasSummaries && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {summaries!.length} video{summaries!.length !== 1 ? "s" : ""} analyzed
          </p>
          {summaries!.map(s => (
            <VideoSummaryCard key={s.id} summary={s} investigationId={investigationId} />
          ))}
        </div>
      )}

      {/* Video selector modal */}
      {showSelector && (
        <VideoSelector
          subjectName={subjectName || inv?.subject_name || "Subject"}
          onConfirm={(paths) => handleStart(paths)}
          onClose={() => setShowSelector(false)}
        />
      )}

    </div>
  );
}
