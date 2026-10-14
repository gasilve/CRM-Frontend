import { useEffect, useState } from "react";
import { casesApi } from "@/lib/crm-api";

/**
 * Case-capture photos are stored as `CaseFile` rows and served from an
 * authenticated, cookie-scoped route (`/cases/:id/files/:fileId`) rather than
 * a plain public URL — a bare `<img src>` can't load them cross-origin. This
 * resolves any photo reference (absolute URL, data/blob URL, or an internal
 * file route/bare file id) down to something an `<img>` can actually render.
 */

/** Survives remounts so scrolling a gallery does not re-download every thumb. */
const blobCache = new Map<string, Promise<string>>();

function cacheKey(caseId: string, fileId: string) {
  return `${caseId}:${fileId}`;
}

export async function resolveCasePhotoUrl(caseId: string, photoUrl: string | null | undefined): Promise<string | null> {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http") || photoUrl.startsWith("data:") || photoUrl.startsWith("blob:")) {
    return photoUrl;
  }
  const match = photoUrl.match(/\/cases\/[^/]+\/files\/([^/?]+)/) ?? photoUrl.match(/^([0-9a-f-]{36})$/i);
  const fileId = match?.[1];
  if (!fileId) return photoUrl;

  const key = cacheKey(caseId, fileId);
  let pending = blobCache.get(key);
  if (!pending) {
    pending = casesApi
      .fileBlob(caseId, fileId)
      .then((blob) => URL.createObjectURL(blob))
      .catch((err) => {
        blobCache.delete(key);
        throw err;
      });
    blobCache.set(key, pending);
  }
  return pending;
}

/** React hook wrapper around {@link resolveCasePhotoUrl} — handles cancellation. */
export function useCasePhoto(caseId: string, photoUrl: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    if (!photoUrl) return;
    resolveCasePhotoUrl(caseId, photoUrl)
      .then((resolved) => {
        if (!cancelled) setSrc(resolved);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      // Blob URLs stay in blobCache for reuse — do not revoke on unmount.
    };
  }, [caseId, photoUrl]);
  return src;
}
