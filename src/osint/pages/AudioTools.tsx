// @ts-nocheck
import { useEffect, useRef, useState } from "react";

type Mode = "voice" | "denoise" | "both";
type Section = { status?: string; progress?: number; message?: string; device?: string; queue_position?: number | null };
type Run = Section & { outputs?: string[]; manifest?: any; requested_by?: string };
type Job = {
  job_id: string; uploaded_name?: string; created_at?: string; original_filename?: string;
  duration_seconds?: number; is_video?: boolean; listen_file?: string; original_retained?: boolean;
  original_sha256?: string; legacy?: boolean;
  prepare?: Section; preview?: Section & { start?: number; files?: Record<string, string> };
  runs?: Partial<Record<Mode, Run>>;
  speakers?: Section & { speakers?: Speaker[]; outputs?: string[]; names?: Record<string, string>;
    num_speakers?: number | null; overlapping_speech_seconds?: number; input_track?: string;
    content_minutes?: Record<string, number>; language?: string; transcript_lines?: number };
};
type TLine = { start: number; end: number; kind: "speech" | "lyrics"; speaker?: string | null; who: string; text: string; repetitive?: boolean };
type Transcript = { language?: string; content?: { window_seconds: number; minutes: Record<string, number>; runs: [number, number, string][] }; lines: TLine[] };
type Speaker = { id: string; talk_seconds: number; talk_percent: number; turns: number; first_heard: number;
  files: { only: string; timeline: string; timeline_flac: string; sample: string } };

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "voice",   label: "Isolate voices", desc: "Removes music, TV and background sounds" },
  { id: "denoise", label: "Remove noise",   desc: "Cleans wind, traffic, hiss and static" },
  { id: "both",    label: "Both",           desc: "Isolate voices, then clean remaining noise" },
];
const R2_THRESHOLD = 90 * 1024 * 1024;
const MULTIPART_THRESHOLD = 1024 * 1024 * 1024; // > 1 GB: parallel multipart (up to 50 GB)

const apiBase = () =>
  typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "" : "http://localhost:8000";
const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
const busy = (s?: Section) => !!s && (s.status === "queued" || s.status === "processing");

function StatusLine({ s }: { s?: Section }) {
  if (!s) return null;
  if (s.status === "error") return <p className="text-sm text-red-600">Failed: {s.message}</p>;
  if (!busy(s)) return null;
  const queued = s.status === "queued";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{queued ? (s.queue_position ? `#${s.queue_position} in GPU queue — waiting for the job ahead to finish` : "Waiting in GPU queue") : s.message}</span>
        {s.device && !queued && <span>{s.device}</span>}
      </div>
      <div className="h-2 rounded bg-slate-100 overflow-hidden">
        <div className={`h-full transition-all ${queued ? "bg-slate-300 animate-pulse" : "bg-orange-500"}`}
             style={{ width: `${queued ? 100 : Math.max(3, s.progress || 0)}%` }} />
      </div>
    </div>
  );
}

