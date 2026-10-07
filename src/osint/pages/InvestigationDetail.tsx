// @ts-nocheck
// InvestigationDetail — ported from Next.js
const ViewToggle = lazy(() => import("@/osint/components/investigations/ViewToggle"));
import { WysiwygLayoutEditor } from "@/osint/components/investigations/WysiwygLayoutEditor";
import React, { lazy, Suspense, useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startTracking } from "@/lib/investigationProgress";


import { groupByPlatform, getPlatformDisplayName, PLATFORM_GROUPS } from '@/osint/lib/platformGroups';
import { useStagingSummary, useSaveSectionOrder } from '@/osint/lib/queries';
import { PlatformGroupSection, PlatformSection } from "@/osint/components/shared/PlatformGroupHeader";
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Play, Trash2, ExternalLink, Check, X as XIcon, Eye, Camera, FileText, ScrollText, BarChart3, Download, ClipboardCheck, Search, Film, Video, Radio, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TloxpModal } from "@/osint/components/investigations/TloxpModal";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/osint/components/investigations/StatusBadge";
import { IntelCard } from "@/osint/components/investigations/IntelCard";
import { ChangeTimeline } from "@/osint/components/investigations/ChangeTimeline";
import { PhotosGallery } from "@/osint/components/photos/PhotosGallery";
import { ThemeSelector } from "@/components/ThemeSelector";
import { ReverseImageSearch } from "@/osint/components/investigations/ReverseImageSearch";
import { VideoTimestampBurner } from "@/osint/components/investigations/VideoTimestampBurner";
import { VideoTab } from "@/osint/components/investigations/VideoTab";
import { MonitorsTab } from "@/osint/components/investigations/MonitorsTab";
import { SignatureModal } from "@/components/docuseal/SignatureModal";
const LayoutEditorModal = lazy(() => import("@/osint/components/investigations/LayoutEditor"));

const InvestigationTabs = lazy(() => import("@/osint/components/investigations/InvestigationTabs"));

const InvestigationMap = lazy(() => import("@/osint/components/investigations/InvestigationMap"));
import {
  useInvestigation, useFindings, useSearchLog, usePhotos, useAISummary, useNotes, useCreateNote,
  useRunInvestigation, useDeleteInvestigation, useValidateFinding,
  useToggleIncludeInReport, useBulkStaging,
} from '@/osint/lib/queries';
import { toast } from "sonner";
import type { Finding } from '@/osint/lib/types';

// Parse UTC date strings correctly regardless of browser timezone
// API returns "2026-06-22T05:30:00" (no Z) — add Z to force UTC interpretation
function utcDate(s: string | null | undefined): Date {
  if (!s) return new Date();
  // Already has timezone info
  if (s.endsWith("Z") || s.includes("+")) return new Date(s);
  // Add Z to force UTC
  return new Date(s + "Z");
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 80 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500";
  return <Badge variant="outline" className={`${cls} text-[10px]`}>{pct}%</Badge>;
}

