import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckSquare, Loader2, Square } from "lucide-react";
import { GlobalWorkerOptions, getDocument, Util } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cn } from "@/lib/cn";
import type { EditableParagraph } from "@/lib/reports-api";

// Vite ?url respects base (/admin/) so the worker loads in prod.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SCALE = 1.35;

type Anchor = {
  paragraphId: string;
  pageIndex: number;
  top: number;
  left: number;
};

interface PdfPreviewProps {
  pdfBytes: ArrayBuffer;
  className?: string;
  revision?: number;
  paragraphs?: EditableParagraph[];
  activeId?: string | null;
  onSelectParagraph?: (paragraphId: string) => void;
}

function needleFor(p: EditableParagraph): string {
  const fromLabel = p.label.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/i,
  )?.[0];
  if (fromLabel) return fromLabel;
  const fromText = p.text.match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/i,
  )?.[0];
  if (fromText) return fromText;
  return p.text.slice(0, 40);
}

function findLineTop(
  items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>,
  viewport: { transform: number[]; width: number },
  needle: string,
): number | null {
  if (!needle.trim()) return null;
  const needleLower = needle.toLowerCase().replace(/\s+/g, " ").trim();
  const probe = needleLower.slice(0, Math.min(28, needleLower.length));

  let plain = "";
  const segs: { start: number; end: number; transform: number[] }[] = [];
  for (const item of items) {
    if (!item.str || !item.transform) continue;
    const start = plain.length;
    plain += item.str;
    segs.push({ start, end: plain.length, transform: item.transform });
  }

  let hit = plain.toLowerCase().indexOf(probe);
  if (hit < 0) {
    // collapsed search — map back poorly; try first word of date
    const firstWord = probe.split(",")[0] ?? probe;
    hit = plain.toLowerCase().indexOf(firstWord);
  }
  if (hit < 0) return null;

  const seg = segs.find((s) => s.end > hit) ?? segs[0];
  if (!seg) return null;
  const tx = Util.transform(viewport.transform, seg.transform);
  return tx[5]; // y in viewport space
}

/** View-only PDF with tick buttons beside editable paragraphs. */
export default function PdfPreview({
  pdfBytes,
  className,
  revision = 0,
  paragraphs = [],
  activeId = null,
  onSelectParagraph,
}: PdfPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevAnchorsRef = useRef<Anchor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [pagesReady, setPagesReady] = useState(0);

  const paragraphKey = paragraphs.map((p) => `${p.id}:${p.label}`).join(",");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;
    setError(null);
    setLoading(true);

    const run = async () => {
      try {
        pdf = await getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise;
        if (cancelled || !hostRef.current) return;
        setPageCount(pdf.numPages);

        // Build pages offscreen, then swap in at once to avoid a blank flash.
        const builtPages: HTMLDivElement[] = [];
        const overlays: (HTMLDivElement | null)[] = [];
        const found: Anchor[] = [];
        const claimed = new Set<string>();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled || !hostRef.current) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: SCALE });

          const pageWrap = document.createElement("div");
          pageWrap.className = "pdf-page";
          pageWrap.style.width = `${Math.floor(viewport.width)}px`;
          pageWrap.style.height = `${Math.floor(viewport.height)}px`;

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          pageWrap.appendChild(canvas);

          const overlay = document.createElement("div");
          overlay.className = "pdf-page-overlay";
          overlay.style.cssText =
            "position:absolute;inset:0;pointer-events:none;z-index:2;";
          pageWrap.appendChild(overlay);

          await page.render({ canvasContext: context, viewport }).promise;

          const textContent = await page.getTextContent();
          const items = textContent.items as Array<{
            str?: string;
            transform?: number[];
            hasEOL?: boolean;
          }>;
          for (const p of paragraphs) {
            if (claimed.has(p.id)) continue;
            // Try label date, text date, and a short text probe — during PDF lag
            // after a date edit, one of these usually still matches the on-screen page.
            const needles = [
              needleFor(p),
              p.label.slice(0, 40),
              p.text.slice(0, 40),
            ].filter((n, i, arr) => n.trim() && arr.indexOf(n) === i);

            let y: number | null = null;
            for (const needle of needles) {
              y = findLineTop(items, viewport, needle);
              if (y != null) break;
            }
            if (y == null) continue;
            found.push({
              paragraphId: p.id,
              pageIndex: pageNum - 1,
              top: Math.max(2, y - 12),
              left: Math.floor(viewport.width) - 32,
            });
            claimed.add(p.id);
          }

          builtPages.push(pageWrap);
          overlays.push(overlay);
        }

        // Keep prior tick positions when a paragraph can't be re-matched yet
        // (common right after a date edit while the PDF is still catching up).
        const liveIds = new Set(paragraphs.map((p) => p.id));
        for (const prev of prevAnchorsRef.current) {
          if (claimed.has(prev.paragraphId)) continue;
          if (!liveIds.has(prev.paragraphId)) continue;
          if (prev.pageIndex >= builtPages.length) continue;
          found.push(prev);
          claimed.add(prev.paragraphId);
        }

        if (cancelled || !hostRef.current) return;
        hostRef.current.replaceChildren(...builtPages);
        pageRefs.current = overlays;
        prevAnchorsRef.current = found;
        setAnchors(found);
        setPagesReady((n) => n + 1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not render PDF preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      void pdf?.destroy();
    };
  }, [pdfBytes, revision, paragraphKey, paragraphs]);

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-auto pdf-host", className)}>
      {loading && pagesReady === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
          <div className="flex items-center gap-2 rounded-tile border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 text-[0.75rem] text-[var(--color-text-mid)]">
            <Loader2 size={14} className="animate-spin" />
            Rendering preview…
            {pageCount > 0 ? ` (${pageCount} pages)` : ""}
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 top-4 z-10 flex items-start gap-2 rounded-tile border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.1)] px-3 py-2 text-[0.75rem] text-[var(--color-neg)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div ref={hostRef} className="pdf-pages select-none" />

      {pagesReady > 0 &&
        anchors.map((a) => {
          const mount = pageRefs.current[a.pageIndex];
          if (!mount) return null;
          const active = a.paragraphId === activeId;
          return createPortal(
            <button
              key={a.paragraphId}
              type="button"
              title="Edit this paragraph"
              onClick={() => onSelectParagraph?.(a.paragraphId)}
              className={cn(
                "pointer-events-auto absolute grid h-7 w-7 place-items-center rounded-md border shadow-md transition-colors",
                active
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-600",
              )}
              style={{ top: a.top, left: a.left }}
            >
              {active ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>,
            mount,
          );
        })}
    </div>
  );
}
