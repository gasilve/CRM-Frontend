import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)]";

export const labelClass =
  "mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]";

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h3 className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">{title}</h3>
        {hint && <p className="mt-0.5 text-[0.71875rem] leading-relaxed text-[var(--color-text-lo)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="anim-banner rounded-[0.625rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-2.5 text-[0.78125rem] text-[var(--color-neg)]">
      {message}
    </div>
  );
}

/** Accessible switch styled as a pill — used for every permission toggle. */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[1.125rem] w-8 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
          : "border-[var(--color-line-2)] bg-[var(--color-ink-3)] hover:border-[var(--color-line-3)]",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white transition-[left]",
          checked ? "left-[1.0625rem]" : "left-[0.125rem]",
        )}
      />
    </button>
  );
}

/** Segmented control for a small set of mutually exclusive choices. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; title?: string; tint?: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] p-0.5",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[0.375rem] font-medium transition-colors",
              size === "sm" ? "px-2 py-[0.1875rem] text-[0.6875rem]" : "px-3 py-1 text-[0.75rem]",
              active
                ? "text-[var(--color-text-hi)]"
                : "text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
            )}
            style={
              active
                ? {
                    background: opt.tint
                      ? `color-mix(in srgb, ${opt.tint} 22%, transparent)`
                      : "var(--color-accent-soft)",
                    color: opt.tint ?? undefined,
                  }
                : undefined
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
