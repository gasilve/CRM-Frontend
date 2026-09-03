// @ts-nocheck

import { useState, useEffect } from "react";
import { prodigyApi as api } from "@/osint/lib/api";
import {
  Film, FolderOpen, Folder, Check, RefreshCw,
  ChevronDown, ChevronUp, ChevronRight, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoItem {
  path: string;
  name: string;
  type: "folder" | "file";
  subject: string;
  recording_date: string;
  recording_ts: number;
  investigator: string | null;
  camera_type: string | null;
  video_count: number;
  total_size_mb: number;
}

interface BrowseItem {
  name: string;
  path: string;
  type: "folder" | "file";
  video_count: number;
  size_bytes: number;
}

interface Props {
  subjectName: string;
  onConfirm: (paths: string[]) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sizeFmt(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function sizeBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function matchScore(item: VideoItem, subjectName: string): number {
  const tokens = subjectName.toLowerCase().split(/[\s,.-]+/).filter(t => t.length >= 3);
  const name   = item.name.toLowerCase();
  return tokens.filter(t => name.includes(t)).length;
}

// ─── Expanded folder — shows individual video files ───────────────────────────

function FolderContents({ folderPath, selected, onToggle }: {
  folderPath: string;
  selected: Set<string>;
  onToggle: (path: string) => void;
}) {
  const [files, setFiles]     = useState<BrowseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/pipeline/browse", { params: { path: folderPath } })
      .then(r => setFiles((r.data.items ?? []).filter((i: BrowseItem) => i.type === "file")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [folderPath]);

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-2"
      style={{ color: "#8a7a6d" }}>
      <RefreshCw className="h-3 w-3 animate-spin" />
      <span className="text-[10px]">Loading…</span>
    </div>
  );

  if (!files.length) return (
    <div className="px-4 py-2 text-[10px]" style={{ color: "#8a7a6d" }}>
      No video files found
    </div>
  );

  return (
    <div className="border-t" style={{ borderColor: "rgba(255,106,26,0.1)" }}>
      {files.map(file => {
        const isSel = selected.has(file.path);
        return (
          <button key={file.path} onClick={() => onToggle(file.path)}
            className="w-full flex items-center gap-3 px-4 py-2 text-left transition-all"
            style={{
              background: isSel ? "rgba(255,106,26,0.08)" : "rgba(0,0,0,0.2)",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}>
            {/* Indent */}
            <div className="w-4 shrink-0" />
            {/* Checkbox */}
            <div className="shrink-0 flex items-center justify-center h-3.5 w-3.5 rounded border"
              style={{
                background: isSel ? "#ff6a1a" : "transparent",
                borderColor: isSel ? "#ff6a1a" : "#3d2a1e",
              }}>
              {isSel && <Check className="h-2 w-2 text-white" />}
            </div>
            <Film className="h-3.5 w-3.5 shrink-0" style={{ color: isSel ? "#ff6a1a" : "#8a7a6d" }} />
            <span className="text-[11px] truncate flex-1" style={{ color: isSel ? "#ff6a1a" : "#c0b0a2" }}>
              {file.name}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: "#8a7a6d" }}>
              {sizeBytes(file.size_bytes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Folder row ───────────────────────────────────────────────────────────────

function FolderRow({ item, selected, highlighted, onToggleFolder, onToggleFile }: {
  item: VideoItem;
  selected: Set<string>;
  highlighted: boolean;
  onToggleFolder: (path: string) => void;
  onToggleFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFolderSel = selected.has(item.path);

  return (
    <div className="rounded-xl overflow-hidden mb-1.5"
      style={{
        border: `1px solid ${isFolderSel || expanded ? "rgba(255,106,26,0.35)" : "rgba(255,255,255,0.05)"}`,
        background: isFolderSel ? "rgba(255,106,26,0.08)" : "rgba(255,255,255,0.02)",
      }}>

      {/* Folder header row */}
      <div className="flex items-center gap-2.5">

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-center h-full px-2.5 py-3 shrink-0 transition-colors"
          style={{ color: expanded ? "#ff6a1a" : "#3d2a1e" }}
          title="Browse individual files">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Checkbox + main click = select whole folder */}
        <button onClick={() => onToggleFolder(item.path)}
          className="flex items-center gap-2.5 flex-1 py-2.5 pr-3 text-left min-w-0">

          <div className="shrink-0 flex items-center justify-center h-4 w-4 rounded border"
            style={{
              background: isFolderSel ? "#ff6a1a" : "transparent",
              borderColor: isFolderSel ? "#ff6a1a" : "#3d2a1e",
            }}>
            {isFolderSel && <Check className="h-2.5 w-2.5 text-white" />}
          </div>

          {expanded
            ? <FolderOpen className="h-4 w-4 shrink-0" style={{ color: highlighted ? "#ff6a1a" : "#d85a30" }} />
            : <Folder     className="h-4 w-4 shrink-0" style={{ color: highlighted ? "#ff6a1a" : "#d85a30" }} />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold truncate" style={{ color: "#e0d3c6" }}>
                {item.subject}
              </span>
              {item.path.startsWith("/mnt/r") && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd" }}>RAW</span>
              )}
              {item.camera_type && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                  style={{
                    background: item.camera_type === "COVERT" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                    color:      item.camera_type === "COVERT" ? "#fca5a5" : "#93c5fd",
                  }}>{item.camera_type}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: "#8a7a6d" }}>
                📅 {item.recording_date}
              </span>
              {item.investigator && (
                <span className="text-[10px] truncate max-w-[160px]" style={{ color: "#8a7a6d" }}>
                  👤 {item.investigator}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "#8a7a6d" }}>
                {item.video_count} clip{item.video_count !== 1 ? "s" : ""} · {sizeFmt(item.total_size_mb)}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Expanded file list */}
      {expanded && (
        <FolderContents
          folderPath={item.path}
          selected={selected}
          onToggle={onToggleFile}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoSelector({ subjectName, onConfirm, onClose }: Props) {
  const [items, setItems]       = useState<VideoItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll]   = useState(false);
  const [rawYear, setRawYear]   = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    api.get("/api/pipeline/video-transfer/list", { params: { year: rawYear } })
      .then(r => {
        const data: VideoItem[] = r.data.items ?? [];
        setItems(data);
        // Auto-select matching items
        const autoSelect = new Set<string>();
        const matchedItems = data.filter(i => matchScore(i, subjectName) >= 1);
        matchedItems.forEach(i => autoSelect.add(i.path));
        setSelected(autoSelect);
        if (matchedItems.length === 0) setShowAll(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectName, rawYear]);

  function toggleFolder(path: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(path) ? s.delete(path) : s.add(path);
      return s;
    });
  }

  function toggleFile(path: string) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(path) ? s.delete(path) : s.add(path);
      return s;
    });
  }

  function clearAll() { setSelected(new Set()); }

  const matched = items.filter(i => matchScore(i, subjectName) >= 1);
  const others  = items.filter(i => matchScore(i, subjectName) === 0);

  const totalSelected    = selected.size;
  const selectedFolders  = items.filter(i => selected.has(i.path));
  const totalSize        = selectedFolders.reduce((a, i) => a + i.total_size_mb, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="flex flex-col w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: "#0e0906", borderColor: "rgba(255,106,26,0.2)", maxHeight: "88vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "rgba(255,106,26,0.15)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#f5ede6" }}>Select Videos to Scan</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "#8a7a6d" }}>
              Subject: <span style={{ color: "#ff6a1a" }}>{subjectName}</span>
              {matched.length > 0 && (
                <span className="ml-2" style={{ color: "#ff6a1a" }}>
                  — {matched.length} folder{matched.length !== 1 ? "s" : ""} pre-selected
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#8a7a6d" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Year picker + source info */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
          style={{ borderColor: "rgba(255,106,26,0.1)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-widest font-semibold"
              style={{ color: "#8a7a6d" }}>RAW year:</span>
            {[2023, 2024, 2025, 2026].map(yr => (
              <button key={yr} onClick={() => setRawYear(yr)}
                className="text-[10px] px-2 py-1 rounded font-semibold transition-colors"
                style={{
                  background: rawYear === yr ? "rgba(255,106,26,0.15)" : "transparent",
                  color:      rawYear === yr ? "#ff6a1a" : "#8a7a6d",
                  border:     `1px solid ${rawYear === yr ? "rgba(255,106,26,0.3)" : "transparent"}`,
                }}>
                {yr}
              </button>
            ))}
          </div>
          <div className="flex gap-2 text-[9px]" style={{ color: "#8a7a6d" }}>
            {[
              { label: "VIDEO TRANSFER", prefix: "/mnt/pifile01" },
              { label: "RAW",            prefix: "/mnt/r" },
            ].map(src => {
              const count = items.filter(i => i.path.startsWith(src.prefix)).length;
              if (!count) return null;
              return (
                <span key={src.prefix} className="px-2 py-0.5 rounded"
                  style={{ background: "rgba(255,106,26,0.08)", color: "#ff6a1a" }}>
                  {src.label}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[10px]" style={{ color: "#8a7a6d" }}>
            ☑ Check a folder to scan <b style={{ color: "#c0b0a2" }}>all clips</b> inside it.
            Click <ChevronRight className="inline h-3 w-3" /> to expand and pick <b style={{ color: "#c0b0a2" }}>individual files</b>.
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: "#8a7a6d" }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2"
              style={{ color: "#3d2a1e" }}>
              <Film className="h-10 w-10" />
              <p className="text-sm">No videos found</p>
            </div>
          )}

          {/* Matched */}
          {!loading && matched.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[9px] uppercase tracking-widest font-semibold"
                  style={{ color: "#ff6a1a" }}>
                  Matching "{subjectName}"
                </span>
                <button onClick={() => matched.forEach(i => toggleFolder(i.path))}
                  className="text-[9px] px-2 py-0.5 rounded"
                  style={{ color: "#ff6a1a", background: "rgba(255,106,26,0.1)" }}>
                  Select all
                </button>
              </div>
              {matched.map(item => (
                <FolderRow key={item.path} item={item}
                  selected={selected} highlighted
                  onToggleFolder={toggleFolder} onToggleFile={toggleFile} />
              ))}
            </>
          )}

          {/* Others */}
          {!loading && others.length > 0 && (
            <>
              <button onClick={() => setShowAll(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg mt-1 mb-2"
                style={{ color: "#8a7a6d", background: "rgba(255,255,255,0.03)" }}>
                <span className="text-[10px]">
                  {showAll ? "Hide" : "Show"} other footage ({others.length})
                </span>
                {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showAll && others.map(item => (
                <FolderRow key={item.path} item={item}
                  selected={selected} highlighted={false}
                  onToggleFolder={toggleFolder} onToggleFile={toggleFile} />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t shrink-0 space-y-3"
          style={{ borderColor: "rgba(255,106,26,0.15)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#c0b0a2" }}>
              {totalSelected > 0
                ? <><span style={{ color: "#ff6a1a", fontWeight: 600 }}>{totalSelected}</span> item{totalSelected !== 1 ? "s" : ""} selected
                    {totalSize > 0 && <span style={{ color: "#8a7a6d" }}> · {sizeFmt(totalSize)}</span>}
                  </>
                : <span style={{ color: "#8a7a6d" }}>Nothing selected — will auto-discover by name</span>
              }
            </span>
            {totalSelected > 0 && (
              <button onClick={clearAll} className="text-[10px]" style={{ color: "#8a7a6d" }}>Clear</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 text-xs py-2.5 rounded-xl border"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "#8a7a6d" }}>
              Cancel
            </button>
            <button onClick={() => onConfirm(Array.from(selected))}
              className="flex-1 flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
              <Film className="h-3.5 w-3.5" />
              {totalSelected > 0
                ? `Scan ${totalSelected} item${totalSelected !== 1 ? "s" : ""}`
                : "Scan all (auto)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
