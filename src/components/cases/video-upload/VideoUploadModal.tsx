import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, X } from "lucide-react";
import type { CaseService } from "@/lib/crm-api";
import {
  clearDraft,
  draftKey,
  type DraftStep,
  type LeftOutReason,
  type SavedBatch,
  type SavedClip,
} from "@/components/cases/video-library";
import { videoApi, type RemoteVideoBatch } from "@/lib/crm-api";
import { caseTypeLabel, dayKeyOf } from "@/components/cases/video-upload/checks";
import { batchSends, buildLedger, narrowToClips, type DayRow, type FieldDay } from "@/components/cases/video-upload/ledger";
import { useSealJobs } from "@/components/cases/video-upload/sealing";
import type { Resume } from "@/components/cases/video-upload/use-video-upload";
import { CertificatePanel, ColdPanel, SendPanel, type Recipient } from "@/components/cases/video-upload/office";
import { UploadView } from "@/components/cases/video-upload/UploadView";
import { WatchView } from "@/components/cases/video-upload/WatchView";
import "@/components/cases/sky-modal.css";
import "./video-upload.css";

type View = { kind: "watch" } | { kind: "upload"; presetDay?: string; key: number };
type Overlay = { kind: "send"; clipIds: string[] } | { kind: "cold"; clipIds: string[] } | { kind: "certificate"; day: string } | null;

const STEPS: { id: DraftStep; label: string }[] = [
  { id: "identify", label: "Identify" },
  { id: "certify", label: "Certify" },
];

/**
 * A case's video, over Sky View. It opens on the player, with the days in a
 * folder list on the left. Uploading is the same two steps as before.
 */
