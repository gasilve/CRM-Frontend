import { createPortal } from "react-dom";
import { ExternalLink, Search, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PHOTO_BASE, type OsintPhoto } from "@/components/cases/osint/mock-data";
import "./osint-modal.css";

function reverseUrls(imageUrl: string) {
  const q = encodeURIComponent(imageUrl);
  return {
    lens: `https://lens.google.com/uploadbyurl?url=${q}`,
    tineye: `https://www.tineye.com/search?url=${q}`,
    yandex: `https://yandex.com/images/search?rpt=imageview&url=${q}`,
  };
}

function Thumb({ photo, size }: { photo: OsintPhoto; size: number }) {
  const [err, setErr] = useState(false);
  const src = `${PHOTO_BASE}/${photo.photo_minio}`;
  if (err) {
    return (
      <div className="osint-avatar" style={{ width: size, height: size }} aria-hidden>
        <User size={size * 0.35} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <img
      className="osint-photos-modal__thumb"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  );
}

export function OsintPhotosModal({
  photos,
  onClose,
}: {
  photos: OsintPhoto[];
  onClose: () => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, OsintPhoto[]>();
    for (const photo of photos) {
      const key = photo.platform;
      const list = map.get(key) ?? [];
      list.push(photo);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [photos]);

  const [selected, setSelected] = useState<OsintPhoto | null>(photos[0] ?? null);
  const imageUrl = selected ? `${PHOTO_BASE}/${selected.photo_minio}` : null;
  const reverse = imageUrl ? reverseUrls(imageUrl) : null;

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="osint-modal osint-photos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osint-photos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="osint-modal__head">
          <div className="osint-modal__head-main">
            <p className="osint-modal__eyebrow">OSINT · Photos</p>
            <h2 id="osint-photos-title" className="osint-modal__title">
              By platform
            </h2>
            <p className="osint-modal__meta">
              {photos.length} photos · pick one for reverse image search
            </p>
          </div>
          <button type="button" className="osint-modal__close" aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="osint-photos-modal__body">
          <div className="osint-photos-modal__list">
            {groups.map(([platform, items]) => (
              <section key={platform}>
                <h3 className="osint-modal__sec">
                  {platform}
                  <span>{items.length}</span>
                </h3>
                <div className="osint-photos-modal__grid">
                  {items.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={
                        selected?.id === photo.id
                          ? "osint-photos-modal__cell on"
                          : "osint-photos-modal__cell"
                      }
                      onClick={() => setSelected(photo)}
                    >
                      <Thumb photo={photo} size={72} />
                      <span>@{photo.handle}</span>
                      {photo.face_score != null && (
                        <b>Face {Math.round(photo.face_score * 100)}%</b>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="osint-photos-modal__detail">
            {selected && imageUrl && reverse ? (
              <>
                <img className="osint-photos-modal__hero" src={imageUrl} alt="" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }} />
                <p className="osint-photos-modal__meta">
                  <b>{selected.platform}</b> · @{selected.handle}
                  {selected.face_score != null ? ` · face ${Math.round(selected.face_score * 100)}%` : ""}
                </p>
                <a
                  className="osint-photos-modal__src"
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source <ExternalLink size={12} strokeWidth={2} />
                </a>
                <div className="osint-photos-modal__actions">
                  <p className="osint-modal__sec">Reverse image</p>
                  <a className="osint-photos-modal__btn" href={reverse.lens} target="_blank" rel="noopener noreferrer">
                    <Search size={14} strokeWidth={2} /> Google Lens
                  </a>
                  <a className="osint-photos-modal__btn" href={reverse.tineye} target="_blank" rel="noopener noreferrer">
                    <Search size={14} strokeWidth={2} /> TinEye
                  </a>
                  <a className="osint-photos-modal__btn" href={reverse.yandex} target="_blank" rel="noopener noreferrer">
                    <Search size={14} strokeWidth={2} /> Yandex
                  </a>
                </div>
              </>
            ) : (
              <p className="osint-empty">No photo selected.</p>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
