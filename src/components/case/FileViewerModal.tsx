/**
 * Document previewer — centered solid modal matching the CRM shell
 * (`dashboard-modal-backdrop` + `surface`), not a full-screen glass sheet.
 *
 * Non-previewable types (docx, etc.) never go into an iframe — browsers treat
 * that as a download, which is what popped a save dialog when switching files.
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

type Kind = "pdf" | "image" | "text" | "other";

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

const kindFrom = (file: ViewerFile, responseType?: string): Kind => {
  const type = (responseType || file.contentType || "").toLowerCase();
  const ext = extOf(file.filename);
  if (type.includes("pdf") || ext === "pdf") return "pdf";
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (type.startsWith("text/") || type.includes("json") || ["txt", "csv", "md", "json", "log"].includes(ext)) {
    return "text";
  }
  return "other";
};

/** True when the browser can render this inline — never iframe anything else. */
const isPreviewable = (kind: Kind, type: string): boolean => {
  if (kind === "pdf") return type.includes("pdf") || type === "application/octet-stream" || !type;
  if (kind === "image") return type.startsWith("image/") || type === "application/octet-stream" || !type;
  if (kind === "text") return type.startsWith("text/") || type.includes("json") || type === "application/octet-stream" || !type;
  return false;
};

const FileKindIcon = ({ kind, className }: { kind: Kind; className?: string }) => {
  if (kind === "pdf") return <FileText size={14} strokeWidth={1.8} className={className} />;
  if (kind === "image") return <FileImage size={14} strokeWidth={1.8} className={className} />;
  if (kind === "text") return <File size={14} strokeWidth={1.8} className={className} />;
  return <FileWarning size={14} strokeWidth={1.8} className={className} />;
};

