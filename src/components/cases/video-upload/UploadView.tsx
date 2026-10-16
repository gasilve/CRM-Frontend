import { useEffect, useRef } from "react";
import { ArrowLeft, Check, Film, Plus, ShieldCheck, Upload } from "lucide-react";
import type { CaseService } from "@/lib/crm-api";
import type { SavedBatch } from "@/components/cases/video-library";
import type { DraftStep } from "@/components/cases/video-library";
import type { Check as CheckRow } from "@/components/cases/video-upload/checks";
import { ClipCard, Player, Questions, SignSheet } from "@/components/cases/video-upload/parts";
import { useVideoUpload, type Resume, type VideoUpload } from "@/components/cases/video-upload/use-video-upload";

export function UploadView({
  caseId,
  signerName,
  service,
  state,
  batches,
  resume,
  presetDay,
  onStep,
  onDraft,
  onSealed,
  onDirty,
  onDiscardReady,
}: {
  caseId: string;
  signerName: string;
  service: CaseService;
  state: string | null;
  batches: SavedBatch[];
  resume: Resume | null;
  presetDay?: string;
  onStep: (step: DraftStep) => void;
  onDraft: (resume: Resume | null) => void;
  onSealed: (day: string) => void;
  /** True while this upload has answers, files, or is still being saved. */
  onDirty: (dirty: boolean) => void;
  onDiscardReady: (discard: (() => Promise<void>) | null) => void;
}) {
  const up = useVideoUpload({ caseId, signerName, service, state, batches, resume, presetDay, onDraft, onSealed });
  const showQuestions = up.step === "identify" && (up.editing || up.clips.length === 0);

  useEffect(() => onStep(up.step), [up.step, onStep]);
  useEffect(() => onDirty(Boolean(resume) || up.dirty), [resume, up.dirty, onDirty]);
  const discardRef = useRef(up.discard);
  discardRef.current = up.discard;
  useEffect(() => {
    onDiscardReady(() => discardRef.current());
    return () => onDiscardReady(null);
  }, [onDiscardReady]);

  return (
    <div
      className="vu-view"
      onDragOver={(event) => {
        event.preventDefault();
        if (up.step === "identify") up.setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) up.setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        up.setDragging(false);
        up.addFiles(event.dataTransfer.files);
      }}
    >
      <div className="vu-body">
        <section className="vu-main">
          {showQuestions ? (
            <Questions up={up} />
          ) : up.step === "certify" ? (
            <SignSheet up={up} signerName={signerName} />
          ) : up.focus ? (
            <Player clip={up.focus} onDuration={(s) => up.noteDuration(up.focus!.id, s)} onUnreadable={() => up.noteUnreadable(up.focus!.id)} />
          ) : null}
        </section>

        <aside className="vu-rail" aria-label="Clips">
          <div className="vu-rail-head">
            <span>Clips{up.clips.length > 0 ? ` · ${up.clips.length}` : ""}</span>
            {up.clips.length > 0 && <em>Saved as you go</em>}
          </div>
          {up.clips.length === 0 && (
            <p className="vu-rail-empty">
              <Film size={20} strokeWidth={1.3} />
              Clips show up here in camera order.
            </p>
          )}
          {up.clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              active={!showQuestions && up.step !== "certify" && up.focus?.id === clip.id}
              repeat={up.repeatIds.has(clip.id)}
              canRemove={up.step === "identify" && !up.sealing}
              canLeaveOut={up.step === "identify" && !up.sealing}
              onFocus={() => {
                up.setFocusId(clip.id);
                if (up.step === "identify") up.setEditing(false);
              }}
              onRemove={() => up.removeClip(clip.id)}
              onLeaveOut={(reason) => up.setLeftOut(clip.id, reason)}
              onDuration={(s) => up.noteDuration(clip.id, s)}
              onUnreadable={() => up.noteUnreadable(clip.id)}
            />
          ))}
          {up.step === "identify" && up.ready && up.clips.length > 0 && (
            <button type="button" className="vu-card-add" onClick={up.openPicker}>
              <Plus size={16} strokeWidth={1.5} />
              Add files
            </button>
          )}
        </aside>
      </div>

      <footer className="vu-foot">
        {up.step === "identify" ? (
          <IdentifyFoot up={up} />
        ) : up.sealing ? (
          <span className="vu-foot-note">Sending the files, then certifying. Stay on this step.</span>
        ) : (
          <>
            <button type="button" className="vu-btn ghost" onClick={() => up.setStep("identify")}>
              <ArrowLeft size={14} strokeWidth={1.8} />
              Back
            </button>
            <span className="vu-foot-note">{up.error ?? up.notice ?? (up.canCertify ? "Ready to sign." : "Tap all three, then sign.")}</span>
            <button type="button" className="vu-btn go" disabled={!up.canCertify} onClick={() => void up.certify()}>
              <ShieldCheck size={15} strokeWidth={1.7} />
              Certify
            </button>
          </>
        )}
      </footer>

      {up.dragging && (
        <div className="vu-drop" aria-hidden>
          <Upload size={26} strokeWidth={1.4} />
          <strong>{up.ready ? "Drop to add" : "Answer the questions first"}</strong>
        </div>
      )}

      <input
        ref={up.fileRef}
        type="file"
        accept="video/*,.mp4,.m4v,.mov,.mts,.m2ts,.avi,.mkv,.wmv,.webm"
        multiple
        hidden
        onChange={(event) => up.addFiles(event.target.files)}
      />
    </div>
  );
}

