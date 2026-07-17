import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { reportsApi, type EditableParagraph } from "@/lib/reports-api";
import DocxPreview from "./DocxPreview";
import PdfPreview from "./PdfPreview";

interface DocumentPreviewProps {
  file: File | null;
  className?: string;
  revision?: number;
  paragraphs?: EditableParagraph[];
  activeId?: string | null;
  onSelectParagraph?: (paragraphId: string) => void;
}

/**
 * Prefer Graph/LibreOffice PDF preview. Falls back to docx-preview.
 * When paragraphs are provided, tick anchors appear on the PDF.
 */
export default function DocumentPreview({
  file,
  className,
  revision = 0,
  paragraphs = [],
  activeId = null,
  onSelectParagraph,
}: DocumentPreviewProps) {
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [mode, setMode] = useState<"loading" | "pdf" | "docx">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);
  const hasPdf = useRef(false);

  useEffect(() => {
    if (!file) {
      setPdfBytes(null);
      setMode("loading");
      setNotice(null);
      hasPdf.current = false;
      return;
    }

    const seq = ++requestSeq.current;
    const background = hasPdf.current;
    if (background) {
      setRefreshing(true);
    } else {
      setMode("loading");
      setNotice(null);
    }

    const run = async () => {
      try {
        const bytes = await reportsApi.wordPreview(file);
        if (seq !== requestSeq.current) return; // stale
        setPdfBytes(bytes);
        setMode("pdf");
        hasPdf.current = true;
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const message =
          err instanceof Error
            ? err.message
            : "PDF preview unavailable — using browser DOCX preview.";
        setNotice(message);
        // Keep an existing PDF on screen if we had one; only downgrade on first load.
        if (!hasPdf.current) setMode("docx");
      } finally {
        if (seq === requestSeq.current) setRefreshing(false);
      }
    };

    void run();
    return () => {
      // Mark in-flight request stale on unmount/change.
      requestSeq.current++;
    };
  }, [file, revision]);

  if (!file) {
    return <div className={cn("min-h-0 flex-1", className)} />;
  }

  if (mode === "loading") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center gap-2 text-[12px] text-[var(--color-text-mid)]",
          className,
        )}
      >
        <Loader2 size={14} className="animate-spin" />
        Building Word-like preview…
      </div>
    );
  }

  if (mode === "pdf" && pdfBytes) {
    return (
      <div className={cn("relative min-h-0 flex-1 flex flex-col", className)}>
        {refreshing ? (
          <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-3 py-1.5 text-[11px] text-[var(--color-text-mid)] shadow">
            <Loader2 size={12} className="animate-spin" />
            Updating preview…
          </div>
        ) : null}
        <PdfPreview
          pdfBytes={pdfBytes}
          className="min-h-0 flex-1"
          revision={revision}
          paragraphs={paragraphs}
          activeId={activeId}
          onSelectParagraph={onSelectParagraph}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-0 flex-1 flex flex-col", className)}>
      {notice ? (
        <div className="flex items-start gap-2 border-b border-[var(--color-line)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[11px] text-[var(--color-text-mid)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <span>
            {notice} Word-cloud (Graph) or LibreOffice preview is unavailable on
            the files-api host.
          </span>
        </div>
      ) : null}
      <DocxPreview file={file} revision={revision} className="min-h-0 flex-1" />
      {paragraphs.length > 0 && onSelectParagraph ? (
        <div className="border-t border-[var(--color-line)] p-2">
          <p className="mb-1 text-[10px] text-[var(--color-text-lo)]">
            PDF anchors unavailable — pick a paragraph:
          </p>
          <div className="flex flex-wrap gap-1">
            {paragraphs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectParagraph(p.id)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px]",
                  activeId === p.id
                    ? "border-sky-500 bg-sky-500/20 text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-mid)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
