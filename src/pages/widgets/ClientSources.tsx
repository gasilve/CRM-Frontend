import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { sourceMix } from "@/lib/mock-data";

export function ClientSources() {
  const total = sourceMix.reduce((s, x) => s + x.value, 0);

  return (
    <Card className="flex flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[140px_1fr] items-center gap-5">
        <div className="relative">
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={sourceMix}
                dataKey="value"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {sourceMix.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">
              Total
            </div>
            <div className="font-mono text-[18px] leading-none text-[var(--color-text-hi)]">
              {total}%
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {sourceMix.map((s) => (
            <li key={s.name} className="flex items-center gap-2.5 text-[12.5px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
              />
              <span className="flex-1 text-[var(--color-text-mid)]">{s.name}</span>
              <span className="font-mono text-[var(--color-text-hi)]">
                {s.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
