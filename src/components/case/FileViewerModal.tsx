/**
 * Full-screen previewer for case documents.
 *
 * Bytes are pulled with `fetch` (so the session cookie always rides along) and
 * rendered from the *response* content type rather than the filename — an
 * attachment we do not hold comes back as placeholder artwork, and that should
 * display as an image even though the row calls it a PDF.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, FileWarning, Loader2, X } from "lucide-react";
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
  loadBlob: (fileId: string) => Promise<Blob>;
  downloadUrl: (fileId: string) => string;
};

const fmtBytes = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type Loaded = { url: string; type: string; text: string | null };

export function FileViewerModal({ open, files, initialFileId, onClose, loadBlob, downloadUrl }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialFileId ?? files[0]?.id ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const index = useMemo(() => files.findIndex((f) => f.id === activeId), [files, activeId]);
  const active = index >= 0 ? files[index] : null;

  useEffect(() => {
    if (open) setActiveId(initialFileId ?? files[0]?.id ?? null);
  }, [open, initialFileId, files]);

  // One in-flight request owns the preview: an older response must not replace
  // a newer one when the user clicks through the list quickly.
  useEffect(() => {
    if (!open || !activeId) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setLoaded(null);

    loadBlob(activeId)
      .then(async (blob) => {
        if (cancelled) return;
        const type = blob.type || "application/octet-stream";
        const text = type.startsWith("text/") || type.includes("json") ? await blob.text() : null;
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ url: objectUrl, type, text });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this file.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, activeId, loadBlob]);

  const step = useCallback(
    (delta: number) => {
      if (files.length < 2 || index < 0) return;
      const next = (index + delta + files.length) % files.length;
      setActiveId(files[next].id);
    },
    [files, index],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open || !active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[rgba(3,6,12,0.86)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${active.filename}`}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[0.8125rem] text-[var(--color-text-hi)]">{active.filename}</div>
          <div className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            {fmtBytes(active.sizeBytes)} · {active.storageKey ? active.storage : "not stored"}
            {files.length > 1 && ` · ${index + 1} of ${files.length}`}
          </div>
        </div>

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
          className="inline-flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line-2)] px-2.5 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-hi)]"
        >
          <Download size={13} />
          Download
        </a>

        <IconButton label="Close preview" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1">
        {files.length > 1 && (
          <nav className="w-56 shrink-0 overflow-y-auto border-r border-[var(--color-line)] p-2">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveId(file.id)}
                className={cn(
                  "mb-1 block w-full rounded-[0.5rem] px-2.5 py-2 text-left transition-colors",
                  file.id === activeId ? "bg-white/[0.07]" : "hover:bg-white/[0.04]",
                )}
              >
                <div
                  className={cn(
                    "truncate font-mono text-[0.6875rem]",
                    file.id === activeId ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]",
                  )}
                >
                  {file.filename}
                </div>
                <div className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {file.storageKey ? fmtBytes(file.sizeBytes) : "not stored"}
                </div>
              </button>
            ))}
          </nav>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto p-4">
          {loading && <Loader2 size={22} className="animate-spin text-[var(--color-text-lo)]" />}

          {!loading && error && (
            <div className="flex max-w-sm flex-col items-center gap-3 text-center">
              <FileWarning size={28} className="text-[var(--color-neg)]" />
              <p className="text-[0.8125rem] text-[var(--color-neg)]">{error}</p>
            </div>
          )}

          {!loading && !error && loaded && <Preview loaded={loaded} filename={active.filename} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Preview({ loaded, filename }: { loaded: Loaded; filename: string }) {
  if (loaded.type.startsWith("image/")) {
    return <img src={loaded.url} alt={filename} className="max-h-full max-w-full object-contain" />;
  }

  if (loaded.type === "application/pdf") {
    return <iframe src={loaded.url} title={filename} className="h-full w-full rounded-[0.5rem] bg-white" />;
  }

  if (loaded.text !== null) {
    return (
      <pre className="h-full w-full overflow-auto rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)] p-4 font-mono text-[0.71875rem] leading-relaxed text-[var(--color-text-mid)]">
        {loaded.text}
      </pre>
    );
  }

  return (
    <div className="flex max-w-sm flex-col items-center gap-3 text-center">
      <FileWarning size={28} className="text-[var(--color-text-lo)]" />
      <p className="text-[0.8125rem] text-[var(--color-text-mid)]">
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
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.5rem] text-[var(--color-text-mid)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-hi)]"
    >
      {children}
    </button>
  );
}
