import { Card } from "@/components/ui/Card";

const METRICS = [
  { label: "Feed sync", value: "99.2%", trend: "+0.3%" },
  { label: "Packet loss", value: "0.8%", trend: "-0.2%" },
  { label: "Latency", value: "114ms", trend: "-12ms" },
  { label: "Active streams", value: "24", trend: "+4" },
];

export function SignalHealth() {
  return (
    <Card className="flex flex-col signal-flicker">
      <div className="grid flex-1 grid-cols-2 gap-2.5">
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink-1)]/60 p-3"
          >
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
              {m.label}
            </div>
            <div className="font-mono text-[18px] text-[var(--color-text-hi)]">
              {m.value}
            </div>
            <div className="font-mono text-[10.5px] text-[var(--color-text-lo)]">
              {m.trend}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
