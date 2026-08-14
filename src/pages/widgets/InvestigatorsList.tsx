import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { investigators } from "@/lib/mock-data";
import type { InvStatus } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

const DOT: Record<InvStatus, string> = {
  clocked_in: "#4ade80",
  on_case:    "#4a7fff",
  off_duty:   "#5b6680",
};

const STATUS_LABEL: Record<InvStatus, string> = {
  clocked_in: "Clocked In",
  on_case:    "On Case",
  off_duty:   "Off Duty",
};

export function InvestigatorsList() {
  return (
    <Card className="flex flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {investigators.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center gap-3 border-b border-[var(--color-line)] py-2.5 last:border-b-0"
          >
            <div className="relative shrink-0">
              <Avatar initials={inv.initials} size={30} />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-ink-2)]",
                  inv.status !== "off_duty" && "animate-pulse",
                )}
                style={{ background: DOT[inv.status] }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
                {inv.name}
              </div>
              <div className="truncate font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                {inv.totalCasesOpen} open case{inv.totalCasesOpen !== 1 ? "s" : ""}
                {inv.location ? ` · ${inv.location}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div
                className="mb-0.5 rounded-full px-2 py-0.5 text-[0.5625rem] font-medium"
                style={{
                  color: DOT[inv.status],
                  background: `${DOT[inv.status]}22`,
                }}
              >
                {STATUS_LABEL[inv.status]}
              </div>
              <div className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                {inv.hoursToday > 0 ? `${inv.hoursToday.toFixed(1)}h today` : inv.id}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
