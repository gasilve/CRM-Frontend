// @ts-nocheck


import React, { useState, useEffect, useRef } from "react";
import { prodigyApi as api } from "@/osint/lib/api";
import { toast } from "sonner";
import {
  Film, Play, Square, RefreshCw, ChevronDown, Settings2,
  Clock, MapPin, Type, AlignLeft, Info, CheckCircle2, XCircle, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileBrowser } from "@/osint/components/investigations/FileBrowser";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BurnConfig {
  input_path: string;
  output_dir: string;
  start_time: string;
  position: string;
  font_style: string;
  font_scale: number;
  font_thickness: number;
  text_color: number[];
  box_alpha: number;
  timestamp_format: string;
  extra_fields: string[];
  skip_existing: boolean;
  dry_run: boolean;
}

interface BurnState {
  status: "idle" | "running" | "done" | "error";
  job_id: string | null;
  input_path: string | null;
  output_path: string | null;
  progress_pct: number;
  total_frames: number;
  done_frames: number;
  start_time_used: string | null;
  error: string | null;
  logs: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: "bottom-left",  label: "↙ Bottom Left"  },
  { value: "bottom-right", label: "↘ Bottom Right" },
  { value: "top-left",     label: "↖ Top Left"     },
  { value: "top-right",    label: "↗ Top Right"    },
];

const FONT_STYLES = [
  { value: "duplex",  label: "Duplex (clean)" },
  { value: "simplex", label: "Simplex (thin)"  },
  { value: "triplex", label: "Triplex (heavy)" },
  { value: "plain",   label: "Plain (minimal)" },
];

const TIMESTAMP_FORMATS = [
  { value: "%m/%d/%Y  %I:%M:%S %p", label: "07/12/2026  06:24:35 PM" },
  { value: "%Y-%m-%d  %H:%M:%S",    label: "2026-07-12  18:24:35"    },
  { value: "%m/%d/%Y %H:%M:%S",     label: "07/12/2026 18:24:35"     },
  { value: "%b %d %Y  %I:%M %p",    label: "Jul 12 2026  06:24 PM"   },
];

const DEFAULT_VIDEO_DIR = "/mnt/pifile01/VIDEO TRANSFER";

