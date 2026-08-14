import { Card } from "@/components/ui/Card";
import { schedule } from "@/lib/mock-data";

export function UpcomingSchedule() {
  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          className="rounded-md border border-[var(--color-line-2)] px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
        >
          View all
        </button>
      </div>
      <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto">
        {schedule.map((s, i) => (
          <li
            key={s.id}
            className="group flex items-start gap-4 rounded-[0.625rem] px-2.5 py-2.5 transition-colors hover:bg-white/[0.02]"
            style={{
              borderTop:
                i === 0 ? undefined : "0.0625rem solid var(--color-line)",
            }}
          >
            <div className="w-[4rem] shrink-0">
              <div className="font-mono text-[0.9375rem] leading-none text-[var(--color-text-hi)]">
                {s.when}
              </div>
              <div className="mt-1 text-[0.625rem] tracking-wider text-[var(--color-text-lo)]">
                {s.date}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
                {s.title}
              </div>
              <div className="truncate text-[0.71875rem] text-[var(--color-text-mid)]">
                {s.client} · {s.with}
              </div>
            </div>
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)] opacity-0 shadow-[0_0_0.5rem_rgba(74,127,255,0.7)] transition-opacity group-hover:opacity-100" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
