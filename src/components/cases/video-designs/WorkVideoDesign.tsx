import { Clock, Film, Plus, ShieldCheck, Snowflake, X } from "lucide-react";
import { Film as ClipFilm, InkPad } from "@/components/cases/video-designs/pieces";
import {
  ATTEST,
  clock,
  dayLabel,
  packageNote,
  type VideoIntake,
} from "@/components/cases/video-designs/use-video-intake";
import type { CaseService } from "@/lib/crm-api";
import { cn } from "@/lib/cn";

/** A capture window. Day tabs, a tray of clips, and the sign-off pinned underneath. */
export function WorkVideoDesign({
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
  const draft = !intake.reviewing;
  const finish = packageNote(service);

  return (
    <div
      className="surface flex h-[min(48rem,88vh)] w-[min(58rem,96vw)] flex-col overflow-hidden rounded-[1.25rem]"
      style={{ borderColor: "#c084fc" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2-title"
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
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-line)] px-4 py-3" style={{ background: "rgba(192,132,252,0.14)" }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#1a1028]" style={{ background: "#c084fc" }}>
          <Film size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[0.5625rem] uppercase tracking-[0.22em] text-[#c084fc]">Video</div>
          <div id="v2-title" className="truncate text-[1.125rem] font-semibold leading-tight text-[var(--color-text-hi)]">
            {subjectName}
          </div>
          <div className="truncate font-mono text-[0.6875rem] text-[#fbbf24]">{claim}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.625rem] border border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-line)] px-3 pt-2">
        <DayTab label="Upload" detail={signerName.split(" ")[0]} on={!intake.selection} onClick={intake.selectToday} />
        {intake.rows.map((row) => (
          <DayTab
            key={row.id}
            label={dayLabel(row.day)}
            detail={row.where === "cold" ? "Cold" : "Staging"}
            cold={row.where === "cold"}
            on={intake.selection?.batchId === row.batchId && intake.selection.day === row.day}
            onClick={() => intake.selectDay(row)}
          />
        ))}
      </div>

      <div className={cn("min-h-0 flex-1 overflow-auto p-4", intake.dragging && "bg-[rgba(192,132,252,0.08)]")}>
        {intake.shown.length === 0 ? (
          <button
            type="button"
            onClick={intake.openPicker}
            className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-[rgba(192,132,252,0.55)] text-[var(--color-text-mid)]"
          >
            <Plus size={22} strokeWidth={1.8} />
            <span className="text-[0.9375rem] text-[var(--color-text-hi)]">Add the clips from today</span>
            <span className="font-mono text-[0.6875rem]">Drop them here. Play any of them before you sign.</span>
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {intake.shown.map((clip) => (
              <div key={clip.id} className="min-w-0">
                <ClipFilm
                  clip={clip}
                  active={intake.playingId === clip.id}
                  onPlay={() => intake.setPlayingId(clip.id)}
                  onPause={() => intake.setPlayingId((current) => (current === clip.id ? null : current))}
                  onDuration={draft ? (seconds) => intake.noteDuration(clip.id, seconds) : undefined}
                  onRemove={draft ? () => intake.removeClip(clip.id) : undefined}
                  className="relative aspect-video overflow-hidden rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]"
                  videoClassName="h-full w-full object-cover"
                  playClassName="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
                  removeClassName="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                />
                <div className="mt-1.5 truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{clip.name.replace(/\.[^.]+$/, "")}</div>
                <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  {clip.kind}
                  {clip.seconds != null ? ` · ${clock(clip.seconds)}` : ""}
                </div>
              </div>
            ))}
            {draft && (
              <button
                type="button"
                onClick={intake.openPicker}
                className="flex aspect-video flex-col items-center justify-center gap-1 rounded-[0.75rem] border border-dashed border-[var(--color-line-2)] text-[var(--color-text-mid)]"
              >
                <Plus size={18} />
                Add
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-ink-1)] px-4 py-3">
        {draft ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <label className="flex items-baseline gap-2">
                <input
                  inputMode="numeric"
                  aria-label="Minutes you shot"
                  placeholder="—"
                  value={intake.minuteText}
                  onChange={(event) => intake.setMinuteText(event.target.value.replace(/[^\d]/g, ""))}
                  className="w-16 border-0 bg-transparent text-center font-mono text-[1.5rem] font-semibold text-[var(--color-text-hi)] outline-none"
                />
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">minutes</span>
              </label>
              <button
                type="button"
                disabled={intake.measured == null}
                onClick={() => intake.measured != null && intake.setMinuteText(String(intake.measured))}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-2.5 py-1 font-mono text-[0.6875rem] text-[var(--color-text-mid)] disabled:opacity-40"
              >
                <Clock size={12} />
                {intake.measured == null ? "Measuring" : `Clips run ${intake.measured} min`}
              </button>
              {finish && <span className="ml-auto hidden truncate font-mono text-[0.625rem] text-[var(--color-text-lo)] sm:block">{finish}</span>}
            </div>
            <div className="grid gap-1.5">
              {ATTEST.map((line, index) => (
                <button
                  key={line}
                  type="button"
                  aria-pressed={intake.checks[index]}
                  onClick={() => intake.toggleCheck(index)}
                  className={cn(
                    "flex items-center gap-2 rounded-[0.625rem] px-2 py-1.5 text-left text-[0.8125rem]",
                    intake.checks[index] ? "bg-[rgba(74,222,128,0.12)] text-[var(--color-text-hi)]" : "text-[var(--color-text-mid)]",
                  )}
                >
                  <ShieldCheck size={14} className={intake.checks[index] ? "text-[#4ade80]" : "text-[var(--color-text-lo)]"} />
                  {line}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <InkPad
                key={intake.signKey}
                onInk={intake.setSigned}
                stroke="#e8eef8"
                className="relative min-w-0 flex-1"
                canvasClassName="h-16 w-full rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]"
                hintClassName="pointer-events-none absolute inset-x-0 top-5 text-center text-[0.75rem] text-[var(--color-text-lo)]"
                clearClassName="absolute right-2 top-1 text-[0.75rem] text-[var(--color-text-lo)]"
              />
              <button
                type="button"
                disabled={!intake.canCertify || intake.saving}
                onClick={() => void intake.certify()}
                className="h-16 shrink-0 rounded-[0.75rem] bg-[var(--color-accent)] px-5 text-[0.875rem] font-semibold text-white disabled:opacity-40"
              >
                {intake.saving ? "Saving" : "Certify"}
              </button>
            </div>
            {intake.libraryError && <p className="text-[0.75rem] text-[var(--color-neg)]">{intake.libraryError}</p>}
          </div>
        ) : (
          intake.activeRow && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-auto min-w-0">
                <div className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">
                  {intake.activeRow.where === "cold" ? "Cold storage" : "Staging"}
                </div>
                <div className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                  {intake.activeRow.files} files · {intake.activeRow.signerName}
                </div>
              </div>
              <button
                type="button"
                disabled={intake.activeRow.where === "cold"}
                onClick={() => intake.activeRow && void intake.moveCold(intake.activeRow)}
                className="inline-flex h-10 items-center gap-2 rounded-[0.75rem] bg-[#60a5fa] px-3 text-[0.8125rem] font-semibold text-[#0c1220] disabled:opacity-40"
              >
                <Snowflake size={14} />
                {intake.activeRow.where === "cold" ? "In cold storage" : "Move to cold storage"}
              </button>
              <button type="button" disabled className="inline-flex h-10 items-center rounded-[0.75rem] border border-[var(--color-line-2)] px-3 text-[0.8125rem] text-[var(--color-text-lo)]">
                Send to client
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function DayTab({
  label,
  detail,
  on,
  cold,
  onClick,
}: {
  label: string;
  detail: string;
  on: boolean;
  cold?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-t-[0.625rem] border border-b-0 px-3 py-2 text-left",
        on ? "border-[var(--color-line-2)] bg-[var(--color-ink-2)] text-[var(--color-text-hi)]" : "border-transparent text-[var(--color-text-lo)]",
      )}
    >
      {cold && <Snowflake size={12} className="text-[#60a5fa]" />}
      <span>
        <span className="block text-[0.8125rem] font-medium leading-none">{label}</span>
        <span className="mt-1 block font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{detail}</span>
      </span>
    </button>
  );
}
