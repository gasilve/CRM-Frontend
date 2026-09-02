import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EvidencePhoto } from "@/lib/mock-data";

const MATCH_THRESHOLD = 80;

type Props = {
  open: boolean;
  photos: EvidencePhoto[];
  /** Field / uploaded still to compare */
  uploadedId?: string;
  /** Subject-on-file still (defaults to primary) */
  subjectOnFileId?: string;
  subjectName: string;
  caseReference: string;
  onClose: () => void;
};

/** Deterministic mock “AWS Rekognition” similarity 0–100 from two ids. */
function mockRekognitionScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 97;
  let h = 0;
  const s = `${a}::${b}`;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  // Spread across low/high so demos show both MATCH and NO MATCH
  const raw = h % 100;
  if (raw < 35) return 2 + (raw % 12); // clear miss
  if (raw < 55) return 40 + (raw % 25); // mid
  return 82 + (raw % 17); // match band
}

export function ImageComparisonModal({
  open,
  photos,
  uploadedId,
  subjectOnFileId,
  subjectName,
  caseReference,
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

  const confidence = useMemo(
    () => mockRekognitionScore(`${subjectPhoto?.id}:${runKey}`, uploadedPhoto?.id ?? ""),
    [subjectPhoto?.id, uploadedPhoto?.id, runKey],
  );
  const isMatch = confidence >= MATCH_THRESHOLD;
  const verdict = isMatch ? "MATCH" : "NO MATCH";
  const accent = isMatch ? "var(--color-pos)" : "var(--color-neg)";

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
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]"
                >
                  <RefreshCw size={12} strokeWidth={1.8} />
                  New analysis
                </button>
              </div>
            </div>

            <h2
              id="facial-compare-title"
              className="text-[2.625rem] font-bold leading-none tracking-tight sm:text-[3rem]"
              style={{ color: accent }}
            >
              {verdict}
            </h2>
            <p className="mt-2 text-[0.875rem] text-[var(--color-text-mid)]">
              {isMatch ? (
                <>
                  Confidence {confidence}% meets threshold {MATCH_THRESHOLD}%.
                </>
              ) : (
                <>
                  Confidence {confidence}% is below threshold {MATCH_THRESHOLD}%.
                </>
              )}
            </p>

            {/* Side-by-side faces */}
            <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
              <FaceFrame
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
                  Via AWS Rekognition
                </div>
              </div>

              <FaceFrame
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
                  style={{ left: `${MATCH_THRESHOLD}%` }}
                  title={`Threshold ${MATCH_THRESHOLD}%`}
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
                {confidence}% (threshold {MATCH_THRESHOLD}%)
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
            <DetailRow label="Images analysed">
              <span className="font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                1 uploaded
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
  label,
  src,
  alt,
}: {
  label: string;
  src: string;
  alt: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-center font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
        {label}
      </div>
      <div className="aspect-square overflow-hidden rounded-[0.875rem] border border-[var(--color-line-2)] bg-[var(--color-ink-0)]">
        <img src={src} alt={alt} className="h-full w-full object-cover" />
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
