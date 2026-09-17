import { useEffect, useState } from "react";
import { casesApi } from "@/lib/crm-api";

/**
 * Case-capture photos are stored as `CaseFile` rows and served from an
 * authenticated, cookie-scoped route (`/cases/:id/files/:fileId`) rather than
 * a plain public URL — a bare `<img src>` can't load them cross-origin. This
 * resolves any photo reference (absolute URL, data/blob URL, or an internal
 * file route/bare file id) down to something an `<img>` can actually render.
 */
export async function resolveCasePhotoUrl(caseId: string, photoUrl: string | null | undefined): Promise<string | null> {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http") || photoUrl.startsWith("data:") || photoUrl.startsWith("blob:")) {
    return photoUrl;
  }
  const match = photoUrl.match(/\/cases\/[^/]+\/files\/([^/?]+)/) ?? photoUrl.match(/^([0-9a-f-]{36})$/i);
  const fileId = match?.[1];
  if (!fileId) return photoUrl;
  const blob = await casesApi.fileBlob(caseId, fileId);
  return URL.createObjectURL(blob);
}

/** React hook wrapper around {@link resolveCasePhotoUrl} — handles cleanup/cancellation. */
export function useCasePhoto(caseId: string, photoUrl: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setSrc(null);
    if (!photoUrl) return;
    resolveCasePhotoUrl(caseId, photoUrl)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved && resolved.startsWith("blob:")) revoke = resolved;
        setSrc(resolved);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [caseId, photoUrl]);
  return src;
}
