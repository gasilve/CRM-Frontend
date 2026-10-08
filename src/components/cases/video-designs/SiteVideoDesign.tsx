import { Clock, FileVideo, HardDrive, Plus, Send, Snowflake, X } from "lucide-react";
import { Film, InkPad, useClipFocus } from "@/components/cases/video-designs/pieces";
import {
  ATTEST,
  clock,
  clipWhen,
  dayLabel,
  packageNote,
  type VideoClip,
  type VideoDayRow,
  type VideoIntake,
} from "@/components/cases/video-designs/use-video-intake";
import type { CaseService } from "@/lib/crm-api";
import { cn } from "@/lib/cn";

/** A file preview. The list is the clips, the pane is the one you are checking, the footer is the sign-off. */
export function SiteVideoDesign({
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
      className="surface flex h-[min(46rem,88vh)] w-[min(76rem,96vw)] flex-col overflow-hidden rounded-[1.125rem]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v3-title"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] text-[var(--color-accent-2)]">
          <FileVideo size={16} strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div id="v3-title" className="truncate font-[family-name:var(--font-display)] text-[1.2rem] italic leading-tight text-[var(--color-text-hi)]">
            {subjectName}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            <span>{claim}</span>
            <span aria-hidden>·</span>
            <span>{signerName}</span>
            {finish && (
              <>
                <span aria-hidden>·</span>
                <span>{finish}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-[0.5rem] text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[16.5rem] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-ink-1)]">
          <div className="min-h-0 flex-1 overflow-auto py-2">
            <button
              type="button"
              onClick={intake.selectToday}
              className="px-3 pb-1 pt-2 text-left font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-[var(--color-text-lo)]"
            >
              This upload
            </button>
            {intake.clips.length === 0 && !intake.selection && (
              <p className="px-3 py-2 text-[0.75rem] text-[var(--color-text-lo)]">No files yet.</p>
            )}
            {!intake.selection &&
              intake.clips.map((clip) => (
                <FileRow key={clip.id} clip={clip} on={focus?.id === clip.id} onClick={() => setFocusId(clip.id)} />
              ))}
            {intake.rows.map((row) => (
              <DayFiles
                key={row.id}
                row={row}
                clips={intake.selection?.batchId === row.batchId && intake.selection.day === row.day ? intake.shown : []}
                open={intake.selection?.batchId === row.batchId && intake.selection.day === row.day}
                focusId={focus?.id ?? null}
                onOpen={() => intake.selectDay(row)}
                onFocus={setFocusId}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              intake.selectToday();
              intake.openPicker();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-[var(--color-line)] px-3 py-3 text-left text-[0.8125rem] font-medium text-[var(--color-accent-2)] hover:bg-[var(--color-ink-3)]"
          >
            <Plus size={15} />
            Add video
          </button>
        </aside>

        <div
          className={cn("flex min-w-0 flex-1 flex-col bg-black/40", intake.dragging && draft && "ring-2 ring-inset ring-[var(--color-accent)]")}
          onDragOver={(event) => {
            if (!draft) return;
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
          {focus ? (
            <>
              <Film
                clip={focus}
                active={intake.playingId === focus.id}
                onPlay={() => intake.setPlayingId(focus.id)}
                onPause={() => intake.setPlayingId((current) => (current === focus.id ? null : current))}
                onDuration={draft ? (seconds) => intake.noteDuration(focus.id, seconds) : undefined}
                onRemove={draft ? () => intake.removeClip(focus.id) : undefined}
                className="relative min-h-0 flex-1"
                videoClassName="h-full w-full bg-black object-contain"
                playClassName="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white"
                removeClassName="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white"
              />
              <div className="flex shrink-0 items-center gap-3 border-t border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-2 font-mono text-[0.6875rem] text-[var(--color-text-mid)]">
                <span className="truncate text-[var(--color-text-hi)]">{focus.name}</span>
                <span>{focus.kind}</span>
                <span>{focus.recordedAt ? clipWhen(focus.recordedAt) : "No date in the file"}</span>
                <span className="ml-auto">{focus.seconds == null ? "" : clock(focus.seconds)}</span>
              </div>
            </>
          ) : (
            <button type="button" onClick={intake.openPicker} className="m-auto flex flex-col items-center gap-2 text-[var(--color-text-mid)]">
              <FileVideo size={28} strokeWidth={1.4} />
              <span>Add a video to preview it here.</span>
            </button>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3">
        {draft ? (
          <div className="flex items-end gap-4">
            <label className="shrink-0">
              <span className="mb-1 block font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Minutes</span>
              <input
                inputMode="numeric"
                aria-label="Minutes you shot"
                placeholder="—"
                value={intake.minuteText}
                onChange={(event) => intake.setMinuteText(event.target.value.replace(/[^\d]/g, ""))}
                className="h-10 w-20 rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 text-center font-mono text-[1rem] text-[var(--color-text-hi)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <button
              type="button"
              disabled={intake.measured == null}
              onClick={() => intake.measured != null && intake.setMinuteText(String(intake.measured))}
              className="mb-2 inline-flex items-center gap-1 text-[0.75rem] text-[var(--color-accent-2)] disabled:opacity-40"
            >
              <Clock size={12} />
              {intake.measured == null ? "Reading clips" : `Use ${intake.measured}`}
            </button>
            <div className="mb-1 grid min-w-0 flex-1 gap-1">
              {ATTEST.map((line, index) => (
                <button
                  key={line}
                  type="button"
                  aria-pressed={intake.checks[index]}
                  onClick={() => intake.toggleCheck(index)}
                  className="flex items-center gap-2 text-left text-[0.75rem] text-[var(--color-text-mid)]"
                >
                  <i
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 rounded-[0.25rem] border",
                      intake.checks[index] ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-line-3)]",
                    )}
                  />
                  {line}
                </button>
              ))}
            </div>
            <InkPad
              key={intake.signKey}
              onInk={intake.setSigned}
              stroke="#e8eef8"
              className="relative w-48 shrink-0"
              canvasClassName="h-14 w-full rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]"
              hintClassName="pointer-events-none absolute inset-x-0 top-4 text-center text-[0.6875rem] text-[var(--color-text-lo)]"
              clearClassName="absolute right-1 top-0.5 text-[0.6875rem] text-[var(--color-text-lo)]"
            />
            <button
              type="button"
              disabled={!intake.canCertify || intake.saving}
              onClick={() => void intake.certify()}
              className="h-10 shrink-0 rounded-[0.625rem] bg-[var(--color-accent)] px-4 text-[0.875rem] font-semibold text-white disabled:opacity-40"
            >
              {intake.saving ? "Saving" : "Certify"}
            </button>
          </div>
        ) : (
          intake.activeRow && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("pill", intake.activeRow.where === "cold" ? "pill-info" : "pill-warn")}>
                {intake.activeRow.where === "cold" ? <Snowflake size={11} /> : <HardDrive size={11} />}
                {intake.activeRow.where === "cold" ? "Cold storage" : "Staging"}
              </span>
              <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                {intake.activeRow.files} files · {intake.activeRow.signerName}
              </span>
              {intake.libraryError && <span className="text-[0.75rem] text-[var(--color-neg)]">{intake.libraryError}</span>}
              <button
                type="button"
                disabled={intake.activeRow.where === "cold"}
                onClick={() => intake.activeRow && void intake.moveCold(intake.activeRow)}
                className="ml-auto inline-flex h-9 items-center gap-2 rounded-[0.625rem] bg-[var(--color-accent)] px-3 text-[0.8125rem] font-semibold text-white disabled:opacity-40"
              >
                <Snowflake size={14} />
                {intake.activeRow.where === "cold" ? "In cold storage" : "Move to cold storage"}
              </button>
              <button type="button" disabled className="inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-[var(--color-line-2)] px-3 text-[0.8125rem] text-[var(--color-text-lo)]">
                <Send size={14} />
                Send to client
              </button>
            </div>
          )
        )}
        {draft && intake.libraryError && <p className="mt-2 text-[0.75rem] text-[var(--color-neg)]">{intake.libraryError}</p>}
      </footer>
    </div>
  );
}

