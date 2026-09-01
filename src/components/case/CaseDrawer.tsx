import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
};

/** Near-fullscreen workspace overlay opened from the case action bar. */
export function CaseDrawer({ open, title, icon, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="case-drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="case-drawer surface" role="dialog" aria-label={title}>
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--color-line)] px-6 py-4">
          {icon && <span className="text-[var(--color-accent-2)]">{icon}</span>}
          <h2 className="editorial text-[1.375rem] leading-none text-[var(--color-text-hi)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full p-1.5 text-[var(--color-text-lo)] transition-colors hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            <X size={17} strokeWidth={1.8} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto w-full max-w-[70rem]">{children}</div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
