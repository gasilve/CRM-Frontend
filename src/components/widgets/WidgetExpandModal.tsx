import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Full list / detail expand — used by "+N more" and header expand buttons. */
export function WidgetExpandModal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div className="surface anim-modal relative z-10 flex max-h-[min(36rem,80vh)] w-full max-w-lg flex-col overflow-hidden rounded-[0.875rem] border border-[var(--color-line)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <div className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[var(--color-text-hi)]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
