import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Kpi = {
  label: string;
  value: string;
  unit?: string;
  delta: number;
  spark?: number[];
};

const kpis: Kpi[] = [
  { label: "Active clients",      value: "248",     delta: 4.2,  spark: [3,4,4,5,5,6,7,8,8,9] },
  { label: "Open cases",          value: "31",      delta: -2.1, spark: [10,9,10,8,9,8,7,9,7,6] },
  { label: "MRR",                 value: "$32.4",   unit: "k", delta: 6.8,  spark: [2,3,4,4,5,6,6,7,8,9] },
  { label: "Conversion",          value: "23.1",    unit: "%", delta: 1.4,  spark: [4,5,5,4,5,6,5,7,7,8] },
];

function Spark({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 22;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  const stroke = positive ? "#34d399" : "#f87171";
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 0.25rem ${stroke}66)` }}
      />
    </svg>
  );
}

export function KpiGrid() {
  return (
    <Card padding={false} className="p-1.5">
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
        {kpis.map((k) => {
          const positive = k.delta >= 0;
          return (
            <div
              key={k.label}
              className="surface-hover relative flex flex-col justify-between rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/40 p-4"
            >
              <div className="text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]">
                {k.label}
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="flex items-baseline gap-0.5">
                  <span className="font-mono text-[1.625rem] font-medium leading-none text-[var(--color-text-hi)]">
                    {k.value}
                  </span>
                  {k.unit && (
                    <span className="font-mono text-[0.875rem] text-[var(--color-text-mid)]">
                      {k.unit}
                    </span>
                  )}
                </div>
                {k.spark && <Spark data={k.spark} positive={positive} />}
              </div>
              <div className="flex items-center gap-2">
                <Pill variant={positive ? "pos" : "neg"}>
                  {positive ? (
                    <ArrowUpRight size={10} strokeWidth={2} />
                  ) : (
                    <ArrowDownRight size={10} strokeWidth={2} />
                  )}
                  {Math.abs(k.delta).toFixed(1)}%
                </Pill>
                <span className="text-[0.65625rem] text-[var(--color-text-lo)]">
                  vs. last month
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
