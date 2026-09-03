// @ts-nocheck

import { useRef, useState, useEffect } from "react";
import { Upload, Loader2, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReverseResult {
  url: string;
  title: string;
  thumbnail_url: string;
  source: string;
  confidence: number;
  matched_face: boolean;
  score_raw?: number;
}

const SOURCE_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  facecheck:   { label: "FaceCheck API", color: "#6366f1", emoji: "👤" },
  yandex:      { label: "Yandex",       color: "#e63329", emoji: "🔴" },
  google_lens: { label: "Google Lens",  color: "#4285f4", emoji: "🔵" },
  tineye:      { label: "TinEye",       color: "#f59e0b", emoji: "👁" },
  bing_visual: { label: "Bing Visual",  color: "#00a4ef", emoji: "🔷" },
  lenso:       { label: "Lenso.ai",     color: "#7c3aed", emoji: "🔮" },
  "lenso+yandex": { label: "Lenso+Yandex", color: "#7c3aed", emoji: "🔮" },
};

const ENGINES = [
  { id: "lenso",       label: "Lenso.ai",     requiresKey: false },
  { id: "facecheck",   label: "FaceCheck API", requiresKey: true },
  { id: "yandex",      label: "Yandex",       requiresKey: false },
  { id: "google_lens", label: "Google Lens",  requiresKey: false },
  { id: "tineye",      label: "TinEye",       requiresKey: false },
  { id: "bing_visual", label: "Bing",         requiresKey: false },
];

