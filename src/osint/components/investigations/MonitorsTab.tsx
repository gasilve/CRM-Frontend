// @ts-nocheck

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Radio, Plus, RefreshCw, Trash2, ExternalLink, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = typeof window !== "undefined" ? (!["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000") : "";

interface Monitor {
  id: number; url: string; label: string; interval_hrs: number;
  last_checked_at: string | null; last_changed_at: string | null;
  change_count: number; is_active: boolean; created_at: string;
}

interface Snapshot {
  id: number; snapshot_path: string; hash: string;
  diff_score: number; changed_regions: any; captured_at: string;
}

export function MonitorsTab({ investigationId }: { investigationId: number }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newInterval, setNewInterval] = useState(24);
  const [checking, setChecking] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, Snapshot[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/investigations/${investigationId}/monitors`);
      if (r.ok) setMonitors(await r.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [investigationId]);

  const addMonitor = async () => {
    if (!newUrl.trim()) return;
    try {
      const r = await fetch(`${API}/api/investigations/${investigationId}/monitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, label: newLabel || newUrl, check_interval_hrs: newInterval }),
      });
      if (r.ok) {
        toast.success("Monitor added");
        setNewUrl(""); setNewLabel(""); setAdding(false);
        load();
      } else toast.error("Failed to add monitor");
    } catch { toast.error("Error adding monitor"); }
  };

  const checkNow = async (mid: number) => {
    setChecking(mid);
    try {
      const r = await fetch(`${API}/api/monitors/${mid}/check`, { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        toast[d.changed ? "warning" : "success"](
          d.changed ? `Change detected! ${d.diff_score}% pixels changed` : "No changes detected"
        );
        load();
      } else toast.error("Check failed");
    } catch { toast.error("Check error"); }
    setChecking(null);
  };

  const loadSnapshots = async (mid: number) => {
    if (expanded === mid) { setExpanded(null); return; }
    setExpanded(mid);
    if (snapshots[mid]) return;
    try {
      const r = await fetch(`${API}/api/monitors/${mid}/snapshots`);
      if (r.ok) { const data = await r.json(); setSnapshots(s => ({ ...s, [mid]: data })); }
    } catch {}
  };

  const deleteMonitor = async (mid: number) => {
    await fetch(`${API}/api/monitors/${mid}`, { method: "DELETE" });
    toast.success("Monitor removed");
    load();
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "Never";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold text-slate-700">Page Monitors</span>
          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">replaces Visualping</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setAdding(v => !v)}>
          <Plus className="h-3 w-3" />Add URL
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="border border-blue-100 rounded-xl bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-medium text-blue-800">Monitor a URL for changes</p>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            placeholder="https://www.facebook.com/subjectname"
            value={newUrl} onChange={e => setNewUrl(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white"
              placeholder="Label (optional)"
              value={newLabel} onChange={e => setNewLabel(e.target.value)}
            />
            <select
              className="border rounded-lg px-3 py-2 text-sm bg-white"
              value={newInterval} onChange={e => setNewInterval(Number(e.target.value))}>
              <option value={6}>Every 6h</option>
              <option value={12}>Every 12h</option>
              <option value={24}>Every 24h</option>
              <option value={48}>Every 48h</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={addMonitor}>Save monitor</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : monitors.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No monitors yet</p>
          <p className="text-xs mt-1">Add a URL to track changes — social profiles, obituaries, web pages</p>
        </div>
      ) : (
        <div className="space-y-2">
          {monitors.map(m => (
            <div key={m.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-shrink-0">
                  {m.change_count > 0
                    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                    : <CheckCircle className="h-4 w-4 text-slate-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.url}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />Checked: {fmt(m.last_checked_at)}
                    </span>
                    {m.change_count > 0 && (
                      <span className="text-[10px] text-amber-600 font-medium">
                        {m.change_count} change{m.change_count !== 1 ? "s" : ""} detected
                      </span>
                    )}
                    <span className="text-[10px] text-slate-300">Every {m.interval_hrs}h</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500"
                    onClick={() => checkNow(m.id)} disabled={checking === m.id}>
                    <RefreshCw className={`h-3 w-3 ${checking === m.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500"
                    onClick={() => loadSnapshots(m.id)}>
                    {expanded === m.id ? "▲" : "History"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                    onClick={() => deleteMonitor(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Snapshot history */}
              {expanded === m.id && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Snapshot history</p>
                  {!snapshots[m.id] ? (
                    <div className="flex justify-center py-3"><div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" /></div>
                  ) : snapshots[m.id].length === 0 ? (
                    <p className="text-xs text-slate-400">No snapshots yet — run a check first</p>
                  ) : (
                    <div className="space-y-1.5">
                      {snapshots[m.id].map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-100">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${s.diff_score > 5 ? "bg-amber-400" : "bg-emerald-400"}`} />
                          <span className="text-[10px] text-slate-500 w-32 flex-shrink-0">{fmt(s.captured_at)}</span>
                          {s.diff_score > 0 && (
                            <span className="text-[10px] text-amber-600 font-medium">{s.diff_score?.toFixed(1)}% changed</span>
                          )}
                          <span className="text-[10px] text-slate-300 font-mono ml-auto">{s.hash}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
