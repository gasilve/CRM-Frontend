import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ImageOff, ScanFace, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCasePhoto } from "@/hooks/useCasePhoto";
import { READABLE_DATE_CLASS } from "@/lib/journal";
import type { CaseDayEntry } from "@/lib/crm-api";

/**
 * Every investigator-facing entity (subject, cohabitants, vehicles, home) opens
 * in this one shell at one fixed size, so moving between them doesn't resize the
 * window under the investigator's cursor. Panes below manage their own scroll —
 * the shell itself never scrolls.
 */
export interface EntityTab {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function EntityModal({
  accent,
  soft,
  eyebrow,
  title,
  subtitle,
  hero,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  children,
}: {
  accent: string;
  soft: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  hero?: ReactNode;
  tabs?: EntityTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="surface flex h-[min(88vh,44rem)] w-full max-w-[min(72rem,95vw)] flex-col overflow-hidden rounded-[1.25rem] shadow-2xl"
        style={{ borderColor: accent, borderWidth: "0.0625rem", borderStyle: "solid" }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-4 py-3" style={{ background: soft }}>
          {hero}
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[0.5625rem] uppercase tracking-[0.22em]" style={{ color: accent }}>
              {eyebrow}
            </div>
            <div className="truncate text-[1.125rem] font-semibold leading-tight text-[var(--color-text-hi)]">{title}</div>
            {subtitle && <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-mid)]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {tabs && tabs.length > 1 && (
          <div className="flex shrink-0 gap-1 border-b border-[var(--color-line)] px-3 pt-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const on = t.key === activeTab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTabChange?.(t.key)}
                  className={cn(
                    "relative -mb-px flex items-center gap-1.5 rounded-t-[0.625rem] border border-b-0 px-3.5 py-2 text-[0.8125rem] transition-colors",
                    on
                      ? "border-[var(--color-line-2)] bg-[var(--color-ink-2)] text-[var(--color-text-hi)]"
                      : "border-transparent text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
                  )}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {t.label}
                  {!!t.badge && (
                    <span className="ml-0.5 rounded-full bg-[var(--color-ink-3)] px-1.5 font-mono text-[0.625rem] text-[var(--color-text-mid)]">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* `relative` anchors AddPhotoPanel's overlay to the body, not the viewport. */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Resolves an internal case-file reference (or a plain URL) and renders it. */
export function CasePhoto({
  caseId,
  photoUrl,
  alt,
  className,
  fit = "cover",
}: {
  caseId: string;
  photoUrl: string | null | undefined;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const src = useCasePhoto(caseId, photoUrl);
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-[var(--color-ink-3)]", className)}>
        <ImageOff size={18} className="text-[var(--color-text-lo)] opacity-40" />
      </div>
    );
  }
  return <img src={src} alt={alt ?? ""} className={cn(fit === "cover" ? "object-cover" : "object-contain", className)} />;
}

// ─── Photo library ──────────────────────────────────────────────────────────

export interface LibraryPhoto {
  id: string;
  url: string;
  label: string;
  when: string | null;
  author?: string | null;
  /** On-file photos came with the case; field photos were captured by an investigator. */
  source: "on_file" | "field";
}

const fmtWhen = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

/**
 * A grid of every still we hold for one entity, with the selected one blown up
 * beside it. This is the "library" half of each entity modal.
 */
export function PhotoLibraryPane({
  caseId,
  photos,
  accent,
  canAdd,
  onAdd,
  onCompare,
  emptyHint,
}: {
  caseId: string;
  photos: LibraryPhoto[];
  accent: string;
  canAdd?: boolean;
  onAdd?: () => void;
  onCompare?: (photo: LibraryPhoto) => void;
  emptyHint?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(photos[0]?.id ?? null);
  const selected = photos.find((p) => p.id === selectedId) ?? photos[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "group relative aspect-[4/3] overflow-hidden rounded-[0.875rem] border transition-all",
                selected?.id === p.id ? "border-[var(--color-line-3)] ring-2 ring-inset" : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
              )}
              style={selected?.id === p.id ? ({ ["--tw-ring-color" as string]: accent } as never) : undefined}
            >
              <CasePhoto caseId={caseId} photoUrl={p.url} alt={p.label} className="h-full w-full" />
              {p.source === "on_file" && (
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-wider text-white">
                  On file
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-left font-mono text-[0.5625rem] text-white/85">
                {fmtWhen(p.when)}
              </span>
            </button>
          ))}
          {onAdd && (
            <button
              type="button"
              onClick={canAdd ? onAdd : undefined}
              disabled={!canAdd}
              title={canAdd ? "Add photo" : "Start the clock to add photos"}
              className={cn(
                "flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-[0.875rem] border-2 border-dashed text-center transition-colors",
                !canAdd && "cursor-not-allowed opacity-40 grayscale",
              )}
              style={{ borderColor: accent, color: accent }}
            >
              <Upload size={20} strokeWidth={1.8} />
              <span className="text-[0.75rem] font-medium">Add photo</span>
            </button>
          )}
        </div>
        {photos.length === 0 && !onAdd && (
          <p className="mt-4 text-[0.8125rem] text-[var(--color-text-lo)]">{emptyHint ?? "No photos held yet."}</p>
        )}
      </div>

      {selected && (
        <div className="hidden w-[19rem] shrink-0 flex-col lg:flex">
          <div className="overflow-hidden rounded-[1rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
            <CasePhoto caseId={caseId} photoUrl={selected.url} alt={selected.label} className="aspect-[4/3] w-full" />
          </div>
          <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto">
            <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-hi)]">{selected.label}</p>
            <div className="mt-2 flex flex-col gap-0.5">
              <span className={cn("text-[0.6875rem]", READABLE_DATE_CLASS)}>{fmtWhen(selected.when)}</span>
              {selected.author && <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">by {selected.author}</span>}
              <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                {selected.source === "on_file" ? "Pre-surveillance / on file" : "Captured in the field"}
              </span>
            </div>
          </div>
          {onCompare && (
            <button
              type="button"
              onClick={() => onCompare(selected)}
              className="mt-2.5 inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.625rem] px-3 py-2.5 text-[0.8125rem] font-semibold text-white"
              style={{ background: accent }}
            >
              <ScanFace size={15} strokeWidth={1.9} />
              Compare this photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Visual-comparison history ──────────────────────────────────────────────

export interface ComparisonRecord {
  id: string;
  score: number | null;
  verdict: string;
  threshold: number | null;
  probeUrl: string | null;
  probeLabel: string | null;
  subjectUrl: string | null;
  when: string;
  author: string | null;
  source: string | null;
}

/** Reads the `face_match` journal entries back out as a comparison log. */
export function comparisonsFromEntries(entries: (CaseDayEntry & { date?: string })[]): ComparisonRecord[] {
  return entries
    .filter((e) => e.type === "face_match")
    .map((e) => {
      const meta = (e.meta ?? {}) as Record<string, unknown>;
      const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
      const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
      return {
        id: e.id,
        score: num(meta.score),
        verdict: str(meta.verdict) ?? (e.body?.split("·")[0]?.trim() ?? "—"),
        threshold: num(meta.threshold),
        probeUrl: str(meta.probePhotoUrl) ?? e.photoUrl,
        probeLabel: str(meta.probeLabel),
        subjectUrl: str(meta.subjectPhotoUrl),
        when: e.createdAt,
        author: e.author?.name ?? null,
        source: str(meta.source),
      };
    })
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
}

export function ComparisonHistory({ caseId, records }: { caseId: string; records: ComparisonRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-[0.8125rem] text-[var(--color-text-lo)]">
        No comparisons run yet. Pick two photos above and run one — every result is logged here and in the journal.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {records.map((r) => {
        const isMatch = r.verdict.toUpperCase().startsWith("MATCH");
        const color = isMatch ? "var(--color-pos)" : "var(--color-neg)";
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] p-2">
            <div className="flex shrink-0 gap-1">
              <CasePhoto caseId={caseId} photoUrl={r.subjectUrl} className="h-11 w-11 rounded-[0.5rem]" />
              <CasePhoto caseId={caseId} photoUrl={r.probeUrl} className="h-11 w-11 rounded-[0.5rem]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.875rem] font-semibold" style={{ color }}>
                  {r.verdict}
                </span>
                {r.score != null && (
                  <span className="font-mono text-[0.75rem] text-[var(--color-text-mid)]">
                    {r.score}%{r.threshold != null ? ` / ${r.threshold}%` : ""}
                  </span>
                )}
              </div>
              <div className="truncate font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                {r.probeLabel ?? "Field still"} · <span className={READABLE_DATE_CLASS}>{fmtWhen(r.when)}</span>
                {r.author ? ` · ${r.author}` : ""}
              </div>
            </div>
            <div className="shrink-0 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              {r.source === "cfr" ? "CFR" : "Mock"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Two-strip picker: which photo on file, which probe — then run it. */
export function ComparePicker({
  caseId,
  photos,
  accent,
  subjectId,
  probeId,
  onPick,
  onRun,
  disabled,
}: {
  caseId: string;
  photos: LibraryPhoto[];
  accent: string;
  subjectId: string | null;
  probeId: string | null;
  onPick: (slot: "subject" | "probe", id: string) => void;
  onRun: () => void;
  disabled?: boolean;
}) {
  const strip = (slot: "subject" | "probe", currentId: string | null) => (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(slot, p.id)}
          className={cn(
            "h-16 w-16 shrink-0 overflow-hidden rounded-[0.625rem] border-2 transition-colors",
            currentId === p.id ? "" : "border-[var(--color-line)] opacity-60 hover:opacity-100",
          )}
          style={currentId === p.id ? { borderColor: accent } : undefined}
          title={p.label}
        >
          <CasePhoto caseId={caseId} photoUrl={p.url} className="h-full w-full" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="rounded-[1rem] border border-[var(--color-line-2)] bg-[var(--color-ink-2)] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">Photo A — on file</div>
          {strip("subject", subjectId)}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">Photo B — to verify</div>
          {strip("probe", probeId)}
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={disabled || !subjectId || !probeId || subjectId === probeId}
        className="mt-3 inline-flex items-center gap-2 rounded-[0.625rem] px-4 py-2.5 text-[0.8125rem] font-semibold text-white disabled:opacity-40"
        style={{ background: accent }}
      >
        <ScanFace size={15} strokeWidth={1.9} />
        Run visual comparison
      </button>
      {subjectId && subjectId === probeId && (
        <span className="ml-2 text-[0.75rem] text-[var(--color-text-lo)]">Pick two different photos.</span>
      )}
    </div>
  );
}

/**
 * In-modal capture: pick or drop a photo, write what it shows, save. Rendered
 * as an overlay inside the entity modal so the investigator never loses their
 * place, and so we don't stack a second dialog on top of a dialog.
 */
export function AddPhotoPanel({
  accent,
  title,
  hint,
  busy,
  onSubmit,
  onCancel,
}: {
  accent: string;
  title: string;
  hint?: string;
  busy?: boolean;
  onSubmit: (file: File, note: string) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const take = (f: File | null | undefined) => {
    if (f && f.type.startsWith("image/")) setFile(f);
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--color-ink-1)]/97 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[1rem] font-semibold text-[var(--color-text-hi)]">{title}</div>
          {hint && <div className="text-[0.75rem] text-[var(--color-text-lo)]">{hint}</div>}
        </div>
        <button type="button" onClick={onCancel} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
          <X size={18} />
        </button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "grid min-h-0 flex-1 cursor-pointer place-items-center rounded-[1rem] border-2 border-dashed transition-colors",
          dragOver ? "bg-[var(--color-accent-soft)]" : "bg-[var(--color-ink-3)]",
        )}
        style={{ borderColor: dragOver ? accent : "var(--color-line-2)" }}
      >
        {preview ? (
          <img src={preview} alt="" className="max-h-full max-w-full rounded-[0.875rem] object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Upload size={26} strokeWidth={1.5} style={{ color: accent }} />
            <div className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">Drop a photo here</div>
            <div className="text-[0.75rem] text-[var(--color-text-mid)]">or click to open your camera / files</div>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
      </label>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What does this photo show?"
        className="mt-3 w-full rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2.5 text-[0.875rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none"
      />

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-2 text-[0.8125rem] text-[var(--color-text-mid)]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => file && onSubmit(file, note.trim())}
          className="rounded-[0.625rem] px-4 py-2 text-[0.8125rem] font-semibold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          {busy ? "Saving…" : "Save photo"}
        </button>
      </div>
    </div>
  );
}

/** Label/value rows used by the detail panes. */
export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">{label}</div>
      <div className="mt-0.5 break-words text-[0.8125rem] text-[var(--color-text-hi)]">{value || "—"}</div>
    </div>
  );
}
