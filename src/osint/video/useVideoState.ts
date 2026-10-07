import { useState, useEffect, useCallback, useRef } from "react";

export type VideoRecord = {
  id: number;
  original_filename: string;
  file_size_bytes: number | null;
  sha256_raw: string | null;
  sha256_final: string | null;
  media_created_at: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  status: "uploaded" | "published" | "delivered";
  output_filename: string | null;
  wasabi_staging_key: string | null;
  wasabi_pub_key: string | null;
  deliver_link: string | null;
  sent_to_attorney_at: string | null;
  error_msg: string | null;
  investigation_id: number;
  video_type: string | null;
  investigator_override: string | null;
};

const BASE = "/api-proxy";

export function useVideoState(invId: number) {
  const [records, setRecords] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ name: string; ok: boolean; msg: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use by-case-context to find videos across related investigations (same claim/subject)
      const r = await fetch(`${BASE}/api/video-custody/records/by-case-context?investigation_id=${invId}`, {
        credentials: "include",
      });
      if (r.ok) {
        setRecords(await r.json());
      } else {
        // Fallback to direct investigation_id filter
        const r2 = await fetch(`${BASE}/api/video-custody/records?investigation_id=${invId}`, {
          credentials: "include",
        });
        if (r2.ok) setRecords(await r2.json());
      }
    } finally {
      setLoading(false);
    }
  }, [invId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (files: FileList, videoType = "HD") => {
    setUploading(true);
    setUploadMsg([]);
    const results: { name: string; ok: boolean; msg: string }[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("investigation_id", String(invId));
        fd.append("video_type", videoType);
        const r = await fetch(`${BASE}/api/video-custody/upload`, {
          method: "POST", credentials: "include", body: fd,
        });
        const d = await r.json();
        results.push({ name: file.name, ok: r.ok, msg: r.ok ? "Uploaded" : d.detail ?? "Error" });
      } catch (e: any) {
        results.push({ name: file.name, ok: false, msg: e.message });
      }
    }
    setUploadMsg(results);
    setUploading(false);
    await load();
  }, [invId, load]);

  const confirm = useCallback(async (recId: number) => {
    await fetch(`${BASE}/api/video-custody/${recId}/confirm`, {
      method: "POST", credentials: "include",
    });
    await load();
  }, [load]);

  return { records, loading, uploading, uploadMsg, upload, confirm, reload: load };
}
