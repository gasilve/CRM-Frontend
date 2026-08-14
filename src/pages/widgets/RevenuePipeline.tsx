import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { revenueSeries } from "@/lib/mock-data";

export function RevenuePipeline() {
  const last = revenueSeries[revenueSeries.length - 1];
  const prev = revenueSeries[revenueSeries.length - 2];
  const delta = ((last.revenue - prev.revenue) / prev.revenue) * 100;

  return (
    <Card className="flex flex-col">
      <div className="mb-3 flex items-start justify-end gap-4">
        <Legend dot="#4a7fff" label="Revenue" />
        <Legend dot="#34d399" label="Pipeline" />
      </div>

      <div className="mb-4 flex items-end gap-6">
        <div>
          <div className="mb-1 text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            Closed ARR · trailing 12mo
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[2.125rem] font-medium leading-none text-[var(--color-text-hi)]">
              ${(last.revenue / 1).toFixed(0)}k
            </span>
            <Pill variant={delta >= 0 ? "pos" : "neg"}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
            </Pill>
          </div>
        </div>
        <div className="ml-auto">
          <div className="mb-1 text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            Active pipeline
          </div>
          <div className="font-mono text-[1.25rem] text-[var(--color-text-mid)]">
            ${last.pipeline}k
          </div>
        </div>
      </div>

      <div className="-mx-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={120}>
          <AreaChart
            data={revenueSeries}
            margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a7fff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#4a7fff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-pipe" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(232,238,248,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="m"
              tick={{ fill: "#5b6680", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#5b6680", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}k`}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "rgba(74,127,255,0.4)", strokeWidth: 1 }}
              contentStyle={{
                background: "#0d1220",
                border: "0.0625rem solid rgba(232,238,248,0.14)",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "JetBrains Mono",
                color: "#e8eef8",
              }}
              labelStyle={{ color: "#9aa6bd", marginBottom: 4 }}
              formatter={(v: number) => `$${v}k`}
            />
            <Area
              type="monotone"
              dataKey="pipeline"
              stroke="#34d399"
              strokeWidth={1.5}
              fill="url(#g-pipe)"
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#4a7fff"
              strokeWidth={2}
              fill="url(#g-rev)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[0.6875rem] text-[var(--color-text-mid)]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: dot, boxShadow: `0 0 0.5rem ${dot}` }}
      />
      {label}
    </div>
  );
}
