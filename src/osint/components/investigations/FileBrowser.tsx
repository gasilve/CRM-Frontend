// @ts-nocheck


import { useState, useEffect } from "react";
import { prodigyApi as api } from "@/osint/lib/api";
import {
  Folder, FolderOpen, Film, ChevronRight, ArrowLeft,
  Loader2, HardDrive, Check
} from "lucide-react";

interface BrowseItem {
  name: string;
  path: string;
  type: "folder" | "file";
  video_count: number;
  size_bytes: number;
}

interface BrowseResult {
  current_path: string;
  breadcrumbs: { name: string; path: string }[];
  items: BrowseItem[];
}

interface FileBrowserProps {
  onSelect: (path: string, type: "folder" | "file") => void;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function FileBrowser({ onSelect, onClose }: FileBrowserProps) {
  const [data, setData]       = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selected, setSelected] = useState<BrowseItem | null>(null);

  async function navigate(path?: string) {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const params = path ? { path } : { path: "/mnt/pifile01/VIDEO TRANSFER" };
      const { data: d } = await api.get("/api/pipeline/browse", { params });
      setData(d);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not load directory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { navigate("/mnt/pifile01/VIDEO TRANSFER"); }, []);

  function handleClick(item: BrowseItem) {
    if (item.type === "folder") {
      navigate(item.path);
    } else {
      setSelected(item);
    }
  }

  function handleConfirm() {
    if (!selected && !data) return;
    if (selected) {
      onSelect(selected.path, "file");
    } else if (data) {
      onSelect(data.current_path, "folder");
    }
  }

  // What's currently "chosen" for display
  const chosenPath = selected?.path ?? data?.current_path ?? "";
  const chosenType = selected ? "file" : "folder";
  const chosenLabel = selected?.name ?? data?.breadcrumbs.at(-1)?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="flex flex-col w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: "#0e0906", borderColor: "rgba(255,106,26,0.2)", maxHeight: "80vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "rgba(255,106,26,0.15)" }}>
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-4 w-4" style={{ color: "#ff6a1a" }} />
            <span className="text-sm font-semibold" style={{ color: "#f5ede6" }}>
              Select video or folder
            </span>
          </div>
          <button onClick={onClose}
            className="text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: "#8a7a6d" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f5ede6")}
            onMouseLeave={e => (e.currentTarget.style.color = "#8a7a6d")}>
            ✕
          </button>
        </div>

        {/* Root selector */}
        <div className="flex gap-1 px-3 py-2 border-b"
          style={{ borderColor: "rgba(255,106,26,0.1)" }}>
          {[
            { label: "VIDEO TRANSFER", path: "/mnt/pifile01/VIDEO TRANSFER" },
            { label: "RAW Video (R:)", path: "/mnt/r" },
          ].map(root => {
            const isActive = data?.breadcrumbs?.[0]?.path === root.path ||
                             data?.current_path?.startsWith(root.path);
            const targetPath = root.path === "/mnt/r"
              ? `/mnt/r/${new Date().getFullYear()}`
              : root.path;
            return (
              <button
                key={root.path}
                onClick={() => navigate(targetPath)}
                className="text-[10px] px-3 py-1.5 rounded-lg font-semibold transition-colors"
                style={{
                  background: isActive ? "rgba(255,106,26,0.15)" : "transparent",
                  color: isActive ? "#ff6a1a" : "#8a7a6d",
                  border: isActive ? "1px solid rgba(255,106,26,0.3)" : "1px solid transparent",
                }}>
                {root.label}
              </button>
            );
          })}
        </div>

        {/* Breadcrumb */}
        {data && (
          <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(255,106,26,0.1)", scrollbarWidth: "none" }}>
            {data.breadcrumbs.map((crumb, i) => (
              <div key={crumb.path} className="flex items-center gap-1 shrink-0">
                {i > 0 && <ChevronRight className="h-3 w-3" style={{ color: "#3d2a1e" }} />}
                <button
                  onClick={() => navigate(crumb.path)}
                  className="text-xs px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    color: i === data.breadcrumbs.length - 1 ? "#ff6a1a" : "#8a7a6d",
                    fontWeight: i === data.breadcrumbs.length - 1 ? 600 : 400,
                  }}>
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-2 py-2" style={{ minHeight: 0 }}>
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2"
              style={{ color: "#8a7a6d" }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          )}

          {error && (
            <div className="mx-2 my-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(255,50,50,0.1)", color: "#ff6060", border: "1px solid rgba(255,50,50,0.2)" }}>
              {error}
            </div>
          )}

          {!loading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2"
              style={{ color: "#3d2a1e" }}>
              <Film className="h-8 w-8" />
              <span className="text-xs">No videos or subfolders here</span>
            </div>
          )}

          {!loading && !error && data?.items.map(item => {
            const isSelected = selected?.path === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleClick(item)}
                onDoubleClick={() => item.type === "folder" && navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all mb-0.5"
                style={{
                  background: isSelected ? "rgba(255,106,26,0.12)" : "transparent",
                  border: isSelected ? "1px solid rgba(255,106,26,0.35)" : "1px solid transparent",
                  color: isSelected ? "#ff6a1a" : "#c0b0a2",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>

                {/* Icon */}
                <div className="shrink-0">
                  {item.type === "folder"
                    ? (isSelected
                        ? <FolderOpen className="h-5 w-5" style={{ color: "#ff6a1a" }} />
                        : <Folder className="h-5 w-5" style={{ color: "#d85a30" }} />)
                    : <Film className="h-5 w-5" style={{ color: isSelected ? "#ff6a1a" : "#8a7a6d" }} />
                  }
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate"
                    style={{ color: isSelected ? "#ff6a1a" : "#e0d3c6" }}>
                    {item.name}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#8a7a6d" }}>
                    {item.type === "folder"
                      ? item.video_count > 0
                        ? `${item.video_count} video${item.video_count !== 1 ? "s" : ""}`
                        : "Empty"
                      : formatSize(item.size_bytes)
                    }
                  </div>
                </div>

                {/* Folder arrow */}
                {item.type === "folder" && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "#3d2a1e" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer — chosen path + confirm */}
        <div className="px-4 py-3 border-t space-y-2.5"
          style={{ borderColor: "rgba(255,106,26,0.15)" }}>

          {/* Current selection preview */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
            style={{ background: "rgba(255,106,26,0.06)", border: "1px solid rgba(255,106,26,0.15)" }}>
            {chosenType === "folder"
              ? <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: "#ff6a1a" }} />
              : <Film className="h-3.5 w-3.5 shrink-0" style={{ color: "#ff6a1a" }} />}
            <span className="truncate" style={{ color: "#c0b0a2" }}>
              {chosenLabel || "—"}
            </span>
            <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,106,26,0.15)", color: "#ff6a1a" }}>
              {chosenType}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 text-xs py-2 rounded-lg border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "#8a7a6d" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f5ede6")}
              onMouseLeave={e => (e.currentTarget.style.color = "#8a7a6d")}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!chosenPath}
              className="flex-1 flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)", color: "#fff" }}>
              <Check className="h-3.5 w-3.5" />
              Select {chosenType === "folder" ? "folder" : "file"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
