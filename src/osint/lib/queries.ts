import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prodigyApi } from "./api";
import type {
  Investigation, InvestigationList, InvestigationCreate,
  Finding, SearchLogEntry, Engine, SubjectResult, CaseResult,
  InvestigatorResult, RunResponse,
} from "./types";

// Helper: build query string from params object
function toQS(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ── Investigations ─────────────────────────────────

export function useInvestigations(page = 1, status?: string, q?: string, investigation_type?: string) {
  return useQuery<InvestigationList>({
    queryKey: ["prodigy-investigations", { page, status, q, investigation_type }],
    queryFn: () => prodigyApi.get<InvestigationList>(`/api/investigations${toQS({ page, status, q, investigation_type })}`),
    staleTime: 30_000,
  });
}

export function useInvestigation(id: number, refetchInterval?: number) {
  return useQuery<Investigation>({
    queryKey: ["prodigy-investigations", id],
    queryFn: () => prodigyApi.get<Investigation>(`/api/investigations/${id}`),
    refetchInterval: refetchInterval || false,
  });
}

export function useCreateInvestigation() {
  const qc = useQueryClient();
  return useMutation<Investigation, Error, InvestigationCreate>({
    mutationFn: (payload) => prodigyApi.post<Investigation>("/api/investigations", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-investigations"] }); },
  });
}

export function useRunInvestigation() {
  const qc = useQueryClient();
  return useMutation<RunResponse, Error, number>({
    mutationFn: (id) => prodigyApi.post<RunResponse>(`/api/investigations/${id}/run`),
    onSuccess: (_data, id) => { qc.invalidateQueries({ queryKey: ["prodigy-investigations", id] }); },
  });
}

export function useDeleteInvestigation() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => prodigyApi.delete<void>(`/api/investigations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-investigations"] }); },
  });
}

// ── Findings ───────────────────────────────────────

export function useFindings(investigationId: number, isActive?: boolean) {
  return useQuery<Finding[]>({
    queryKey: ["prodigy-findings", investigationId],
    queryFn: () => prodigyApi.get<Finding[]>(`/api/investigations/${investigationId}/findings`),
    refetchInterval: isActive ? 4000 : false,
  });
}

export function useValidateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, by, notes }: { id: number; status: string; by: string; notes?: string }) =>
      prodigyApi.post(`/api/findings/${id}/validate`, { validation_status: status, validated_by: by, validation_notes: notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-findings"] }); },
  });
}

// ── Search Log ─────────────────────────────────────

export function useSearchLog(investigationId: number) {
  return useQuery<SearchLogEntry[]>({
    queryKey: ["prodigy-searchLog", investigationId],
    queryFn: () => prodigyApi.get<SearchLogEntry[]>(`/api/investigations/${investigationId}/log`),
  });
}

// ── Engines ────────────────────────────────────────

export function useEngines() {
  return useQuery<Engine[]>({
    queryKey: ["prodigy-engines"],
    queryFn: () => prodigyApi.get<Engine[]>("/api/engines"),
    staleTime: 300_000,
  });
}

// ── Autocomplete ───────────────────────────────────

export function useSubjectSearch(q: string) {
  return useQuery<SubjectResult[]>({
    queryKey: ["prodigy-subjects", q],
    queryFn: () => prodigyApi.get<SubjectResult[]>(`/api/subjects/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}

export function useCaseSearch(q: string) {
  return useQuery<CaseResult[]>({
    queryKey: ["prodigy-cases", q],
    queryFn: () => prodigyApi.get<CaseResult[]>(`/api/cases/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}

export function useActiveInvestigators() {
  return useQuery<InvestigatorResult[]>({
    queryKey: ["prodigy-investigators-active"],
    queryFn: () => prodigyApi.get<InvestigatorResult[]>("/api/investigators/active"),
    staleTime: 300_000,
  });
}

// ── Photos ─────────────────────────────────────────

export function usePhotos(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-photos", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/photos`),
  });
}

export function useValidatePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, by, notes }: { id: number; decision: string; by: string; notes?: string }) =>
      prodigyApi.post(`/api/photos/${id}/validate`, { decision, decided_by: by, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-photos"] }); },
  });
}

export function useMarkAsSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: number; by: string }) =>
      prodigyApi.post(`/api/photos/${id}/mark-as-subject`, { marked_by: by }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prodigy-photos"] });
      qc.invalidateQueries({ queryKey: ["prodigy-investigations"] });
    },
  });
}

export function useMarkAsSubjectCrop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, x, y, width, height, by }: { id: number; x: number; y: number; width: number; height: number; by: string }) =>
      prodigyApi.post(`/api/photos/${id}/mark-as-subject-crop`, { x, y, width, height, marked_by: by }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prodigy-photos"] });
      qc.invalidateQueries({ queryKey: ["prodigy-investigations"] });
    },
  });
}

export function usePhotoAudit(photoId: number) {
  return useQuery({
    queryKey: ["prodigy-photoAudit", photoId],
    queryFn: () => prodigyApi.get(`/api/photos/${photoId}/audit`),
    enabled: photoId > 0,
  });
}

export function usePhotoFaces(photoId: number) {
  return useQuery({
    queryKey: ["prodigy-photo-faces", photoId],
    queryFn: () => prodigyApi.get(`/api/photos/${photoId}/faces`),
    enabled: photoId > 0,
  });
}

