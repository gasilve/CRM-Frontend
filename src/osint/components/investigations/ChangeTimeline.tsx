// @ts-nocheck

import { useQuery } from "@tanstack/react-query";
import { prodigyApi as api } from "@/osint/lib/api";
import { ExternalLink, AlertTriangle, AlertCircle, Info, Clock } from "lucide-react";

interface TimelineEvent {
  finding_id: number;
  title: string;
  content: string;
  url: string;
  confidence: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  date_before: string | null;
  date_after: string | null;
  changes: { field: string; added: string[]; removed: string[] }[];
  snapshot_url_before: string | null;
  snapshot_url_after: string | null;
  source_url: string | null;
}

interface TimelineData {
  investigation_id: number;
  total_changes: number;
  critical: number;
  high: number;
  events: TimelineEvent[];
}

const SEVERITY_CONFIG = {
  CRITICAL: {
    bg: "bg-red-50 border-red-300",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-800 border-red-300",
    icon: AlertCircle,
    iconColor: "text-red-500",
    label: "CRITICAL",
  },
  HIGH: {
    bg: "bg-orange-50 border-orange-300",
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    label: "HIGH",
  },
  MEDIUM: {
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    label: "MEDIUM",
  },
  LOW: {
    bg: "bg-slate-50 border-slate-200",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    icon: Info,
    iconColor: "text-slate-400",
    label: "LOW",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso.slice(0, 10); }
}

function ChangeCard({ event }: { event: TimelineEvent }) {
  const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.LOW;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
          <div className="min-w-0">
            <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${cfg.badge}`}>
              {cfg.label}
            </span>
            <p className="text-xs font-medium text-slate-800 mt-1 truncate">
              {event.source_url || event.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-500">
          <Clock className="h-3 w-3" />
          {formatDate(event.date_after)}
        </div>
      </div>

      {/* Changes */}
      <div className="space-y-1.5">
        {event.changes.map((ch, i) => (
          <div key={i} className="rounded bg-white/60 border border-white px-2.5 py-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {ch.field}
            </p>
            {ch.removed.length > 0 && (
              <p className="text-xs text-red-700 font-mono">
                <span className="text-red-400 mr-1">−</span>
                {ch.removed.join(" · ")}
              </p>
            )}
            {ch.added.length > 0 && (
              <p className="text-xs text-emerald-700 font-mono">
                <span className="text-emerald-400 mr-1">+</span>
                {ch.added.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Dates + links */}
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>
          {formatDate(event.date_before)} → {formatDate(event.date_after)}
          {event.date_before && event.date_after && (() => {
            const days = Math.abs(
              (new Date(event.date_after).getTime() - new Date(event.date_before).getTime())
              / 86400000
            );
            return ` (${Math.round(days)} days)`;
          })()}
        </span>
        <div className="flex gap-2">
          {event.snapshot_url_before && (
            <a href={event.snapshot_url_before} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:text-blue-600">
              Before <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {event.snapshot_url_after && (
            <a href={event.snapshot_url_after} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-0.5 hover:text-blue-600">
              After <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChangeTimeline({ investigationId }: { investigationId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["timeline", investigationId],
    queryFn: async () => {
      const data = await api.get(`/api/investigations/${investigationId}/timeline`);
      return data as TimelineData;
    },
  });

  if (isLoading) return null;
  if (!data || data.total_changes === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            🕐 Change Timeline
            <span className="text-xs font-normal text-slate-500">
              — {data.total_changes} change{data.total_changes !== 1 ? "s" : ""} detected via Wayback Machine
            </span>
          </h3>
          {(data.critical > 0 || data.high > 0) && (
            <p className="text-xs text-red-700 font-medium mt-0.5">
              ⚠ {data.critical > 0 ? `${data.critical} critical` : ""}
              {data.critical > 0 && data.high > 0 ? " · " : ""}
              {data.high > 0 ? `${data.high} high severity` : ""} change{(data.critical + data.high) !== 1 ? "s" : ""} — review immediately
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

        <div className="space-y-3 pl-10">
          {data.events.map((event) => {
            const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.LOW;
            return (
              <div key={event.finding_id} className="relative">
                {/* Dot on timeline */}
                <div className={`absolute -left-6 top-4 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />
                <ChangeCard event={event} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
