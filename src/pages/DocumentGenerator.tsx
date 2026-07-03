import { useCallback, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  Upload,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Replace,
} from "lucide-react";
import { cn } from "@/lib/cn";
import StyleRulesPanel from "@/components/document-generator/StyleRulesPanel";

const DEMO_PDF_URL = `${import.meta.env.BASE_URL}demo-report.pdf`;
const MAX_FILE_MB = 25;
const ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function DocumentGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedAt, setUploadedAt] = useState<Date | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleCount, setRuleCount] = useState(2);

  const clearFile = useCallback(() => {
    setFile(null);
    setUploadedAt(null);
    setDocxHtml(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [pdfUrl]);

  const runGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }

    await new Promise((r) => setTimeout(r, 1800));

    try {
      const res = await fetch(DEMO_PDF_URL);
      if (!res.ok) throw new Error("Demo PDF unavailable");
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch {
      setError("Could not generate preview right now.");
    } finally {
      setGenerating(false);
    }
  }, [pdfUrl]);

  const loadDocx = useCallback(
    async (next: File) => {
      setError(null);
      setPreviewLoading(true);
      setDocxHtml(null);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }

      try {
        const arrayBuffer = await next.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(result.value || "<p><em>Document appears empty.</em></p>");
        setPreviewLoading(false);
        await runGenerate();
      } catch {
        setError("Could not read this file. Make sure it is a valid .docx document.");
        setFile(null);
        setUploadedAt(null);
        setPreviewLoading(false);
      }
    },
    [pdfUrl, runGenerate],
  );

  const acceptFile = useCallback(
    (next: File) => {
      const name = next.name.toLowerCase();
      if (!name.endsWith(".docx")) {
        setError("Only .docx files are supported.");
        return;
      }
      if (next.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`File must be under ${MAX_FILE_MB} MB.`);
        return;
      }
      setError(null);
      setFile(next);
      setUploadedAt(new Date());
      void loadDocx(next);
    },
    [loadDocx],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  };

  const handleDownload = () => {
    if (!pdfUrl || !file) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${file.name.replace(/\.docx$/i, "")}-report.pdf`;
    a.click();
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">
            Report Generator
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-lo)]">
            Convert case documents to formatted PDFs
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className={cn(
            "shrink-0 flex items-center gap-2 rounded-tile border px-4 py-2.5 text-[13px] font-medium transition-colors",
            "border-[var(--color-line-2)] bg-[var(--color-ink-2)] text-[var(--color-text-mid)]",
            "hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text-hi)]",
          )}
        >
          <Lightbulb size={15} className="text-[var(--color-accent-2)]" />
          Style rules
          {ruleCount > 0 && (
            <span className="rounded-full bg-[var(--color-warn)]/15 px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-warn)]">
              {ruleCount}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[10px] bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] px-4 py-3 text-[var(--color-neg)] text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Source */}
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <div className="eyebrow mb-1">Source</div>
            <h2 className="text-[15px] font-medium text-[var(--color-text-hi)]">Document</h2>
          </div>

          <div className="flex flex-1 min-h-0 flex-col p-5 gap-3">
            {!file ? (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex flex-1 min-h-[360px] flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors",
                  dragOver
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-line-2)]",
                )}
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
                  <Upload size={22} strokeWidth={1.5} />
                </div>
                <div className="text-center px-4">
                  <p className="text-[13px] font-medium text-[var(--color-text-hi)]">Drop a .docx here</p>
                  <p className="text-[12px] text-[var(--color-text-lo)] mt-1">
                    or click to browse · max {MAX_FILE_MB} MB
                  </p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) acceptFile(picked);
                  }}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50 px-3 py-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[var(--color-ink-2)] text-[var(--color-text-mid)]">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-text-hi)] truncate">{file.name}</p>
                    <p className="text-[11px] text-[var(--color-text-lo)]">
                      {formatBytes(file.size)}
                      {uploadedAt && ` · Uploaded ${formatUploadedAt(uploadedAt)}`}
                    </p>
                  </div>
                  {previewLoading ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-lo)]">
                      <Loader2 size={12} className="animate-spin" />
                      Parsing…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-pos)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-pos)]" />
                      Parsed
                    </span>
                  )}
                </div>

                <div className="doc-paper flex-1 min-h-0 overflow-y-auto">
                  {previewLoading ? (
                    <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-[var(--color-text-lo)] text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      Reading document…
                    </div>
                  ) : docxHtml ? (
                    <div
                      className="docx-preview text-[13px] leading-relaxed text-[#1a1a1a]"
                      dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={clearFile}
                  className="flex items-center justify-center gap-2 rounded-tile border border-[var(--color-line)] py-2 text-[12px] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] hover:border-[var(--color-line-2)] transition-colors"
                >
                  <Replace size={14} />
                  Replace file
                </button>
              </>
            )}
          </div>
        </section>

        {/* Converted */}
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <div className="eyebrow mb-1">Output</div>
            <h2 className="text-[15px] font-medium text-[var(--color-text-hi)]">Converted preview</h2>
          </div>

          <div className="flex flex-1 min-h-0 flex-col p-5 gap-3">
            {file && (
              <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50 px-3 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] text-[var(--color-text-mid)]">
                    Template: <span className="text-[var(--color-text-hi)]">Standard field report</span>
                  </p>
                  <p className="text-[11px] text-[var(--color-text-lo)] truncate">
                    Letterhead, timeline table, photo block
                  </p>
                </div>
                {ruleCount > 0 && (
                  <span className="shrink-0 rounded-full border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 px-2 py-0.5 text-[10px] font-mono text-[var(--color-warn)]">
                    {ruleCount} rules applied
                  </span>
                )}
              </div>
            )}

            <div
              className={cn(
                "flex flex-1 min-h-[360px] overflow-hidden rounded-[10px] border border-[var(--color-line)]",
                !pdfUrl && !generating && "bg-[var(--color-ink-1)]/40",
              )}
            >
              {generating ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
                  <div>
                    <p className="text-[13px] text-[var(--color-text-mid)]">Converting document…</p>
                    <p className="text-[11px] text-[var(--color-text-lo)] mt-1">
                      Extracting sections · applying {ruleCount} rules · formatting PDF
                    </p>
                  </div>
                </div>
              ) : pdfUrl ? (
                <iframe src={pdfUrl} className="h-full w-full min-h-[360px] bg-white" title="Converted PDF" />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[var(--color-text-lo)]">
                  <FileText size={32} strokeWidth={1.2} />
                  <p className="text-[13px]">Converted PDF will appear here</p>
                  <p className="text-[11px] max-w-[200px]">Upload a source document to begin</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!pdfUrl}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-tile border py-2.5 text-[12px] font-medium transition-colors",
                  "border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] hover:border-[var(--color-line-2)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <Download size={14} />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => file && runGenerate()}
                disabled={!file || generating || previewLoading}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-tile py-2.5 text-[12px] font-medium transition-opacity",
                  "bg-[var(--color-accent)] text-white hover:opacity-90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
                Regenerate
              </button>
            </div>
          </div>
        </section>
      </div>

      <StyleRulesPanel
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        onRulesChange={setRuleCount}
      />

      <style>{`
        .doc-paper {
          background: #fff;
          border-radius: 6px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          padding: 1.25rem 1.5rem;
        }
        .docx-preview p { margin: 0.45em 0; }
        .docx-preview strong { font-weight: 600; }
        .docx-preview h1, .docx-preview h2, .docx-preview h3 {
          font-weight: 600;
          margin: 0.65em 0 0.3em;
        }
      `}</style>
    </div>
  );
}
