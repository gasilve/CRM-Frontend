import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Segmented control button. Wrap a set of these in
 * `<div className="view-toggle-group">` to get the surrounding chrome.
 */
export function ViewToggle({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "anim-toggle tap flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.71875rem]",
        active
          ? "bg-[var(--color-ink-3)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_var(--color-line-2)]"
          : "text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]",
      )}
    >
      {icon} {label}
      {badge ? (
        <span className="anim-pop rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0 text-[0.625rem] text-[var(--color-accent-2)]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function ViewToggleGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/40 p-1">
      {children}
    </div>
  );
}