const DEFAULT_CONFIG: BurnConfig = {
  input_path:       DEFAULT_VIDEO_DIR,
  output_dir:       "",
  start_time:       "",
  position:         "bottom-left",
  font_style:       "duplex",
  font_scale:       1.1,
  font_thickness:   2,
  text_color:       [255, 255, 255],
  box_alpha:        0.45,
  timestamp_format: "%m/%d/%Y  %I:%M:%S %p",
  extra_fields:     [],
  skip_existing:    true,
  dry_run:          false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): number[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(rgb: number[]): string {
  return "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
}

// ─── Preview Badge ────────────────────────────────────────────────────────────

function TimestampPreview({ config }: { config: BurnConfig }) {
  const now = new Date(2026, 6, 12, 18, 24, 35);

  const pad = (n: number) => String(n).padStart(2, "0");
  const month  = pad(now.getMonth() + 1);
  const day    = pad(now.getDate());
  const year   = now.getFullYear();
  const h24    = pad(now.getHours());
  const h12raw = now.getHours() % 12 || 12;
  const h12    = pad(h12raw);
  const min    = pad(now.getMinutes());
  const sec    = pad(now.getSeconds());
  const ampm   = now.getHours() >= 12 ? "PM" : "AM";
  const mon    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][now.getMonth()];

  const formatted = config.timestamp_format
    .replace("%Y", String(year)).replace("%m", month).replace("%d", day)
    .replace("%H", h24).replace("%I", h12).replace("%M", min)
    .replace("%S", sec).replace("%p", ampm).replace("%b", mon);

  const lines = [formatted];
  if (config.extra_fields.includes("investigator")) lines.push("INV: Frandy Perez-Estevez");
  if (config.extra_fields.includes("claim"))        lines.push("CLM: 1862-WC-25-0300081");

  const color = rgbToHex(config.text_color);

  const posClass: Record<string, string> = {
    "bottom-left":  "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2",
    "top-left":     "top-2 left-2",
    "top-right":    "top-2 right-2",
  };

  const fontClass: Record<string, string> = {
    duplex:  "font-mono font-normal",
    simplex: "font-mono font-light",
    triplex: "font-mono font-bold",
    plain:   "font-mono text-[10px]",
  };

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      {/* Fake video frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-1 opacity-10 w-full h-full p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded bg-slate-400" />
          ))}
        </div>
        <Film className="absolute h-12 w-12 text-slate-300" />
      </div>

      {/* Timestamp overlay */}
      <div
        className={`absolute ${posClass[config.position] || "bottom-2 left-2"} px-2 py-1 rounded`}
        style={{ backgroundColor: `rgba(0,0,0,${config.box_alpha})` }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={`leading-tight tracking-wider ${fontClass[config.font_style] || "font-mono"}`}
            style={{
              color,
              fontSize: `${Math.max(9, config.font_scale * 9)}px`,
              fontWeight: config.font_thickness >= 2 ? "600" : "400",
              textShadow: "1px 1px 0 #000",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function BurnProgress({ state }: { state: BurnState }) {
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [state.logs]);

  const statusColor = {
    idle:    "text-slate-400",
    running: "text-amber-400",
    done:    "text-emerald-400",
    error:   "text-red-400",
  }[state.status];

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-sm font-medium ${statusColor}`}>
          {state.status === "running" && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {state.status === "done"    && <CheckCircle2 className="h-3.5 w-3.5" />}
          {state.status === "error"   && <XCircle className="h-3.5 w-3.5" />}
          <span className="capitalize">{state.status}</span>
        </div>
        {state.status === "running" && (
          <span className="text-xs text-slate-400">
            {state.done_frames.toLocaleString()} / {state.total_frames.toLocaleString()} frames
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(state.status === "running" || state.status === "done") && (
        <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${state.progress_pct}%`,
              background: "linear-gradient(90deg, #ff6a1a, #ff3d00)",
            }}
          />
        </div>
      )}

      {/* Error */}
      {state.error && (
        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1.5 border border-red-800">
          {state.error}
        </p>
      )}

      {/* Logs */}
      {state.logs.length > 0 && (
        <div
          ref={logsRef}
          className="text-[10px] font-mono text-slate-400 bg-slate-900 rounded border border-slate-700 p-2 h-28 overflow-y-auto space-y-0.5"
        >
          {state.logs.map((l, i) => (
            <div key={i} className={
              l.startsWith("✅") ? "text-emerald-400" :
              l.startsWith("❌") ? "text-red-400" :
              l.startsWith("⏭") ? "text-slate-500" :
              l.startsWith("📹") ? "text-amber-300" :
              l.startsWith("🏁") ? "text-emerald-300 font-bold" :
              ""
            }>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VideoTimestampBurner() {
  const [config, setConfig] = useState<BurnConfig>(DEFAULT_CONFIG);
  const [burnState, setBurnState] = useState<BurnState>({
    status: "idle", job_id: null, input_path: null, output_path: null,
    progress_pct: 0, total_frames: 0, done_frames: 0,
    start_time_used: null, error: null, logs: [],
  });
  const [showBrowser, setShowBrowser] = useState(false);
  const [showOutputBrowser, setShowOutputBrowser] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll while running
  useEffect(() => {
    if (burnState.status === "running") {
      pollRef.current = setInterval(async () => {
        try {
          const data = await api.get("/api/pipeline/video-burn/status");
          setBurnState(data);
          if (data.status !== "running") clearInterval(pollRef.current!);
        } catch {}
      }, 800);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [burnState.status]);

  const set = <K extends keyof BurnConfig>(key: K, val: BurnConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: val }));

  const toggleExtraField = (field: string) =>
    set("extra_fields", config.extra_fields.includes(field)
      ? config.extra_fields.filter(f => f !== field)
      : [...config.extra_fields, field]
    );

  const handleStart = async () => {
    if (!config.input_path.trim()) {
      toast.error("Enter a video path or folder");
      return;
    }
    try {
      const payload = {
        ...config,
        output_dir:  config.output_dir.trim()  || null,
        start_time:  config.start_time.trim()  || null,
      };
      const data = await api.post("/api/pipeline/video-burn/start", payload);
      setBurnState(prev => ({ ...prev, status: "running", logs: [] }));
      toast.success(`Burn job started (${data.job_id})`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to start");
    }
  };

  const handleCancel = async () => {
    await api.post("/api/pipeline/video-burn/cancel");
    setBurnState(prev => ({ ...prev, status: "idle" }));
    toast.info("Job cancelled");
  };

  const isRunning = burnState.status === "running";

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-amber-900/30 border border-amber-800/40">
          <Film className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Video Timestamp Burner</h3>
          <p className="text-xs text-slate-500">Burn a running timestamp overlay onto surveillance videos</p>
        </div>
      </div>

      {/* Input path */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Input Path
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.input_path}
            onChange={e => set("input_path", e.target.value)}
            placeholder="/mnt/pifile01/VIDEO TRANSFER/CASE FOLDER"
            disabled={isRunning}
            className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 font-mono"
          />
          <button
            onClick={() => setShowBrowser(true)}
            disabled={isRunning}
            title="Browse folders"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: "rgba(255,106,26,0.35)", color: "#ff6a1a", background: "rgba(255,106,26,0.06)" }}>
            <FolderOpen className="h-3.5 w-3.5" />
            Browse
          </button>
        </div>
        <p className="text-[10px] text-slate-400">Single file or entire folder — subfolders are included</p>
      </div>

      {showBrowser && (
        <FileBrowser
          onSelect={(selectedPath, _type) => {
            set("input_path", selectedPath);
            setShowBrowser(false);
          }}
          onClose={() => setShowBrowser(false)}
        />
      )}

      {/* Output folder */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Output Folder
          <span className="text-[10px] text-slate-400 font-normal">(blank = same folder as input)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.output_dir}
            onChange={e => set("output_dir", e.target.value)}
            placeholder="/mnt/pifile01/TIMESTAMPED"
            disabled={isRunning}
            className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white
                       text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1
                       focus:ring-amber-500 disabled:opacity-50 font-mono"
          />
          <button
            onClick={() => setShowOutputBrowser(true)}
            disabled={isRunning}
            title="Browse output folder"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs
                       font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: "rgba(255,106,26,0.35)", color: "#ff6a1a", background: "rgba(255,106,26,0.06)" }}>
            <FolderOpen className="h-3.5 w-3.5" />
            Browse
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Output: <code className="bg-slate-100 px-1 rounded font-mono">original_name_TS.mp4</code>
        </p>
      </div>

      {showOutputBrowser && (
        <FileBrowser
          onSelect={(selectedPath, type) => {
            set("output_dir", type === "folder" ? selectedPath : selectedPath.split("/").slice(0,-1).join("/"));
            setShowOutputBrowser(false);
          }}
          onClose={() => setShowOutputBrowser(false)}
        />
      )}

      {/* Preview */}
      <TimestampPreview config={config} />

      {/* Style controls — 2 col grid */}
      <div className="grid grid-cols-2 gap-3">

        {/* Position */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <AlignLeft className="h-3 w-3" /> Position
          </label>
          <select
            value={config.position}
            onChange={e => set("position", e.target.value)}
            disabled={isRunning}
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white
                       text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500
                       disabled:opacity-50"
          >
            {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Font style */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Type className="h-3 w-3" /> Font Style
          </label>
          <select
            value={config.font_style}
            onChange={e => set("font_style", e.target.value)}
            disabled={isRunning}
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white
                       text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500
                       disabled:opacity-50"
          >
            {FONT_STYLES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* Timestamp format */}
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Date/Time Format
          </label>
          <select
            value={config.timestamp_format}
            onChange={e => set("timestamp_format", e.target.value)}
            disabled={isRunning}
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white
                       text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500
                       disabled:opacity-50"
          >
            {TIMESTAMP_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Text color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Text Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={rgbToHex(config.text_color)}
              onChange={e => set("text_color", hexToRgb(e.target.value))}
              disabled={isRunning}
              className="h-8 w-12 rounded border border-slate-200 cursor-pointer disabled:opacity-50 p-0.5"
            />
            <span className="text-[10px] font-mono text-slate-500">
              rgb({config.text_color.join(", ")})
            </span>
          </div>
        </div>

        {/* Box opacity */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Box Opacity <span className="text-slate-400">{Math.round(config.box_alpha * 100)}%</span>
          </label>
          <input
            type="range" min="0" max="0.9" step="0.05"
            value={config.box_alpha}
            onChange={e => set("box_alpha", parseFloat(e.target.value))}
            disabled={isRunning}
            className="w-full accent-amber-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Extra fields */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">Extra Fields (parsed from filename)</label>
        <div className="flex gap-2">
          {["investigator", "claim"].map(field => (
            <button
              key={field}
              onClick={() => toggleExtraField(field)}
              disabled={isRunning}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                config.extra_fields.includes(field)
                  ? "bg-amber-500/10 border-amber-500/50 text-amber-600 font-medium"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {field === "investigator" ? "Investigator name" : "Claim number"}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Settings2 className="h-3 w-3" />
        Advanced options
        <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">

          {/* Font size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Font Size <span className="text-slate-400">{config.font_scale.toFixed(1)}x</span>
              </label>
              <input
                type="range" min="0.6" max="2.5" step="0.1"
                value={config.font_scale}
                onChange={e => set("font_scale", parseFloat(e.target.value))}
                disabled={isRunning}
                className="w-full accent-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                Thickness <span className="text-slate-400">{config.font_thickness}px</span>
              </label>
              <input
                type="range" min="1" max="4" step="1"
                value={config.font_thickness}
                onChange={e => set("font_thickness", parseInt(e.target.value))}
                disabled={isRunning}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Manual start time */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Manual Start Time
              <span className="text-[10px] text-slate-400 font-normal">(leave blank = auto from filename + mtime)</span>
            </label>
            <input
              type="text"
              value={config.start_time}
              onChange={e => set("start_time", e.target.value)}
              placeholder="2026-07-12 09:14:00"
              disabled={isRunning}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white
                         text-slate-800 placeholder:text-slate-400 focus:outline-none
                         focus:ring-1 focus:ring-amber-500 font-mono disabled:opacity-50"
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            {[
              { key: "skip_existing" as const, label: "Skip if overlay exists" },
              { key: "dry_run" as const,       label: "Dry run (no files written)" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <div
                  onClick={() => set(key, !config[key])}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    config[key] ? "bg-amber-500" : "bg-slate-300"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    config[key] ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </div>
                {label}
              </label>
            ))}
          </div>

          {/* Info box */}
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
            <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-600 leading-relaxed">
              Outputs are saved as <code className="font-mono bg-blue-100 px-1 rounded">original_name_TS.mp4</code>.
              Originals are never modified. Processing speed depends on video resolution — 1080p ≈ 3–5 fps on CPU.
            </p>
          </div>
        </div>
      )}

      {/* Progress / logs */}
      {burnState.status !== "idle" && (
        <BurnProgress state={burnState} />
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {!isRunning ? (
          <Button
            onClick={handleStart}
            className="flex-1 gap-2 text-xs h-9"
            style={{ background: "linear-gradient(135deg, #ff6a1a, #ff3d00)" }}
          >
            <Play className="h-3.5 w-3.5" />
            {config.dry_run ? "Dry Run" : "Burn Timestamps"}
          </Button>
        ) : (
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1 gap-2 text-xs h-9 border-red-300 text-red-600 hover:bg-red-50"
          >
            <Square className="h-3.5 w-3.5" />
            Cancel Job
          </Button>
        )}
      </div>

    </div>
  );
}
