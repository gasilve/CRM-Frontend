import { useState } from "react";
import { createPortal } from "react-dom";
import { Car, ChevronDown, Folder, Plus, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/cn";

export type CaseDrawerId = "vehicles" | "people" | "folder" | "notebook";

const BAR_COLLAPSED_LS_KEY = "accenty.crm.case-action-bar.collapsed";

type Props = {
  /** SuperAdmin only — shows the big + (widget dock) button. */
  canEditLayout: boolean;
  activeDrawer: CaseDrawerId | null;
  dockOpen: boolean;
  onToggleDock: () => void;
  onOpenDrawer: (id: CaseDrawerId) => void;
};

/**
 * Always-visible action bar centered along the bottom of the case page, with a
 * chevron above it to collapse/expand. Hidden while a widget is being dragged
 * or the widget dock is open.
 */
export function CaseActionBar({ canEditLayout, activeDrawer, dockOpen, onToggleDock, onOpenDrawer }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(BAR_COLLAPSED_LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(BAR_COLLAPSED_LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, active: boolean) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn("case-bar-btn", active && "is-active")}
    >
      {icon}
    </button>
  );

  return createPortal(
    <div
      className={cn(
        "case-action-bar-wrap",
        collapsed && "is-collapsed",
        dockOpen && "is-dock-hidden",
      )}
    >
      <button
        type="button"
        className="case-action-bar-toggle"
        aria-label={collapsed ? "Show action menu" : "Hide action menu"}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <ChevronDown size={14} strokeWidth={2} className="case-action-bar-toggle__icon" />
      </button>

      <div className="case-action-bar">
        {btn("Vehicles", <Car size={17} strokeWidth={1.8} />, () => onOpenDrawer("vehicles"), activeDrawer === "vehicles")}
        {btn("People", <Users size={17} strokeWidth={1.8} />, () => onOpenDrawer("people"), activeDrawer === "people")}
        {canEditLayout && (
          <button
            type="button"
            title="Add or remove widgets"
            aria-label="Add or remove widgets"
            onClick={onToggleDock}
            className={cn("case-bar-btn case-bar-btn--primary", dockOpen && "is-active")}
          >
            <Plus size={22} strokeWidth={1.8} />
          </button>
        )}
        {btn("Case folder", <Folder size={17} strokeWidth={1.8} />, () => onOpenDrawer("folder"), activeDrawer === "folder")}
        <button
          type="button"
          title="Coming soon"
          aria-label="Coming soon"
          className="case-bar-btn case-bar-btn--soon"
          onClick={(e) => e.preventDefault()}
        >
          <Sparkles size={17} strokeWidth={1.8} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
