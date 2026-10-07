import { History, VenetianMask } from "lucide-react";
import type { CoverStatus } from "@/components/schedule/cover-status";

/** Safe = blue, Noticed = yellow, Burnt = red — cover-status palette. */
export const COVER_STATUS_COLOR: Record<CoverStatus, string> = {
  safe: "#4a7fff",
  noticed: "#f59e0b",
  burnt: "#f87171",
};

export const COVER_STATUS_LABEL: Record<CoverStatus, string> = {
  safe: "Safe",
  noticed: "Noticed",
  burnt: "Burnt",
};

/** Temporary Lucide stand-in until a brand icon set is chosen. */
export function CoverStatusMark({
  status,
  size = 12,
  showLabel = true,
  className,
}: {
  status: CoverStatus;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const color = COVER_STATUS_COLOR[status];
  const label = COVER_STATUS_LABEL[status];
  return (
    <span
      className={
        className ??
        "inline-flex items-center gap-1 font-mono text-[0.53125rem] uppercase tracking-wider"
      }
      style={{ color }}
      title={label}
    >
      <VenetianMask size={size} strokeWidth={1.9} />
      {showLabel ? label : null}
    </span>
  );
}

export function PriorCaseMark({
  size = 12,
  strokeWidth = 1.9,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return <History size={size} strokeWidth={strokeWidth} className={className} />;
}
