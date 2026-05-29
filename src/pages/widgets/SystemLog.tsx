import { Card } from "@/components/ui/Card";

const LOGS = [
  "Email received: attachment_1942.msg",
  "Image extracted: metro_station_cam_04.jpg",
  "Recognition scan initialized",
  "Confidence threshold met · match 93%",
  "Case K-3201 linked to profile",
  "Signal connector sync complete",
];

export function SystemLog() {
  return (
    <Card className="flex flex-col crt-interlaced">
      <ul className="min-h-0 flex-1 overflow-y-auto font-mono text-[11px] text-[var(--color-text-mid)]">
        {LOGS.map((line, i) => (
          <li
            key={line}
            className="flex items-start gap-2 border-b border-[var(--color-line)] py-2 last:border-b-0"
          >
            <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--color-accent-2)] shadow-[0_0_8px_rgba(122,161,255,0.7)]" />
            <div className="min-w-0">
              <div className="text-[10px] text-[var(--color-text-lo)]">
                {String(18 + i).padStart(2, "0")}:{String(12 + i * 2).padStart(2, "0")}
                :42
              </div>
              <div className="truncate">{line}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
