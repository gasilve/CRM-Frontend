
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

const GROUP_ICONS: Record<string, string> = {
  social_platforms: "📘",
  social_media:     "💬",
  professional:     "💼",
  obituaries:       "🕊️",
  dating:           "❤️",
  marketplace:      "🛒",
  payments:         "💳",
  music:            "🎵",
  design:           "🎨",
  web_dev:          "💻",
  work:             "📋",
  jobs:             "🏢",
  gaming:           "🎮",
  forums:           "🗣️",
  news:             "📰",
  other:            "🔍",
};

interface PlatformGroupSectionProps {
  groupKey: string;
  groupLabel: string;
  totalItems: number;
  onGroupToggle?: (select: boolean) => void;
  toggleLabel?: [string, string];
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function PlatformGroupSection({
  groupKey,
  groupLabel,
  totalItems,
  onGroupToggle,
  toggleLabel = ["Select all", "Deselect all"],
  defaultOpen = false,
  children,
}: PlatformGroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const icon = GROUP_ICONS[groupKey] || "🔍";

  return (
    <div className="mb-2 rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
        {/* Collapse toggle — left side */}
        <button
          className="flex items-center gap-2 flex-1 px-3 py-2 text-left"
          onClick={() => setOpen(o => !o)}
        >
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          }
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-slate-700">{groupLabel}</span>
          <span className="text-[10px] text-slate-400 bg-white border border-slate-200 rounded-full px-1.5 py-0.5">
            {totalItems}
          </span>
        </button>

        {/* Bulk action buttons — right side, no collapse on click */}
        {onGroupToggle && (
          <div className="flex items-center gap-2 px-3 shrink-0">
            <button
              onClick={() => onGroupToggle(true)}
              className="text-[10px] text-blue-600 hover:underline"
            >{toggleLabel[0]}</button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onGroupToggle(false)}
              className="text-[10px] text-red-500 hover:underline"
            >{toggleLabel[1]}</button>
          </div>
        )}
      </div>

      {open && <div className="divide-y divide-slate-100">{children}</div>}
    </div>
  );
}

interface PlatformSectionProps {
  platformLabel: string;
  count: number;
  onPlatformToggle?: (select: boolean) => void;
  toggleLabel?: [string, string];
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function PlatformSection({
  platformLabel,
  count,
  onPlatformToggle,
  toggleLabel = ["Select all", "Deselect all"],
  defaultOpen = false,
  children,
}: PlatformSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center hover:bg-slate-50 transition-colors">
        {/* Collapse toggle — left side */}
        <button
          className="flex items-center gap-2 flex-1 px-3 py-1.5 text-left"
          onClick={() => setOpen(o => !o)}
        >
          {open
            ? <ChevronDown className="h-3 w-3 text-slate-300 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
          <span className="text-xs font-medium text-slate-600">{platformLabel}</span>
          <span className="text-[10px] text-slate-400">({count})</span>
        </button>

        {/* Bulk action buttons — right side */}
        {onPlatformToggle && (
          <div className="flex items-center gap-2 px-3 shrink-0">
            <button
              onClick={() => onPlatformToggle(true)}
              className="text-[10px] text-blue-600 hover:underline"
            >{toggleLabel[0]}</button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onPlatformToggle(false)}
              className="text-[10px] text-red-500 hover:underline"
            >{toggleLabel[1]}</button>
          </div>
        )}
      </div>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}
