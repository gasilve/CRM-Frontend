import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Lightbulb,
  Replace,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import StyleRulesPanel from "@/components/document-generator/StyleRulesPanel";
import { reportConfigApi } from "@/lib/report-config-api";
import { reportsApi } from "@/lib/reports-api";

const MAX_FILE_MB = 25;
const MAX_FILES = 20;
const ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface UploadedFile {
  id: string;
  file: File;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx");
}

function slotCount(fileCount: number): number {
  if (fileCount === 0) return 4;
  return Math.min(Math.max(4, fileCount + 1), MAX_FILES);
}

function gridLayout(slots: number): { cols: number; rows: number } {
  if (slots <= 4) return { cols: 2, rows: 2 };
  if (slots <= 6) return { cols: 3, rows: 2 };
  if (slots <= 9) return { cols: 3, rows: 3 };
  if (slots <= 12) return { cols: 4, rows: 3 };
  if (slots <= 15) return { cols: 5, rows: 3 };
  return { cols: 5, rows: 4 };
}

const GRID_GAP_PX = 12;

function useTileSize(cols: number, rows: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tileSize, setTileSize] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const cellW = (width - GRID_GAP_PX * (cols - 1)) / cols;
      const cellH = (height - GRID_GAP_PX * (rows - 1)) / rows;
      setTileSize(Math.floor(Math.min(cellW, cellH)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, rows]);

  return { containerRef, tileSize };
}

function shortName(name: string, max = 36): string {
  if (name.length <= max) return name;
  const ext = name.match(/\.[^.]+$/)?.[0] ?? "";
  const base = name.slice(0, name.length - ext.length);
  const keep = max - ext.length - 1;
  return `${base.slice(0, Math.max(keep, 10))}…${ext}`;
}