function FileRow({ clip, on, onClick }: { clip: VideoClip; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-left",
        on ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)]",
      )}
    >
      <FileVideo size={14} className="shrink-0 text-[var(--color-accent-2)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem]">{clip.name.replace(/\.[^.]+$/, "")}</span>
        <span className="block font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {clip.kind}
          {clip.seconds != null ? ` · ${clock(clip.seconds)}` : ""}
        </span>
      </span>
    </button>
  );
}

function DayFiles({
  row,
  clips,
  open,
  focusId,
  onOpen,
  onFocus,
}: {
  row: VideoDayRow;
  clips: VideoClip[];
  open: boolean;
  focusId: string | null;
  onOpen: () => void;
  onFocus: (id: string) => void;
}) {
  return (
    <div>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-ink-3)]">
        {row.where === "cold" ? <Snowflake size={13} className="text-[#7aa1ff]" /> : <HardDrive size={13} className="text-[#f59e0b]" />}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[0.8125rem]", open ? "text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]")}>
            {dayLabel(row.day, true)}
          </span>
          <span className="block font-mono text-[0.625rem] text-[var(--color-text-lo)]">
            {row.files} files · {row.where === "cold" ? "Cold" : "Staging"} · {row.signerName.split(" ")[0]}
          </span>
        </span>
      </button>
      {open && clips.map((clip) => <FileRow key={clip.id} clip={clip} on={focusId === clip.id} onClick={() => onFocus(clip.id)} />)}
    </div>
  );
}