export function ReverseImageSearch({ investigationId }: { investigationId: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [credits, setCredits] = useState<Record<string, {credits?: number|null; description?: string; used?: number; total?: number}>>({});

  // Fetch credits on mount
  useEffect(() => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    fetch(`${base}/api/investigations/reverse-image/credits`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then(setCredits)
      .catch(() => {});
  }, []);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReverseResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(
    new Set(["yandex", "google_lens", "tineye"])
  );
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

  const saveResult = async (result: ReverseResult) => {
    if (!investigationId) {
      alert("Select an investigation first");
      return;
    }
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname)
      ? "" : "http://localhost:8000";
    try {
      const res = await fetch(`${base}/api/investigations/${investigationId}/findings/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: result.url,
          title: result.title || new URL(result.url).hostname,
          platform: result.source,
          confidence: result.confidence,
          finding_type: "photo_match",
          thumbnail_url: result.thumbnail_url,
        }),
      });
      if (res.ok) {
        setSavedUrls(prev => new Set([...prev, result.url]));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to save: ${err.detail || res.statusText}`);
      }
    } catch (e) {
      alert(`Error saving result: ${String(e)}`);
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResults(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleFile(f);
  };

  const toggleEngine = (id: string) => {
    setSelectedEngines(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const runSearch = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname)
      ? "" : "http://localhost:8000";

    const formData = new FormData();
    formData.append("file", file);
    const enginesParam = [...selectedEngines].join(",");

    try {
      // Step 1: Start job
      const res = await fetch(
        `${base}/api/investigations/${investigationId}/reverse-image-search?engines=${enginesParam}`,
        { method: "POST", body: formData, credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const startData = await res.json();

      // If old-style response (has results directly), use it
      if (startData.results) {
        setResults(startData.results);
        return;
      }

      // Step 2: Poll for results
      const jobId = startData.job_id;
      if (!jobId) throw new Error("No job ID returned");

      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        try {
          const poll = await fetch(
            `${base}/api/investigations/${investigationId}/reverse-image-job/${jobId}`,
            { credentials: "include" }
          );
          if (!poll.ok) break;
          const data = await poll.json();
          // Show partial results as they come in
          if (data.results?.length > 0) {
            setResults(data.results);
          }
          if (data.status === "done") break;
        } catch (_) { break; }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const displayedResults = activeSource
    ? (results || []).filter(r => r.source === activeSource)
    : (results || []);

  const sourceGroups = results
    ? Object.entries(
        results.reduce((acc, r) => {
          acc[r.source] = (acc[r.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors cursor-pointer"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !preview && fileRef.current?.click()}
      >
        {preview ? (
          <div className="flex items-center gap-4 p-4">
            <img src={preview} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-slate-200" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{file?.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{file ? Math.round(file.size / 1024) : 0} KB</p>
              <button
                onClick={e => { e.stopPropagation(); setPreview(null); setFile(null); setResults(null); }}
                className="text-xs text-red-400 hover:text-red-600 mt-2"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10">
            <Upload className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">Drop photo here or click to browse</p>
            <p className="text-xs text-slate-400">JPG, PNG — face photos work best</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {/* Engine selector */}
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Engines</p>
        <div className="flex flex-wrap gap-2">
          {ENGINES.map(eng => {
            const info = SOURCE_INFO[eng.id];
            const selected = selectedEngines.has(eng.id);
            return (
              <button
                key={eng.id}
                onClick={() => toggleEngine(eng.id)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  selected
                    ? "border-transparent text-white"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
                style={selected ? { background: info.color, borderColor: info.color } : {}}
              >
                {info.emoji} {eng.label}
                {eng.requiresKey && <span className="ml-1 opacity-70 text-[9px]">API</span>}
                {(() => {
                  const keyMap: Record<string,string> = { facecheck: "facecheck", yandex: "yandex", lenso: "lenso" };
                  const c = credits[keyMap[eng.id] || eng.id];
                  if (!c || c.credits == null) return null;
                  return <span className="ml-1.5 opacity-80 text-[9px] bg-black/20 px-1.5 py-0.5 rounded-full">{c.credits === -1 ? "∞" : c.credits}</span>;
                })()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search button */}
      <Button
        onClick={runSearch}
        disabled={!file || loading || selectedEngines.size === 0}
        className="w-full gap-2"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Searching across {selectedEngines.size} engines...</>
        ) : (
          <><Search className="h-4 w-4" /> Search</>
        )}
      </Button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          {/* Source filter tabs */}
          {sourceGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveSource(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  !activeSource ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500"
                }`}
              >
                All ({results.length})
              </button>
              {sourceGroups.map(([src, count]) => {
                const info = SOURCE_INFO[src] || { label: src, color: "#64748b", emoji: "🔍" };
                return (
                  <button
                    key={src}
                    onClick={() => setActiveSource(activeSource === src ? null : src)}
                    className="text-xs px-2.5 py-1 rounded-full border transition-all"
                    style={
                      activeSource === src
                        ? { background: info.color, color: "#fff", borderColor: info.color }
                        : { borderColor: "#e2e8f0", color: "#64748b" }
                    }
                  >
                    {info.emoji} {info.label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {displayedResults.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No results found for the selected engines.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {displayedResults.map((r, i) => {
                const info = SOURCE_INFO[r.source] || { label: r.source, color: "#64748b", emoji: "🔍" };
                const pct = Math.round(r.confidence * 100);
                return (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-lg border border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="relative bg-slate-100 h-36 overflow-hidden">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt={r.title || "Result"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={e => { (e.target as HTMLImageElement).parentElement!.classList.add("no-img"); (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : null}
                      {!r.thumbnail_url && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400">
                          <ExternalLink className="h-5 w-5 mb-1" />
                          <span className="text-[10px] font-medium px-2 text-center leading-tight">
                            {(() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return "link"; } })()}
                          </span>
                        </div>
                      )}
                      {/* Source badge */}
                      <div
                        className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ background: info.color }}
                      >
                        {info.emoji} {info.label}
                      </div>
                      {/* Face match badge */}
                      {r.matched_face && (
                        <div className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white">
                          ✓ Face match
                        </div>
                      )}
                      {/* Confidence */}
                      <div className="absolute bottom-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-white">
                        {pct}%
                      </div>
                    </div>
                    {/* Info + Save */}
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-medium text-slate-700 truncate">
                        {(() => { try { return new URL(r.url).hostname.replace("www.", ""); } catch { return "unknown"; } })()}
                      </p>
                      {r.title && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.title}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" /> Open
                        </a>
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); saveResult(r); }}
                          disabled={savedUrls.has(r.url)}
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            savedUrls.has(r.url)
                              ? "bg-green-100 text-green-600"
                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                          }`}
                        >
                          {savedUrls.has(r.url) ? "\u2713 Saved" : "Save to case"}
                        </button>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
