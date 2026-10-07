/**
 * VideoHighlightsPanel — highlights embebidos directo en el panel del grid.
 * Misma lógica que HighlightsPanel de proti pero adaptada al look del CRM.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Loader2 } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { CaseDetail } from "@/lib/crm-api";

const BASE = "/api-proxy";

const ACTIVITY_KEYWORDS = [
  { label: "All",       value: "" },
  { label: "Bending",   value: "bend" },
  { label: "Lifting",   value: "lift" },
  { label: "Carrying",  value: "carry" },
  { label: "Walking",   value: "walk" },
  { label: "Running",   value: "run" },
  { label: "Squatting", value: "squat" },
  { label: "Climbing",  value: "climb" },
  { label: "Working",   value: "work" },
];

function effortColor(s: number) {
  return s >= 7 ? "#ef4444" : s >= 4 ? "#f59e0b" : s >= 1 ? "#22c55e" : "#334155";
}
function effortLabel(s: number) {
  return s >= 7 ? "HIGH" : s >= 4 ? "MED" : s >= 1 ? "LOW" : "—";
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Frame = {
  frame_id: number; custody_id: number; time_sec: number; timestamp: string;
  description: string; filename: string; investigator: string;
  recorded_at: string | null; effort_score: number;
  subject_match?: boolean; thumbnail_presigned?: string; clip_presigned?: string;
};

function FrameCard({ frame, playing, selected, onClick, onSelect, keyword }: {
  frame: Frame; playing: boolean; selected: boolean; onClick: () => void; onSelect: (e: React.MouseEvent) => void; keyword: string;
}) {
  const col = effortColor(frame.effort_score);
  return (
    <div onClick={onClick} className="cursor-pointer overflow-hidden rounded-[0.5rem] transition-all"
      style={{
        background: "#1e293b",
        border: `2px solid ${playing ? "#60a5fa" : frame.effort_score >= 7 ? "#ef444444" : frame.effort_score >= 4 ? "#f59e0b44" : "transparent"}`,
        transform: playing ? "scale(1.02)" : "scale(1)",
      }}>
      {/* Thumbnail */}
      <div className="relative" style={{ background: "#0f172a", aspectRatio: "16/9", overflow: "hidden" }}>
        {frame.thumbnail_presigned
          ? <img src={frame.thumbnail_presigned} alt="" className="h-full w-full object-cover opacity-90" />
          : <div className="flex h-full items-center justify-center text-2xl opacity-30">🎬</div>}
        {/* Timestamp */}
        <div className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[0.5rem] text-white">
          {frame.timestamp}
        </div>
        {/* Clip badge */}
        <div className="absolute right-1.5 top-1.5 rounded bg-[rgba(59,130,246,0.85)] px-1.5 py-0.5 text-[0.5rem] font-bold text-white">
          ▶ 20s
        </div>
        {/* Subject match */}
        {frame.subject_match && (
          <div className="absolute bottom-1.5 right-7 rounded bg-[rgba(239,68,68,0.85)] px-1 py-0.5 text-[0.5rem] font-bold text-white">
            🎯
          </div>
        )}
        {/* Effort score */}
        {frame.effort_score > 0 && (
          <div className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[0.5rem] font-bold text-white"
            style={{ background: col }}>
            {effortLabel(frame.effort_score)} {frame.effort_score}/10
          </div>
        )}
        {/* Select checkbox */}
        <div onClick={onSelect}
          className="absolute bottom-1.5 right-1.5 flex h-4 w-4 cursor-pointer items-center justify-center rounded border-2 border-white text-[0.5rem] font-bold text-white transition-colors"
          style={{ background: selected ? "#3b82f6" : "rgba(255,255,255,0.2)" }}>
          {selected ? "✓" : ""}
        </div>
      </div>
      {/* Info */}
      <div className="p-1.5">
        <div className="mb-0.5 text-[0.5rem] text-[#475569]">
          {fmtDate(frame.recorded_at)} · {frame.investigator.replace(" Camcorder", "")}
        </div>
        <div className="line-clamp-2 text-[0.5625rem] leading-snug text-[#cbd5e1]">
          {frame.description}
        </div>
      </div>
    </div>
  );
}

