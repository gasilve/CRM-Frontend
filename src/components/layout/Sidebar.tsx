import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users2,
  FolderOpen,
  CalendarDays,
  Building2,
  FileText,
  BarChart3,
  Settings,
  BotMessageSquare,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { invCases, investigators } from "@/lib/mock-data";
import accentyLogoMark from "@/assets/branding/accenty-logo-mark.svg";

// Live badge counts — swap with API data later
const openCases = invCases.filter((c) => c.status === "open").length;
const clockedIn = investigators.filter((i) => i.status !== "off_duty").length;

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
};

type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: "Operations",
    items: [
      { to: "/",              label: "Dashboard",    icon: LayoutDashboard },
      { to: "/cases",         label: "Cases",        icon: FolderOpen,   badge: openCases },
      { to: "/investigators", label: "Investigators",icon: Users2,        badge: clockedIn > 0 ? `${clockedIn} live` : undefined },
      { to: "/calendar",      label: "Calendar",     icon: CalendarDays },
    ],
  },
  {
    label: "Business",
    items: [
      { to: "/clients",  label: "Clients",  icon: Building2 },
      { to: "/billing",  label: "Billing",  icon: FileText },
      { to: "/reports",  label: "Reports",  icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/documents", label: "Report Generator", icon: ScrollText },
      { to: "/assistant", label: "AI Assistant", icon: BotMessageSquare },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function SidebarLink({ item }: { item: Item }) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors";

  if (item.disabled) {
    return (
      <div className={cn(base, "cursor-not-allowed text-[var(--color-text-lo)] hover:bg-white/[0.015]")}>
        <Icon size={16} strokeWidth={1.6} />
        <span className="flex-1">{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          base,
          isActive
            ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_1px_var(--color-accent-soft)]"
            : "text-[var(--color-text-mid)] hover:bg-white/[0.025] hover:text-[var(--color-text-hi)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="pointer-events-none absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-[var(--color-accent)]"
              style={{ boxShadow: "0 0 10px color-mix(in srgb, var(--color-accent) 70%, transparent)" }}
            />
          )}
          <Icon
            size={16}
            strokeWidth={1.6}
            className={isActive ? "text-[var(--color-accent-2)]" : ""}
          />
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 font-mono text-[9px] tracking-wider",
                isActive
                  ? "border-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "border-[var(--color-line-2)] text-[var(--color-text-lo)]",
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="app-sidebar relative z-10 flex h-full w-[244px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/80 backdrop-blur-xl">
      {/* Wordmark — same px/gap as nav links below */}
      <div className="flex h-[var(--shell-chrome-height)] shrink-0 items-center px-3">
        <div className="flex w-full items-center gap-6 px-3">
          <img
            src={accentyLogoMark}
            alt=""
            aria-hidden
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="font-[Cinzel] text-[17px] font-semibold tracking-[0.08em] text-[var(--color-text-hi)] lowercase leading-none">
            accenty
          </div>
        </div>
      </div>

      <div className="hairline mx-3 mb-2 opacity-60" />

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            <div className="px-3 pb-2 pt-1 text-[9px] font-medium uppercase tracking-[0.32em] text-[var(--color-text-lo)]">
              {group.label}
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map((it) => (
                <SidebarLink key={it.to} item={it} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="m-3 mt-2">
        <div className="surface p-3">
          <div className="eyebrow mb-1">Operator</div>
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
            >
              AD
            </div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-medium text-[var(--color-text-hi)]">Admin</div>
              <div className="text-[10.5px] text-[var(--color-text-lo)]">Principal · Accenty</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
