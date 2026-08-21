import { cn } from "@/lib/cn";
import type { PendingCaseFilesStatus, PendingCaseStatus } from "@/lib/crm-api";

const REVIEW_CONFIG: Record<PendingCaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  pending_review: { label: "Pending review", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  accepted: { label: "Accepted", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  rejected: { label: "Rejected", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

const FILES_CONFIG: Record<PendingCaseFilesStatus, { label: string; pill: string; text: string }> = {
  none: { label: "No files", pill: "var(--color-ink-3)", text: "var(--color-text-lo)" },
  pending: { label: "Not fetched", pill: "rgba(245,158,11,0.16)", text: "#f59e0b" },
  ready: { label: "Fetched", pill: "rgba(74,222,128,0.16)", text: "#4ade80" },
  failed: { label: "Fetch failed", pill: "rgba(248,113,113,0.16)", text: "#f87171" },
};

/** His `case_type` values, spelled out. Anything new falls through unchanged. */
const CASE_TYPE_LABELS: Record<string, string> = {
  new_case: "New case",
  surveillance_followup: "Follow-up",
  background: "Background",
  medical_canvass: "Medical canvass",
  supplement: "Supplement",
  reopen: "Reopen",
};

/** His own case state, which we copy onto the real case on accept. */
const INGESTOR_STATUS_COLORS: Record<string, { pill: string; text: string }> = {
  open: { pill: "rgba(74,222,128,0.14)", text: "#4ade80" },
  active: { pill: "rgba(74,222,128,0.14)", text: "#4ade80" },
  closed: { pill: "rgba(91,102,128,0.16)", text: "#7a8499" },
  cancelled: { pill: "rgba(248,113,113,0.14)", text: "#f87171" },
};

export function ReviewStatusPill({ status, className }: { status: PendingCaseStatus; className?: string }) {
  const cfg = REVIEW_CONFIG[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium", className)}
      style={{ background: cfg.pill, color: cfg.text }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

export function FilesPill({ status, className }: { status: PendingCaseFilesStatus; className?: string }) {
  const cfg = FILES_CONFIG[status];
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide", className)}
      style={{ background: cfg.pill, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

export function CaseTypePill({ caseType }: { caseType: string | null }) {
  if (!caseType) return <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">—</span>;
  return (
    <span className="inline-block rounded-full bg-[rgba(74,127,255,0.16)] px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide text-[#7aa1ff]">
      {CASE_TYPE_LABELS[caseType] ?? caseType}
    </span>
  );
}

export function IngestorStatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = INGESTOR_STATUS_COLORS[status] ?? { pill: "var(--color-ink-3)", text: "var(--color-text-lo)" };
  return (
    <span
      className="inline-block rounded-[0.3125rem] px-1.5 py-0.5 font-mono text-[0.53125rem] font-semibold uppercase tracking-wider"
      style={{ background: cfg.pill, color: cfg.text }}
      title="Status reported by the ingestor"
    >
      {status}
    </span>
  );
}