export default function DocumentGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [ruleCount, setRuleCount] = useState(0);

  const slots = slotCount(uploads.length);
  const { cols, rows } = gridLayout(slots);
  const { containerRef, tileSize } = useTileSize(cols, rows);

  const clearOutput = useCallback(() => setOutputFile(null), []);

  const clearAll = useCallback(() => {
    setUploads([]);
    clearOutput();
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [clearOutput]);

  useEffect(() => {
    reportConfigApi
      .listStyleRules()
      .then((res) => setRuleCount(res.rules.length))
      .catch(() => setRuleCount(0));
  }, []);

  const runGenerate = useCallback(async () => {
    if (!uploads.length) return;
    setGenerating(true);
    setError(null);
    clearOutput();

    try {
      const blob = await reportsApi.generate(uploads.map((u) => u.file));
      const base =
        uploads.length === 1
          ? uploads[0].file.name.replace(/\.docx$/i, "")
          : "investigation-report";
      const file = new File([blob], `${base} surveillance.docx`, { type: blob.type });
      setOutputFile(file);
      // Auto-download immediately
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate report right now.");
    } finally {
      setGenerating(false);
    }
  }, [uploads, clearOutput]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const valid = incoming.filter(isDocx);
      if (!valid.length) {
        setError("Only .docx files are supported.");
        return;
      }
      const tooLarge = valid.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
      if (tooLarge) {
        setError(`"${tooLarge.name}" exceeds ${MAX_FILE_MB} MB.`);
        return;
      }
      setUploads((prev) => {
        const next = [...prev];
        for (const file of valid) {
          if (next.length >= MAX_FILES) {
            setError(`Maximum ${MAX_FILES} files per case.`);
            return prev;
          }
          next.push({ id: crypto.randomUUID(), file });
        }
        return next;
      });
      clearOutput();
      setError(null);
    },
    [clearOutput],
  );

  const removeUpload = useCallback(
    (id: string) => {
      setUploads((prev) => {
        const next = prev.filter((u) => u.id !== id);
        if (!next.length) clearAll();
        else clearOutput();
        return next;
      });
    },
    [clearAll, clearOutput],
  );

  const handleDownload = () => {
    if (!outputFile) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(outputFile);
    a.download = outputFile.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-6">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files ? [...e.target.files] : [];
          if (picked.length) addFiles(picked);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">
            Report Generator
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-lo)]">
            Add your .docx files, then generate the report
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
          Style rules & prompt
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
        {/* Source panel */}
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow mb-1">Source</div>
              <h2 className="text-[15px] font-medium text-[var(--color-text-hi)]">
                Documents{uploads.length > 0 ? ` (${uploads.length}/${MAX_FILES})` : ""}
              </h2>
            </div>
            <button
              type="button"
              onClick={clearAll}
              disabled={uploads.length === 0}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-tile border border-[var(--color-line)] px-3 py-1.5 text-[11px] transition-colors",
                uploads.length === 0
                  ? "invisible"
                  : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
              )}
            >
              <Replace size={12} />
              Clear all
            </button>
          </div>

          <div
            className={cn(
              "flex flex-1 min-h-0 flex-col p-5",
              dragOver && "ring-2 ring-inset ring-[var(--color-accent)]",
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles([...e.dataTransfer.files]); }}
          >
            <div ref={containerRef} className="relative flex-1 min-h-0 w-full">
              {uploads.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 bottom-1 z-10 text-center text-[11px] text-[var(--color-text-lo)]">
                  Drop files here · max {MAX_FILE_MB} MB each
                </p>
              )}
              {tileSize > 0 && (
                <div
                  className="grid h-full w-full place-content-center"
                  style={{
                    gap: GRID_GAP_PX,
                    gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
                    gridTemplateRows: `repeat(${rows}, ${tileSize}px)`,
                  }}
                >
                  {Array.from({ length: slots }, (_, index) => {
                    const upload = uploads[index];
                    const tileClass =
                      "flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-tile p-2 text-center transition-colors overflow-hidden";

                    if (upload) {
                      return (
                        <div key={upload.id} className="group relative h-full w-full">
                          <div
                            className={cn(
                              tileClass,
                              "border border-[var(--color-line)] bg-[var(--color-ink-1)]/60",
                            )}
                          >
                            <FileText
                              size={22}
                              strokeWidth={1.4}
                              className="shrink-0 text-[var(--color-accent-2)]"
                            />
                            <span className="line-clamp-3 text-[11px] font-medium leading-snug text-[var(--color-text-hi)] px-1">
                              {shortName(upload.file.name)}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--color-text-lo)]">
                              {formatBytes(upload.file.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUpload(upload.id)}
                            className={cn(
                              "absolute top-1.5 right-1.5 z-10 grid h-6 w-6 place-items-center rounded-full",
                              "border border-[var(--color-line)] bg-[var(--color-ink-2)] text-[var(--color-text-lo)]",
                              "opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--color-neg)]",
                            )}
                            aria-label={`Remove ${upload.file.name}`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`empty-${index}`}
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className={cn(
                          tileClass,
                          "border-2 border-dashed",
                          dragOver
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40"
                            : "border-[var(--color-line)] hover:border-[var(--color-line-2)] hover:bg-[var(--color-ink-1)]/40",
                        )}
                      >
                        <Plus size={20} className="text-[var(--color-text-lo)]" />
                        <span className="text-[10px] text-[var(--color-text-lo)]">Add .docx</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Output panel */}
        <section className="surface flex min-h-0 flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <div className="eyebrow mb-1">Output</div>
            <h2 className="text-[15px] font-medium text-[var(--color-text-hi)]">Generated report</h2>
          </div>

          <div className="flex flex-1 min-h-0 flex-col p-5 gap-3">
            {ruleCount > 0 && (
              <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-1)]/50 px-3 py-2.5 flex justify-end">
                <span className="shrink-0 rounded-full border border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 px-2 py-0.5 text-[10px] font-mono text-[var(--color-warn)]">
                  {ruleCount} style rules active
                </span>
              </div>
            )}

            <div
              className={cn(
                "flex flex-1 min-h-[360px] overflow-hidden rounded-[10px] border border-[var(--color-line)]",
                !outputFile && !generating && "bg-[var(--color-ink-1)]/40",
              )}
            >
              {generating ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
                  <div>
                    <p className="text-[13px] text-[var(--color-text-mid)]">Generating report…</p>
                    <p className="text-[11px] text-[var(--color-text-lo)] mt-1">
                      Merging chrono · paraphrasing · filling state template
                    </p>
                  </div>
                </div>
              ) : outputFile ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                  <FileText size={36} className="text-[var(--color-accent)]" strokeWidth={1.2} />
                  <div>
                    <p className="text-[14px] font-medium text-[var(--color-text-hi)]">Report ready</p>
                    <p className="text-[12px] text-[var(--color-text-mid)] mt-1 max-w-sm truncate">
                      {outputFile.name}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-lo)] mt-0.5">
                      Open in Microsoft Word to review
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[var(--color-text-lo)]">
                  <FileText size={32} strokeWidth={1.2} />
                  <p className="text-[13px]">Word report will appear here after you generate</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void runGenerate()}
                disabled={!uploads.length || generating}
                className={cn(
                  "flex flex-[2] items-center justify-center gap-2 rounded-tile py-2.5 text-[12px] font-medium transition-opacity",
                  "bg-[var(--color-accent)] text-white hover:opacity-90",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Generate report
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!outputFile}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-tile border py-2.5 text-[12px] font-medium transition-colors",
                  "border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] hover:border-[var(--color-line-2)]",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                )}
              >
                <Download size={14} />
                Download DOCX
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
    </div>
  );
}
