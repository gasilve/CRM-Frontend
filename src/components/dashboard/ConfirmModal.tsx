import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="dashboard-modal-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="dashboard-modal surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dashboard-confirm-title" className="dashboard-modal__title">
          {title}
        </h2>
        <div className="hairline my-5" />
        <div className="dashboard-modal__body">{description}</div>
        <div className="dashboard-modal__actions">
          <button
            type="button"
            className="dashboard-modal-btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn(
              "dashboard-modal-btn",
              danger && "dashboard-modal-btn--danger",
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
