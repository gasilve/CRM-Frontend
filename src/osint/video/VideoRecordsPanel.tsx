import { useRef, useState } from "react";
import { Upload, Loader2, Film, CheckCircle2, Send, HardDrive, CalendarDays, User, ChevronDown, ChevronRight, Play } from "lucide-react";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { PanelShell } from "@/pages/case-detail-panels";
import type { VideoRecord, useVideoState } from "./useVideoState";

type State = ReturnType<typeof useVideoState>;

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  uploaded:  { label: "Uploaded",  color: "#64748b", icon: HardDrive },
  published: { label: "Published", color: "#3b82f6", icon: CheckCircle2 },
  delivered: { label: "Delivered", color: "#10b981", icon: Send },
};

const fmtBytes = (b: number | null) => !b ? "—" :
  b > 1e9 ? (b/1e9).toFixed(2)+" GB" :
  b > 1e6 ? (b/1e6).toFixed(1)+" MB" : (b/1e3).toFixed(0)+" KB";

const fmtDate = (s: string | null) => !s ? "—" :
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function EmptyState({ state, onFiles }: { state: State; onFiles: (f: FileList) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex cursor-pointer flex-col items-center gap-3 rounded-[0.75rem] border-2 border-dashed border-[var(--color-line-2)] p-8 text-center transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)]"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      >
        <Upload size={28} className="text-[var(--color-text-lo)]" />
        <div>
          <div className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">No videos yet</div>
          <div className="mt-1 text-[0.75rem] text-[var(--color-text-lo)]">Drop files here or click to upload</div>
        </div>
        {state.uploading && (
          <div className="flex items-center gap-2 text-[0.75rem] text-[var(--color-text-mid)]">
            <Loader2 size={14} className="animate-spin" /> Uploading…
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" multiple accept="video/*" className="hidden"
        onChange={e => { if (e.target.files?.length) onFiles(e.target.files); }} />
      {state.uploadMsg.map((m, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-[0.5rem] px-3 py-2 text-[0.75rem] ${m.ok ? "bg-[rgba(16,185,129,0.1)] text-[#10b981]" : "bg-[rgba(239,68,68,0.1)] text-[#ef4444]"}`}>
          {m.ok ? <CheckCircle2 size={13}/> : "✕"} {m.name}: {m.msg}
        </div>
      ))}
    </div>
  );
}

function RecordRow({ r, selected, onClick, onPlay }: { r: VideoRecord; selected: boolean; onClick: () => void; onPlay: () => void }) {
  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.uploaded;
  const Icon = cfg.icon;
  return (
    <div
      className={`w-full rounded-[0.625rem] border transition-all ${
        selected
          ? "border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]"
          : "border-[var(--color-line)] bg-[var(--color-ink-2)] hover:border-[var(--color-line-2)]"
      }`}
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
    <button type="button" onClick={onClick} className="w-full p-3 text-left">
      <div className="flex items-start gap-2.5">
        <Film size={14} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
            {r.original_filename}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[0.625rem] text-[var(--color-text-lo)]">
            <span>{fmtBytes(r.file_size_bytes)}</span>
            <span>·</span>
            <span>{fmtDate(r.media_created_at ?? r.uploaded_at)}</span>
          </div>
          {r.investigator_override && (
            <div className="mt-0.5 text-[0.625rem] text-[var(--color-text-mid)]">
              {r.investigator_override}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1" style={{ color: cfg.color }}>
          <Icon size={11} />
          <span className="font-mono text-[0.5rem]">{cfg.label}</span>
        </div>
      </div>
    </button>
    <div className="flex items-center border-t border-[var(--color-line)]/40 px-3 py-1.5">
      <button type="button" onClick={onPlay}
        className="flex items-center gap-1 text-[0.5625rem] text-[var(--color-text-lo)] hover:text-[var(--color-accent)] transition-colors">
        <Play size={10} fill="currentColor"/> Play
      </button>
    </div>
    </div>
  );
}


type GroupBy = "none" | "date" | "investigator";

function groupRecords(records: VideoRecord[], by: GroupBy) {
  if (by === "none") return [{ key: "all", label: "All", items: records }];
  const map = new Map<string, VideoRecord[]>();
  for (const r of records) {
    let key: string;
    if (by === "date") {
      key = r.media_created_at
        ? new Date(r.media_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "No date";
    } else {
      key = r.investigator_override || r.uploaded_by_name || "Unknown";
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([key, items]) => ({ key, label: key, items }));
}

export function VideoRecordsPanel({
  state, selectedId, onSelect,
}: {
  state: State;
  selectedId: number | null;
  onSelect: (r: VideoRecord) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setExpanded(s => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const [modalRecord, setModalRecord] = useState<VideoRecord | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [videoType, setVideoType] = useState("HD");

  return (
    <>
    <PanelShell
      title="Videos"
      icon={<Film size={11} strokeWidth={1.8} />}
      action={
  state.records.length > 0 ? (
          <div className="flex items-center gap-1">
            <button type="button" title="Group by date"
              onClick={() => setGroupBy(g => g === "date" ? "none" : "date")}
              className={"flex items-center gap-1 rounded-[0.375rem] border px-1.5 py-0.5 text-[0.5625rem] transition-colors " + (groupBy === "date" ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]")}>
              <CalendarDays size={9} /> Date
            </button>
            <button type="button" title="Group by investigator"
              onClick={() => setGroupBy(g => g === "investigator" ? "none" : "investigator")}
              className={"flex items-center gap-1 rounded-[0.375rem] border px-1.5 py-0.5 text-[0.5625rem] transition-colors " + (groupBy === "investigator" ? "border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]")}>
              <User size={9} /> Investigator
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 rounded-[0.375rem] border border-[var(--color-line)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]">
              <Upload size={9} />
            </button>
          </div>
        ) : undefined
      }
    >
      <input ref={fileRef} type="file" multiple accept="video/*" className="hidden"
        onChange={e => { if (e.target.files?.length) { setPendingFiles(e.target.files); } }} />

      {state.loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[0.75rem] text-[var(--color-text-lo)]">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : state.records.length === 0 ? (
        <EmptyState state={state} onFiles={setPendingFiles} />
      ) : (
        <div className="flex flex-col gap-2">
          {state.uploading && (
            <div className="flex items-center gap-2 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-2 text-[0.75rem] text-[var(--color-accent)]">
              <Loader2 size={13} className="animate-spin" /> Uploading…
            </div>
          )}
          {state.uploadMsg.map((m, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-[0.5rem] px-3 py-2 text-[0.75rem] ${m.ok ? "bg-[rgba(16,185,129,0.1)] text-[#10b981]" : "bg-[rgba(239,68,68,0.1)] text-[#ef4444]"}`}>
              {m.ok ? <CheckCircle2 size={12}/> : "✕"} {m.name}: {m.msg}
            </div>
          ))}
          {groupRecords(state.records, groupBy).map(group => (
            <div key={group.key}>
              {groupBy !== "none" && (
                <button type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="mb-1 flex w-full items-center gap-1.5 rounded-[0.375rem] px-1 py-1 text-left hover:bg-[var(--color-ink-3)]">
                  {expanded.has(group.key)
                    ? <ChevronDown size={11} className="text-[var(--color-text-lo)]"/>
                    : <ChevronRight size={11} className="text-[var(--color-text-lo)]"/>}
                  <span className="flex-1 text-[0.6875rem] font-semibold text-[var(--color-text-hi)]">{group.label}</span>
                  <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{group.items.length}</span>
                </button>
              )}
              {expanded.has(group.key) && group.items.map(r => (
                <RecordRow key={r.id} r={r} selected={r.id === selectedId} onClick={() => onSelect(r)} onPlay={() => setModalRecord(r)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
    {pendingFiles && (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70"
        onClick={() => setPendingFiles(null)}>
        <div className="surface w-full max-w-sm rounded-[1rem] p-6 shadow-2xl"
          onClick={e => e.stopPropagation()}>
          <div className="mb-4 text-[0.9375rem] font-semibold text-[var(--color-text-hi)]">
            Select video type
          </div>
          <div className="mb-4 text-[0.75rem] text-[var(--color-text-mid)]">
            {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} ready to upload
          </div>
          <div className="mb-5 flex gap-2">
            {["HD", "Cover", "Ultra"].map(t => (
              <button key={t} type="button" onClick={() => setVideoType(t)}
                className="flex-1 rounded-[0.5rem] border py-2.5 text-[0.8125rem] font-semibold transition-colors"
                style={{
                  background: videoType === t ? "var(--color-accent)" : "var(--color-ink-3)",
                  color: videoType === t ? "white" : "var(--color-text-mid)",
                  borderColor: videoType === t ? "var(--color-accent)" : "var(--color-line)",
                }}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPendingFiles(null)}
              className="flex-1 rounded-[0.5rem] border border-[var(--color-line)] py-2 text-[0.8125rem] text-[var(--color-text-mid)]">
              Cancel
            </button>
            <button type="button"
              onClick={() => { state.upload(pendingFiles, videoType); setPendingFiles(null); }}
              className="flex-1 rounded-[0.5rem] bg-[var(--color-accent)] py-2 text-[0.8125rem] font-semibold text-white">
              Upload
            </button>
          </div>
        </div>
      </div>
    )}
    {modalRecord && (
      <VideoPlayerModal record={modalRecord} onClose={() => setModalRecord(null)} />
    )}
    </>
  );
}