export function VideoUploadModal({
  caseId,
  subjectName,
  claimNumber,
  caseNumber,
  service,
  state,
  signerName,
  canManage,
  fieldDays,
  recipients,
  onClose,
}: {
  caseId: string;
  subjectName: string;
  claimNumber: string | null;
  caseNumber: string;
  service: CaseService;
  state: string | null;
  signerName: string;
  /** Office: send to the client and move originals to cold storage. */
  canManage: boolean;
  /** Scheduled field days, so days with no video show up as missing. */
  fieldDays: FieldDay[];
  recipients: Recipient[];
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ kind: "watch" });
  const [sealedDay, setSealedDay] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [batches, setBatches] = useState<SavedBatch[] | null>(null);
  const [draft, setDraft] = useState<Resume | null>(null);
  const [uploadStep, setUploadStep] = useState<DraftStep>("identify");
  const [error, setError] = useState<string | null>(null);
  const [uploadDirty, setUploadDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<"close" | "watch" | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const discardUpload = useRef<(() => Promise<void>) | null>(null);
  const jobs = useSealJobs(caseId);
  const key = draftKey(caseId, signerName);

  const reload = useCallback(async () => {
    try {
      const listed = await videoApi.list(caseId);
      setBatches(listed.batches.map(asSaved));
    } catch {
      setError("Could not open the video on this case.");
      setBatches([]);
    }
  }, [caseId]);

  useEffect(() => {
    void reload();
  }, [reload, jobs.length]);

  useEffect(() => {
    void clearDraft(key).catch(() => {});
    setDraft(null);
    return () => {
      void clearDraft(key).catch(() => {});
    };
  }, [key]);

  useEffect(() => sheetRef.current?.focus(), []);

  const today = dayKeyOf(new Date());
  const { rows, missing } = useMemo(() => buildLedger(batches ?? [], fieldDays, today), [batches, fieldDays, today]);
  const rowOf = (day: string) => rows.find((row) => row.day === day);

  const change = async (ids: string[], edit: (batch: SavedBatch) => SavedBatch) => {
    try {
      for (const id of ids) {
        const current = (batches ?? []).find((batch) => batch.id === id);
        if (!current) continue;
        const next = edit(current);
        await videoApi.patchBatch(id, {
          flag: next.flag ?? null,
          sends: next.sends ?? [],
          clips: next.clips.map((clip) => ({
            id: clip.id,
            inClientVideo: clip.inClientVideo !== false,
            leftOutReason: clip.leftOutReason ?? null,
          })),
        });
      }
      setError(null);
    } catch {
      setError("That change could not be saved. Try again.");
    }
    await reload();
  };

  const sendClips = async (clipIds: string[], to: string[], note: string) => {
    const at = new Date().toISOString();
    const ids = new Set(clipIds);
    const batchIds = [...new Set(rows.flatMap((row) => row.batches.filter((batch) => batch.clips.some((clip) => ids.has(clip.id))).map((batch) => batch.id)))];
    await change(batchIds, (batch) => ({
      ...batch,
      sends: [...batchSends(batch), { at, to, note, by: signerName, clipIds: batch.clips.filter((clip) => ids.has(clip.id)).map((clip) => clip.id) }],
    }));
    setOverlay(null);
  };

  const coldClips = async (clipIds: string[]) => {
    try {
      const moved = await videoApi.moveCold(caseId, clipIds);
      setBatches(moved.batches.map(asSaved));
      setError(null);
    } catch {
      setError("Those files could not be moved to storage. Try again.");
    }
    setOverlay(null);
  };

  const setLeftOut = (batchId: string, clipId: string, reason: LeftOutReason | null) =>
    void change([batchId], (batch) => ({
      ...batch,
      clips: batch.clips.map((clip) => (clip.id === clipId ? { ...clip, inClientVideo: reason == null, leftOutReason: reason } : clip)),
    }));

  const setFlag = (batchId: string, note: string | null) =>
    void change([batchId], (batch) => ({ ...batch, flag: note == null ? null : { at: new Date().toISOString(), note } }));

  const startUpload = (presetDay?: string) => {
    setOverlay(null);
    setView({ kind: "upload", presetDay, key: Date.now() });
  };

  const onDraft = useCallback((next: Resume | null) => setDraft(next), []);
  const onSealed = useCallback((day: string) => {
    setUploadDirty(false);
    setSealedDay(day);
    setView({ kind: "watch" });
  }, []);
  const bindDiscard = useCallback((fn: (() => Promise<void>) | null) => {
    discardUpload.current = fn;
  }, []);

  const unsaved = view.kind === "upload" ? uploadDirty : draft != null;

  const askLeave = (to: "close" | "watch") => {
    if (to === "watch" && view.kind !== "upload") return;
    if (!unsaved) {
      if (to === "close") onClose();
      else setView({ kind: "watch" });
      return;
    }
    setLeaveTo(to);
  };

  const confirmLeave = async () => {
    try {
      if (discardUpload.current) await discardUpload.current();
      else await clearDraft(key);
      setDraft(null);
      setUploadDirty(false);
      setError(null);
    } catch {
      setError("Could not throw that upload away. Try again.");
      setLeaveTo(null);
      return;
    }
    const to = leaveTo;
    setLeaveTo(null);
    if (to === "close") onClose();
    else setView({ kind: "watch" });
  };

  const overlayRows = overlay && overlay.kind !== "certificate" ? narrowToClips(rows, overlay.clipIds) : [];

  return createPortal(
    <div className="vu-layer" role="presentation">
      <button type="button" className="sky-modal-veil" aria-label="Close video" onClick={() => askLeave("close")} />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="vu-sheet sky-modal-frame lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vu-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (leaveTo) setLeaveTo(null);
            else askLeave("close");
          }
        }}
      >
        <header className="vu-head">
          <div className="vu-who">
            <p className="vu-kicker">Video</p>
            <h2 id="vu-title">{subjectName}</h2>
            <p className="vu-claim">
              {claimNumber ? `Claim ${claimNumber}` : caseNumber}
              <span className="vu-chip">
                {caseTypeLabel(service)}
                {state ? ` · ${state}` : ""}
              </span>
            </p>
          </div>

          {view.kind === "upload" && (
            <ol className="vu-steps" aria-label="Steps">
              {STEPS.map((item, index) => {
                const at = STEPS.findIndex((step) => step.id === uploadStep);
                return (
                  <li key={item.id} className={index < at ? "past" : index === at ? "now" : ""} aria-current={index === at ? "step" : undefined}>
                    <i>{index < at ? <Check size={11} strokeWidth={3} /> : index + 1}</i>
                    {item.label}
                  </li>
                );
              })}
            </ol>
          )}

          {view.kind === "upload" && (
            <button type="button" className="vu-crumb back" onClick={() => askLeave("watch")}>
              <ChevronLeft size={15} strokeWidth={1.8} />
              Back to videos
            </button>
          )}

          {view.kind === "watch" && <div className="vu-head-slot" ref={setHeaderSlot} />}

          <button type="button" className="vu-close" aria-label="Close" onClick={() => askLeave("close")}>
            <X size={16} strokeWidth={1.6} />
          </button>
        </header>
        <div className="vu-band" aria-hidden />

        {error && (
          <p className="vu-error" role="alert">
            {error}
          </p>
        )}

        {view.kind === "watch" && (
          <WatchView
            rows={rows}
            missing={missing}
            jobs={jobs}
            draft={draft}
            justSealed={sealedDay}
            canManage={canManage}
            signerName={signerName}
            onUpload={startUpload}
            onContinue={() => startUpload()}
            onDiscard={() => {
              setDraft(null);
              void clearDraft(key).catch(() => setError("Could not throw that upload away. Try again."));
            }}
            onSend={(clipIds) => setOverlay({ kind: "send", clipIds })}
            onCold={(clipIds) => setOverlay({ kind: "cold", clipIds })}
            onCertificate={(row) => setOverlay({ kind: "certificate", day: row.day })}
            onLeaveOut={setLeftOut}
            onFlag={setFlag}
            headerSlot={headerSlot}
          />
        )}

        {view.kind === "upload" && (
          <UploadView
            key={view.key}
            caseId={caseId}
            signerName={signerName}
            service={service}
            state={state}
            batches={batches ?? []}
            resume={draft}
            presetDay={view.presetDay}
            onStep={setUploadStep}
            onDraft={onDraft}
            onSealed={onSealed}
            onDirty={setUploadDirty}
            onDiscardReady={bindDiscard}
          />
        )}

        {leaveTo && (
          <div className="vu-panel-layer" role="presentation">
            <button type="button" className="vu-panel-scrim" aria-label="Keep working" onClick={() => setLeaveTo(null)} />
            <div className="vu-unsaved" role="alertdialog" aria-labelledby="vu-leave-title" aria-describedby="vu-leave-copy">
              <p className="vu-kicker">Unsaved upload</p>
              <h3 id="vu-leave-title">Unsaved changes</h3>
              <p id="vu-leave-copy">It has not been signed. Leaving now throws away the files, the answers, and any progress. You would have to start that day again.</p>
              <div className="vu-unsaved-actions">
                <button type="button" className="vu-btn ghost" onClick={() => setLeaveTo(null)}>
                  Keep working
                </button>
                <button type="button" className="vu-btn danger" onClick={() => void confirmLeave()}>
                  Throw it away
                </button>
              </div>
            </div>
          </div>
        )}

        {overlay?.kind === "send" && overlayRows.length > 0 && (
          <SendPanel rows={overlayRows} recipients={recipients} service={service} state={state} onClose={() => setOverlay(null)} onSend={(to, note) => sendClips(overlay.clipIds, to, note)} />
        )}
        {overlay?.kind === "cold" && overlayRows.length > 0 && <ColdPanel rows={overlayRows} onClose={() => setOverlay(null)} onConfirm={() => coldClips(overlay.clipIds)} />}
        {overlay?.kind === "certificate" && rowOf(overlay.day) && <CertificatePanel row={rowOf(overlay.day)!} onClose={() => setOverlay(null)} />}
      </div>
    </div>,
    document.body,
  );
}

