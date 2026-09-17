import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EvidencePhoto } from "@/lib/mock-data";
import { casesApi, ApiError, type VisualComparisonResult } from "@/lib/crm-api";
import { useCasePhoto } from "@/hooks/useCasePhoto";

type Props = {
  open: boolean;
  photos: EvidencePhoto[];
  /** Field / uploaded still to compare */
  uploadedId?: string;
  /** Subject-on-file still (defaults to primary) */
  subjectOnFileId?: string;
  subjectName: string;
  caseReference: string;
  /** The case these photos belong to — runs the comparison through the real backend adapter (CFR, mocked for now). */
  caseId: string;
  onClose: () => void;
};

export function ImageComparisonModal({
  open,
  photos,
  uploadedId,
  subjectOnFileId,
  subjectName,
  caseReference,
  caseId,
  onClose,
}: Props) {
  const subjectDefault = subjectOnFileId ?? photos[0]?.id ?? "";
  const uploadedDefault =
    uploadedId ??
    photos.find((p) => p.id !== subjectDefault)?.id ??
    photos[1]?.id ??
    photos[0]?.id ??
    "";

  const [probeId, setProbeId] = useState(uploadedDefault);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setProbeId(uploadedDefault);
    setRunKey((k) => k + 1);
  }, [open, uploadedDefault]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subjectPhoto = useMemo(
    () => photos.find((p) => p.id === subjectDefault) ?? photos[0],
    [photos, subjectDefault],
  );
  const uploadedPhoto = useMemo(
    () => photos.find((p) => p.id === probeId) ?? photos[1] ?? photos[0],
    [photos, probeId],
  );

  // Runs through the real crm-api adapter — mocked deterministically server-side
  // until CFR (github.com/Accenty-AI/CFR) integration access lands. Each run
  // logs a face_match day-journal entry, so re-running is a deliberate action
  // (new probe pick or the "New analysis" button), not an incidental effect.
  const [result, setResult] = useState<VisualComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !subjectPhoto || !uploadedPhoto) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    casesApi
      .runVisualComparison(caseId, {
        subjectPhotoUrl: subjectPhoto.url,
        probePhotoUrl: uploadedPhoto.url,
        subjectLabel: subjectPhoto.label,
        probeLabel: uploadedPhoto.label,
      })
      .then((res) => {
        if (!cancelled) setResult(res.result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not run the comparison.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caseId, subjectPhoto?.id, uploadedPhoto?.id, runKey]);

  const confidence = result?.score ?? 0;
  const threshold = result?.threshold ?? 80;
  const isMatch = result?.verdict === "MATCH";
  const verdict = result?.verdict ?? "…";
  const accent = !result ? "var(--color-text-lo)" : isMatch ? "var(--color-pos)" : "var(--color-neg)";

  if (!open || !subjectPhoto || !uploadedPhoto) return null;

  return createPortal(
    <div
      className="dashboard-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="surface flex max-h-[min(94vh,56.25rem)] w-full max-w-[45rem] flex-col overflow-hidden rounded-[1.125rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="facial-compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top chrome */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[0.9375rem] font-semibold tracking-tight text-[var(--color-text-hi)]">
              True Cognition
            </div>
            <div className="font-mono text-[0.5625rem] uppercase tracking-[0.28em] text-[var(--color-text-lo)]">
              Visual comparison
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-[0.625rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Verdict card */}
          <div className="rounded-[1rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/50 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-[var(--color-text-lo)]">
                Verdict — Case {caseReference}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={probeId}
                  onChange={(e) => {
                    setProbeId(e.target.value);
                    setRunKey((k) => k + 1);
                  }}
                  className="rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-hi)] outline-none"
                  aria-label="Uploaded image"
                >
                  {photos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRunKey((k) => k + 1)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)] disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} strokeWidth={1.8} />}
                  New analysis
                </button>
              </div>
            </div>

            <h2
              id="facial-compare-title"
              className="text-[2.625rem] font-bold leading-none tracking-tight sm:text-[3rem]"
              style={{ color: accent }}
            >
              {loading ? "Comparing…" : verdict}
            </h2>
            <p className="mt-2 text-[0.875rem] text-[var(--color-text-mid)]">
              {error ? (
                <span className="text-[var(--color-neg)]">{error}</span>
              ) : loading ? (
                "Running the visual comparison…"
              ) : isMatch ? (
                <>
                  Confidence {confidence}% meets threshold {threshold}%.
                </>
              ) : (
                <>
                  Confidence {confidence}% is below threshold {threshold}%.
                </>
              )}
            </p>

            {/* Side-by-side faces */}
            <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
              <FaceFrame
                caseId={caseId}
                label="Uploaded images"
                src={uploadedPhoto.url}
                alt={uploadedPhoto.label}
              />

              <div className="flex flex-col items-center gap-1.5 px-1 text-center">
                <span
                  className="rounded-full border px-2.5 py-0.5 text-[0.625rem] font-semibold tracking-wide"
                  style={{ color: accent, borderColor: accent }}
                >
                  {verdict}
                </span>
                <div
                  className="text-[2.25rem] font-bold leading-none sm:text-[2.75rem]"
                  style={{ color: accent }}
                >
                  {confidence}%
                </div>
                <div className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-[var(--color-text-lo)]">
                  {result?.source === "cfr" ? "Via CFR / AWS Rekognition" : "Mock analysis — pending CFR"}
                </div>
              </div>

              <FaceFrame
                caseId={caseId}
                label="Subject on file"
                src={subjectPhoto.url}
                alt={subjectName}
              />
            </div>

            {/* Confidence meter */}
            <div className="mt-8">
              <div className="relative h-2.5 overflow-visible rounded-full bg-[var(--color-ink-3)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${confidence}%`,
                    background: accent,
                  }}
                />
                <div
                  className="absolute top-1/2 z-10 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-warn)] shadow-[0_0_0_0.125rem_rgba(0,0,0,0.35)]"
                  style={{ left: `${threshold}%` }}
                  title={`Threshold ${threshold}%`}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <dl className="mt-2 divide-y divide-[var(--color-line)]">
            <DetailRow label="Verdict">
              <span
                className="inline-flex rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold"
                style={{ color: accent, borderColor: accent }}
              >
                {verdict}
              </span>
            </DetailRow>
            <DetailRow label="Confidence score">
              <span className="font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                {confidence}% (threshold {threshold}%)
              </span>
            </DetailRow>
            <DetailRow label="Subject on file">
              <span className="text-[0.8125rem] text-[var(--color-text-hi)]">{subjectName}</span>
            </DetailRow>
            <DetailRow label="Case reference">
              <span className="font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                {caseReference}
              </span>
            </DetailRow>
            <DetailRow label="Comparison source">
              <span className="font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                {result?.source === "cfr" ? "CFR (AWS Rekognition)" : "Mock analysis — CFR integration pending"}
              </span>
            </DetailRow>
          </dl>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FaceFrame({
  caseId,
  label,
  src,
  alt,
}: {
  caseId: string;
  label: string;
  src: string;
  alt: string;
}) {
  // Field captures live behind the authenticated case-file route, so the raw
  // reference has to be resolved before an <img> can show it.
  const resolved = useCasePhoto(caseId, src);
  return (
    <div className="min-w-0">
      <div className="mb-2 text-center font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
        {label}
      </div>
      <div className="aspect-square overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)] bg-[var(--color-ink-0)]">
        {resolved && <img src={resolved} alt={alt} className="h-full w-full object-cover" />}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="text-[0.8125rem] text-[var(--color-text-mid)]">{label}</dt>
      <dd className={cn("shrink-0 text-right")}>{children}</dd>
    </div>
  );
}