type Cached = { url: string; type: string; text: string | null; blob: Blob; kind: Kind };

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export function FileViewerModal({ open, files, initialFileId, onClose, loadBlob, downloadUrl }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialFileId ?? files[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Cached | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const cacheRef = useRef(new Map<string, Cached>());

  const index = useMemo(() => files.findIndex((f) => f.id === activeId), [files, activeId]);
  const active = index >= 0 ? files[index] : null;

  useEffect(() => {
    if (open) {
      setActiveId(initialFileId ?? files[0]?.id ?? null);
      setZoom(1);
    }
  }, [open, initialFileId, files]);

  useEffect(() => {
    if (open) return;
    for (const entry of cacheRef.current.values()) URL.revokeObjectURL(entry.url);
    cacheRef.current.clear();
    setLoaded(null);
    setError(null);
    setLoading(false);
  }, [open]);

  const materialize = useCallback(async (file: ViewerFile, blob: Blob): Promise<Cached> => {
    const existing = cacheRef.current.get(file.id);
    if (existing) return existing;
    const type = blob.type || file.contentType || "application/octet-stream";
    const kind = kindFrom(file, type);
    const text = kind === "text" && isPreviewable(kind, type) ? await blob.text() : null;
    const url = isPreviewable(kind, type) ? URL.createObjectURL(blob) : "";
    const entry: Cached = { url, type, text, blob, kind };
    cacheRef.current.set(file.id, entry);
    return entry;
  }, []);

  useEffect(() => {
    if (!open || !activeId || !active) return;

    const cached = cacheRef.current.get(activeId);
    if (cached && reloadToken === 0) {
      setLoaded(cached);
      setError(null);
      setLoading(false);
      return;
    }

    if (reloadToken > 0) {
      const stale = cacheRef.current.get(activeId);
      if (stale?.url) URL.revokeObjectURL(stale.url);
      cacheRef.current.delete(activeId);
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLoaded(null);
    setZoom(1);

    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    const file = active;

    loadBlob(activeId, controller.signal)
      .then((blob) => materialize(file, blob))
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
  }, [open, activeId, active, loadBlob, materialize, reloadToken]);

  useEffect(() => {
    if (!open || index < 0 || files.length < 2) return;
    const neighbours = [files[index - 1], files[index + 1]].filter(Boolean) as ViewerFile[];
    for (const neighbour of neighbours) {
      if (cacheRef.current.has(neighbour.id) || !neighbour.storageKey) continue;
      if (kindFrom(neighbour) === "other") continue;
      void loadBlob(neighbour.id)
        .then((blob) => materialize(neighbour, blob))
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

  const downloadActive = useCallback(async () => {
    if (!active) return;
    setDownloading(true);
    try {
      const cached = cacheRef.current.get(active.id);
      const blob = cached?.blob ?? (await loadBlob(active.id));
      triggerDownload(blob, active.filename);
    } catch {
      window.location.assign(downloadUrl(active.id));
    } finally {
      setDownloading(false);
    }
  }, [active, loadBlob, downloadUrl]);

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

  const responseKind = loaded?.kind ?? kindFrom(active);
  const isPlaceholder = loaded?.type === "image/svg+xml" && !active.storageKey;
  const notStored = !active.storageKey;
  const canPreview =
    !notStored && !isPlaceholder && loaded != null && isPreviewable(loaded.kind, loaded.type);
  const multi = files.length > 1;

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="surface flex w-full max-w-[min(68rem,96vw)] flex-col overflow-hidden rounded-[1.125rem]"
        style={{ height: "min(86vh, 52rem)" }}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${active.filename}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — solid, no glass */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3 md:px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] text-[var(--color-accent-2)]">
            <FileKindIcon kind={responseKind} />
          </div>

          <div className="min-w-0 flex-1">
            <div
              className="truncate font-[family-name:var(--font-display)] text-[1.2rem] italic leading-tight text-[var(--color-text-hi)]"
              title={active.filename}
            >
              {active.filename}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              <span>{fmtBytes(active.sizeBytes)}</span>
              {multi && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {index + 1} / {files.length}
                  </span>
                </>
              )}
              {(notStored || isPlaceholder) && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-[var(--color-warn)]">Not stored</span>
                </>
              )}
            </div>
          </div>

          {responseKind === "image" && canPreview && (
            <div className="hidden items-center gap-0.5 sm:flex">
              <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
                <Minus size={14} />
              </IconButton>
              <button
                type="button"
                className="min-w-[2.75rem] rounded-[0.5rem] px-1 py-1 font-mono text-[0.5625rem] text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)]"
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

          {multi && (
            <div className="flex items-center gap-0.5">
              <IconButton label="Previous file" onClick={() => step(-1)}>
                <ChevronLeft size={16} />
              </IconButton>
              <IconButton label="Next file" onClick={() => step(1)}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
          )}

          <IconButton
            label={downloading ? "Downloading…" : "Download"}
            onClick={() => void downloadActive()}
            disabled={downloading || notStored}
          >
            <Download size={15} />
          </IconButton>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 bg-[var(--color-ink-2)]">
          {multi && (
            <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-ink-1)] p-2 sm:block md:w-60">
              <div className="eyebrow mb-2 px-2 text-[var(--color-text-lo)]">Files</div>
              <div className="flex flex-col gap-0.5">
                {files.map((file) => {
                  const selected = file.id === activeId;
                  const kind = kindFrom(file);
                  return (
                    <button
                      key={file.id}
                      type="button"
                      title={file.filename}
                      onClick={() => {
                        setActiveId(file.id);
                        setZoom(1);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[var(--radius-tile)] px-2.5 py-2 text-left transition-colors",
                        selected
                          ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                          : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
                      )}
                    >
                      <FileKindIcon
                        kind={kind}
                        className={cn(
                          "mt-0.5 shrink-0",
                          selected ? "text-[var(--color-accent-2)]" : "text-[var(--color-text-lo)]",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-mono text-[0.6875rem] leading-snug">{file.filename}</span>
                        <span className="mt-0.5 block font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                          {file.storageKey
                            ? `${fmtBytes(file.sizeBytes)} · ${extOf(file.filename) || "file"}`
                            : "not stored"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 md:p-4">
              {loading && (
                <div className="flex flex-col items-center gap-3" role="status" aria-live="polite" aria-busy="true">
                  <BeamLoader className="w-40" />
                  <LoadingCaption>Loading document</LoadingCaption>
                </div>
              )}

              {!loading && error && (
                <div className="max-w-sm px-4 py-6 text-center">
                  <FileWarning size={26} className="mx-auto text-[var(--color-neg)]" />
                  <p className="mt-3 font-[family-name:var(--font-display)] text-[1.15rem] italic text-[var(--color-text-hi)]">
                    Couldn’t open this file
                  </p>
                  <p className="mt-1.5 text-[0.8125rem] text-[var(--color-neg)]">{error}</p>
                  <button
                    type="button"
                    className="dashboard-modal-btn mt-4 inline-flex items-center gap-1.5 !h-9 !px-3 !text-[0.75rem]"
                    onClick={() => setReloadToken((n) => n + 1)}
                  >
                    <RotateCcw size={12} />
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && loaded && (
                <Preview
                  loaded={loaded}
                  filename={active.filename}
                  zoom={zoom}
                  notStored={notStored || isPlaceholder}
                  reason={active.error}
                  canPreview={canPreview}
                  onDownload={() => void downloadActive()}
                  downloading={downloading}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Preview({
  loaded,
  filename,
  zoom,
  notStored,
  reason,
  canPreview,
  onDownload,
  downloading,
}: {
  loaded: Cached;
  filename: string;
  zoom: number;
  notStored: boolean;
  reason?: string | null;
  canPreview: boolean;
  onDownload: () => void;
  downloading: boolean;
}) {
  if (notStored) {
    return (
      <div className="max-w-sm px-4 py-6 text-center anim-rise">
        <FileWarning size={26} className="mx-auto text-[var(--color-warn)]" />
        <p className="mt-3 font-[family-name:var(--font-display)] text-[1.15rem] italic text-[var(--color-text-hi)]">
          Contents unavailable
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
          {reason || "This attachment was listed by the ingestor without its bytes."}
        </p>
      </div>
    );
  }

  if (!canPreview || loaded.kind === "other") {
    return (
      <div className="max-w-sm px-4 py-6 text-center anim-rise">
        <FileWarning size={26} className="mx-auto text-[var(--color-text-lo)]" />
        <p className="mt-3 font-[family-name:var(--font-display)] text-[1.15rem] italic text-[var(--color-text-hi)]">
          Preview not available
        </p>
        <p className="mt-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
          {(extOf(filename) || "This").toUpperCase()} files can’t be shown here. Download to open locally.
        </p>
        <button
          type="button"
          className="dashboard-modal-btn dashboard-modal-btn--primary mt-4 inline-flex items-center gap-1.5 !h-9 !px-3 !text-[0.75rem]"
          onClick={onDownload}
          disabled={downloading}
        >
          <Download size={12} />
          {downloading ? "Downloading…" : "Download"}
        </button>
      </div>
    );
  }

  if (loaded.kind === "image" && loaded.url) {
    return (
      <div className="flex h-full w-full items-center justify-center anim-fade">
        <img
          src={loaded.url}
          alt={filename}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-full max-w-full origin-center object-contain transition-transform duration-200 ease-out"
        />
      </div>
    );
  }

  if (loaded.kind === "pdf" && loaded.url) {
    return (
      <div className="h-full w-full overflow-hidden rounded-[var(--radius-tile)] border border-[var(--color-line)] bg-white anim-rise">
        <iframe
          src={`${loaded.url}#toolbar=0&navpanes=0&scrollbar=1`}
          title={filename}
          className="h-full w-full bg-white"
        />
      </div>
    );
  }

  if (loaded.text !== null) {
    return (
      <pre className="h-full max-h-full w-full overflow-auto rounded-[var(--radius-tile)] border border-[var(--color-line)] bg-[var(--color-ink-1)] p-4 font-mono text-[0.75rem] leading-relaxed text-[var(--color-text-mid)] anim-rise">
        {loaded.text}
      </pre>
    );
  }

  return null;
}

function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-tile)] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