export function VideoHighlightsPanel({ kase, invId }: { kase: CaseDetail; invId: number }) {
  const [frames,    setFrames]    = useState<Frame[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [keyword,   setKeyword]   = useState("");
  const [subjectOnly, setSubjectOnly] = useState(false);
  const [effortFilter, setEffortFilter] = useState<"all"|"high"|"med"|"low">("all");
  const [page,      setPage]      = useState(1);
  const [playing,   setPlaying]   = useState<Frame | null>(null);
  const [clipUrl,   setClipUrl]   = useState<string | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState(30);

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const generateLink = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/highlights/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investigation_id: invId, frame_ids: [...selected], expiry_days: expiryDays, note: `Activity highlights — ${kase.subjectName}` }),
      });
      const d = await r.json();
      if (d.url) setGeneratedUrl(d.url);
    } catch { alert("Failed to generate link"); }
    setGenerating(false);
  };
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/video-custody/investigation/${invId}/highlights-by-context?limit=3000${subjectOnly ? "&subject_only=true" : ""}`,
      { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setFrames(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [invId, subjectOnly]);

  useEffect(() => { setPage(1); }, [keyword, subjectOnly, effortFilter]);

  const filtered = frames.filter(f =>
    (!keyword || f.description.toLowerCase().includes(keyword.toLowerCase())) &&
    (effortFilter === "all" ||
     (effortFilter === "high" && f.effort_score >= 7) ||
     (effortFilter === "med"  && f.effort_score >= 4 && f.effort_score < 7) ||
     (effortFilter === "low"  && f.effort_score >= 1 && f.effort_score < 4))
  );
  const visible = filtered.slice(0, page * PAGE_SIZE);

  const playClip = useCallback(async (frame: Frame) => {
    setPlaying(frame);
    setClipLoading(true);
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setClipUrl(null);
    try {
      if (frame.clip_presigned) {
        setClipUrl(frame.clip_presigned);
        setClipLoading(false);
        setTimeout(() => videoRef.current?.play(), 100);
        return;
      }
      const r = await fetch(
        `${BASE}/api/video-custody/${frame.custody_id}/clip?t=${frame.time_sec}&before=10&after=10`,
        { credentials: "include" }
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        setClipUrl(url);
        setTimeout(() => videoRef.current?.play(), 100);
      }
    } finally { setClipLoading(false); }
  }, [clipUrl]);

  const header = (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">
        {filtered.length}/{frames.length}
      </span>
      {selected.size > 0 && (
        <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 font-mono text-[0.5rem] text-white">
          {selected.size} selected
        </span>
      )}
    </div>
  );

  return (
    <PanelShell title="Activity highlights" icon={<Zap size={11} strokeWidth={1.8} />} action={header}>
      <div className="flex h-full min-h-0 flex-col gap-2">

        {/* Filters */}
        <div className="flex flex-wrap gap-1 shrink-0">
          {/* Subject only */}
          <button type="button" onClick={() => setSubjectOnly(s => !s)}
            className="rounded px-2 py-0.5 text-[0.5625rem] font-bold text-white transition-colors"
            style={{ background: subjectOnly ? "#ef4444" : "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)" }}>
            🎯 Subject
          </button>

          {/* Activity chips */}
          {ACTIVITY_KEYWORDS.map(k => (
            <button key={k.value} type="button" onClick={() => setKeyword(k.value)}
              className="rounded px-2 py-0.5 text-[0.5625rem] font-semibold transition-colors"
              style={{
                background: keyword === k.value ? "#3b82f6" : "var(--color-ink-3)",
                color: keyword === k.value ? "white" : "var(--color-text-mid)",
                border: `1px solid ${keyword === k.value ? "#3b82f6" : "var(--color-line)"}`,
              }}>
              {k.label}
            </button>
          ))}

          {/* Effort filter */}
          <div className="flex items-center gap-1 border-l border-[var(--color-line)] pl-1 ml-0.5">
            {([
              { k: "all",  label: "All" },
              { k: "high", label: "🔴 HIGH" },
              { k: "med",  label: "🟡 MED" },
              { k: "low",  label: "🟢 LOW" },
            ] as const).map(e => (
              <button key={e.k} type="button" onClick={() => setEffortFilter(e.k)}
                className="rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold transition-colors"
                style={{
                  background: effortFilter === e.k ? "rgba(255,255,255,0.2)" : "var(--color-ink-3)",
                  color: effortFilter === e.k ? "white" : "var(--color-text-lo)",
                  border: `1px solid ${effortFilter === e.k ? "rgba(255,255,255,0.4)" : "var(--color-line)"}`,
                }}>
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate link bar */}
        {selected.size > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-2.5 py-2">
            <span className="text-[0.625rem] text-[var(--color-accent)] font-semibold">{selected.size} clip{selected.size > 1 ? "s" : ""} selected</span>
            <span className="text-[0.5625rem] text-[var(--color-text-lo)]">Expires:</span>
            {[7, 30, 60, 90].map(d => (
              <button key={d} type="button" onClick={() => setExpiryDays(d)}
                className="rounded px-1.5 py-0.5 text-[0.5625rem] font-bold transition-colors"
                style={{ background: expiryDays === d ? "var(--color-accent)" : "var(--color-ink-3)", color: expiryDays === d ? "white" : "var(--color-text-mid)", border: `1px solid ${expiryDays === d ? "var(--color-accent)" : "var(--color-line)"}` }}>
                {d}d
              </button>
            ))}
            <button type="button" onClick={generateLink} disabled={generating}
              className="ml-auto flex items-center gap-1 rounded-[0.375rem] bg-[#7c3aed] px-2.5 py-1 text-[0.625rem] font-bold text-white disabled:opacity-60">
              {generating ? "⏳ Generating…" : `🔗 Generate link`}
            </button>
            <button type="button" onClick={() => setSelected(new Set())}
              className="text-[0.5625rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">Clear</button>
          </div>
        )}

        {/* Generated URL */}
        {generatedUrl && (
          <div className="flex shrink-0 items-center gap-2 rounded-[0.5rem] border border-[#22c55e]/40 bg-[rgba(34,197,94,0.1)] px-3 py-2">
            <span className="text-[0.625rem] font-semibold text-[#22c55e]">✅ Link ready:</span>
            <a href={generatedUrl} target="_blank" rel="noreferrer"
              className="flex-1 truncate text-[0.5625rem] text-[#60a5fa] hover:underline">{generatedUrl}</a>
            <button type="button" onClick={() => navigator.clipboard.writeText(generatedUrl)}
              className="shrink-0 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.5rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">Copy</button>
          </div>
        )}

        {/* Clip player */}
        {playing && (
          <div className="shrink-0 overflow-hidden rounded-[0.5rem] border border-[var(--color-line)] bg-black">
            <div className="flex items-center justify-between border-b border-white/10 px-2 py-1">
              <span className="font-mono text-[0.5625rem] text-white/60 truncate">{playing.filename} · {playing.timestamp}</span>
              <button type="button" onClick={() => { setPlaying(null); setClipUrl(null); }}
                className="shrink-0 text-white/40 hover:text-white text-[0.75rem] ml-2">✕</button>
            </div>
            <div className="relative" style={{ aspectRatio: "16/9", background: "#000" }}>
              {clipLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-white/40" />
                </div>
              )}
              {clipUrl && (
                <video ref={videoRef} src={clipUrl} controls autoPlay className="h-full w-full" />
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[0.75rem] text-[var(--color-text-lo)]">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-[0.75rem] text-[var(--color-text-lo)]">
              {frames.length === 0 ? "No AI-analyzed frames yet." : "No frames match."}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Load more button — top */}
              {visible.length < filtered.length && (
                <button type="button" onClick={() => setPage(p => p + 1)}
                  className="w-full rounded-[0.5rem] border border-[#3b82f6]/40 bg-[rgba(59,130,246,0.1)] py-1.5 text-[0.625rem] font-semibold text-[#60a5fa]">
                  Load more ({visible.length} of {filtered.length} shown)
                </button>
              )}
              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {visible.map(frame => (
                  <FrameCard key={frame.frame_id} frame={frame}
                    playing={playing?.frame_id === frame.frame_id}
                    selected={selected.has(frame.frame_id)}
                    onClick={() => playClip(frame)}
                    onSelect={(e) => toggleSelect(frame.frame_id, e)}
                    keyword={keyword} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}
