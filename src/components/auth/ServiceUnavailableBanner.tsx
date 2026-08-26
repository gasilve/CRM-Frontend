import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

export function ServiceUnavailableBanner({
  className,
  onRetry,
}: {
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className={cn(
        "anim-banner rounded-[0.5rem] border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-3.5 py-3 text-[0.75rem] leading-relaxed text-[var(--color-warn)]",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-text-hi)]">Service temporarily unavailable</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[var(--color-accent-2)] hover:underline"
            >
              Check again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
