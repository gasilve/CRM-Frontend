import { cn } from "@/lib/cn";
import type { PendingCaseFilesStatus, PendingCaseStatus } from "@/lib/crm-api";

const REVIEW_CONFIG: Record<PendingCaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  pending_review: { label: "Pending review", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  accepted: { label: "Accepted", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  rejected: { label: "Rejected", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

const FILES_CONFIG: Record<PendingCaseFilesStatus, { label: string; pill: string; text: string }> = {
  none: { label: "No files", pill: "var(--color-ink-3)", text: "var(--color-text-lo)" },
  pending: { label: "Saving", pill: "rgba(245,158,11,0.16)", text: "#f59e0b" },
  ready: { label: "Saved", pill: "rgba(74,222,128,0.16)", text: "#4ade80" },
  failed: { label: "Not saved", pill: "rgba(248,113,113,0.16)", text: "#f87171" },
};

/** Case types on proposals created before the CRM read the mailbox itself. */
const CASE_TYPE_LABELS: Record<string, string> = {
  new_case: "New case",
  surveillance_followup: "Follow-up",
  background: "Background",
  medical_canvass: "Medical canvass",
  supplement: "Supplement",
  reopen: "Reopen",
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

const KIND_CONFIG: Record<string, { label: string; pill: string; text: string }> = {
  new: { label: "New", pill: "rgba(74,127,255,0.16)", text: "#7aa1ff" },
  reopen: { label: "Reopen", pill: "rgba(167,139,250,0.16)", text: "#b9a4fb" },
};

/** What the email asked for: new work, or more work on a claim the firm already handled. */
export function KindPill({ kind, caseType }: { kind: string | null; caseType: string | null }) {
  const cfg = kind ? KIND_CONFIG[kind] : undefined;
  if (!cfg) return <CaseTypePill caseType={caseType} />;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[0.59375rem] font-medium tracking-wide"
      style={{ background: cfg.pill, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

/** `review` means the draft came from free text and a person should check it closely. */
export function LanePill({ lane }: { lane: string | null }) {
  if (lane !== "review") return null;
  return (
    <span
      className="inline-block rounded-[0.3125rem] bg-[rgba(245,158,11,0.14)] px-1.5 py-0.5 font-mono text-[0.53125rem] font-semibold uppercase tracking-wider text-[#f59e0b]"
      title="Written in free text, so the draft needs a closer look"
    >
      Check
    </span>
  );
}
