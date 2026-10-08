import { Clock, Film as FilmIcon, Plus, ShieldCheck, Snowflake, X } from "lucide-react";
import { Film, InkPad, useClipFocus } from "@/components/cases/video-designs/pieces";
import {
  ATTEST,
  clock,
  clipWhen,
  dayLabel,
  packageNote,
  type VideoIntake,
} from "@/components/cases/video-designs/use-video-intake";
import type { CaseService } from "@/lib/crm-api";

/** A viewer. One picture, a strip of the other clips, and the signature under the picture. */
export function SkyVideoDesign({
  intake,
  subjectName,
  claim,
  service,
  signerName,
  onClose,
}: {
  intake: VideoIntake;
  subjectName: string;
  claim: string;
  service: CaseService;
  signerName: string;
  crew: string[];
  onClose: () => void;
}) {
  const { focus, setFocusId } = useClipFocus(intake.shown);
  const draft = !intake.reviewing;
  const finish = packageNote(service);

  return (
    <div
      className={intake.dragging ? "v1-modal over" : "v1-modal"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="v1-title"
      onDragOver={(event) => {
        event.preventDefault();
        intake.setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) intake.setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        intake.setDragging(false);
        if (draft) intake.addFiles(event.dataTransfer.files);
      }}
    >
      <header className="v1-top">
        <div>
          <p className="v1-kicker">Video</p>
          <h2 id="v1-title">{subjectName}</h2>
          <p className="v1-claim">{claim}</p>
        </div>
        <button type="button" className="v1-close" aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div className="v1-days" role="tablist">
        <button type="button" className={intake.selection ? "" : "on"} onClick={intake.selectToday}>
          Today
        </button>
        {intake.rows.map((row) => {
          const on = intake.selection?.batchId === row.batchId && intake.selection.day === row.day;
          return (
            <button key={row.id} type="button" className={on ? "on" : ""} onClick={() => intake.selectDay(row)}>
              {row.where === "cold" && <Snowflake size={12} strokeWidth={1.6} />}
              {dayLabel(row.day)}
              <span>{row.files}</span>
            </button>
          );
        })}
      </div>

      <div className="v1-watch">
        {focus ? (
          <Film
            clip={focus}
            active={intake.playingId === focus.id}
            onPlay={() => intake.setPlayingId(focus.id)}
            onPause={() => intake.setPlayingId((current) => (current === focus.id ? null : current))}
            onDuration={draft ? (seconds) => intake.noteDuration(focus.id, seconds) : undefined}
            className="v1-player"
            videoClassName="v1-video"
            playClassName="v1-play"
            removeClassName="v1-x"
          />
        ) : (
          <button type="button" className="v1-empty" onClick={intake.openPicker}>
            <FilmIcon size={28} strokeWidth={1.25} />
            <strong>Drop the video here</strong>
            <span>You can play it before you sign.</span>
          </button>
        )}
        {focus && (
          <p className="v1-caption">
            <b>{focus.name.replace(/\.[^.]+$/, "")}</b>
            <span>{focus.kind}</span>
            <span>{focus.recordedAt ? clipWhen(focus.recordedAt) : "No date in the file"}</span>
            <span>{focus.seconds == null ? "" : clock(focus.seconds)}</span>
          </p>
        )}
        {(intake.shown.length > 0 || draft) && (
          <div className="v1-strip">
            {intake.shown.map((clip) => (
              <div key={clip.id} className={focus?.id === clip.id ? "v1-thumb on" : "v1-thumb"}>
                <Film
                  clip={clip}
                  active={false}
                  previewOnly
                  onPlay={() => {
                    setFocusId(clip.id);
                    intake.setPlayingId(null);
                  }}
                  onPause={() => {}}
                  onDuration={draft ? (seconds) => intake.noteDuration(clip.id, seconds) : undefined}
                  onRemove={draft ? () => intake.removeClip(clip.id) : undefined}
                  className="v1-thumb-film"
                  videoClassName="v1-video"
                  playClassName="v1-play"
                  removeClassName="v1-x"
                />
              </div>
            ))}
            {draft && (
              <button type="button" className="v1-thumb add" onClick={intake.openPicker} aria-label="Add video">
                <Plus size={18} strokeWidth={1.4} />
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="v1-foot">
        {draft ? (
          <>
            <div className="v1-minutes">
              <label>
                <input
                  inputMode="numeric"
                  aria-label="Minutes you shot"
                  placeholder="—"
                  value={intake.minuteText}
                  onChange={(event) => intake.setMinuteText(event.target.value.replace(/[^\d]/g, ""))}
                />
                <span>min</span>
              </label>
              <button
                type="button"
                disabled={intake.measured == null}
                onClick={() => intake.measured != null && intake.setMinuteText(String(intake.measured))}
              >
                <Clock size={13} strokeWidth={1.5} />
                {intake.measured == null ? "Reading" : `${intake.measured} on the clips`}
              </button>
            </div>
            <div className="v1-checks">
              {ATTEST.map((line, index) => (
                <button
                  key={line}
                  type="button"
                  className={intake.checks[index] ? "on" : ""}
                  aria-pressed={intake.checks[index]}
                  onClick={() => intake.toggleCheck(index)}
                >
                  <i />
                  {line}
                </button>
              ))}
            </div>
            <InkPad
              key={intake.signKey}
              onInk={intake.setSigned}
              stroke="#f4f6fb"
              className="v1-sign"
              canvasClassName="v1-pad"
              hintClassName="v1-hint"
              clearClassName="v1-clear"
            />
            {finish && <p className="v1-note">{finish}</p>}
            {intake.libraryError && <p className="v1-err">{intake.libraryError}</p>}
            <button type="button" className="v1-go" disabled={!intake.canCertify || intake.saving} onClick={() => void intake.certify()}>
              <ShieldCheck size={15} strokeWidth={1.6} />
              {intake.saving ? "Saving" : `Certify · ${signerName.split(" ")[0]}`}
            </button>
          </>
        ) : (
          intake.activeRow && (
            <div className="v1-custody">
              <div>
                <b>{intake.activeRow.where === "cold" ? "Cold storage" : "Staging"}</b>
                <span>
                  {intake.activeRow.files} files · {intake.activeRow.signerName}
                </span>
              </div>
              <button
                type="button"
                className="v1-go"
                disabled={intake.activeRow.where === "cold"}
                onClick={() => intake.activeRow && void intake.moveCold(intake.activeRow)}
              >
                <Snowflake size={15} strokeWidth={1.6} />
                {intake.activeRow.where === "cold" ? "In cold storage" : "Move to cold storage"}
              </button>
              <button type="button" className="v1-go" disabled>
                Send to client
              </button>
              {intake.libraryError && <p className="v1-err">{intake.libraryError}</p>}
            </div>
          )
        )}
      </footer>
    </div>
  );
}
