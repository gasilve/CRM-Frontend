// @ts-nocheck

import { useState } from "react";
import { Plus, Play, User, AtSign, Mail, Phone, MapPin, Building, X, Loader2, Users } from "lucide-react";
import { useSearchCriteria, useAddCriterion, useRemoveCriterion } from "@/osint/lib/queries";
import { toast } from "sonner";

const CRITERION_TYPES = [
  { key: "alias",    label: "Name / Alias", icon: User,     color: "bg-blue-50 border-blue-200 text-blue-800" },
  { key: "username", label: "Username",     icon: AtSign,   color: "bg-purple-50 border-purple-200 text-purple-800" },
  { key: "email",    label: "Email",        icon: Mail,     color: "bg-green-50 border-green-200 text-green-800" },
  { key: "phone",    label: "Phone",        icon: Phone,    color: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "city",     label: "City",         icon: MapPin,   color: "bg-slate-100 border-slate-300 text-slate-700" },
  { key: "address",  label: "Address",      icon: Building, color: "bg-slate-100 border-slate-300 text-slate-700" },
];

const GROUP_CONFIG: Record<string, {
  label: string; icon: React.ElementType;
  color: string; addType: string; placeholder: string;
}> = {
  names:     { label: "Name",      icon: User,     color: "bg-blue-50 border-blue-200 text-blue-800",       addType: "alias",    placeholder: "Add alias…" },
  aliases:   { label: "Aliases",   icon: User,     color: "bg-blue-50 border-blue-200 text-blue-800",       addType: "alias",    placeholder: "Add alias…" },
  usernames: { label: "Usernames", icon: AtSign,   color: "bg-purple-50 border-purple-200 text-purple-800", addType: "username", placeholder: "Add username…" },
  emails:    { label: "Emails",    icon: Mail,     color: "bg-green-50 border-green-200 text-green-800",    addType: "email",    placeholder: "Add email…" },
  phones:    { label: "Phones",    icon: Phone,    color: "bg-amber-50 border-amber-200 text-amber-800",    addType: "phone",    placeholder: "Add phone…" },
  locations: { label: "Cities",    icon: MapPin,   color: "bg-slate-100 border-slate-300 text-slate-700",   addType: "city",     placeholder: "Add city/county…" },
  addresses: { label: "Addresses", icon: Building, color: "bg-slate-100 border-slate-300 text-slate-700",   addType: "address",  placeholder: "Add address…" },
  employers: { label: "Employers", icon: Building, color: "bg-orange-50 border-orange-200 text-orange-800", addType: "employer", placeholder: "Add employer…" },
  relatives: { label: "Relatives", icon: Users, color: "bg-pink-50 border-pink-200 text-pink-800", addType: "relative", placeholder: "Add relative name…" },
};

function AddCriterionInline({
  investigationId, type, placeholder, color, onAdded,
}: {
  investigationId: number; type: string; placeholder: string;
  color: string; onAdded?: () => void;
}) {
  const [val, setVal] = useState("");
  const [open, setOpen] = useState(false);
  const addMut = useAddCriterion();

  const submit = () => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    addMut.mutate(
      { investigationId, type, value: trimmed },
      {
        onSuccess: (res) => {
          toast.success(`↺ Running ${res.engines?.length || 0} engines for "${trimmed}"…`);
          setVal(""); setOpen(false);
          onAdded?.(trimmed);
        },
        onError: () => toast.error("Failed to add criterion"),
      }
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-full px-2 py-0.5 hover:border-slate-400 transition-colors"
      >
        <Plus className="h-2.5 w-2.5" />Add
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setOpen(false); setVal(""); }
        }}
        placeholder={placeholder}
        className={`text-xs border rounded-full px-2.5 py-0.5 outline-none w-36 ${color}`}
      />
      <button
        onClick={submit}
        disabled={!val.trim() || addMut.isPending}
        className="flex items-center gap-1 text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50"
      >
        <Play className="h-2.5 w-2.5" />
        {addMut.isPending ? "…" : "Run"}
      </button>
      <button onClick={() => { setOpen(false); setVal(""); }} className="text-slate-400 hover:text-slate-600">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function SearchCriteriaPills({ investigationId }: { investigationId: number }) {
  const { data: criteria, isLoading } = useSearchCriteria(investigationId);
  const removeMut = useRemoveCriterion();
  const [runningCriteria, setRunningCriteria] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleExpand = (g: string) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });

  if (isLoading || !criteria) return null;

  // Collect groups that have content
  const groupOrder = ["names", "aliases", "usernames", "emails", "phones", "locations", "addresses", "employers", "relatives"] as const;
  const hasAny = groupOrder.some(g => (criteria[g]?.length ?? 0) > 0);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Search Criteria
      </p>

      {!hasAny && (
        <p className="text-xs text-slate-400 italic">No criteria recorded</p>
      )}

      {groupOrder.map(group => {
        const items: string[] = criteria[group] || [];
        const cfg = GROUP_CONFIG[group];
        if (!cfg) return null;
        // Skip empty groups that aren't "names" (always show names)
        if (group === "usernames") return null;  // shown in IntelCard grid above
        if (items.length === 0 && group !== "names" && group !== "employers") return null;

        const Icon = cfg.icon;

        const MAX = 3;
        const isExpanded = expandedGroups.has(group);
        const visible = isExpanded ? items : items.slice(0, MAX);
        const hidden = items.length - MAX;

        return (
          // Grid: [label 72px] [pills flex] [add-btn fixed]
          <div key={group} className="grid items-center gap-x-2 gap-y-0"
            style={{ gridTemplateColumns: "72px 1fr auto" }}>

            {/* Col 1: Label */}
            <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
              <Icon className="h-2.5 w-2.5" />{cfg.label}
            </span>

            {/* Col 2: Pills */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {visible.map((item, i) => (
                <span
                  key={i}
                  className={`group inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${cfg.color} ${runningCriteria.has(item) ? "ring-2 ring-violet-400 ring-offset-1" : ""}`}
                >
                  {runningCriteria.has(item) && <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />}
                  {item}
                  {!(group === "names" && i === 0) && (
                    <button
                      onClick={() => removeMut.mutate({ investigationId, type: cfg.addType, value: item })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-red-500"
                      title={`Remove ${item}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}
              {!isExpanded && hidden > 0 && (
                <button
                  onClick={() => toggleExpand(group)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-full px-2 py-0.5"
                >
                  +{hidden} more
                </button>
              )}
              {isExpanded && items.length > MAX && (
                <button
                  onClick={() => toggleExpand(group)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-full px-2 py-0.5"
                >
                  show less
                </button>
              )}
            </div>

            {/* Col 3: Add button — always in same column */}
            <div className="shrink-0">
              <AddCriterionInline
                investigationId={investigationId}
                type={cfg.addType}
                placeholder={cfg.placeholder}
                color={cfg.color}
                onAdded={(v) => {
                  setRunningCriteria(prev => new Set([...prev, v]));
                  setTimeout(() => setRunningCriteria(prev => {
                    const next = new Set(prev); next.delete(v); return next;
                  }), 180000);
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
