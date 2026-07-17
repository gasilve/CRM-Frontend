import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface DocxPreviewProps {
  file: File | null;
  className?: string;
  /** Called when the user finishes a text selection inside the preview. */
  onTextSelect?: (text: string) => void;
  /** Bump to force a re-render after the in-memory file changes. */
  revision?: number;
}

export default function DocxPreview({
  file,
  className,
  onTextSelect,
  revision = 0,
}: DocxPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !file) {
      if (host) host.innerHTML = "";
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    host.innerHTML = "";

    const run = async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (cancelled || !hostRef.current) return;
        await renderAsync(buffer, hostRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not render document preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [file, revision]);

  const handleMouseUp = () => {
    if (!onTextSelect) return;
    const text = window.getSelection()?.toString().replace(/\u00a0/g, " ").trim() ?? "";
    if (text) onTextSelect(text);
  };

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-auto docx-host", className)}>
      {loading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20">
          <div className="flex items-center gap-2 rounded-tile border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 text-[12px] text-[var(--color-text-mid)]">
            <Loader2 size={14} className="animate-spin" />
            Rendering document…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-4 top-4 z-10 flex items-start gap-2 rounded-tile border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.1)] px-3 py-2 text-[12px] text-[var(--color-neg)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div ref={hostRef} onMouseUp={handleMouseUp} className="min-h-full" />
    </div>
  );
}
