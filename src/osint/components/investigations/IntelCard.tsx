// @ts-nocheck

import { SearchCriteriaPills } from "./SearchCriteriaPills";
import { PossibleSubjects } from "./PossibleSubjects";
import { useIntelCard } from "@/osint/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, User, Shield, AlertTriangle, MapPin, Mail, Phone, Star, X, Download, ZoomIn } from "lucide-react";
import { useState } from "react";

function _apiBase(){if(typeof window==="undefined")return"http://localhost:8000";const{hostname,port}=window.location;if(!["localhost","127.0.0.1"].includes(hostname)||port==="4001")return"";return"http://localhost:8000";}
const API = _apiBase();

function PlatformIcon({ name }: { name: string }) {
  const n = (name || "").toLowerCase();
  const colors: Record<string, string> = {
    instagram: "from-purple-500 to-pink-500", threads: "from-gray-800 to-black",
    vimeo: "from-sky-400 to-sky-600", gamespot: "from-red-500 to-red-700",
    geeks: "from-green-500 to-green-700", github: "from-gray-700 to-gray-900",
    facebook: "from-blue-500 to-blue-700", linkedin: "from-blue-600 to-blue-800",
    twitter: "from-sky-400 to-sky-600", tiktok: "from-gray-800 to-black",
    reddit: "from-orange-500 to-orange-700", youtube: "from-red-500 to-red-700",
    pixwox: "from-pink-400 to-pink-600", scholar: "from-blue-400 to-blue-600",
  };
  const gradient = Object.entries(colors).find(([k]) => n.includes(k))?.[1] || "from-slate-400 to-slate-600";
  return <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm`}>{(name || "?")[0].toUpperCase()}</div>;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const cls = pct >= 80 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : pct >= 50 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-100 text-slate-600 border-slate-300";
  return <Badge variant="outline" className={`${cls} text-[11px] font-semibold`}>Likelihood {pct}%</Badge>;
}

type PhotoItem = { photo_id: number; source_url: string; thumbnail_url: string; extraction_method: string; face_match_score: number | null; is_reference?: boolean };

function PhotoModal({ photo, photos, onClose, onNavigate }: { photo: PhotoItem; photos: PhotoItem[]; onClose: () => void; onNavigate: (p: PhotoItem) => void }) {
  const idx = photos.findIndex(p => p.photo_id === photo.photo_id);
  const prev = idx > 0 ? photos[idx - 1] : null;
  const next = idx < photos.length - 1 ? photos[idx + 1] : null;

  const platformFromUrl = (url: string) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return "unknown"; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-3xl w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/80 hover:text-white">
          <X className="h-6 w-6" />
        </button>

        {/* Image */}
        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
          <img
            src={`${API}/api/photos/${photo.photo_id}/full`}
            alt=""
            className="w-full max-h-[70vh] object-contain"
          />

          {/* Bottom bar */}
          <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-white font-medium">{platformFromUrl(photo.source_url)}</span>
              <span className="text-gray-400 ml-2 text-xs">via {photo.extraction_method}</span>
              {photo.face_match_score !== null && (
                <Badge variant="outline" className="ml-2 text-[10px] bg-emerald-900/50 text-emerald-300 border-emerald-700">
                  Face: {Math.round(photo.face_match_score * 100)}%
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <a href={photo.source_url} target="_blank" rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition" title="View original">
                <ExternalLink className="h-4 w-4" />
              </a>
              <a href={`${API}/api/photos/${photo.photo_id}/download`}
                className="text-gray-400 hover:text-white transition" title="Download">
                <Download className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-3">
          {prev ? (
            <button onClick={() => onNavigate(prev)} className="text-white/80 hover:text-white text-sm flex items-center gap-1">
              ← Previous
            </button>
          ) : <div />}
          <span className="text-white/50 text-xs">{idx + 1} of {photos.length}</span>
          {next ? (
            <button onClick={() => onNavigate(next)} className="text-white/80 hover:text-white text-sm flex items-center gap-1">
              Next →
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}

export function IntelCard({ investigationId }: { investigationId: number }) {
  const { data: intel, isLoading } = useIntelCard(investigationId) as any;
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [modalPhoto, setModalPhoto] = useState<PhotoItem | null>(null);

  if (isLoading || !intel) return null;
  if (intel.status !== "completed") return null;

  // Auto-refresh while AI is processing
  const isProcessing = intel.ai_processed === false;

  if (isProcessing) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-slate-100 to-slate-50 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-200" />
          <h3 className="text-sm font-bold text-white">Identity Assessment</h3>
        </div>
        <div className="p-5 flex items-center gap-3">
          <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-slate-700">AI analyzing findings...</p>
            <p className="text-xs text-slate-400">AI analysis of all findings to identify the most likely matches for the subject. This takes 1-2 minutes.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!intel.ai_processed) return null;

  const topCandidate = intel.candidates?.[0];
  const otherCandidates = intel.candidates?.slice(1) || [];
  const hasIdentity = topCandidate && topCandidate.name.toLowerCase() !== (intel.searched_name || "").toLowerCase();
  const photos = intel.relevant_photos || [];
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 4);
  const contact = intel.contact_data || { emails: [], phones: [], locations: [], addresses: [] };
  const hasContact = contact.emails.length > 0 || contact.phones.length > 0 || contact.locations.length > 0;

  const downloadAllUrl = photos.length > 0
    ? `${API}/api/investigations/${investigationId}/photos/download-all?photo_ids=${photos.map(p => p.photo_id).join(",")}`
    : null;

  return (
    <>
      {/* Photo Modal */}
      {modalPhoto && (
        <PhotoModal
          photo={modalPhoto}
          photos={photos}
          onClose={() => setModalPhoto(null)}
          onNavigate={(p) => setModalPhoto(p)}
        />
      )}

      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-slate-100 to-slate-50 shadow-lg overflow-hidden">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-200" />
            <h3 className="text-sm font-bold text-white">Identity Assessment</h3>
            {intel.stats && (
              <span className="text-[10px] text-blue-200 ml-2">
                {intel.stats.total_findings} findings · {intel.stats.maigret_hits} accounts · {intel.stats.total_photos} photos
              </span>
            )}
          </div>
          {topCandidate && <ScoreBadge score={topCandidate.score} />}
        </div>

        <div className="p-5 space-y-5">
          {/* ── Top candidate ── */}
          {topCandidate && (
            <div className="flex gap-4">
              {/* Photo grid */}
              <div className="flex-shrink-0 w-[160px] space-y-1.5">
                {photos.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {visiblePhotos.map((p, i) => (
                        <div
                          key={p.photo_id}
                          className={`relative cursor-pointer group ${i === 0 ? "col-span-2" : ""}`}
                          onClick={() => setModalPhoto(p)}
                        >
                          <img
                            src={`${API}${p.thumbnail_url}`}
                            alt=""
                            className={`${i === 0 ? "h-28 w-full" : "h-16 w-full"} rounded-lg object-cover border-2 border-white shadow-sm group-hover:border-blue-400 transition`}
                            onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f1f5f9' width='100' height='100'/%3E%3C/svg%3E"; }}
                          />
                          <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                            <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-lg" />
                          </div>
                          {p.is_reference && (
                            <div className="absolute top-1 left-1 bg-emerald-500/90 text-white text-[8px] px-1.5 py-0.5 rounded-full font-semibold">
                              ✓ Reference
                            </div>
                          )}
                          {i === 0 && !p.is_reference && (
                            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-full">
                              Primary
                            </div>
                          )}
                        </div>
                      ))}
                      {photos.length > 4 && !showAllPhotos && (
                        <button onClick={() => setShowAllPhotos(true)}
                          className="h-16 w-full rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-500 hover:bg-slate-200 transition">
                          +{photos.length - 4} more
                        </button>
                      )}
                    </div>
                    {/* Download all button */}
                    {downloadAllUrl && (
                      <a href={downloadAllUrl}
                        className="flex items-center justify-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50 hover:border-blue-300 transition w-full">
                        <Download className="h-3 w-3" />
                        Download all ({photos.length})
                      </a>
                    )}
                  </>
                ) : (
                  <div className="h-28 w-full rounded-lg bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                    <User className="h-10 w-10 text-slate-300" />
                  </div>
                )}
              </div>

              {/* Identity info */}
              <div className="flex-1 space-y-3">
                {hasIdentity ? (
                  <>
                    <div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Top Identity Candidate</p>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5">{topCandidate.name}</p>
                      <p className="text-sm text-slate-500">
                        Searched as <Badge variant="outline" className="text-[11px] bg-slate-50 mx-1">@{intel.searched_username}</Badge>
                      </p>
                    </div>

                    {/* Evidence */}
                    <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 space-y-1">
                      <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Why this identification</p>
                      {topCandidate.reasons.filter((r: string, i: number, arr: string[]) => arr.indexOf(r) === i).map((r: string, i: number) => (
                        <p key={i} className="text-[11px] text-blue-700/80 flex gap-1.5">
                          <span className="text-blue-400">→</span>{r}
                        </p>
                      ))}
                      {topCandidate.evidence.length > 0 && (
                        <p className="text-[10px] text-blue-500 mt-1">
                          Source: {topCandidate.evidence.map((e: {id: number; title: string; url: string; platform: string}, i: number) => (
                            <a key={e.id} href={e.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">
                              {i > 0 ? ", " : ""}{e.platform}
                            </a>
                          ))}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-slate-900">@{intel.searched_username || intel.searched_name}</p>
                    <p className="text-sm text-slate-400">No different real name resolved — accounts confirmed below</p>
                  </div>
                )}

                {/* Search Criteria — editable pills */}
                <SearchCriteriaPills investigationId={intel.investigation_id} />
              </div>

              {/* Possible Subjects — right panel */}
              <div className="w-64 flex-shrink-0 border-l pl-4">
                <PossibleSubjects investigationId={intel.investigation_id} />
              </div>
            </div>
          )}

          {/* ── Other candidates ── */}
          {otherCandidates.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Other possible identities</p>
              <div className="space-y-2">
                {otherCandidates.map((c: {name: string; score: number; reasons: string[]}, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-700">{c.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">{c.reasons[0]}</span>
                    </div>
                    <ScoreBadge score={c.score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Confirmed platforms — 3-tier display ── */}
          {intel.confirmed_platforms.length > 0 && (() => {
            type PlatformEntry = {name: string; url: string; username: string; confidence?: number; is_original_username?: boolean};
            const platforms = intel.confirmed_platforms as PlatformEntry[];
            const high = platforms.filter(p => (p.confidence || 0) >= 0.90 || p.is_original_username);
            const possible = platforms.filter(p => (p.confidence || 0) >= 0.70 && (p.confidence || 0) < 0.90 && !p.is_original_username);
            const low = platforms.filter(p => (p.confidence || 0) < 0.70 && !p.is_original_username);

            const PlatformCard = ({p, tier}: {p: PlatformEntry; tier: string}) => (
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm hover:shadow-md transition-all group ${
                  tier === "high" ? "bg-emerald-50 border-emerald-200 hover:border-emerald-400" :
                  tier === "possible" ? "bg-white border-slate-200 hover:border-blue-300" :
                  "bg-slate-50 border-slate-100 opacity-60 hover:opacity-100"
                }`}>
                <PlatformIcon name={p.name} />
                <div className="leading-tight">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <span className="block text-[10px] text-slate-400">@{p.username}</span>
                  <span className={`block text-[10px] font-medium ${
                    tier === "high" ? "text-emerald-600" :
                    tier === "possible" ? "text-amber-600" : "text-slate-400"
                  }`}>
                    {`Likelihood ${Math.round((p.confidence||0) * 100)}%`}
                    {p.confidence ? ` (${Math.round(p.confidence * 100)}%)` : ""}
                  </span>
                </div>
                <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-blue-500 transition" />
              </a>
            );

            return (
              <div className="border-t pt-3 space-y-2">
                {high.length > 0 && (
                  <details>
                    <summary className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 mb-1.5 list-none">
                      <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                        ✓ High Likelihood ({high.length})
                      </span>
                      <span className="text-[10px] text-slate-300 ml-auto">click to collapse</span>
                    </summary>
                    <div className="flex flex-wrap gap-2">
                      {high.map((p, i) => <PlatformCard key={i} p={p} tier="high" />)}
                    </div>
                  </details>
                )}
                {possible.length > 0 && (
                  <details>
                    <summary className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 mb-1.5 list-none">
                      <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                        ? Possible Likelihood — requires review ({possible.length})
                      </span>
                      <span className="text-[10px] text-slate-300 ml-auto">click to collapse</span>
                    </summary>
                    <div className="flex flex-wrap gap-2">
                      {possible.map((p, i) => <PlatformCard key={i} p={p} tier="possible" />)}
                    </div>
                  </details>
                )}
                {low.length > 0 && (
                  <details>
                    <summary className="flex items-center gap-2 cursor-pointer select-none hover:opacity-80 mb-1.5 list-none">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Low Likelihood — not included in report ({low.length})
                      </span>
                    </summary>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {low.map((p, i) => <PlatformCard key={i} p={p} tier="low" />)}
                    </div>
                  </details>
                )}
              </div>
            );
          })()}

          {/* ── People Search Data ── */}
          {(() => {
            const psd = (intel as Record<string, unknown>).people_search_data as {
              phones?: string[]; addresses?: string[]; relatives?: string[];
              emails?: string[]; age_range?: string; sources?: string[];
            } | undefined;
            if (!psd) return null;
            const hasData = (psd.phones?.length || psd.addresses?.length ||
              psd.relatives?.length || psd.emails?.length);
            if (!hasData) return null;
            return (
              <div className="border-t pt-3">
                <details>
                  <summary className="flex items-center gap-2 cursor-pointer select-none list-none mb-2">
                    <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">
                      🔎 People Search Sites
                    </span>
                    {psd.sources && psd.sources.length > 0 && (
                      <span className="text-[9px] text-slate-400">
                        ({psd.sources.join(", ")})
                      </span>
                    )}
                  </summary>
                  <div className="space-y-2">
                    {psd.phones && psd.phones.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">📞 Phones</p>
                        <div className="flex flex-wrap gap-1.5">
                          {psd.phones.map((p, i) => (
                            <span key={i} className="text-[11px] bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-mono">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {psd.addresses && psd.addresses.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">📍 Addresses</p>
                        <div className="space-y-0.5">
                          {psd.addresses.map((a, i) => (
                            <p key={i} className="text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded">{a}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {psd.relatives && psd.relatives.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">👥 Relatives & Associates</p>
                        <div className="flex flex-wrap gap-1.5">
                          {psd.relatives.map((r, i) => (
                            <span key={i} className="text-[11px] bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full">{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {psd.emails && psd.emails.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">✉️ Emails</p>
                        <div className="flex flex-wrap gap-1.5">
                          {psd.emails.map((e, i) => (
                            <span key={i} className="text-[11px] bg-green-50 border border-green-200 text-green-800 px-2 py-0.5 rounded-full font-mono">{e}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {psd.age_range && (
                      <p className="text-[11px] text-slate-500">Age range: <b className="text-slate-700">{psd.age_range}</b></p>
                    )}
                  </div>
                </details>
              </div>
            );
          })()}

          {/* ── Professional Licenses ── */}
          {(() => {
            const licenses = (intel as Record<string, unknown>).professional_licenses as Array<{
              finding_id: number; title: string; source: string;
              license_type: string; license_number: string; status: string;
              status_category: string; is_alert: boolean; expiration: string | null;
            }> | undefined;
            if (!licenses?.length) return null;
            const alerts = licenses.filter(l => l.is_alert);
            return (
              <div className="border-t pt-3">
                <details open={alerts.length > 0}>
                  <summary className="flex items-center gap-2 cursor-pointer select-none list-none mb-2">
                    <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                      🪪 Professional Licenses
                      {alerts.length > 0 && (
                        <span className="bg-red-100 text-red-700 border border-red-300 text-[9px] px-1.5 py-0.5 rounded-full ml-1">
                          {alerts.length} ALERT{alerts.length > 1 ? "S" : ""}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="space-y-1.5">
                    {licenses.map((lic, i) => (
                      <div key={i} className={`rounded-lg border px-3 py-2 ${
                        lic.is_alert
                          ? "bg-red-50 border-red-300"
                          : lic.status_category === "active"
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-slate-800">
                              {lic.source} — {lic.license_type}
                            </span>
                            {lic.license_number && (
                              <span className="text-[10px] text-slate-500 ml-2">#{lic.license_number}</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            lic.is_alert
                              ? "bg-red-100 text-red-700 border-red-300"
                              : lic.status_category === "active"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}>
                            {lic.status?.toUpperCase()}
                          </span>
                        </div>
                        {lic.is_alert && (
                          <p className="text-[10px] text-red-700 mt-1 font-medium">
                            ⚠️ Non-active license — verify reason. May indicate fraud.
                          </p>
                        )}
                        {lic.expiration && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Expires: {lic.expiration}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })()}

          {/* ── Data gaps ── */}
          {intel.data_gaps.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-amber-700">Missing Information</p>
                <p className="text-[11px] text-amber-600">{intel.data_gaps.join(" · ")}</p>
                <p className="text-[10px] text-amber-500 mt-1">Tip: Run a second search with the discovered name to find more data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