export function AudioToolsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadInfo, setUploadInfo] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [numSpeakers, setNumSpeakers] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [merges, setMerges] = useState<Record<string, string>>({});
  const [tr, setTr] = useState<Transcript | null>(null);
  const [q, setQ] = useState("");
  const [showLyrics, setShowLyrics] = useState(false);
  const [nowT, setNowT] = useState(0);
  useEffect(() => {
    setTr(null);
    if (job?.speakers?.status === "done" && job.speakers.outputs?.includes("transcript.json")) {
      fetch(`${apiBase()}/api/audio/jobs/${job.job_id}/transcript`, { credentials: "include" })
        .then(r => (r.ok ? r.json() : null)).then(setTr).catch(() => {});
    }
  }, [job?.job_id, job?.speakers?.status, job?.speakers?.completed_at, JSON.stringify(job?.speakers?.names || {})]);
  const seek = (t: number) => { const p = player.current; if (!p) return; p.currentTime = Math.max(0, t - 0.3); p.play().catch(() => {}); p.scrollIntoView({ behavior: "smooth", block: "center" }); };
  useEffect(() => { setMerges({}); }, [job?.job_id, job?.speakers?.status]);
  useEffect(() => { setNames(job?.speakers?.names || {}); }, [job?.job_id, job?.speakers?.status]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  const api = (path: string, init?: RequestInit) =>
    fetch(`${apiBase()}/api/audio${path}`, { credentials: "include", ...init });

  const loadHistory = () => api("/jobs").then(r => (r.ok ? r.json() : [])).then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); return () => { if (poll.current) clearInterval(poll.current); }; }, []);

  const anyBusy = (j: Job) =>
    busy(j.prepare) || busy(j.preview) || busy(j.speakers) || Object.values(j.runs || {}).some(r => busy(r));

  const watch = (id: string) => {
    if (poll.current) clearInterval(poll.current);
    const tick = async () => {
      const r = await api(`/jobs/${id}`);
      if (!r.ok) return;
      const j: Job = await r.json();
      setJob(j);
      if (!anyBusy(j) && poll.current) { clearInterval(poll.current); poll.current = null; loadHistory(); }
    };
    tick();
    poll.current = setInterval(tick, 2500);
  };

  const post = async (path: string, body: any) => {
    setError(null);
    const r = await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.detail || `Request failed (${r.status})`); return; }
    setJob(d); watch(d.job_id);
  };

  const putWithProgress = (url: string, f: File, contentType: string) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Network error during upload — check your connection and retry"));
      xhr.send(f);
    });

  const putPart = (url: string, blob: Blob, onProgress: (loaded: number) => void) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.upload.onprogress = e => onProgress(e.loaded);
      xhr.onload = () => {
        const etag = xhr.getResponseHeader("ETag");
        xhr.status < 300 && etag ? resolve(etag) : reject(new Error(`Part upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(blob);
    });

  const multipartUpload = async (f: File): Promise<string> => {
    const contentType = f.type || "application/octet-stream";
    const sr = await api("/r2/multipart/start", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: f.name, content_type: contentType, size: f.size }) });
    const st = await sr.json().catch(() => ({}));
    if (!sr.ok) throw new Error(st.detail || `Could not start upload (${sr.status})`);
    const { r2_key, upload_id, part_size, urls } = st as { r2_key: string; upload_id: string; part_size: number; urls: string[] };
    const loaded = new Array(urls.length).fill(0);
    const etags: string[] = new Array(urls.length);
    const t0 = Date.now();
    const report = () => {
      const done = loaded.reduce((a, b) => a + b, 0);
      setUploadPct(Math.min(99, Math.floor((done / f.size) * 100)));
      const secs = (Date.now() - t0) / 1000;
      if (secs > 3 && done > 0) {
        const rate = done / secs;
        const left = (f.size - done) / rate;
        setUploadInfo(`${(done / 1e9).toFixed(2)} / ${(f.size / 1e9).toFixed(2)} GB · ${(rate / 1e6).toFixed(1)} MB/s · ~${left > 3600 ? `${Math.floor(left / 3600)}h ` : ""}${Math.ceil((left % 3600) / 60)} min left`);
      }
    };
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const i = next++;
        const blob = f.slice(i * part_size, Math.min(f.size, (i + 1) * part_size));
        for (let attempt = 1; ; attempt++) {
          try {
            etags[i] = await putPart(urls[i], blob, l => { loaded[i] = l; report(); });
            loaded[i] = blob.size; report();
            break;
          } catch (e) {
            loaded[i] = 0; report();
            if (attempt >= 4) throw new Error(`Upload failed on part ${i + 1} of ${urls.length} after 4 tries — check your connection and retry`);
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
    } catch (e) {
      api("/r2/multipart/abort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ r2_key, upload_id }) }).catch(() => {});
      throw e;
    }
    const cr = await api("/r2/multipart/complete", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2_key, upload_id, parts: etags.map((e, i) => ({ PartNumber: i + 1, ETag: e })) }) });
    const c = await cr.json().catch(() => ({}));
    if (!cr.ok) throw new Error(c.detail || `Could not finish upload (${cr.status})`);
    setUploadPct(100);
    return r2_key;
  };

  const upload = async () => {
    if (!file) return;
    setError(null); setJob(null); setUploading(true); setUploadPct(0); setUploadInfo("");
    try {
      let d: any;
      if (file.size > MULTIPART_THRESHOLD) {
        const key = await multipartUpload(file);
        const sr = await api("/isolate-r2", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2_key: key, filename: file.name }) });
        d = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(d.detail || `Could not start processing (${sr.status})`);
      } else if (file.size > R2_THRESHOLD) {
        const contentType = file.type || "application/octet-stream";
        const pr = await api("/r2/presign", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content_type: contentType, size: file.size }) });
        const p = await pr.json().catch(() => ({}));
        if (!pr.ok) throw new Error(p.detail || `Could not start upload (${pr.status})`);
        await putWithProgress(p.presigned_url, file, p.content_type);
        const sr = await api("/isolate-r2", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2_key: p.r2_key, filename: file.name }) });
        d = await sr.json().catch(() => ({}));
        if (!sr.ok) throw new Error(d.detail || `Could not start processing (${sr.status})`);
      } else {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api("/isolate", { method: "POST", body: fd });
        d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.detail || `Upload failed (${r.status})`);
      }
      setJob(d); watch(d.job_id); setFile(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const url = (name: string) => `${apiBase()}/api/audio/jobs/${job!.job_id}/file/${encodeURIComponent(name)}`;
  const ready = job?.prepare?.status === "done";
  const pv = job?.preview;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audio Voice Isolation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload audio or video (MP4, MOV… up to 50 GB), listen to it, preview the filters on the part that matters, process the full file, and split it into one track per person.
          Runs locally on the GPU — audio never leaves the server. Originals are SHA-256 hashed and never modified.
        </p>
      </div>

      {/* 1. Upload */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <label className="block rounded-lg border-2 border-dashed border-slate-200 p-6 text-center cursor-pointer hover:border-orange-400 transition">
          <input type="file" className="hidden" accept="audio/*,video/*,.amr,.m4a,.opus,.wma,.3gp,.mkv,.mts"
                 onChange={e => setFile(e.target.files?.[0] || null)} />
          {file
            ? <span className="text-sm text-slate-700">🎧 {file.name} <span className="text-slate-400">({(file.size / 1048576).toFixed(0)} MB)</span></span>
            : <span className="text-sm text-slate-400">Click to choose an audio or video file (up to 50 GB)</span>}
        </label>
        <button type="button" onClick={upload} disabled={!file || uploading}
          className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5">
          {uploading ? `Uploading… ${uploadPct ? uploadPct + "%" : ""}` : "Upload"}
        </button>
        {uploading && file && file.size > R2_THRESHOLD && (
          <div className="space-y-1">
            <div className="h-2 rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-orange-500 transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
            {uploadInfo && <p className="text-xs text-slate-600 font-mono">{uploadInfo}</p>}
            <p className="text-xs text-slate-500">Large file — keep this tab open until 100%. After that the server keeps working even if you close it.</p>
          </div>
        )}
        {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">⚠ {error}</div>}
      </div>

      {job && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-800 truncate">{job.uploaded_name}</span>
            {job.duration_seconds ? <span className="text-xs text-slate-400 shrink-0">{fmtTime(job.duration_seconds)}</span> : null}
          </div>
          <StatusLine s={job.prepare} />

          {/* 2. Listen */}
          {ready && job.listen_file && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">1 · LISTEN TO THE ORIGINAL</div>
              <audio ref={player} controls preload="metadata" className="w-full" src={url(job.listen_file)}
                onTimeUpdate={e => setNowT((e.target as HTMLAudioElement).currentTime)} />
            </div>
          )}

          {/* 3. Preview filters */}
          {ready && !job.legacy && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-semibold text-slate-500">2 · PREVIEW THE FILTERS (30 s)</div>
                  <div className="text-xs text-slate-400">Move the player to the part you care about, then preview from there.</div>
                </div>
                <button type="button" disabled={busy(pv)}
                  onClick={() => post(`/jobs/${job.job_id}/preview`, { start: player.current?.currentTime || 0 })}
                  className="rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-40 text-sm font-semibold px-3 py-1.5">
                  {busy(pv) ? "Preparing preview…" : "Preview filters from here"}
                </button>
              </div>
              <StatusLine s={pv} />
              {pv?.status === "done" && pv.files && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">From {fmtTime(pv.start || 0)} to {fmtTime((pv.start || 0) + 30)}</div>
                  {[{ id: "original", label: "Original" }, ...MODES].map(m => pv.files![m.id] && (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">{m.label}</span>
                      <audio controls preload="none" className="flex-1 h-9" src={url(pv.files![m.id])} />
                      {m.id !== "original" && (
                        <button type="button" disabled={busy(job.runs?.[m.id as Mode])}
                          onClick={() => post(`/jobs/${job.job_id}/process`, { mode: m.id })}
                          className="shrink-0 rounded border border-slate-300 hover:border-orange-500 hover:text-orange-600 disabled:opacity-40 text-xs px-2 py-1">
                          Use for full file
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Process full file */}
          {ready && !job.legacy && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">3 · PROCESS THE FULL FILE</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map(m => (
                  <button key={m.id} type="button" disabled={busy(job.runs?.[m.id])}
                    onClick={() => post(`/jobs/${job.job_id}/process`, { mode: m.id })}
                    className="text-left rounded-lg border border-slate-200 hover:border-orange-500 disabled:opacity-40 p-3 transition">
                    <div className="text-sm font-semibold text-slate-800">
                      {m.label}{job.runs?.[m.id]?.status === "done" ? " ✓" : ""}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Separate by person */}
          {ready && !job.legacy && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-semibold text-slate-500">4 · PEOPLE & TRANSCRIPT</div>
                  <div className="text-xs text-slate-400">Finds who is talking (singing is filtered out), one track per person, and a clickable transcript.</div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={20} placeholder="Auto" value={numSpeakers}
                    onChange={e => setNumSpeakers(e.target.value)}
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" title="How many people? Leave empty to detect automatically" />
                  <button type="button" disabled={busy(job.speakers)}
                    onClick={() => post(`/jobs/${job.job_id}/speakers`, { num_speakers: numSpeakers ? Number(numSpeakers) : null })}
                    className="rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 disabled:opacity-40 text-sm font-semibold px-3 py-1.5">
                    {busy(job.speakers) ? "Working…" : job.speakers?.status === "done" ? "Run again" : "Separate people & transcribe"}
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-400">How many people? Type it if you know (more accurate), or leave “Auto”.</div>
              <StatusLine s={job.speakers} />
              {job.speakers?.status === "done" && tr?.content && job.duration_seconds && (
                <div className="space-y-1">
                  <div className="relative h-4 w-full overflow-hidden rounded bg-slate-200 cursor-pointer" title="Click to jump there"
                    onClick={e => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * job.duration_seconds!); }}>
                    {tr.content.runs.filter(r => r[2] !== "quiet").map(([a, b, k], i) => (
                      <div key={i} className={`absolute top-0 h-full ${k === "speech" ? "bg-orange-500" : k === "lyrics" ? "bg-violet-400" : "bg-slate-400"}`}
                        style={{ left: `${(a / job.duration_seconds!) * 100}%`, width: `${Math.max(0.15, ((b - a) / job.duration_seconds!) * 100)}%` }} />
                    ))}
                    <div className="absolute top-0 h-full w-0.5 bg-slate-900" style={{ left: `${(nowT / job.duration_seconds!) * 100}%` }} />
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-500 mr-1" />Talking {tr.content.minutes.speech} min</span>
                    <span><span className="inline-block w-2 h-2 rounded-sm bg-violet-400 mr-1" />Singing / song vocals {tr.content.minutes.lyrics} min</span>
                    <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />Music only {tr.content.minutes.music} min</span>
                  </div>
                </div>
              )}
              {job.speakers?.status === "done" && (job.speakers.speakers || []).length === 0 && (
                <p className="text-sm text-slate-600">No conversation found — the voices in this file are singing or part of songs. The transcript below still shows what is said/sung and when.</p>
              )}
              {job.speakers?.status === "done" && job.speakers.outputs?.includes("speech_only_timeline.mp3") && (
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">Talking only</span>
                  <audio controls preload="none" className="flex-1 h-9" src={url("speech_only_timeline.mp3")} />
                  <a href={url("speech_only_timeline.flac")} className="shrink-0 text-xs text-slate-500 hover:text-orange-600">⬇ FLAC</a>
                </div>
              )}
              {job.speakers?.status === "done" && job.speakers.speakers && (
                <div className="space-y-3">
                  {job.speakers.speakers.map((sp, i) => (
                    <div key={sp.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <input value={names[sp.id] || ""} placeholder={`Speaker ${i + 1}`}
                          onChange={e => setNames({ ...names, [sp.id]: e.target.value })}
                          onBlur={() => post(`/jobs/${job.job_id}/speakers/names`, { names })}
                          className="rounded border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-800 w-56" />
                        <span className="text-xs text-slate-500">
                          talks {fmtTime(sp.talk_seconds)} ({sp.talk_percent}%) · {sp.turns} turns · first heard at {fmtTime(sp.first_heard)}
                        </span>
                        <select value={merges[sp.id] || ""}
                          onChange={e => { const m = { ...merges }; if (e.target.value) m[sp.id] = e.target.value; else delete m[sp.id]; setMerges(m); }}
                          className={`ml-auto rounded border px-2 py-1 text-xs ${merges[sp.id] ? "border-orange-500 text-orange-600" : "border-slate-200 text-slate-500"}`}>
                          <option value="">Same person as…</option>
                          {job.speakers!.speakers!.filter(o => o.id !== sp.id && !merges[o.id]).map(o => {
                            const oi = job.speakers!.speakers!.findIndex(x => x.id === o.id);
                            return <option key={o.id} value={o.id}>{names[o.id] || `Speaker ${oi + 1}`}</option>;
                          })}
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-slate-500">10 s sample</span>
                        <audio controls preload="none" className="flex-1 h-9" src={url(sp.files.sample)} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-slate-500">Only this person</span>
                        <audio controls preload="none" className="flex-1 h-9" src={url(sp.files.only)} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <a href={url(sp.files.only)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50">⬇ Only this person (MP3)</a>
                        <a href={url(sp.files.timeline)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50" title="Same length as the original — timestamps match">⬇ On original timeline (MP3)</a>
                        <a href={url(sp.files.timeline_flac)} className="rounded border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50">⬇ On original timeline (lossless FLAC)</a>
                      </div>
                    </div>
                  ))}
                  {Object.keys(merges).length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2">
                      <span className="text-xs text-slate-700">
                        {Object.entries(merges).map(([a, b]) => {
                          const ix = (id: string) => job.speakers!.speakers!.findIndex(x => x.id === id) + 1;
                          return `${names[a] || `Speaker ${ix(a)}`} → ${names[b] || `Speaker ${ix(b)}`}`;
                        }).join(" · ")}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={() => setMerges({})} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                        <button type="button" onClick={() => post(`/jobs/${job.job_id}/speakers/merge`, { merges })}
                          className="rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold px-3 py-1.5">Apply merges</button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a href={url("speakers_segments.csv")} className="rounded border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">⬇ Who spoke when (CSV)</a>
                    <a href={url("speakers.rttm")} className="rounded border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">⬇ RTTM</a>
                    <a href={url("speakers_manifest.json")} className="rounded border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">⬇ Chain of custody (JSON)</a>
                  </div>
                  {!!job.speakers.overlapping_speech_seconds && job.speakers.overlapping_speech_seconds > 5 && (
                    <p className="text-xs text-slate-400">
                      Note: about {fmtTime(job.speakers.overlapping_speech_seconds)} of the audio has people talking over each other; those moments go to whoever is dominant.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          {tr && (
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-semibold text-slate-500">TRANSCRIPT {tr.language ? `· ${tr.language.toUpperCase()}` : ""}</div>
                  <div className="text-xs text-slate-400">Click any line to jump to that moment in the player above.</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search words…"
                    className="rounded border border-slate-200 px-2 py-1 text-sm w-44" />
                  <label className="text-xs text-slate-500 flex items-center gap-1">
                    <input type="checkbox" checked={showLyrics} onChange={e => setShowLyrics(e.target.checked)} /> show song lyrics
                  </label>
                  {["txt", "srt", "vtt"].map(f => (
                    <a key={f} href={`${apiBase()}/api/audio/jobs/${job.job_id}/transcript?format=${f}&lyrics=${showLyrics}`}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">⬇ {f.toUpperCase()}</a>
                  ))}
                </div>
              </div>
              {(() => {
                const ql = q.trim().toLowerCase();
                const shown = tr.lines.filter(l => (showLyrics || l.kind !== "lyrics") && (!ql || l.text.toLowerCase().includes(ql) || l.who.toLowerCase().includes(ql)));
                if (!shown.length) return <p className="text-sm text-slate-400">{ql ? "No matches." : showLyrics ? "Nothing transcribed." : "No spoken lines — tick “show song lyrics” to see what is sung."}</p>;
                return (
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-sm">
                    {ql && <div className="py-1 text-xs text-slate-400">{shown.length} matches</div>}
                    {shown.map((l, i) => {
                      const active = nowT >= l.start && nowT < l.end + 0.5;
                      return (
                        <button key={i} type="button" onClick={() => seek(l.start)}
                          className={`w-full text-left flex gap-3 py-1.5 px-1 rounded hover:bg-orange-50 ${active ? "bg-orange-100" : ""} ${l.kind === "lyrics" ? "text-slate-400 italic" : "text-slate-800"}`}>
                          <span className="shrink-0 w-16 font-mono text-xs text-slate-400 pt-0.5">{fmtTime(l.start)}</span>
                          <span className={`shrink-0 w-28 truncate text-xs font-semibold pt-0.5 ${l.kind === "lyrics" ? "text-violet-400" : "text-orange-600"}`}>{l.who}</span>
                          <span>{l.text}{l.repetitive ? <span className="ml-1 text-xs text-slate-300">(repetitive)</span> : null}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Results per filter */}
          {Object.entries(job.runs || {}).map(([mode, r]) => {
            const label = MODES.find(m => m.id === mode)?.label || mode;
            const outs = r?.outputs || [];
            const voiceMp3 = outs.find(o => o.endsWith("voices.mp3"));
            const bg = outs.find(o => o.endsWith("background.mp3"));
            return (
              <div key={mode} className="border-t border-slate-100 pt-4 space-y-3">
                <div className="text-sm font-semibold text-orange-600">{label}</div>
                <StatusLine s={r} />
                {r?.status === "done" && (
                  <>
                    {voiceMp3 && <div><div className="text-xs text-slate-500 mb-1">Voices</div><audio controls preload="none" className="w-full" src={url(voiceMp3)} /></div>}
                    {bg && <div><div className="text-xs text-slate-500 mb-1">What was removed</div><audio controls preload="none" className="w-full" src={url(bg)} /></div>}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {outs.filter(o => o !== bg).map(n => (
                        <a key={n} href={url(n)} className="rounded border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">⬇ {n}</a>
                      ))}
                      {job.listen_file && <a href={url(job.listen_file)} className="rounded border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">⬇ {job.listen_file}</a>}
                    </div>
                    {r.manifest && (
                      <details className="text-xs text-slate-500">
                        <summary className="cursor-pointer">Chain of custody</summary>
                        <div className="mt-2 space-y-1 font-mono break-all">
                          <div>Original SHA-256: {r.manifest.original?.sha256}{r.manifest.original?.retained_on_server === false ? " (not retained on server — verify your copy)" : ""}</div>
                          {r.manifest.outputs?.map((o: any) => <div key={o.filename}>{o.filename}: {o.sha256}</div>)}
                          <div>Filter: {r.manifest.filter || Object.values(r.manifest.models || {}).filter(Boolean).join(" + ")}</div>
                          <div>Processed {r.manifest.completed_at} in {r.manifest.processing_seconds}s on {r.manifest.device} by {r.manifest.requested_by}</div>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="text-sm font-semibold text-slate-800 mb-2">Recent files</div>
          <div className="divide-y divide-slate-100">
            {history.map(h => (
              <button key={h.job_id} type="button" onClick={() => watch(h.job_id)}
                className="w-full flex items-center justify-between py-2 text-left text-sm hover:bg-slate-50 px-1 rounded">
                <span className="text-slate-700 truncate">{h.uploaded_name}</span>
                <span className="text-xs text-slate-400 shrink-0 ml-3">
                  {h.status === "ready" ? "ready to listen" : h.status}
                  {h.filters?.length ? ` · ${h.filters.map((f: string) => MODES.find(m => m.id === f)?.label).join(", ")}` : ""}
                  {h.speakers ? ` · ${h.speakers} people` : ""}
                  {h.created_at ? ` · ${new Date(h.created_at).toLocaleString()}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
