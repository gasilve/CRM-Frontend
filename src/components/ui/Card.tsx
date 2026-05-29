import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Card({
  className,
  children,
  padding = true,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  padding?: boolean;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface relative h-full overflow-hidden",
        hover && "surface-hover",
        padding && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow,
  title,
  right,
  className,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h3 className="font-display text-[20px] font-light italic tracking-[-0.01em] text-[var(--color-text-hi)]">
          {title}
        </h3>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