function asSaved(batch: RemoteVideoBatch): SavedBatch {
  return {
    id: batch.id,
    caseId: batch.caseId,
    signerName: batch.signerName,
    certifiedAt: batch.certifiedAt ?? "",
    minutes: Math.max(1, Math.round((batch.declared?.seconds ?? 0) / 60)),
    measured: batch.measuredSeconds == null ? null : Math.max(1, Math.round(batch.measuredSeconds / 60)),
    sentOn: {},
    workDate: batch.workDate,
    camera: batch.camera ?? undefined,
    declared: batch.declared ?? undefined,
    declaredFirst: batch.declaredFirst ?? undefined,
    measuredSeconds: batch.measuredSeconds,
    series: batch.series ?? undefined,
    attest: batch.attest,
    signature: batch.signature ?? undefined,
    service: (batch.service ?? undefined) as SavedBatch["service"],
    state: batch.state,
    flag: batch.flag,
    storage: batch.storage,
    coldAt: batch.coldAt,
    sends: batch.sends,
    clips: batch.clips.map((clip): SavedClip => ({
      id: clip.id,
      name: clip.name,
      kind: clip.kind,
      seconds: clip.seconds,
      recordedAt: clip.recordedAt,
      blob: null,
      sizeBytes: clip.sizeBytes,
      number: clip.number,
      sha256: clip.sha256,
      inClientVideo: clip.inClientVideo,
      leftOutReason: clip.leftOutReason,
      coldAt: clip.coldAt,
    })),
  };
}
