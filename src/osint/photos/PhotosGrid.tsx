/**
 * PhotosGrid — GridStack panel for subject photos from Prodigy.
 * Shows reference photos, face matches, and social media photos.
 * Goes in the CaseDetail tab bar as "Photos".
 */
import { useState, useEffect, useCallback } from "react";
import { useEffect as ue, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { GridStack } from "gridstack";
import { settleGridMetrics } from "@/lib/grid-stack-host";
import { designPx } from "@/lib/rem";
import { Camera, User, ExternalLink, Loader2, Star, X, Upload } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import type { CaseDetail } from "@/lib/crm-api";
import React from "react";

const CELL_H = 84, MARGIN = 8, COLS = 12, ROWS = 9;
const BASE = "/api-proxy";

const WIDGETS = [
  { id: "photos-gallery",  x: 0, y: 0, w: 8, h: 9, minW: 4, minH: 4 },
  { id: "photos-lightbox", x: 8, y: 0, w: 4, h: 9, minW: 3, minH: 4 },
];

type Photo = {
  id: number;
  source_url: string | null;
  source_platform: string | null;
  source_post_url: string | null;
  minio_path: string | null;
  thumbnail_path: string | null;
  is_downloaded: boolean;
  face_match_score: number | null;
  profile_picture: boolean;
  found_date: string | null;
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook:  "#1877f2",
  instagram: "#e4405f",
  tiktok:    "#010101",
  linkedin:  "#0a66c2",
  twitter:   "#1da1f2",
  youtube:   "#ff0000",
};

function photoSrc(p: Photo): string | null {
  if (p.minio_path) return `${BASE}/api/forensic/image/${p.minio_path}`;
  if (p.source_url) return p.source_url;
  return null;
}

// ── Gallery panel ─────────────────────────────────────────────────────────────
function GalleryPanel({ photos, selected, onSelect, invId, loading }: {
  photos: Photo[]; selected: Photo | null; onSelect: (p: Photo) => void;
  invId: number; loading: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (files: FileList) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("profile_picture", "true");
      await fetch(`${BASE}/api/investigations/${invId}/reference-photos`, {
        method: "POST", credentials: "include", body: fd,
      }).catch(() => {});
    }
    setUploading(false);
    // trigger reload — parent will re-fetch
    window.dispatchEvent(new CustomEvent("prodigy-photos-refresh"));
  };

  const profile = photos.filter(p => p.profile_picture);
  const rest    = photos.filter(p => !p.profile_picture);
  const groups  = [
    { label: "Reference / Profile",    items: profile },
    { label: "Found in investigation", items: rest },
  ].filter(g => g.items.length > 0);

  return (
    <PanelShell title="Photos"
      icon={<Camera size={11} strokeWidth={1.8} />}
      action={
        <div className="flex items-center gap-1">
          <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{photos.length}</span>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-0.5 rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[0.5rem] text-[var(--color-text-lo)] hover:text-[var(--color-accent)]">
            <Upload size={9}/> Upload
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => { if (e.target.files?.length) uploadPhoto(e.target.files); }}/>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 size={14} className="animate-spin text-[var(--color-text-lo)]"/>
          <span className="text-[0.75rem] text-[var(--color-text-lo)]">Loading photos…</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Camera size={28} className="text-[var(--color-text-lo)]"/>
          <p className="text-[0.75rem] text-[var(--color-text-lo)]">No photos yet</p>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.75rem] font-medium text-[var(--color-accent)]">
            <Upload size={12}/> Upload reference photo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {uploading && (
            <div className="flex items-center gap-2 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-2 text-[0.75rem] text-[var(--color-accent)]">
              <Loader2 size={12} className="animate-spin"/> Uploading…
            </div>
          )}
          {groups.map(g => (
            <div key={g.label}>
              <div className="mb-2 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-text-lo)]">{g.label}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {g.items.map(p => {
                  const src = photoSrc(p);
                  const active = selected?.id === p.id;
                  const col = PLATFORM_COLORS[p.source_platform?.toLowerCase() ?? ""] ?? "var(--color-line-2)";
                  return (
                    <button key={p.id} type="button" onClick={() => onSelect(p)}
                      className="relative overflow-hidden rounded-[0.375rem] border-2 transition-all"
                      style={{ borderColor: active ? "var(--color-accent)" : col, aspectRatio: "1" }}>
                      {src
                        ? <img src={src} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center bg-[var(--color-ink-3)]">
                            <User size={18} className="text-[var(--color-text-lo)]"/>
                          </div>
                      }
                      {p.profile_picture && (
                        <div className="absolute left-0.5 top-0.5">
                          <Star size={10} fill="#f59e0b" className="text-[#f59e0b]"/>
                        </div>
                      )}
                      {p.face_match_score !== null && (
                        <div className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 py-0.5 font-mono text-[0.5rem] text-white">
                          {Math.round(p.face_match_score * 100)}%
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

// ── Lightbox / detail panel ───────────────────────────────────────────────────
function LightboxPanel({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  if (!photo) {
    return (
      <PanelShell title="Photo detail" icon={<Camera size={11} strokeWidth={1.8}/>}>
        <div className="flex h-full items-center justify-center">
          <p className="text-[0.75rem] text-[var(--color-text-lo)]">Select a photo</p>
        </div>
      </PanelShell>
    );
  }
  const src = photoSrc(photo);
  const col = PLATFORM_COLORS[photo.source_platform?.toLowerCase() ?? ""] ?? "var(--color-accent)";
  return (
    <PanelShell title={photo.source_platform ?? "Photo"}
      icon={<Camera size={11} strokeWidth={1.8}/>}
      action={
        <button type="button" onClick={onClose}
          className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
          <X size={13}/>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {src && (
          <div className="overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
            <img src={src} alt="" className="w-full object-contain" style={{ maxHeight: 260 }}/>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {photo.source_platform && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: col }}/>
              <span className="text-[0.75rem] font-semibold capitalize text-[var(--color-text-hi)]">
                {photo.source_platform}
              </span>
            </div>
          )}
          {photo.face_match_score !== null && (
            <div className="rounded-[0.5rem] border px-2.5 py-1.5"
              style={{ borderColor: col + "40", background: col + "15" }}>
              <span className="font-mono text-[0.625rem]" style={{ color: col }}>
                Face match: {Math.round(photo.face_match_score * 100)}%
              </span>
            </div>
          )}
          {photo.found_date && (
            <div className="text-[0.625rem] text-[var(--color-text-lo)]">
              Found: {new Date(photo.found_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
          {photo.profile_picture && (
            <div className="flex items-center gap-1 text-[0.625rem] text-[#f59e0b]">
              <Star size={10} fill="#f59e0b"/> Reference photo
            </div>
          )}
          {photo.source_post_url && (
            <a href={photo.source_post_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[0.625rem] text-[var(--color-accent)] hover:underline">
              <ExternalLink size={10}/> View post
            </a>
          )}
          {photo.source_url && !photo.minio_path && (
            <a href={photo.source_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[0.625rem] text-[var(--color-accent)] hover:underline">
              <ExternalLink size={10}/> Source image
            </a>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────
export function PhotosGrid({ kase }: { kase: CaseDetail }) {
  const hostRef  = useRef<HTMLDivElement>(null);
  const rootsRef = useRef<Map<string, Root>>(new Map());
  const [photos,   setPhotos]   = useState<Photo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);

  const invId = Number(kase.id);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/investigations/${invId}/photos`, { credentials: "include" });
      if (r.ok) setPhotos(await r.json());
    } finally { setLoading(false); }
  }, [invId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);
  useEffect(() => {
    const handler = () => loadPhotos();
    window.addEventListener("prodigy-photos-refresh", handler);
    return () => window.removeEventListener("prodigy-photos-refresh", handler);
  }, [loadPhotos]);

  // Keep refs current
  const photosRef  = useRef(photos);
  const loadingRef = useRef(loading);
  const selRef     = useRef(selected);
  const selSetRef  = useRef(setSelected);
  photosRef.current  = photos;
  loadingRef.current = loading;
  selRef.current     = selected;

  const renderPanel = (el: HTMLElement, id: string) => {
    let root = rootsRef.current.get(id);
    if (!root) { root = createRoot(el); rootsRef.current.set(id, root); }
    const node = (() => {
      if (id === "photos-gallery")
        return <GalleryPanel photos={photosRef.current} selected={selRef.current}
          onSelect={p => { selRef.current = p; selSetRef.current(p); }} invId={invId} loading={loadingRef.current}/>;
      if (id === "photos-lightbox")
        return <LightboxPanel photo={selRef.current} onClose={() => { selRef.current = null; selSetRef.current(null); }}/>;
      return null;
    })();
    if (node) root.render(<div className="widget-frame h-full w-full"><div className="widget-body h-full w-full">{node}</div></div>);
  };

  useEffect(() => {
    if (!hostRef.current) return;
    for (const id of rootsRef.current.keys()) {
      const el = hostRef.current.querySelector(`.grid-stack-item[gs-id="${id}"] .grid-stack-item-content`) as HTMLElement | null;
      if (el) renderPanel(el, id);
    }
  }, [photos, loading, selected]);

  useEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    let cancelled = false;
    for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
    rootsRef.current.clear();
    hostEl.innerHTML = "";
    hostEl.classList.add("grid-stack");
    GridStack.renderCB = (el, node) => {
      const id = (node.id ?? el.getAttribute("gs-id")) as string | null;
      if (id && !cancelled) renderPanel(el, id);
    };
    const grid = GridStack.init({
      column: COLS, cellHeight: designPx(CELL_H), margin: designPx(MARGIN),
      float: true, animate: false, maxRow: ROWS,
    }, hostEl);
    grid.batchUpdate(true);
    grid.load(WIDGETS.map(w => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: w.minW, minH: w.minH, maxW: COLS, maxH: ROWS })));
    grid.batchUpdate(false);
    settleGridMetrics(grid, CELL_H, MARGIN);
    const onResize = () => settleGridMetrics(grid, CELL_H, MARGIN);
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      for (const root of rootsRef.current.values()) { try { root.unmount(); } catch { /**/ } }
      rootsRef.current.clear();
      try { grid.destroy(false); } catch { /**/ }
    };
  }, [invId]); // eslint-disable-line

  const minH = ROWS * (designPx(CELL_H) + designPx(MARGIN)) + designPx(MARGIN);
  return (
    <div className="h-full w-full overflow-auto">
      <div ref={hostRef} style={{ minHeight: `${minH}px` }} />
    </div>
  );
}
