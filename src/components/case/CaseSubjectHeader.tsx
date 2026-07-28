import type { ReactNode } from "react";
import { Cake, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { birthdayCountdownLabel, formatDob } from "@/lib/dates";
import type { Subject } from "@/lib/mock-data";

type CaseSubjectHeaderProps = {
  subject: Subject;
  claimNumber: string;
  actions?: ReactNode;
  className?: string;
};

export function CaseSubjectHeader({
  subject,
  claimNumber,
  actions,
  className,
}: CaseSubjectHeaderProps) {
  const hasAddress = Boolean(subject.address || subject.city || subject.zip);

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">
          {subject.name}
        </h1>

        {hasAddress && (
          <div className="mt-2.5 flex items-start gap-1.5 text-[13px] text-[var(--color-text-mid)]">
            <MapPin
              size={14}
              strokeWidth={1.7}
              className="mt-0.5 shrink-0 text-[var(--color-text-lo)]"
            />
            <span>
              {subject.address && (
                <span className="text-[var(--color-text-hi)]">{subject.address}</span>
              )}
              {subject.address && (subject.city || subject.zip) && (
                <span className="text-[var(--color-text-lo)]"> · </span>
              )}
              {[subject.city, subject.state].filter(Boolean).join(", ")}
              {subject.zip && (
                <span className="ml-1.5 font-mono text-[12px] text-[var(--color-text-mid)]">
                  {subject.zip}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] tracking-wide text-[var(--color-accent-2)]">
            {claimNumber}
          </span>
          {subject.dob && (
            <>
              <span className="text-[var(--color-text-lo)]" aria-hidden>
                ·
              </span>
              <span className="font-mono text-[12px] text-[var(--color-text-mid)]">
                {formatDob(subject.dob)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-2)]/60 px-2.5 py-0.5 text-[10.5px] text-[var(--color-text-mid)]">
                <Cake size={11} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
                {birthdayCountdownLabel(subject.dob)}
              </span>
            </>
          )}
        </div>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
