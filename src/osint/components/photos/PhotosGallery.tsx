// @ts-nocheck

import { useState, useMemo } from "react";
import { Camera, AlertTriangle, Zap, UserCheck, X, ExternalLink, User, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PhotoCard } from "./PhotoCard";
import { PlatformGroupSection, PlatformSection } from "@/osint/components/shared/PlatformGroupHeader";
import { groupByPlatform } from "@/osint/lib/platformGroups";
import type { PhotoItem, Investigation } from "@/osint/lib/types";
import { useValidatePhoto } from "@/osint/lib/queries";
import { toast } from "sonner";

function Lightbox({ photo, onClose }: { photo: PhotoItem; onClose: () => void }) {
  const imgSrc = photo.minio_path ? `${typeof window!=="undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : (window.location.port==="4001" ? "" : "http://localhost:8000")}/api/photos/${photo.id}/thumbnail` : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">{photo.source_platform || "Photo"}</span>
            {photo.face_match_score !== null && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                {Math.round(photo.face_match_score * 100)}% match
              </Badge>
            )}
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-slate-100 flex items-center justify-center" style={{ minHeight: 280 }}>
          {imgSrc
            ? <img src={imgSrc} alt="" className="max-h-80 max-w-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            : <div className="flex flex-col items-center gap-2 py-16 text-slate-400"><User className="h-10 w-10" /><span className="text-xs">No preview</span></div>
          }
        </div>
        <div className="px-4 py-3 bg-slate-50 border-t space-y-2">
          {photo.source_url && (
            <a href={photo.source_url?.startsWith("http") ? photo.source_url : "https://" + (photo.source_url || "")}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Open source: {photo.source_url}</span>
            </a>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {photo.source_platform && <span>Platform: <b className="text-slate-700">{photo.source_platform}</b></span>}
            {(photo.face_count ?? 0) > 0 && <span>Faces: <b className="text-slate-700">{photo.face_count}</b></span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhotosGallery({ photos, investigation }: { photos: PhotoItem[]; investigation: Investigation }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "validated">("all");
  const [selected, setSelected] = useState<PhotoItem | null>(null);
  const validateMut = useValidatePhoto();
  const hasRef = investigation.has_reference_photos ?? false;

  const visible = useMemo(() => {
    let fi = photos.filter(p => p.validation_status !== "rejected" && p.minio_path);
    if (statusFilter !== "all") fi = fi.filter(p => p.validation_status === statusFilter);
    return fi.sort((a, b) => (b.face_match_score ?? -1) - (a.face_match_score ?? -1));
  }, [photos, statusFilter]);

  const grouped = useMemo(() =>
    groupByPlatform(visible, p => p.source_platform),
  [visible]);

  const scored = photos.filter(p => p.face_match_score !== null);
  const cardOnly = photos.filter(p => p.extraction_quality === "card_only");

  const bulkValidate = (items: PhotoItem[], decision: string) => {
    items.forEach(p => {
      if (p.validation_status !== decision && !p.marked_as_subject) {
        validateMut.mutate(
          { id: p.id, decision, by: "investigator" },
          { onError: () => toast.error("Failed to update photo") }
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      {selected && <Lightbox photo={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Camera className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium">{photos.length} photos</span>
        {hasRef
          ? <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]"><Zap className="h-2.5 w-2.5 mr-1" />Auto-Match</Badge>
          : <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]"><UserCheck className="h-2.5 w-2.5 mr-1" />Manual ID</Badge>
        }
        {scored.length > 0 && <span className="text-[10px] text-slate-400">{scored.length} scored</span>}
        <label className="cursor-pointer flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 transition-colors">
          <Upload className="h-3 w-3" />
          {hasRef ? "Change ref photo" : "Upload ref photo"}
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append("files", file);
              form.append("uploaded_by", "investigator");
              const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
              const invId = investigation.id;
              try {
                const res = await fetch(`${base}/api/investigations/${invId}/reference-photos`, {
                  method: "POST", body: form,
                  headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
                });
                if (res.ok) { window.location.reload(); }
              } catch {}
            }}
          />
        </label>
        <div className="ml-auto">
          <select className="h-7 rounded-md border px-2 text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="validated">Validated</option>
          </select>
        </div>
      </div>

      {cardOnly.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Some photos are limited previews. Click to open source.</span>
        </div>
      )}

      {visible.length === 0
        ? <div className="py-12 text-center text-sm text-slate-400">No photos matching filters</div>
        : grouped.map(group => {
            const groupPhotos = group.platforms.flatMap(p => p.items);
            return (
              <PlatformGroupSection
                key={group.groupKey}
                groupKey={group.groupKey}
                groupLabel={group.groupLabel}
                totalItems={groupPhotos.length}
                toggleLabel={["Validate all", "Reject all"]}
                onGroupToggle={(select) => bulkValidate(groupPhotos, select ? "validated" : "rejected")}
              >
                {group.platforms.map(plat => (
                  <PlatformSection
                    key={plat.platformKey}
                    platformLabel={plat.platformLabel}
                    count={plat.items.length}
                    toggleLabel={["Validate all", "Reject all"]}
                    onPlatformToggle={(select) => bulkValidate(plat.items, select ? "validated" : "rejected")}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 py-2">
                      {plat.items.map(p => (
                        <PhotoCard key={p.id} photo={p} hasReference={hasRef} onSelect={setSelected} />
                      ))}
                    </div>
                  </PlatformSection>
                ))}
              </PlatformGroupSection>
            );
          })
      }
    </div>
  );
}
