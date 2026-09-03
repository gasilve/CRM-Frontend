// @ts-nocheck

import { useState } from "react";
import { Check, X, Eye, User, Users, ZoomIn, ExternalLink, ImagePlus, Sparkles, Shield, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PhotoItem } from "@/osint/lib/types";
import { useValidatePhoto, useMarkAsSubject, useScrapeProfile } from "@/osint/lib/queries";
import { CropFaceModal } from "./CropFaceModal";
import { toast } from "sonner";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="outline" className="bg-slate-50 text-slate-400 text-[10px]">No score</Badge>;
  const pct = Math.round(score * 100);
  const cls = score >= 0.92 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : score >= 0.85 ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-500 border-slate-200";
  const label = score >= 0.92 ? "Strong" : score >= 0.85 ? "Possible" : "Low";
  return <Badge variant="outline" className={`${cls} text-[10px]`}>{pct}% {label}</Badge>;
}

function ValidationBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    pending: "bg-slate-50 text-slate-500", validated: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-600", review_needed: "bg-amber-50 text-amber-700",
  };
  return <Badge variant="outline" className={`${m[status] || m.pending} text-[10px]`}>{status.replace("_"," ")}</Badge>;
}

export function PhotoCard({ photo, hasReference, onSelect }: {
  photo: PhotoItem; hasReference: boolean; onSelect: (p: PhotoItem) => void;
}) {
  const validateMut = useValidatePhoto();
  const markMut    = useMarkAsSubject();
  const scrapeMut  = useScrapeProfile();

  const [showCrop,        setShowCrop]        = useState(false);
  const [enhancing,       setEnhancing]       = useState(false);
  const [forensicsOpen,   setForensicsOpen]   = useState(false);
  const [forensicsData,   setForensicsData]   = useState<any>(null);
  const [forensicsLoading,setForensicsLoading]= useState(false);

  const SCRAPPABLE = ["instagram.com","facebook.com","fb.com","twitter.com","x.com",
    "tiktok.com","pinterest.com","threads.net","youtube.com","flickr.com","reddit.com"];
  const isScrappable = photo.source_url
    ? SCRAPPABLE.some(d => photo.source_url!.includes(d)) : false;

  const handleValidate = (decision: string) =>
    validateMut.mutate({ id: photo.id, decision, by: "investigator" }, {
      onSuccess: () => toast.success(`Photo ${decision}`),
    });

  const handleScrape = () =>
    scrapeMut.mutate({ photoId: photo.id }, {
      onSuccess: (res) => toast.success(`Scraping ${res.platform} — new photos will appear shortly`),
      onError: (err: unknown) => {
        const detail = (err as any)?.response?.data?.detail;
        toast.error(typeof detail === "object" && detail?.message ? detail.message : "Scrape failed");
      },
    });

  const getBase = () => {
    if (typeof window === "undefined") return "http://localhost:8000";
    const { hostname, port } = window.location;
    if (!["localhost","127.0.0.1"].includes(hostname) || port === "4001") return "";
    return "http://localhost:8000";
  };

  const imgSrc = photo.minio_path ? `${getBase()}/api/photos/${photo.id}/thumbnail` : null;

  const handleEnhance = async () => {
    setEnhancing(true);
    try {
      const r = await fetch(`${getBase()}/api/photos/${photo.id}/enhance`, { method: "POST" });
      if (r.ok) { const d = await r.json(); toast.success(`Enhanced: ${d.enhanced_size} — reload to see`); }
      else toast.error("Enhancement failed");
    } catch { toast.error("Enhancement error"); }
    finally { setEnhancing(false); }
  };

  const handleForensics = async () => {
    setForensicsLoading(true);
    setForensicsOpen(true);
    try {
      const r = await fetch(`${getBase()}/api/photos/${photo.id}/forensics`, { method: "POST" });
      if (r.ok) setForensicsData(await r.json());
      else toast.error("Forensics failed");
    } catch { toast.error("Forensics error"); }
    finally { setForensicsLoading(false); }
  };

  const srcHref = photo.source_url?.startsWith("http")
    ? photo.source_url : `https://${photo.source_url || ""}`;

  return (
    <>
      <div className="group rounded-lg border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">

        {/* Thumbnail */}
        <div className="relative h-36 bg-slate-100 flex items-center justify-center cursor-zoom-in"
          onClick={() => onSelect(photo)}>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center pointer-events-none z-10">
            <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
          {imgSrc
            ? <img src={imgSrc} alt={photo.source_platform || ""} className="h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <User className="h-8 w-8 text-slate-300" />}
          {photo.extraction_quality === "card_only" && (
            <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[8px] px-1 py-0.5 rounded font-medium">CARD</span>
          )}
          {photo.marked_as_subject && (
            <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[8px] px-1 py-0.5 rounded font-medium">REF</span>
          )}
          {(photo as any).search_criterion && (
            <span className="absolute bottom-1 right-1 bg-violet-600/90 text-white text-[8px] px-1.5 py-0.5 rounded-full font-semibold">
              ↺ {((photo as any).search_criterion || "").split(":")[1] || (photo as any).search_criterion}
            </span>
          )}
          {(photo.face_count ?? 0) > 1 && (
            <span className="absolute bottom-1.5 left-1.5 bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />{photo.face_count}
            </span>
          )}
        </div>

        {/* Meta + validation buttons */}
        <div className="p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 truncate">
              {photo.extraction_method === "facecheck_thumbnail" ? "FaceCheck"
                : photo.extraction_method === "yandex_thumbnail"   ? "Yandex"
                : photo.extraction_method === "lenso_thumbnail"    ? "Lenso"
                : photo.extraction_method === "reverse_image_auto" ? "Reverse Image"
                : photo.source_platform || "Unknown"}
            </span>
            <ValidationBadge status={photo.validation_status} />
          </div>
          <ScoreBadge score={photo.face_match_score} />
          <div className="flex gap-1 pt-1 flex-wrap">
            {photo.face_match_score !== null ? (
              <>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600" title="Validate"
                  onClick={() => handleValidate("validated")} disabled={photo.validation_status === "validated"}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" title="Reject"
                  onClick={() => handleValidate("rejected")} disabled={photo.validation_status === "rejected"}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-amber-500" title="Review"
                  onClick={() => handleValidate("review_needed")}>
                  <Eye className="h-3 w-3" />
                </Button>
                {!photo.marked_as_subject && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-violet-600 shrink-0"
                    title="Use as reference photo" onClick={() => setShowCrop(true)}>
                    <User className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="sm"
                  variant={photo.marked_as_subject ? "default" : "outline"}
                  className={`h-6 text-[10px] flex-1 min-w-0 ${photo.marked_as_subject ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                  onClick={() => !photo.marked_as_subject && setShowCrop(true)}
                  disabled={!!photo.marked_as_subject}>
                  <User className="h-3 w-3 mr-1 shrink-0" />
                  {photo.marked_as_subject ? "Subject ✓" : "This is the subject"}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 shrink-0"
                  onClick={() => handleValidate("rejected")} disabled={photo.validation_status === "rejected"}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Enhance + Forensics */}
        <div className="flex border-t border-slate-100">
          <button onClick={handleEnhance} disabled={enhancing}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50">
            <Sparkles className="h-2.5 w-2.5" />
            {enhancing ? "Enhancing..." : "Enhance"}
          </button>
          <button onClick={handleForensics} disabled={forensicsLoading}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-blue-600 hover:bg-blue-50 transition-colors border-l border-slate-100 disabled:opacity-50">
            <Shield className="h-2.5 w-2.5" />
            {forensicsLoading ? "Analyzing..." : "Forensics"}
          </button>
        </div>

        {/* Source link */}
        <a href={srcHref} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 border-t text-[10px] text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
          onClick={e => e.stopPropagation()}>
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{photo.source_platform || photo.source_url}</span>
        </a>

        {/* Scrape more button */}
        {isScrappable && (
          <button onClick={handleScrape} disabled={scrapeMut.isPending}
            className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100 disabled:opacity-50"
            title={`Scrape more photos from ${photo.source_platform || "this profile"}`}>
            <ImagePlus className="h-3 w-3" />
            {scrapeMut.isPending ? "Scraping..." : `More from ${photo.source_platform?.replace("www.","").split(".")[0] || "profile"}`}
          </button>
        )}
      </div>

      {/* Forensics modal — outside the card div so fixed positioning works */}
      {forensicsOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={() => setForensicsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />Forensic Metadata
              </span>
              <button onClick={() => setForensicsOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>
            {forensicsLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            )}
            {forensicsData && !forensicsLoading && (
              <div className="p-4 space-y-3 text-xs">
                {forensicsData.inconsistencies?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-semibold text-red-700 mb-1">⚠ Inconsistencies detected</p>
                    {forensicsData.inconsistencies.map((f: string, i: number) =>
                      <p key={i} className="text-red-600">{f}</p>)}
                  </div>
                )}
                {forensicsData.gps && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                      <Globe className="h-3 w-3" />GPS Location Found
                    </p>
                    <p className="text-emerald-800">{forensicsData.gps.latitude}, {forensicsData.gps.longitude}</p>
                    <a href={forensicsData.gps.maps_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline">Open in Google Maps →</a>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {["Make","Model","Software","DateTimeOriginal","width","height","megapixels","format"].map(k =>
                    forensicsData[k] ? (
                      <div key={k} className="bg-slate-50 rounded p-2">
                        <p className="text-slate-400 text-[10px]">{k}</p>
                        <p className="text-slate-700 font-medium truncate">{String(forensicsData[k])}</p>
                      </div>
                    ) : null
                  )}
                </div>
                <div className="bg-slate-50 rounded p-2 font-mono text-[9px] text-slate-500 break-all">
                  SHA256: {forensicsData.sha256}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCrop && <CropFaceModal photo={photo} onClose={() => setShowCrop(false)} />}
    </>
  );
}
