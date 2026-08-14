import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { clients, fmtCurrency } from "@/lib/mock-data";

function MicroSpark({ seed }: { seed: number }) {
  const data: number[] = [];
  let v = 40 + (seed % 10);
  for (let i = 0; i < 16; i++) {
    v += (seed % 7) - 3 + i / 4;
    data.push(Math.max(8, v + Math.sin(i + seed) * 6));
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 80;
  const h = 18;
  const step = w / (data.length - 1);
  const pts = data
    .map((d, i) => `${i * step},${h - ((d - min) / (max - min || 1)) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={pts}
        fill="none"
        stroke="#4a7fff"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 0.25rem rgba(74,127,255,0.45))" }}
      />
    </svg>
  );
}

export function TopClients() {
  const top = [...clients]
    .filter((c) => c.status === "active")
    .sort((a, b) => b.arr - a.arr)
    .slice(0, 5);

  return (
    <Card className="flex flex-col">
      <CardHeader eyebrow="Accounts" title="Top clients by ARR" />
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {top.map((c, i) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border-b border-[var(--color-line)] py-2.5 last:border-b-0"
          >
            <span className="w-5 font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Avatar initials={c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
                {c.company}
              </div>
              <div className="truncate text-[0.6875rem] text-[var(--color-text-lo)]">
                {c.name} · {c.segment}
              </div>
            </div>
            <MicroSpark seed={c.id.charCodeAt(c.id.length - 1)} />
            <div className="w-[5rem] text-right font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
              {fmtCurrency(c.arr)}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
