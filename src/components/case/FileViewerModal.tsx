/**
 * Full-screen document previewer — editorial chrome matching the CRM shell.
 *
 * Bytes are pulled with `fetch` (session cookie rides along) and rendered from
 * the *response* content type: missing attachments come back as placeholder
 * artwork and should display as images even when the row still says PDF.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileText,
  FileWarning,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { BeamLoader, LoadingCaption } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";

/** Shape shared by `CaseFile` and `PendingCaseFile`. */
export type ViewerFile = {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number | null;
  storage: string;
  storageKey: string | null;
  error?: string | null;
};

type Props = {
  open: boolean;
  files: ViewerFile[];
  /** Which file to show when the modal opens. Falls back to the first. */
  initialFileId?: string | null;
  onClose: () => void;
  loadBlob: (fileId: string, signal?: AbortSignal) => Promise<Blob>;
  downloadUrl: (fileId: string) => string;
};

const fmtBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const extOf = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

const kindFrom = (file: ViewerFile, responseType?: string): "pdf" | "image" | "text" | "other" => {
  const type = (responseType || file.contentType || "").toLowerCase();
  const ext = extOf(file.filename);
  if (type.includes("pdf") || ext === "pdf") return "pdf";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (type.startsWith("text/") || type.includes("json") || ["txt", "csv", "md", "json", "log"].includes(ext)) {
    return "text";
  }
  return "other";
};

const FileKindIcon = ({ kind, className }: { kind: ReturnType<typeof kindFrom>; className?: string }) => {
  if (kind === "pdf") return <FileText size={14} strokeWidth={1.8} className={className} />;
  if (kind === "image") return <FileImage size={14} strokeWidth={1.8} className={className} />;
  if (kind === "text") return <File size={14} strokeWidth={1.8} className={className} />;
  return <FileWarning size={14} strokeWidth={1.8} className={className} />;
};

type Cached = { url: string; type: string; text: string | null; blob: Blob };