function FindingRow({ finding }: { finding: Finding }) {
  const mut = useValidateFinding();
  const v = (s: string) => mut.mutate({ id: finding.id, status: s, by: "investigator" }, { onSuccess: () => toast.success(`Finding ${s}`) });
  const sBadge: Record<string, string> = {
    pending:      "bg-slate-50 text-slate-500 border-slate-200",
    validated:    "bg-emerald-50 text-emerald-700 border-emerald-300",
    rejected:     "bg-red-50 text-red-600 border-red-300",
    review_needed:"bg-amber-50 text-amber-700 border-amber-300",
  };
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium">{finding.platform || "?"}</span>
          <ConfidenceBadge confidence={finding.confidence} />
          <Badge variant="outline" className={`${sBadge[finding.validation_status] || sBadge.pending} text-[10px]`}>{
            finding.validation_status === "validated"    ? "✅ Confirmed" :
            finding.validation_status === "rejected"     ? "❌ Rejected" :
            finding.validation_status === "review_needed"? "❓ Unsure" :
            "Pending"
          }</Badge>
        </div>
        {finding.search_criterion && (
          <span className="text-[10px] bg-violet-100 border border-violet-300 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold mt-0.5 inline-flex items-center gap-0.5">
            ↺ Re-run: {finding.search_criterion.split(":")[1] || finding.search_criterion}
          </span>
        )}
        {finding.url && <a href={finding.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 truncate">{finding.url}<ExternalLink className="h-2.5 w-2.5 flex-shrink-0" /></a>}
      </div>
      <div className="flex gap-0.5 flex-shrink-0">
        <Button size="sm" variant="ghost" title="✅ Confirmed — is the subject" className="h-6 w-6 p-0 text-emerald-600 hover:bg-emerald-50" onClick={() => v("validated")} disabled={finding.validation_status==="validated"}><Check className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" title="❌ Rejected — not the subject" className="h-6 w-6 p-0 text-red-500 hover:bg-red-50" onClick={() => v("rejected")} disabled={finding.validation_status==="rejected"}><XIcon className="h-3 w-3" /></Button>
        <Button size="sm" variant="ghost" title="❓ Unsure — needs review" className="h-6 w-6 p-0 text-amber-500 hover:bg-amber-50" onClick={() => v("review_needed")} disabled={finding.validation_status==="review_needed"}><Eye className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

// ── STAGING COMPONENT ─────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  github: "GitHub",
  telegram: "Telegram",
  vk: "VKontakte",
  truepeoplesearch: "TruePeopleSearch",
  fastpeoplesearch: "FastPeopleSearch",
  spokeo: "Spokeo",
  people_search: "People Search",
  holehe: "Holehe (Email Check)",
  maigret: "Maigret (Username)",
  searxng: "Web Search",
  wayback: "Wayback Machine",
  whois: "WHOIS",
  darkweb: "Dark Web",
  email_candidates: "Email Candidates",
  phoneinfoga: "PhoneInfoga",
  instaloader: "Instagram (Instaloader)",
  beenverified: "BeenVerified",
};

function categoryLabel(platform: string | null, engine: string): string {
  const key = (platform || engine || "").toLowerCase();
  return CATEGORY_LABELS[key] || platform || engine || "Other";
}

function StagingTab({
  investigationId,
  findings,
  sessionUser,
  confidenceThreshold,
  setConfidenceThreshold,
  showLowConf,
  setShowLowConf,
}: {
  investigationId: number;
  findings: Finding[];
  sessionUser: { name: string; email: string; role?: string } | null;
  confidenceThreshold: number;
  setConfidenceThreshold: (n: number) => void;
  showLowConf: boolean;
  setShowLowConf: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const toggleMut = useToggleIncludeInReport();
  const bulkMut = useBulkStaging();
  const saveSectionOrder = useSaveSectionOrder();
  const { data: summary } = useStagingSummary(investigationId);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [showEmpty, setShowEmpty] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Load saved section order
  React.useEffect(() => {
    if (summary?.section_order) setSectionOrder(summary.section_order);
  }, [summary?.section_order]);

  const handleDragStart = (e: React.DragEvent, groupKey: string) => {
    e.dataTransfer.setData("groupKey", groupKey);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    const srcKey = e.dataTransfer.getData("groupKey");
    if (!srcKey || srcKey === targetKey) return;
    const keys = grouped.map(g => g.groupKey);
    const currentOrder = sectionOrder.length ? sectionOrder : keys;
    const newOrder = [...currentOrder];
    const si = newOrder.indexOf(srcKey) === -1 ? keys.indexOf(srcKey) : newOrder.indexOf(srcKey);
    const ti = newOrder.indexOf(targetKey) === -1 ? keys.indexOf(targetKey) : newOrder.indexOf(targetKey);
    if (si === -1 || ti === -1) return;
    newOrder.splice(si, 1);
    newOrder.splice(ti, 0, srcKey);
    setSectionOrder(newOrder);
    saveSectionOrder.mutate({ investigationId, order: newOrder });
  };
  const [recipientForm, setRecipientForm] = useState({
    name: "", organization: "", address: "", city_state_zip: "",
    claim_no: "", case_number: "", case_name: "", cmda_matter: "",
    date_of_loss: "", investigator: "",
  });

  const [showRecipient, setShowRecipient] = useState(false);

  // Pre-fill investigator from session when modal opens
  useEffect(() => {
    if (sessionUser?.name && !recipientForm.investigator) {
      setRecipientForm(prev => ({ ...prev, investigator: sessionUser.name }));
    }
  }, [sessionUser, showRecipient]);

  // Filter findings by confidence threshold
  const filteredFindings = useMemo(() => {
    const base = findings.filter(f => f.validation_status !== "rejected");
    if (showLowConf) return base;
    return base.filter(f => (f.confidence || 0) >= confidenceThreshold);
  }, [findings, confidenceThreshold, showLowConf]);

  const hiddenCount = useMemo(() =>
    findings.filter(f => (f.confidence || 0) < confidenceThreshold).length,
  [findings, confidenceThreshold]);

  // Group findings by platform category (Todd's order + custom drag-and-drop)
  const grouped = useMemo(() =>
    groupByPlatform(filteredFindings, f => f.platform || f.engine, sectionOrder.length ? sectionOrder : undefined),
  [filteredFindings, sectionOrder]);

  // Apply defaultExcluded on first render — exclude low-priority groups
  React.useEffect(() => {
    for (const group of grouped) {
      if (group.defaultExcluded) {
        const included = group.platforms.flatMap(p => p.items).filter(f => f.include_in_report);
        if (included.length > 0) {
          included.forEach(f => toggleMut.mutate({ findingId: f.id, include: false }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const included = findings.filter(f => f.include_in_report);
  const total = findings.length;

  const handleToggle = (findingId: number, currentValue: boolean) => {
    toggleMut.mutate(
      { findingId, include: !currentValue },
      { onError: () => toast.error("Failed to update finding") }
    );
  };

  const handleBulkPreset = (preset: "high_confidence" | "all" | "none") => {
    bulkMut.mutate(
      { investigationId, preset },
      {
        onSuccess: () => {
          const labels = { high_confidence: "High confidence findings selected", all: "All findings selected", none: "All findings deselected" };
          toast.success(labels[preset]);
        },
        onError: () => toast.error("Bulk update failed"),
      }
    );
  };

  // Map platform name to group key (mirrors backend engine grouping)
  const getPlatformGroupKey = (plat: string): string => {
    const social = new Set(['facebook','instagram','tiktok','twitter','x','linkedin','snapchat','pinterest','reddit','youtube','vimeo','tumblr','whatsapp','telegram','discord']);
    const darkweb = new Set(['darkweb','onion','tor']);
    if (social.has(plat)) return 'social_platforms';
    if (darkweb.has(plat)) return 'darkweb';
    if (['google','bing','duckduckgo','yahoo'].includes(plat)) return 'search_engines';
    if (['spokeo','whitepages','beenverified','intelius','peoplefinder'].includes(plat)) return 'people_search';
    return 'web';
  };

  // Social-only preset: select findings from social_platforms + social_media groups
  const SOCIAL_GROUP_KEYS = new Set(["social_platforms", "social_media"]);
  const handleSocialOnly = () => {
    const socialIds = filteredFindings
      .filter(f => {
        const plat = (f.platform || f.engine || "").toLowerCase().replace("www.","").split(".")[0];
        const groupKey = getPlatformGroupKey(plat);
        return SOCIAL_GROUP_KEYS.has(groupKey);
      })
      .map(f => f.id);
    if (!socialIds.length) { toast.info("No social findings found"); return; }
    // First deselect all, then select social ones
    bulkMut.mutate({ investigationId, preset: "none" }, {
      onSuccess: () => {
        bulkMut.mutate(
          { investigationId, findingIds: socialIds, include: true },
          {
            onSuccess: () => toast.success(`${socialIds.length} social platform findings selected`),
            onError: () => toast.error("Failed to select social findings"),
          }
        );
      }
    });
  };

  // Investigator-confirmed preset: select findings validated by investigator
  const handleConfirmedOnly = () => {
    const confirmedIds = findings
      .filter(f => f.validation_status === "validated")
      .map(f => f.id);
    if (!confirmedIds.length) { toast.info("No confirmed findings — validate findings in the Findings tab first"); return; }
    bulkMut.mutate({ investigationId, preset: "none" }, {
      onSuccess: () => {
        bulkMut.mutate(
          { investigationId, findingIds: confirmedIds, include: true },
          {
            onSuccess: () => toast.success(`${confirmedIds.length} investigator-confirmed findings selected`),
            onError: () => toast.error("Failed to select confirmed findings"),
          }
        );
      }
    });
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const baseUrl = (typeof window !== "undefined" && (!["localhost","127.0.0.1"].includes(window.location.hostname) || window.location.port === "4001") ? "" : "http://localhost:8000");
      const res = await fetch(`${baseUrl}/api/investigations/${investigationId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: {
            name: recipientForm.name || undefined,
            organization: recipientForm.organization || undefined,
            address: recipientForm.address || undefined,
            city_state_zip: recipientForm.city_state_zip || undefined,
            claim_no: recipientForm.claim_no || undefined,
            case_name: recipientForm.case_name || undefined,
            case_number: recipientForm.case_number || undefined,
            cmda_matter: recipientForm.cmda_matter || undefined,
            date_of_loss: recipientForm.date_of_loss || undefined,
          },
          investigator: recipientForm.investigator || undefined,
        }),
      });
      if (!res.ok) throw new Error("Report generation failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `prodigy_report_${investigationId}.docx`;
      a.click();
      toast.success("Report downloaded");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGeneratingReport(false);
    }
  };

  const confidenceColor = (c: number) => c >= 0.85 ? "text-emerald-600" : c >= 0.60 ? "text-amber-600" : "text-slate-400";
  const confidenceLabel = (c: number) => `Likelihood ${Math.round(c * 100)}%`;

  return (
    <div className="space-y-4">
      {/* Header bar — B3 counter */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-blue-900 text-sm">Report Staging</h3>
          {summary && (
            <p className="text-xs text-slate-500 mt-0.5">
              Searched <span className="font-semibold text-blue-700">{summary.estimated_sites.toLocaleString()}+ sites</span>
              {" — "}
              <span className="font-semibold text-emerald-700">{summary.positive_matches} positive matches</span>
              {" · "}
              <span className="font-medium text-blue-700">{included.length} in report</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => setShowEmpty(v => !v)}>
            {showEmpty ? "Hide empty" : "Show all searched"}
          </Button>
          <span className="text-[10px] text-slate-400">|</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkPreset("high_confidence")} disabled={bulkMut.isPending}>
            ✦ High confidence (≥85%)
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleSocialOnly} disabled={bulkMut.isPending}
            title="Select only Facebook, Instagram, Twitter, TikTok, YouTube, etc.">
            📱 Social only
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={handleConfirmedOnly} disabled={bulkMut.isPending}
            title="Select only findings confirmed by investigator (validated status)">
            ✓ Confirmed only
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleBulkPreset("all")} disabled={bulkMut.isPending}>
            Select all
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-200" onClick={() => handleBulkPreset("none")} disabled={bulkMut.isPending}>
            Deselect all
          </Button>
          <span className="text-[10px] text-slate-300">|</span>
          <span className="text-[10px] text-slate-400 font-medium">SHOW ≥</span>
          <select
            value={confidenceThreshold}
            onChange={e => { setConfidenceThreshold(Number(e.target.value)); setShowLowConf(false); }}
            className="h-7 text-xs border border-slate-200 rounded px-1.5 bg-white text-slate-700 cursor-pointer"
          >
            <option value={0}>All</option>
            <option value={0.50}>50%</option>
            <option value={0.65}>65%</option>
            <option value={0.75}>75%</option>
            <option value={0.80}>80%</option>
            <option value={0.85}>85%</option>
            <option value={0.90}>90%</option>
          </select>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowLowConf(v => !v)}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              {showLowConf ? "hide low" : `+${hiddenCount} hidden`}
            </button>
          )}
        </div>
      </div>

      {/* B2 drag note */}
      <p className="text-[10px] text-slate-400">Drag sections to reorder · Low-priority sections (Web & Dev, Forums, News) deselected by default</p>

      {/* Findings grouped — B1 order, B2 drag-and-drop */}
      {grouped.map(group => {
        const groupFindings = group.platforms.flatMap(p => p.items);
        const includedInGroup = groupFindings.filter(f => f.include_in_report).length;
        // B3: hide groups with no findings unless showEmpty
        if (groupFindings.length === 0 && !showEmpty) return null;
        return (
          <div
            key={group.groupKey}
            draggable
            onDragStart={e => handleDragStart(e, group.groupKey)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, group.groupKey)}
            className="cursor-grab active:cursor-grabbing"
          >
          <PlatformGroupSection
            key={group.groupKey}
            groupKey={group.groupKey}
            groupLabel={(() => {
              const engineSet = new Set(groupFindings.map((f: Finding) => f.engine).filter(Boolean));
              const engineCount = engineSet.size;
              return `${group.groupLabel}${engineCount > 0 ? ` · ${engineCount} engine${engineCount > 1 ? "s" : ""}` : ""}${includedInGroup > 0 ? ` · ${includedInGroup} in report` : ""}`;
            })()}
            totalItems={groupFindings.length}
            defaultOpen={!group.defaultCollapsed}
            toggleLabel={["Include all", "Exclude all"]}
            onGroupToggle={(select) => {
              groupFindings.forEach(f => {
                if (f.include_in_report !== select)
                  toggleMut.mutate({ findingId: f.id, include: select });
              });
            }}
          >
            {group.platforms.map(plat => (
              <PlatformSection
                key={plat.platformKey}
                platformLabel={plat.platformLabel}
                count={plat.items.length}
                toggleLabel={["Include all", "Exclude all"]}
                onPlatformToggle={(select) => {
                  plat.items.forEach(f => {
                    if (f.include_in_report !== select)
                      toggleMut.mutate({ findingId: f.id, include: select });
                  });
                }}
              >
                {plat.items.map(f => (
                  <div key={f.id} className={`flex items-start gap-3 py-2.5 border-b last:border-0 transition-colors ${f.include_in_report ? "" : "opacity-50"}`}>
                    <div className="mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={f.include_in_report}
                        onChange={() => handleToggle(f.id, f.include_in_report)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold tabular-nums ${confidenceColor(f.confidence)}`}>
                          {confidenceLabel(f.confidence)}
                        </span>
                        <span className="text-[10px] text-slate-400">{f.finding_type}</span>
                        {f.found_username && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">@{f.found_username}</span>}
                        {f.found_name && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{f.found_name}</span>}
                        {f.search_criterion && (
                          <span className="text-[10px] bg-violet-100 border border-violet-300 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            ↺ Re-run: {f.search_criterion.split(":")[1] || f.search_criterion}
                          </span>
                        )}
                      </div>
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5 truncate max-w-lg">
                          {f.url}<ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                        </a>
                      )}
                      {f.title && !f.url && <p className="text-xs text-slate-600 mt-0.5 truncate">{f.title}</p>}
                      {f.content && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{f.content}</p>}
                    </div>
                    <div className="flex-shrink-0 w-1 self-stretch rounded-full"
                      style={{ background: f.confidence >= 0.85 ? "#10b981" : f.confidence >= 0.60 ? "#f59e0b" : "#e2e8f0" }} />
                  </div>
                ))}
              </PlatformSection>
            ))}
          </PlatformGroupSection>
          </div>
        );
      })}

      {/* Recipient info + Generate button */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-500/10 to-slate-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-emerald-900 text-sm">Generate Report</h3>
            <p className="text-xs text-slate-500">{included.length} findings will be included in the .docx</p>
          </div>
          <button
            className="text-xs text-emerald-700 hover:underline"
            onClick={() => setShowRecipient(v => !v)}
          >
            {showRecipient ? "▲ Hide recipient info" : "▼ Add recipient info"}
          </button>
        </div>

        {showRecipient && (
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Attorney name", "name"],
              ["Organization", "organization"],
              ["Address", "address"],
              ["City, State ZIP", "city_state_zip"],
              ["Claim No.", "claim_no"],
              ["Case number", "case_number"],
              ["Case name", "case_name"],
              ["CMDA Matter", "cmda_matter"],
              ["Date of Loss", "date_of_loss"],
              ["Investigated by", "investigator"],
            ].map(([label, key]) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">{label}</label>
                <input
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
                  value={recipientForm[key as keyof typeof recipientForm]}
                  onChange={e => setRecipientForm(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <Button
          id="generate-report-btn"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleGenerateReport}
          disabled={generatingReport || included.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {generatingReport ? "Generating..." : `Generate Report (${included.length} findings)`}
        </Button>
        {included.length === 0 && (
          <p className="text-[10px] text-amber-600 text-center">Select at least one finding above to generate the report.</p>
        )}
        <Button variant="outline" size="sm" className="w-full gap-2 mt-2"
          onClick={() => setShowSignature(true)}>
          <FileSignature className="h-4 w-4" />
          Send for signature
        </Button>
      </div>

      {/* Template Upload — Todd can replace the template without touching code */}
      <TemplateUploader />
    </div>
  );
}

function TemplateUploader() {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gender, setGender] = useState("male");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const baseUrl = (typeof window !== "undefined" && (!["localhost","127.0.0.1"].includes(window.location.hostname) || window.location.port === "4001") ? "" : "http://localhost:8000");
      const res = await fetch(`${baseUrl}/api/investigations/template/upload?gender=${gender}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMsg(`✓ Template uploaded: ${data.filename} (${data.size_kb || Math.round(data.size/1024)} KB)`);
    } catch (err: unknown) {
      setMsg(`✗ Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50">
      <summary className="px-4 py-2.5 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none">
        ⚙ Replace Report Template
      </summary>
      <div className="px-4 pb-4 pt-2 space-y-2">
        <p className="text-[10px] text-slate-400">Upload a .docx template to replace the current one. The system will use it for all future reports.</p>
        <div className="flex items-center gap-3">
          <select
            className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
            value={gender}
            onChange={e => setGender(e.target.value)}
          >
            <option value="male">Male template</option>
            <option value="female">Female template</option>
          </select>
          <label className={`cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-100 ${uploading ? "opacity-50" : ""}`}>
            {uploading ? "Uploading..." : "Choose .docx file"}
            <input type="file" accept=".docx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {msg && <p className={`text-[10px] ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>}
      </div>
    </details>
  );
}
// ── END STAGING ───────────────────────────────────────────────────────────────

export default function InvestigationDetail() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = Number(idStr);
  const navigate = useNavigate();
  const [tab, setTab] = useState("findings");
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchSms, setWatchSms] = useState("");
  const [watchActive, setWatchActive] = useState(false);

  const isActive = (s: string) => s === "running" || s === "queued";
  const { data: inv, isLoading, refetch } = useInvestigation(id, 3000);
  const { data: findings, isLoading: fLoading } = useFindings(id, inv ? isActive(inv.status) : false);
  const { data: photos } = usePhotos(id);
  const { data: notes } = useNotes(id);
  const createNoteMut = useCreateNote();
  const [noteText, setNoteText] = useState("");
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const saveField = async (field: string, value: string) => {
    if (!value.trim()) { setEditField(null); return; }
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    // Load saved layout
    fetch(`${base}/api/investigations/layout/config`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tabs) setSavedLayout(d.tabs); })
      .catch(() => {});
    const payload: any = {};
    const arrayFields = ["subject_emails","subject_phones","subject_aliases","subject_addresses","subject_usernames"];
    // Physical description fields stored in extra_metadata
    const metaFields = ["subject_height","subject_weight","subject_build","subject_eyes","subject_complexion","subject_glasses"];
    if (arrayFields.includes(field)) {
      const existing = (inv as any)?.[field] || [];
      payload[field] = [...existing, value.trim()];
    } else if (metaFields.includes(field)) {
      const metaKey = field.replace("subject_", "");
      payload["extra_metadata"] = { ...((inv as any)?.extra_metadata || {}), [metaKey]: value.trim() };
    } else {
      payload[field] = value.trim();
    }
    try {
      await fetch(`${base}/api/investigations/${id}`, {
        method: "PATCH", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      queryClient.invalidateQueries({ queryKey: ["investigation", id] });
      toast.success("Updated");
    } catch { toast.error("Failed to update"); }
    setEditField(null);
    setEditValue("");
  };

  const removeFieldValue = async (field: string, valueToRemove?: string) => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    const payload: any = {};
    const arrayFields = ["subject_emails","subject_phones","subject_aliases","subject_addresses","subject_usernames"];
    if (arrayFields.includes(field) && valueToRemove) {
      const existing = ((inv as any)[field] || []).filter((v: string) => v !== valueToRemove);
      payload[field] = existing;
    } else {
      payload[field] = null;
    }
    try {
      await fetch(`${base}/api/investigations/${id}`, {
        method: "PATCH", headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      queryClient.invalidateQueries({ queryKey: ["investigation", id] });
      toast.success("Removed");
    } catch { toast.error("Failed to remove"); }
  };
  const { data: logs } = useSearchLog(id);
  const { data: aiData } = useAISummary(id);
  // TLO/XP import handler — patches current investigation with parsed data

  const runMut = useRunInvestigation();
  const queryClient = useQueryClient();

  const handleTloxpImport = async (data: Record<string, any>) => {
    try {
      // Use same base URL pattern as other working fetches on this page
      const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
      const patch: Record<string, any> = {};
      // Always overwrite — user explicitly chose to import
      if (data.subject_name)          patch.subject_name      = data.subject_name;
      if (data.subject_dob) {
        const dobRaw: string = data.subject_dob;
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dobRaw)) {
          const [m, d, y] = dobRaw.split("/");
          patch.subject_dob = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
        } else {
          patch.subject_dob = dobRaw;
        }
      }
      if (data.subject_ssn_last4)     patch.subject_ssn_last4 = data.subject_ssn_last4;
      if (data.subject_ssn)           patch.subject_ssn       = data.subject_ssn;
      if (data.subject_gender)        patch.subject_gender    = data.subject_gender;
      if (data.subject_phones?.length) {
        patch.subject_phones = data.subject_phones;
        // Store confidence metadata per phone/email from TLO
        if ((data as any).raw_phones?.length) {
          const meta: Record<string,number> = {};
          (data as any).raw_phones.forEach((p: any) => { meta[p.phone] = p.confidence; });
          patch.subject_phones_meta = meta;
        }
      }
      if (data.subject_emails?.length) {
        patch.subject_emails = data.subject_emails;
        if ((data as any).raw_emails?.length) {
          const emailMeta: Record<string,number> = {};
          (data as any).raw_emails.forEach((e: any) => { emailMeta[e.email] = e.confidence; });
          // Store in extra_metadata
          patch.extra_metadata = {
            ...((inv as any)?.extra_metadata || {}),
            ...(patch.extra_metadata || {}),
            emails_confidence: emailMeta,
          };
        }
      }
      if (data.subject_aliases?.length)   patch.subject_aliases   = data.subject_aliases;
      if (data.subject_usernames?.length) patch.subject_usernames = data.subject_usernames;
      if (data.subject_addresses?.length) patch.subject_addresses = data.subject_addresses;
      // primary_address stored in extra_metadata for Google Places canvass
      if (data.primary_address) patch.extra_metadata = {
        ...((inv as any)?.extra_metadata || {}),
        primary_address: data.primary_address,
      };
      if (!Object.keys(patch).length) {
        toast.error("No data selected to import");
        return;
      }
      const res = await fetch(`${base}/api/investigations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        toast.success("TLO/XP data imported");
        queryClient.invalidateQueries({ queryKey: ["investigation", id] });
        queryClient.invalidateQueries({ queryKey: ["investigations"] });
        setShowTloxp(false);
      } else {
        const errText = await res.text().catch(() => "unknown error");
        toast.error("Import failed: " + errText.slice(0, 80));
      }
    } catch (e: any) { toast.error("Import error: " + (e?.message || e)); }
  };

  // M1/M2: auto-start progress tracking
  useEffect(() => {
    if (inv && (inv.status === "running" || inv.status === "queued")) {
      startTracking(id);
    }
  }, [inv?.status, id]);
  const delMut = useDeleteInvestigation();
  const validateFindingMut = useValidateFinding();
  const [downloading, setDownloading] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50);
  const [showLowConf, setShowLowConf] = useState(false);
  const [sessionUser, setSessionUser] = useState<{name: string; email: string; role?: string; can_view_pii?: boolean; pii_closed_cases?: boolean} | null>(null);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [showTloxp, setShowTloxp] = useState(false);
  const [savedLayout, setSavedLayout] = useState<any[] | null>(null);

  // Load layout config from DB on mount
  useEffect(() => { (async () => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    fetch(`${base}/api/layout/all`, { credentials:"include" })
      .then(r => r.json())
      .then(async d => {
        if (d.tabs && d.tabs.length) {
          // Convert DB tab format to LayoutEditor TabLayout format
          const { DEFAULT_LAYOUT } = await import("@/osint/components/investigations/LayoutEditor");
          const dbTabs = d.tabs.filter((t: any) => t.visible).sort((a: any,b: any) => a.sort_order - b.sort_order);
          const merged = dbTabs.map((dbTab: any) => {
            const def = DEFAULT_LAYOUT.find((dl: any) => dl.id === dbTab.id);
            return def ? { ...def, label: dbTab.label } : null;
          }).filter(Boolean);
          if (merged.length) setSavedLayout(merged);
        }
      })
      .catch(() => {});
  })(); }, []);


  // Load session user from Microsoft auth for report
  useEffect(() => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname)
      ? "" : "http://localhost:8000";
    fetch(`${base}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.authenticated) {
          setSessionUser({
            name: data.name || "Investigator",
            email: data.email || "",
            role: data.role || "investigator",
            can_view_pii: data.can_view_pii || false,
            pii_closed_cases: data.pii_closed_cases || false,
          });
        }
      })
      .catch(() => {});
  }, []);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const baseUrl = (typeof window !== "undefined" && (!["localhost","127.0.0.1"].includes(window.location.hostname) || window.location.port === "4001") ? "" : "http://localhost:8000");
      const res = await fetch(`${baseUrl}/api/investigations/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: {}, investigator: sessionUser?.name || "Prodigy" }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `prodigy_report_inv${id}.docx`;
      a.click();
      toast.success("Report downloaded");
    } catch {
      toast.error("Report generation failed");
    } finally {
      setDownloading(false);
    }
  };

  const [showAddrPicker, setShowAddrPicker] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [findingsMinConf, setFindingsMinConf] = useState(0.80);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualPlatform, setManualPlatform] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const saveManualFinding = async () => {
    if (!manualUrl.trim()) return;
    setManualSaving(true);
    try {
      const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
      const res = await fetch(`${base}/api/investigations/${id}/findings/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ url: manualUrl.trim(), platform: manualPlatform || undefined, title: manualTitle || undefined, confidence: 0.95, finding_type: "profile" }),
      });
      if (res.ok) {
        toast.success("Finding added");
        queryClient.invalidateQueries({ queryKey: ["findings", id] });
        setManualUrl(""); setManualPlatform(""); setManualTitle(""); setShowAddFinding(false);
      } else { toast.error("Failed to save finding"); }
    } catch { toast.error("Error saving finding"); }
    finally { setManualSaving(false); }
  };

  const visibleFindings = useMemo(() => {
    const base = (findings || []).filter(f => f.validation_status !== "rejected");
    if (showAllFindings) return base;
    return base.filter(f => (f.confidence || 0) >= findingsMinConf);
  }, [findings, findingsMinConf, showAllFindings]);

  const hiddenFindingsCount = (findings?.length || 0) - (visibleFindings?.length || 0);

  const groupedFindings = useMemo(() =>
    groupByPlatform(visibleFindings, f => f.platform || f.engine),
  [visibleFindings]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80" /><Skeleton className="h-64" /></div>;
  if (!inv) return <p className="text-red-500 text-sm">Investigation not found</p>;
  const validated = findings?.filter(f => f.validation_status === "validated").length ?? 0;
  const missingSubjectData = [];
  if (!inv.subject_dob) missingSubjectData.push("date of birth");
  if (!inv.subject_gender || inv.subject_gender === "unknown") missingSubjectData.push("gender");
  if (!inv.subject_race || inv.subject_race === "unknown") missingSubjectData.push("race");
  if (!inv.has_reference_photos) missingSubjectData.push("reference photo");
  const scoredPhotos = (photos || []).filter(p => p.face_match_score !== null && p.face_match_score >= 0.85);
  const bestPhoto = (() => {
    if (!photos?.length) return null;
    const subject = photos.find(p => p.marked_as_subject && p.minio_path);
    if (subject) return subject;
    const scored = photos.filter(p => p.minio_path && p.face_match_score !== null)
      .sort((a, b) => (b.face_match_score ?? 0) - (a.face_match_score ?? 0));
    return scored[0] || photos.find(p => p.minio_path) || null;
  })();
  const photoBase = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
  const includedInReport = findings?.filter(f => f.include_in_report).length ?? 0;

  const tabs = [
    { key: "findings",      label: "Findings",      icon: FileText,       count: findings?.length },
    { key: "photos",        label: "Photos",          icon: Camera,        count: photos?.length },
    { key: "video",         label: "Video Evidence",  icon: Video,         count: undefined },
    { key: "reverse_image", label: "🔍 Rev. Image",   icon: Search,         count: undefined },
    { key: "staging",       label: "Staging",         icon: ClipboardCheck, count: includedInReport },
    { key: "log",           label: "Log",             icon: ScrollText,     count: logs?.length },
    { key: "monitors",      label: "Monitors",       icon: Radio,          count: undefined },
    { key: "overview",      label: "Overview",        icon: BarChart3 },
    { key: "timeline",      label: "Timeline",        icon: FileText },
  ];

  return (
    <>
    <div className="space-y-5">
      {/* CRM-style subject hero */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <span className="text-sm text-slate-500">Investigations</span>
          <span className="text-slate-400">/</span>
          <span className="text-sm font-medium text-slate-800">{inv.subject_name}</span>
        </div>
        <div className="flex gap-1.5 items-center">
          <ThemeSelector />

          {["draft","open","completed","failed"].includes(inv.status) && (
            <Button size="sm" className="h-8 text-xs"
              disabled={runMut.isPending}
              onClick={() => runMut.mutate(id, {
                onSuccess: () => { toast.success("OSINT engines started"); startTracking(id); },
                onError: (e: any) => toast.error("Failed to start: " + (e?.response?.data?.detail || e?.message || "unknown error")),
              })}>
              <Play className="mr-1 h-3 w-3" />
              {runMut.isPending ? "Starting…" : inv.status === "draft" ? "Run" : "Re-run"}
            </Button>
          )}
          {(inv.status==="completed" || (inv.status==="failed" && findings && findings.length > 0)) && (
            <Button size="sm" variant="outline" className="h-8 text-xs bg-blue-50 text-blue-700 border-blue-300"
              onClick={() => { setTab("staging"); setTimeout(() => document.getElementById("staging-tab")?.scrollIntoView({behavior:"smooth"}), 50); }}>
              <ClipboardCheck className="mr-1 h-3 w-3" />Stage report
            </Button>
          )}
          {(inv.status==="completed" || (inv.status==="failed" && findings && findings.length > 0)) && (
            <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-700 border-emerald-300 bg-emerald-50"
              onClick={() => { setTab("staging"); setTimeout(() => document.getElementById("generate-report-btn")?.scrollIntoView({behavior:"smooth", block:"center"}), 100); }}>
              <Download className="mr-1 h-3 w-3" />Download report
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs text-violet-700 border-violet-300 bg-violet-50"
            title="Import TLO/XP Comprehensive Report" onClick={() => setShowTloxp(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            TLO/XP
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs text-blue-600 border-blue-300 bg-blue-50"
            title="Upload reference photo" onClick={() => document.getElementById("ref-photo-upload")?.click()}>
            <Camera className="mr-1 h-3 w-3" />Add photo
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs"
            title="Edit layout" onClick={() => setLayoutEditorOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Edit layout
          </Button>
          <input id="ref-photo-upload" type="file" accept="image/*" multiple className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              const formData = new FormData();
              files.forEach(f => formData.append("files", f));
              const base = (typeof window !== "undefined" && (!["localhost","127.0.0.1"].includes(window.location.hostname) || window.location.port === "4001") ? "" : "http://localhost:8000");
              const res = await fetch(`${base}/api/investigations/${id}/reference-photos`, { method: "POST", body: formData });
              if (res.ok) {
                toast.success(`${files.length} reference photo${files.length > 1 ? "s" : ""} uploaded`);
                queryClient.invalidateQueries({ queryKey: ["photos", id] });
              } else { toast.error("Photo upload failed"); }
              e.target.value = "";
            }} />
          <input id="tmpl-upload-input" type="file" accept=".docx" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const gender = inv.subject_gender === "female" ? "female" : "male";
              const form = new FormData(); form.append("file", file);
              const res = await fetch(`${typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000"}/api/investigations/template/upload?gender=${gender}`, {method:"POST",body:form});
              if (res.ok) { const d = await res.json(); toast.success("Template updated: " + d.filename); }
              else { toast.error("Upload failed"); }
              e.target.value = "";
            }} />
          <Button size="sm" variant="outline" className="h-8 text-xs text-red-500 border-red-300" onClick={() => delMut.mutate(id, { onSuccess: () => { toast.success("Cancelled"); navigate("/"); } })}>
            <Trash2 className="mr-1 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* View toggle — Subject / Map / Summary */}
      {/* ViewToggle disabled temporarily */}

      {/* Investigation Tabs — ACT-style layout */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5">
        <InvestigationTabs
          inv={inv}
          userRole={(sessionUser as any)?.role || "investigator"}
          canViewPii={(sessionUser as any)?.can_view_pii ?? false}
          piiClosedCases={(sessionUser as any)?.pii_closed_cases ?? false}
          layout={savedLayout || undefined}
          onSave={async (field: string, value: any) => {
            const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
            await fetch(`${base}/api/investigations/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ [field]: value }),
            });
            refetch();
          }}
        />
      </div>
      {/* Layout Editor Modal */}
      {layoutEditorOpen && (
        <WysiwygLayoutEditor
          isOpen={layoutEditorOpen}
          onClose={() => setLayoutEditorOpen(false)}
          currentLayout={savedLayout || []}
          inv={inv}
          onSave={async (layout) => {
            const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
            await fetch(`${base}/api/layout/all`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tabs: layout }),
            });
            setSavedLayout(layout);
            setLayoutEditorOpen(false);
          }}
        />
      )}

      {watchOpen && <div className="rounded-lg border border-green-200 bg-green-50 p-3"><p className="text-xs font-semibold text-green-800 mb-2">Monitor for changes (weekly SMS)</p><div className="flex gap-2"><input className="flex-1 text-sm rounded border border-green-300 px-2 py-1" placeholder="+1 555 123 4567" value={watchSms} onChange={e=>setWatchSms(e.target.value)} /><Button size="sm" onClick={()=>{setWatchActive(true);setWatchOpen(false);toast.success("Watch set!");}}>Save</Button></div></div>}

      {/* Intel Card */}
      {/* <IntelCard investigationId={id} /> — replaced by CRM hero above */}

      {/* Stats bar removed — info available in tabs */}

      {missingSubjectData.length > 0 && inv.status === "completed" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex items-center gap-2">
          <span className="font-medium">Filtering limited:</span>
          <span>Missing {missingSubjectData.join(", ")}. Age and visual filters work better with complete subject data.</span>
        </div>
      )}
      {/* Tabs */}
      <div className="border-b flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200" style={{scrollbarWidth:"thin"}}>
        {tabs.map(t => (
          <button key={t.key} id={t.key === "staging" ? "staging-tab" : undefined} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${tab === t.key ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"} ${t.key === "staging" && tab !== "staging" ? "text-blue-500" : ""}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
            {t.count !== undefined && (
              <span className={`ml-0.5 text-[10px] ${t.key === "staging" ? "text-blue-500 font-semibold" : "text-slate-400"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "findings" && (
        fLoading ? <Skeleton className="h-48" /> :
        !findings?.length ? <div className="py-10 text-center text-sm text-slate-400">{isActive(inv.status) ? "Findings will appear as engines complete..." : "No findings. Run the investigation."}</div> :
        <div className="grid grid-cols-[1fr_300px] gap-4 items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500 font-medium">Show ≥</span>
            <select value={findingsMinConf} onChange={e => { setFindingsMinConf(Number(e.target.value)); setShowAllFindings(false); }}
              className="h-7 text-xs border border-slate-200 rounded px-1.5 bg-white text-slate-700 cursor-pointer">
              <option value={0}>All</option>
              <option value={0.50}>50%</option>
              <option value={0.65}>65%</option>
              <option value={0.75}>75%</option>
              <option value={0.80}>80%</option>
              <option value={0.90}>90%</option>
            </select>
            <span className="text-slate-400">{visibleFindings.length} of {findings?.length || 0} findings</span>
            <button onClick={() => setShowAddFinding(v => !v)}
              className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
              + Add manually
            </button>
            {hiddenFindingsCount > 0 && !showAllFindings && (
              <button onClick={() => setShowAllFindings(true)}
                className="text-blue-500 hover:text-blue-700 underline cursor-pointer">
                +{hiddenFindingsCount} hidden
              </button>
            )}
            {showAllFindings && (
              <button onClick={() => setShowAllFindings(false)}
                className="text-slate-400 hover:text-slate-600 underline cursor-pointer">
                re-apply filter
              </button>
            )}
          </div>
          {showAddFinding && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-orange-800">Add finding manually</p>
              <input type="text" value={manualUrl} onChange={e => setManualUrl(e.target.value)}
                placeholder="https://www.facebook.com/SierraGerman"
                className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                onKeyDown={e => e.key === "Enter" && saveManualFinding()} />
              <div className="flex gap-2">
                <input type="text" value={manualPlatform} onChange={e => setManualPlatform(e.target.value)}
                  placeholder="Platform (e.g. facebook)"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
                <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)}
                  placeholder="Label (optional)"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveManualFinding} disabled={manualSaving || !manualUrl.trim()}
                  className="flex-1 text-xs py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#ff6a1a,#ff3d00)" }}>
                  {manualSaving ? "Saving…" : "Save finding"}
                </button>
                <button onClick={() => setShowAddFinding(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border text-slate-500">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {groupedFindings.map(group => {
            return (
              <PlatformGroupSection
                key={group.groupKey}
                groupKey={group.groupKey}
                groupLabel={group.groupLabel}
                totalItems={group.platforms.reduce((s, p) => s + p.items.length, 0)}
                toggleLabel={["Verify all", "Discard all"]}
                onGroupToggle={(select) => {
                  group.platforms.flatMap(p => p.items).forEach(f => {
                    if (f.validation_status !== (select ? "validated" : "rejected"))
                      validateFindingMut.mutate({ id: f.id, status: select ? "validated" : "rejected", by: "investigator" });
                  });
                }}
              >
                {group.platforms.map(plat => (
                  <PlatformSection
                    key={plat.platformKey}
                    platformLabel={plat.platformLabel}
                    count={plat.items.length}
                    toggleLabel={["Verify all", "Discard all"]}
                    onPlatformToggle={(select) => {
                      plat.items.forEach(f => {
                        if (f.validation_status !== (select ? "validated" : "rejected"))
                          validateFindingMut.mutate({ id: f.id, status: select ? "validated" : "rejected", by: "investigator" });
                      });
                    }}
                  >
                    {plat.items.map(f => <FindingRow key={f.id} finding={f} />)}
                  </PlatformSection>
                ))}
              </PlatformGroupSection>
            );
          })}
        </div>

        {/* Notes panel */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col" style={{maxHeight:"600px"}}>
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Case notes</h3>
            <span className="text-[11px] text-slate-400">{notes?.length || 0} notes</span>
          </div>
          <div className="flex-1 overflow-auto px-3 py-3 space-y-2.5" style={{minHeight:"100px"}}>
            {(!notes || notes.length === 0) && (
              <div className="text-center py-8 text-xs text-slate-400">No notes yet</div>
            )}
            {notes?.map((n: any) => (
              <div key={n.id} className={`bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 ${n.pinned ? "border-blue-200 bg-blue-50" : ""}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {(n.author_name || "?").split(" ").map((w: string) => w[0]).join("").substring(0, 2)}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-700">{n.author_name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">{new Date(n.created_at).toLocaleDateString("en-US", {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                </div>
                <p className="text-[13px] text-slate-500 leading-relaxed">{n.content}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 px-3 py-3">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note to this case..."
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 resize-none"
              rows={2}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[11px] text-slate-400">Posting as {sessionUser?.name || "investigator"}</span>
              <button
                onClick={() => { if (noteText.trim()) { createNoteMut.mutate({ investigationId: id, content: noteText, author_name: sessionUser?.name || "Investigator" }); setNoteText(""); } }}
                disabled={!noteText.trim()}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40"
              >Add note</button>
            </div>
          </div>
        </div>

        </div>
      )}

      {tab === "staging" && (
        fLoading ? <Skeleton className="h-48" /> :
        !findings?.length ? (
          <div className="py-10 text-center text-sm text-slate-400">
            {isActive(inv.status) ? "Run the investigation first to get findings." : "No findings to stage."}
          </div>
        ) : (
          <StagingTab investigationId={id} findings={findings} sessionUser={sessionUser} confidenceThreshold={confidenceThreshold} setConfidenceThreshold={setConfidenceThreshold} showLowConf={showLowConf} setShowLowConf={setShowLowConf} />
        )
      )}

      {tab==="timeline"&&(<div className="space-y-2">{(findings||[]).sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||"")).map(f=>(<div key={f.id} className="flex gap-3 border-l-2 border-slate-200 pl-3 py-1"><span className="text-xs text-slate-400 w-24 shrink-0">{(f.found_date||(f.created_at||"").split("T")[0])||"—"}</span><div><b className="text-xs text-blue-700">{f.platform}</b><span className="mx-1">·</span><a href={f.url||"#"} target="_blank" className="text-xs hover:underline">{f.title||f.url||"—"}</a></div></div>))}</div>)}
      {tab === "photos" && photos && <PhotosGallery photos={photos} investigation={inv} />}
      {tab === "reverse_image" && (
        <div className="p-4 max-w-2xl">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Reverse Image Search</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload a photo to search across FaceCheck.id, Yandex, Google Lens, TinEye and more</p>
          </div>
          <ReverseImageSearch investigationId={id} />
        </div>
      )}

      {tab === "monitors" && (
        <MonitorsTab investigationId={id} />
      )}
      {tab === "video" && inv && (
        <div className="p-4">
          <VideoTab investigationId={id} hasReferencePhotos={inv.has_reference_photos ?? false} />
        </div>
      )}

      {tab === "log" && (
        <div className="rounded-lg border bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead><tr className="border-b text-left text-slate-500"><th className="px-4 py-2">Engine</th><th className="px-4 py-2">Query</th><th className="px-4 py-2">Results</th><th className="px-4 py-2">Duration</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Time</th></tr></thead>
            <tbody>
              {logs?.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{l.engine}</td>
                  <td className="px-4 py-2 text-slate-500">{l.query_type}={l.query_term}</td>
                  <td className="px-4 py-2">{l.result_count}</td>
                  <td className="px-4 py-2">{l.duration_ms ? `${(l.duration_ms/1000).toFixed(1)}s` : "—"}</td>
                  <td className="px-4 py-2">{l.error_message ? <span className="text-red-500">Error</span> : <span className="text-emerald-600">OK</span>}</td>
                  <td className="px-4 py-2 text-slate-400">{l.executed_at ? format(utcDate(l.executed_at), "MMM d, HH:mm") : "—"}</td>
                </tr>
              )) || <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No log entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-4">
          <ChangeTimeline investigationId={id} />
          {aiData?.summary && (
            <div className="rounded-lg border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">AI Analysis</h3>
                {aiData.confidence && (
                  <Badge variant="outline" className={aiData.confidence >= 0.8 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                    Confidence: {Math.round(aiData.confidence * 100)}%
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{aiData.summary}</p>
              {(() => {
                const sd = (aiData.profile as Record<string, unknown>)?.summary_details as Record<string, unknown> | undefined;
                if (!sd) return null;
                const platforms2 = (sd.confirmed_platforms || []) as Array<Record<string, unknown>>;
                const observations = (sd.key_observations || []) as Array<Record<string, unknown>>;
                const gaps = (sd.data_gaps || []) as string[];
                return (
                  <>
                    {platforms2.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-1">Likely Matches</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {platforms2.map((p, i) => (
                            <Badge key={i} variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">
                              {String(p.platform)} @{String(p.username || "?")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {observations.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-1">Key Observations</h4>
                        <ul className="text-xs text-slate-600 space-y-1">
                          {observations.map((o, i) => (
                            <li key={i} className="flex gap-1.5">
                              <span className="text-slate-400">•</span>
                              <span>{String(o.observation)} <span className="text-slate-400">refs: {JSON.stringify(o.finding_ids)}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {gaps.length > 0 && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5">
                        <h4 className="text-xs font-semibold text-amber-700 mb-1">Data Gaps</h4>
                        <ul className="text-xs text-amber-700 space-y-0.5">
                          {gaps.map((g, i) => <li key={i}>• {g}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
              {aiData.processed_at && <p className="text-[10px] text-slate-400">AI processed: {aiData.processed_at}</p>}
            </div>
          )}
          <div className="rounded-lg border bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Subject Information</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
              {[
                ["Name", inv.subject_name], ["DOB", inv.subject_dob || "—"],
                ["Usernames", inv.subject_usernames?.join(", ") || "—"], ["Emails", inv.subject_emails?.join(", ") || "—"],
                ["Phones", inv.subject_phones?.join(", ") || "—"], ["Locations", inv.subject_locations?.join(", ") || "—"],
                ["Employers", inv.subject_employers?.join(", ") || "—"], ["Priority", inv.priority],
              ].map(([k, v]) => <div key={String(k)}><span className="text-slate-400">{k}:</span> <span className="text-slate-700">{v}</span></div>)}
            </div>
          </div>
        </div>
      )}
    </div>

    {showTloxp && (
      <TloxpModal
        onImport={handleTloxpImport}
        onClose={() => setShowTloxp(false)}
      />
    )}
    </>
  );
}