// ── AI ─────────────────────────────────────────────

export function useAISummary(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-ai-summary", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/ai-summary`),
    staleTime: 60_000,
  });
}

export function useIntelCard(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-intel-card", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/intel-card`),
    staleTime: 30_000,
  });
}

// ── Staging ────────────────────────────────────────

export function useToggleIncludeInReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, include }: { findingId: number; include: boolean }) =>
      prodigyApi.patch(`/api/findings/${findingId}/include`, { include }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-findings"] }); },
  });
}

export function useBulkStaging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, preset, findingIds, include }: {
      investigationId: number; preset?: string; findingIds?: number[]; include?: boolean;
    }) => prodigyApi.post(`/api/investigations/${investigationId}/staging/bulk`, { preset, finding_ids: findingIds, include }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-findings"] }); },
  });
}

export function useStagingSummary(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-staging-summary", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/staging/summary`),
  });
}

export function useSaveSectionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, order }: { investigationId: number; order: string[] }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/staging/section-order`, { order }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["prodigy-staging-summary", vars.investigationId] }); },
  });
}

// ── Notes ──────────────────────────────────────────

export function useNotes(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-notes", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/notes`),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, content, author_name }: { investigationId: number; content: string; author_name: string }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/notes`, { content, author_name }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["prodigy-notes", vars.investigationId] }); },
  });
}

// ── Search Criteria ────────────────────────────────

export function useSearchCriteria(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-criteria", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/criteria`),
  });
}

export function useAddCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, type, value }: { investigationId: number; type: string; value: string }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/criteria/add`, { type, value }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["prodigy-criteria", vars.investigationId] });
      qc.invalidateQueries({ queryKey: ["prodigy-findings", vars.investigationId] });
    },
  });
}

// ── Video ──────────────────────────────────────────

export function useVideoScanStatus(investigationId: number, refetchInterval?: number) {
  return useQuery({
    queryKey: ["prodigy-video-scan-status", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/scan-videos/status`),
    refetchInterval: refetchInterval || false,
  });
}

export function useVideoFrames(investigationId: number, minScore = 0, flaggedOnly = false) {
  return useQuery({
    queryKey: ["prodigy-video-frames", investigationId, minScore, flaggedOnly],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/video-frames${toQS({ min_score: minScore, flagged_only: String(flaggedOnly) })}`),
  });
}

export function useStartVideoScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, videoPaths = [] }: { investigationId: number; videoPaths?: string[] }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/scan-videos`, { video_paths: videoPaths }),
    onSuccess: (_, { investigationId }) => { qc.invalidateQueries({ queryKey: ["prodigy-video-scan-status", investigationId] }); },
  });
}

export function useVideoSummaries(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-video-summaries", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/video-summaries`),
  });
}

export function useUploadReferencePhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ investigationId, files }: { investigationId: number; files: File[] }) => {
      const form = new FormData();
      files.forEach(f => form.append("files", f));
      form.append("uploaded_by", "investigator");
      const base = import.meta.env.VITE_PRODIGY_API_URL || "";
      const res = await fetch(`${base}/api/investigations/${investigationId}/reference-photos`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, { investigationId }) => {
      qc.invalidateQueries({ queryKey: ["prodigy-investigations", investigationId] });
      qc.invalidateQueries({ queryKey: ["prodigy-photos", investigationId] });
    },
  });
}

// ── Extra mutations referenced by components ──────

export function useRemoveCriterion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, type, value }: { investigationId: number; type: string; value: string }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/criteria/remove`, { type, value }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["prodigy-criteria", vars.investigationId] }); },
  });
}

export function useScrapeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId }: { photoId: number }) =>
      prodigyApi.post(`/api/photos/${photoId}/scrape-profile`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-photos"] }); },
  });
}

export function useScrapeProfileUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, url }: { investigationId: number; url: string }) =>
      prodigyApi.post(`/api/investigations/${investigationId}/scrape-profile`, { url }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prodigy-photos"] }); },
  });
}

export function useFlagVideoFrame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investigationId, frameId, flagged, note }:
      { investigationId: number; frameId: number; flagged: boolean; note?: string }) =>
      prodigyApi.patch(
        `/api/investigations/${investigationId}/video-frames/${frameId}/flag`,
        { flagged, note: note || "", by: "investigator" }
      ),
    onSuccess: (_, { investigationId }) => {
      qc.invalidateQueries({ queryKey: ["prodigy-video-frames", investigationId] });
    },
  });
}

export function useUploadReferencePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ investigationId, files }: { investigationId: number; files: File[] }) => {
      const form = new FormData();
      files.forEach(f => form.append("files", f));
      form.append("uploaded_by", "investigator");
      const base = import.meta.env.VITE_PRODIGY_API_URL || "";
      const res = await fetch(`${base}/api/investigations/${investigationId}/reference-photos`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, { investigationId }) => {
      qc.invalidateQueries({ queryKey: ["prodigy-investigations", investigationId] });
      qc.invalidateQueries({ queryKey: ["prodigy-photos", investigationId] });
    },
  });
}

export function useDuplicates(investigationId: number) {
  return useQuery({
    queryKey: ["prodigy-duplicates", investigationId],
    queryFn: () => prodigyApi.get(`/api/investigations/${investigationId}/duplicates`),
    staleTime: 60_000,
  });
}
