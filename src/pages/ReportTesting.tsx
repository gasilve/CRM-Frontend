import { useCallback, useRef, useState } from "react";
import { AlertCircle, Download, FileText, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { reportsApi } from "@/lib/reports-api";

const ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_MB = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDocx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".docx");
}

export default function ReportTesting() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setFile(null);
    setOutput(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const takeFile = useCallback((next: File | null) => {
    setOutput(null);
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!isDocx(next)) {
      setError("Only .docx files are supported.");
      setFile(null);
      return;
    }
    if (next.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_FILE_MB} MB.`);
      setFile(null);
      return;
    }
    setFile(next);
  }, []);

  const onGenerate = async () => {
    if (!file || generating) return;
    setGenerating(true);
    setError(null);
    setOutput(null);
    try {
      const blob = await reportsApi.cleanDocx(file);
      const name = file.name.replace(/\.docx$/i, "") + "-clean.docx";
      setOutput(
        new File([blob], name, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const onDownload = () => {
    if (!output) return;
    const url = URL.createObjectURL(output);
    const a = document.createElement("a");
    a.href = url;
    a.download = output.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="editorial text-[32px] leading-none text-[var(--color-text-hi)]">
          Report Testing
        </h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-[var(--color-text-mid)]">
          Upload any .docx. We extract the text, reuse the document's Word header
          and footer (including per-page page numbers), and rebuild a clean body — no AI.
        </p>
      </div>

      <div
        className={cn(
          "relative flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 transition-colors",
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5"
            : "border-[var(--color-border)] bg-[var(--color-surface)]",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) takeFile(dropped);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => takeFile(e.target.files?.[0] ?? null)}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
          >
            <Upload size={28} strokeWidth={1.5} />
            <span className="text-[13px]">Drop a .docx here or click to browse</span>
          </button>
        ) : (
          <div className="flex w-full max-w-md items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <FileText size={18} className="shrink-0 text-[var(--color-text-mid)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-[var(--color-text-hi)]">{file.name}</div>
              <div className="font-mono text-[11px] text-[var(--color-text-lo)]">
                {formatBytes(file.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={clear}
              className="rounded p-1 text-[var(--color-text-lo)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-hi)]"
              title="Remove"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!file || generating}
          onClick={() => void onGenerate()}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors",
            !file || generating
              ? "cursor-not-allowed bg-[var(--color-surface)] text-[var(--color-text-lo)]"
              : "bg-[var(--color-accent)] text-white hover:opacity-90",
          )}
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {generating ? "Generating…" : "Generate clean DOCX"}
        </button>

        {output && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-[13px] text-[var(--color-text-hi)] hover:bg-[var(--color-bg)]"
          >
            <Download size={16} />
            Download {output.name}
          </button>
        )}
      </div>
    </div>
  );
}
