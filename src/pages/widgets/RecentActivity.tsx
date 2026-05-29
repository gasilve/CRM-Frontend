import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { activity } from "@/lib/mock-data";
import { Phone, Mail, Calendar, FileText, ArrowRight } from "lucide-react";

const ICONS = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  deal: ArrowRight,
} as const;

export function RecentActivity() {
  return (
    <Card className="flex flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {activity.map((a) => {
          const Icon = ICONS[a.type];
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 border-b border-[var(--color-line)] py-2.5 last:border-b-0"
            >
              <Avatar initials={a.whoInitials} size={26} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-[var(--color-text-hi)]">
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-[var(--color-text-mid)]">{a.text}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-[var(--color-text-lo)]">
                  <Icon size={10} strokeWidth={1.8} />
                  <span>{a.type}</span>
                  <span className="opacity-50">·</span>
                  <span className="font-mono normal-case tracking-normal">
                    {a.at} ago
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