function IdentifyFoot({ up }: { up: VideoUpload }) {
  if (up.clips.length === 0) {
    return <span className="vu-foot-note">Answers first, then the files. Leaving before you sign throws this upload away.</span>;
  }
  const problem = up.checks.find((check) => check.tone === "bad" || check.tone === "warn");
  const changed =
    up.declaredFirst && up.declared && (up.declaredFirst.files !== up.declared.files || up.declaredFirst.seconds !== up.declared.seconds);
  return (
    <div className="vu-checks-wrap">
      <div className="vu-checks">
        {up.checks.map((check) => (
          <CheckPill key={check.id} check={check} />
        ))}
      </div>
      <div className="vu-foot-row">
        <div className="vu-foot-say">
          {problem ? <p className={`vu-say ${problem.tone}`}>{problem.detail}</p> : <p className="vu-say ok">Everything matches. Watch any clip, then continue.</p>}
          {up.needsExplanation && (
            <input
              className="vu-why"
              placeholder="Why? For example: the camera skipped that number"
              value={up.explanation}
              maxLength={240}
              onChange={(event) => up.setExplanation(event.target.value)}
            />
          )}
          {(up.otherDays > 0 || up.skipped > 0 || changed || up.error) && (
            <p className="vu-aside">
              {[
                up.error,
                up.otherDays > 0 && `${up.otherDays} ${up.otherDays === 1 ? "clip was" : "clips were"} recorded on another day.`,
                up.skipped > 0 && `Skipped ${up.skipped} already added.`,
                changed && "You changed your answers. Both are kept.",
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </div>
        <div className="vu-foot-actions">
          {!up.editing && (
            <button type="button" className="vu-btn ghost" onClick={() => up.setEditing(true)}>
              Change answers
            </button>
          )}
          <button
            type="button"
            className="vu-btn go"
            disabled={!up.canContinue}
            onClick={() => {
              up.resetSignature();
              up.setStep("certify");
            }}
          >
            Continue to sign
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckPill({ check }: { check: CheckRow }) {
  return (
    <span className={`vu-pill ${check.tone}`} title={check.detail}>
      <i aria-hidden>{check.tone === "ok" ? <Check size={10} strokeWidth={3.2} /> : null}</i>
      {check.title}
    </span>
  );
}
