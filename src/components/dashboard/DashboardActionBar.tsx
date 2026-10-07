import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

const BAR_COLLAPSED_LS_KEY = "accenty.crm.dashboard-action-bar.collapsed";

type Props = {
  visible: boolean;
  dockOpen: boolean;
  onToggleDock: () => void;
  onResetLayout: () => void;
};

/**
 * Case-style bottom bar for the dashboard — add widgets + reset layout.
 * Chevron is ~3× the original case baseline.
 */
export function DashboardActionBar({ visible, dockOpen, onToggleDock, onResetLayout }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(BAR_COLLAPSED_LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!visible) return null;

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

  return createPortal(
    <div
      className={cn(
        "dashboard-action-bar-wrap",
        collapsed && "is-collapsed",
        dockOpen && "is-dock-hidden",
      )}
    >
      <button
        type="button"
        className="dashboard-action-bar-toggle"
        aria-label={collapsed ? "Show dashboard menu" : "Hide dashboard menu"}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <ChevronDown size={42} strokeWidth={2} className="dashboard-action-bar-toggle__icon" />
      </button>

      <div className="dashboard-action-bar">
        <button
          type="button"
          title="Add or remove widgets"
          aria-label="Add or remove widgets"
          onClick={onToggleDock}
          className={cn("case-bar-btn case-bar-btn--primary", dockOpen && "is-active")}
        >
          <Plus size={22} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          title="Reset layout"
          aria-label="Reset layout"
          onClick={onResetLayout}
          className="case-bar-btn"
        >
          <RotateCcw size={17} strokeWidth={1.8} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
