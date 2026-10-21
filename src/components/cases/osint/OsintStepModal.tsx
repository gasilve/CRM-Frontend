import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./osint-modal.css";

export type PipelineStepView = {
  label: string;
  status: "done" | "running" | "pending" | "skipped";
  detail: string;
  summary: string;
  hits: string[];
};

const STATUS_LABEL: Record<PipelineStepView["status"], string> = {
  done: "Done",
  running: "Running",
  pending: "Pending",
  skipped: "Skipped",
};

export function OsintStepModal({
  step,
  onClose,
  eyebrow = "Pipeline step",
}: {
  step: PipelineStepView;
  onClose: () => void;
  eyebrow?: string;
}) {
  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="osint-modal osint-step-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osint-step-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="osint-modal__head">
          <div className="osint-modal__head-main">
            <p className="osint-modal__eyebrow">{eyebrow}</p>
            <h2 id="osint-step-title" className="osint-modal__title">
              {step.label}
            </h2>
            <p className="osint-modal__meta">
              {STATUS_LABEL[step.status]} · {step.detail}
            </p>
          </div>
          <button type="button" className="osint-modal__close" aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="osint-step-modal__body">
          <p className="osint-step-modal__summary">{step.summary}</p>
          <h3 className="osint-modal__sec">What it found</h3>
          {step.hits.length === 0 ? (
            <p className="osint-empty">Nothing logged for this step yet.</p>
          ) : (
            <ul className="osint-step-modal__hits">
              {step.hits.map((hit) => (
                <li key={hit}>{hit}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