export function FileViewerModal({ open, files, initialFileId, onClose, loadBlob, downloadUrl }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialFileId ?? files[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const cacheRef = useRef(new Map<string, Cached>());

  const index = useMemo(() => files.findIndex((f) => f.id === activeId), [files, activeId]);
  const active = index >= 0 ? files[index] : null;
  const storedCount = useMemo(() => files.filter((f) => f.storageKey).length, [files]);

  useEffect(() => {
    if (open) {
      setActiveId(initialFileId ?? files[0]?.id ?? null);
      setZoom(1);
    }
  }, [open, initialFileId, files]);

  // Drop object URLs when the modal closes so we don't leak blobs across cases.
  useEffect(() => {
    if (open) return;
    for (const entry of cacheRef.current.values()) URL.revokeObjectURL(entry.url);
    cacheRef.current.clear();
    setLoaded(null);
    setError(null);
    setLoading(false);
  }, [open]);

  const materialize = useCallback(async (fileId: string, blob: Blob): Promise<Cached> => {
    const existing = cacheRef.current.get(fileId);
    if (existing) return existing;
    const type = blob.type || "application/octet-stream";
    const text = type.startsWith("text/") || type.includes("json") ? await blob.text() : null;
    const url = URL.createObjectURL(blob);
    const entry: Cached = { url, type, text, blob };
    cacheRef.current.set(fileId, entry);
    return entry;
  }, []);

  useEffect(() => {
    if (!open || !activeId) return;

    const cached = cacheRef.current.get(activeId);
    if (cached && reloadToken === 0) {
      setLoaded(cached);
      setError(null);
      setLoading(false);
      return;
    }

    if (reloadToken > 0) cacheRef.current.delete(activeId);

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLoaded(null);
    setZoom(1);

    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    loadBlob(activeId, controller.signal)
      .then((blob) => materialize(activeId, blob))
      .then((entry) => {
        if (!controller.signal.aborted) {
          setLoaded(entry);
          setReloadToken(0);
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error && err.name === "AbortError"
            ? "Timed out loading this file."
            : err instanceof Error
              ? err.message
              : "Could not load this file.";
        setError(message);
        setReloadToken(0);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, activeId, loadBlob, materialize, reloadToken]);

  // Prefetch neighbours while the current file is on screen.
  useEffect(() => {
    if (!open || index < 0 || files.length < 2) return;
    const neighbours = [files[index - 1], files[index + 1]].filter(Boolean) as ViewerFile[];
    for (const neighbour of neighbours) {
      if (cacheRef.current.has(neighbour.id) || !neighbour.storageKey) continue;
      const controller = new AbortController();
      void loadBlob(neighbour.id, controller.signal)
        .then((blob) => materialize(neighbour.id, blob))
        .catch(() => {
          /* prefetch is best-effort */
        });
    }
  }, [open, index, files, loadBlob, materialize]);

  const step = useCallback(
    (delta: number) => {
      if (files.length < 2 || index < 0) return;
      const next = (index + delta + files.length) % files.length;
      setActiveId(files[next].id);
      setZoom(1);
    },
    [files, index],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
      if (e.key === "-") setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
      if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open || !active) return null;

  const responseKind = kindFrom(active, loaded?.type);
  const isPlaceholder = loaded?.type === "image/svg+xml" && !active.storageKey;
  const notStored = !active.storageKey;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--color-backdrop)] backdrop-blur-[0.375rem] anim-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${active.filename}`}
    >
      <header className="relative shrink-0 border-b border-[var(--color-line)] bg-[var(--color-ink-1)]/90 px-4 py-3 md:px-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent-glow)] to-transparent opacity-70" />
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
            <FileKindIcon kind={responseKind} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="eyebrow text-[var(--color-text-lo)]">Case documents</div>
            <div className="truncate font-[family-name:var(--font-display)] text-[1.15rem] italic leading-tight text-[var(--color-text-hi)]">
              {active.filename}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              <span>{fmtBytes(active.sizeBytes)}</span>
              <span aria-hidden>·</span>
              <StorageChip file={active} placeholder={isPlaceholder} />
              {files.length > 1 && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {index + 1} of {files.length}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {storedCount}/{files.length} stored
                  </span>
                </>
              )}
            </div>
          </div>

          {responseKind === "image" && !notStored && (
            <div className="hidden items-center gap-1 sm:flex">
              <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
                <Minus size={14} />
              </IconButton>
              <button
                type="button"
                className="min-w-[3rem] rounded-[0.5rem] px-1.5 py-1 font-mono text-[0.625rem] text-[var(--color-text-mid)] hover:bg-white/[0.05]"
                onClick={() => setZoom(1)}
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
                <Plus size={14} />
              </IconButton>
            </div>
          )}

          {files.length > 1 && (
            <div className="flex items-center gap-1">
              <IconButton label="Previous file" onClick={() => step(-1)}>
                <ChevronLeft size={16} />
              </IconButton>
              <IconButton label="Next file" onClick={() => step(1)}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
          )}

          <a
            href={downloadUrl(active.id)}
            download={active.filename}
            className="dashboard-modal-btn dashboard-modal-btn--primary inline-flex items-center gap-1.5 !py-1.5 !text-[0.71875rem]"
          >
            <Download size={13} />
            Download
          </a>

          <IconButton label="Close preview" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {files.length > 1 && (
          <nav className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/55 p-2.5 md:block">
            <div className="eyebrow mb-2 px-1.5 text-[var(--color-text-lo)]">Files</div>
            <div className="anim-stagger-tight flex flex-col gap-1">
              {files.map((file) => {
                const selected = file.id === activeId;
                const kind = kindFrom(file);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => {
                      setActiveId(file.id);
                      setZoom(1);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-[var(--radius-tile)] border px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                        : "border-[var(--color-line-2)] bg-[var(--color-ink-3)]/35 hover:border-[var(--color-accent)]",
                    )}
                  >
                    <FileKindIcon
                      kind={kind}
                      className={cn(
                        "mt-0.5 shrink-0",
                        file.storageKey ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-mono text-[0.6875rem]",
                          selected ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]",
                        )}
                      >
                        {file.filename}
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                        {file.storageKey ? fmtBytes(file.sizeBytes) : "not stored"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 md:p-6">
            {loading && (
              <div className="flex flex-col items-center gap-3" role="status" aria-live="polite" aria-busy="true">
                <BeamLoader className="w-44" />
                <LoadingCaption>Loading document</LoadingCaption>
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {fmtBytes(active.sizeBytes)}
                </p>
              </div>
            )}

            {!loading && error && (
              <div className="surface max-w-md px-6 py-8 text-center anim-rise">
                <FileWarning size={28} className="mx-auto text-[var(--color-neg)]" />
                <p className="mt-3 font-[family-name:var(--font-display)] text-[1.25rem] italic text-[var(--color-text-hi)]">
                  Couldn’t open this file
                </p>
                <p className="mt-2 text-[0.8125rem] text-[var(--color-neg)]">{error}</p>
                <button
                  type="button"
                  className="dashboard-modal-btn mt-5 inline-flex items-center gap-1.5"
                  onClick={() => setReloadToken((n) => n + 1)}
                >
                  <RotateCcw size={13} />
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && loaded && (
              <Preview
                loaded={loaded}
                filename={active.filename}
                kind={responseKind}
                zoom={zoom}
                notStored={notStored || isPlaceholder}
                reason={active.error}
              />
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-ink-1)]/70 px-4 py-2 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            <span className="hidden sm:inline">Esc close · ← → navigate · − + zoom</span>
            <span className="truncate sm:hidden">{active.filename}</span>
            <span className="shrink-0">{extOf(active.filename) || "file"}</span>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StorageChip({ file, placeholder }: { file: ViewerFile; placeholder: boolean }) {
  if (!file.storageKey || placeholder) {
    return (
      <span className="rounded-full border border-[var(--color-warn)]/35 bg-[var(--color-warn)]/10 px-1.5 py-0.5 text-[var(--color-warn)]">
        Not stored
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[var(--color-pos)]/30 bg-[var(--color-pos)]/10 px-1.5 py-0.5 text-[var(--color-pos)]">
      {file.storage}
    </span>
  );
}

function Preview({
  loaded,
  filename,
  kind,
  zoom,
  notStored,
  reason,
}: {
  loaded: Cached;
  filename: string;
  kind: ReturnType<typeof kindFrom>;
  zoom: number;
  notStored: boolean;
  reason?: string | null;
}) {
  if (notStored || (kind === "image" && loaded.type.includes("svg") && notStored)) {
    return (
      <div className="flex max-w-3xl flex-col items-center gap-4 anim-rise">
        {loaded.type.startsWith("image/") && (
          <img
            src={loaded.url}
            alt={filename}
            className="max-h-[55vh] max-w-full rounded-[var(--radius-card)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] object-contain shadow-[0_24px_80px_rgba(0,0,0,var(--shadow-alpha))]"
          />
        )}
        <div className="surface max-w-md px-5 py-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-[1.15rem] italic text-[var(--color-text-hi)]">
            Contents unavailable
          </p>
          <p className="mt-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
            {reason || "This attachment was listed by the ingestor without its bytes."}
          </p>
        </div>
      </div>
    );
  }

  if (loaded.type.startsWith("image/") || kind === "image") {
    return (
      <div className="flex min-h-full w-full items-center justify-center anim-fade">
        <img
          src={loaded.url}
          alt={filename}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-[78vh] max-w-full origin-center object-contain transition-transform duration-200 ease-out"
        />
      </div>
    );
  }

  if (loaded.type === "application/pdf" || kind === "pdf") {
    return (
      <div className="surface h-full min-h-[70vh] w-full max-w-5xl overflow-hidden p-0 anim-rise">
        <iframe src={loaded.url} title={filename} className="h-full min-h-[70vh] w-full bg-white" />
      </div>
    );
  }

  if (loaded.text !== null) {
    return (
      <pre className="surface h-full max-h-[78vh] w-full max-w-4xl overflow-auto p-5 font-mono text-[0.75rem] leading-relaxed text-[var(--color-text-mid)] anim-rise">
        {loaded.text}
      </pre>
    );
  }

  return (
    <div className="surface max-w-md px-6 py-8 text-center anim-rise">
      <FileWarning size={28} className="mx-auto text-[var(--color-text-lo)]" />
      <p className="mt-3 font-[family-name:var(--font-display)] text-[1.25rem] italic text-[var(--color-text-hi)]">
        Preview not available
      </p>
      <p className="mt-2 text-[0.8125rem] text-[var(--color-text-mid)]">
        This file type cannot be previewed in the browser. Download it to open it locally.
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-tile)] border border-transparent text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:bg-white/[0.05] hover:text-[var(--color-text-hi)]"
    >
      {children}
    </button>
  );
}
