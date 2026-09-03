// @ts-nocheck

import { useState, useEffect, useRef } from "react";
import { prodigyApi as api } from '@/osint/lib/api';
import { useVideoScanStatus, useVideoFrames, useStartVideoScan, useFlagVideoFrame } from '@/osint/lib/queries';
import type { VideoFrame, VideoScanJob } from '@/osint/lib/types';
import { toast } from "sonner";
import {
  Film, Search, User, ChevronRight, Play, RefreshCw,
  CheckCircle2, XCircle, Flag, FlagOff, Maximize2, X,
  AlertTriangle, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvSummary {
  id: number;
  subject_name: string;
  status: string;
  has_reference_photos: boolean;
  created_at: string;
}

interface StandaloneJob {
  job_id: number | null;
  status: "idle" | "running" | "done" | "error";
  subject_name: string;
  videos_found: number;
  videos_processed: number;
  frames_scanned: number;
  frames_matched: number;
  frames_activity: number;
  best_match_score: number | null;
  error_message: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreBg(score: number | null) {
  if (!score) return "bg-slate-100 text-slate-500";
  if (score >= 0.55) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (score >= 0.40) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-slate-100 text-slate-500";
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  lift_heavy:     { label: "Lifting",        icon: "🏋️", color: "text-red-600 bg-red-50 border border-red-200" },
  bend_crouch:    { label: "Bending",        icon: "🧎", color: "text-orange-600 bg-orange-50 border border-orange-200" },
  carry:          { label: "Carrying",       icon: "📦", color: "text-red-500 bg-red-50 border border-red-100" },
  reach_overhead: { label: "Overhead reach", icon: "🙋", color: "text-orange-500 bg-orange-50 border border-orange-100" },
  fast_walk:      { label: "Fast walk",      icon: "🚶", color: "text-amber-600 bg-amber-50 border border-amber-200" },
};

function apiBase() {
  if (typeof window === "undefined") return "http://localhost:8000";
  return !["localhost", "127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
}

// ─── Standalone scan form ─────────────────────────────────────────────────────

function StandaloneScanForm({ onComplete }: { onComplete: (invId: number) => void }) {
  const [name, setName]           = useState("");
  const [claim, setClaim]         = useState("");
  const [invId, setInvId]         = useState<number | null>(null);
  const [creating, setCreating]   = useState(false);
  const [job, setJob]             = useState<StandaloneJob | null>(null);
  const pollRef                   = useRef<NodeJS.Timeout | null>(null);

  async function handleScan() {
    if (!name.trim()) { toast.error("Enter a subject name"); return; }
    setCreating(true);
    try {
      // Create a minimal investigation if needed
      const { data: inv } = await api.post("/api/investigations", {
        subject_name: name.trim(),
        status: "draft",
        enabled_engines: [],
      });
      setInvId(inv.id);
      toast.info(`Temporary investigation #${inv.id} created`);

      // No reference photo → runs in general mode (activity detection, no face matching)
      const { data: jobData } = await api.post(`/api/investigations/${inv.id}/scan-videos`);
      setJob({
        job_id: jobData.job_id,
        status: "running",
        subject_name: name.trim(),
        videos_found: 0, videos_processed: 0,
        frames_scanned: 0, frames_matched: 0, frames_activity: 0,
        best_match_score: null, error_message: null,
      });

      // Poll
      pollRef.current = setInterval(async () => {
        const data = await api.get(`/api/investigations/${inv.id}/scan-videos/status`);
        setJob(prev => prev ? { ...prev, ...data } : data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current!);
          if (data.status === "done") onComplete(inv.id);
        }
      }, 1500);

    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to start scan");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const isRunning = job?.status === "running";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg" style={{ background: "rgba(255,106,26,0.1)" }}>
          <Film className="h-4 w-4" style={{ color: "#ff6a1a" }} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Quick Video Scan</h2>
          <p className="text-[10px] text-slate-500">Search VIDEO TRANSFER + RAW Video by subject name — no investigation required</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Subject Name</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. David Kubot"
            disabled={isRunning}
            onKeyDown={e => e.key === "Enter" && handleScan()}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white
                       focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Claim # (optional)</label>
          <input
            type="text" value={claim} onChange={e => setClaim(e.target.value)}
            placeholder="e.g. 1862-WC-25-0300081"
            disabled={isRunning}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white
                       focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[10px] text-slate-500">
          Runs in <b>general mode</b> — detects persons and activity across VIDEO TRANSFER and RAW Video.
          To enable face matching, open the investigation and upload a reference photo.
        </p>
      </div>

      <button
        onClick={handleScan}
        disabled={isRunning || creating || !name.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                   text-white transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
        {isRunning ? <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning…</> : <><Play className="h-4 w-4" /> Find Videos</>}
      </button>

      {/* Job progress */}
      {job && job.status !== "idle" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {job.status === "running" && <RefreshCw className="h-3 w-3 text-amber-500 animate-spin" />}
              {job.status === "done"    && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              {job.status === "error"   && <XCircle className="h-3 w-3 text-red-500" />}
              <span className="text-slate-600 font-medium">
                {job.status === "running" ? `${job.videos_processed}/${job.videos_found} videos…` :
                 job.status === "done"    ? `Done — ${job.frames_matched} matches in ${job.videos_found} videos` :
                 job.error_message || "Error"}
              </span>
            </div>
            {job.best_match_score && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${scoreBg(job.best_match_score)}`}>
                Best: {Math.round(job.best_match_score * 100)}%
              </span>
            )}
          </div>
          {job.status === "running" && job.videos_found > 0 && (
            <div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${job.videos_processed / job.videos_found * 100}%`,
                         background: "linear-gradient(90deg,#ff6a1a,#ff3d00)" }} />
            </div>
          )}
          {invId && job.status === "done" && (
            <Link to={`/investigations/${invId}?tab=video`}
              className="flex items-center justify-center gap-1.5 text-xs text-white py-2 rounded-lg font-semibold"
              style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
              View results in investigation #{invId} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Investigation row ────────────────────────────────────────────────────────

function InvRow({ inv }: { inv: InvSummary }) {
  const { data: job } = useVideoScanStatus(inv.id);
  const hasMatches = job?.status === "done" && (job.frames_matched ?? 0) > 0;
  const isRunning  = job?.status === "running" || job?.status === "pending";

  return (
    <Link to={`/investigations/${inv.id}?tab=video`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm"
      style={{
        borderColor: hasMatches ? "rgba(255,106,26,0.3)" : undefined,
        background:  hasMatches ? "rgba(255,106,26,0.03)" : "white",
      }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "rgba(255,106,26,0.1)" }}>
        <User className="h-4 w-4" style={{ color: "#ff6a1a" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{inv.subject_name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {!job || job.status === "never_run" ? "No scan yet" :
           isRunning                          ? `Scanning… ${job.videos_processed ?? 0}/${job.videos_found ?? 0} videos` :
           job.status === "done"              ? `${job.frames_matched ?? 0} matches · ${job.frames_activity ?? 0} activity` :
           job.status === "error"             ? "Scan error" : job.status}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!inv.has_reference_photos && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">No ref photo</span>
        )}
        {hasMatches && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(255,106,26,0.1)", color: "#ff6a1a" }}>
            {job!.frames_matched} frames
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideoEvidencePage() {
  const [investigations, setInvestigations] = useState<InvSummary[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [completedId, setCompletedId]       = useState<number | null>(null);

  useEffect(() => {
    api.get("/api/investigations", { params: { page: 1, page_size: 100 } })
      .then(r => setInvestigations(r.data.items ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = investigations.filter(inv =>
    inv.subject_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: "rgba(255,106,26,0.1)" }}>
          <Film className="h-5 w-5" style={{ color: "#ff6a1a" }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Video Evidence</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Face-matched surveillance footage across all investigations
          </p>
        </div>
      </div>

      {/* Standalone scan form */}
      <StandaloneScanForm onComplete={id => {
        setCompletedId(id);
        api.get("/api/investigations", { params: { page: 1, page_size: 100 } })
          .then(r => setInvestigations(r.data.items ?? r.data));
      }} />

      {/* Search existing */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search investigations…"
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white
                     focus:outline-none focus:ring-1 focus:ring-orange-400 text-slate-800 placeholder:text-slate-400"
        />
      </div>

      {/* Investigations list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl border border-slate-100 bg-slate-50 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Film className="h-10 w-10 opacity-30" />
          <p className="text-sm">No investigations found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered
            .sort((a, b) => a.id === completedId ? -1 : b.id === completedId ? 1 : 0)
            .map(inv => <InvRow key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}
