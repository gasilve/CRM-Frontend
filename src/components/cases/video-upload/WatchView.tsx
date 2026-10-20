import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, ChevronLeft, Clock, FileCheck2, Flag, Lock, Play, Send, Upload, X } from "lucide-react";
import type { LeftOutReason, SavedBatch, SavedClip } from "@/components/cases/video-library";
import { videoApi, type VideoProcessing } from "@/lib/crm-api";
import { LEFT_OUT_LABEL, clock, dayName } from "@/components/cases/video-upload/checks";
import { clipLocked, clipSent, shortAt, shortDay, type DayRow, type FieldDay } from "@/components/cases/video-upload/ledger";
import type { SealJob } from "@/components/cases/video-upload/sealing";
import type { Resume } from "@/components/cases/video-upload/use-video-upload";
import { Player, type PlayClip } from "@/components/cases/video-upload/parts";

type StatusFilter = "all" | "unsent" | "sent" | "staging" | "locked";
type Picking = "send" | "cold" | null;

const STATUS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "unsent", label: "Not sent" },
  { id: "sent", label: "Sent" },
  { id: "staging", label: "In staging" },
  { id: "locked", label: "Locked" },
];

type Card = { clip: SavedClip; batch: SavedBatch; day: string; url: string };

/**
 * Filters on the left, every video as a card on the right. Starts on "All".
 * Send and cold storage reuse the same cards: pick some, then confirm.
 */
export function WatchView({
  rows,
  missing,
  jobs,
  draft,
  justSealed,
  canManage,
  signerName,
  onUpload,
  onContinue,
  onDiscard,
  onSend,
  onCold,
  onCertificate,
  onLeaveOut,
  onFlag,
  onRetryProcessing,
  onRetryHighlights,
  headerSlot,
}: {
  rows: DayRow[];
  missing: FieldDay[];
  jobs: SealJob[];
  draft: Resume | null;
  justSealed: string | null;
  canManage: boolean;
  signerName: string;
  onUpload: (day?: string) => void;
  onContinue: () => void;
  onDiscard: () => void;
  onSend: (clipIds: string[]) => void;
  onCold: (clipIds: string[]) => void;
  onCertificate: (row: DayRow) => void;
  onLeaveOut: (batchId: string, clipId: string, reason: LeftOutReason | null) => void;
  onFlag: (batchId: string, note: string | null) => void;
  /** Office: send a clip whose processing failed through again. */
  onRetryProcessing: (clipId: string) => void;
  onRetryHighlights: (clipId: string) => void;
  /** Where Upload and Back to videos sit, in the modal header. */
  headerSlot: HTMLElement | null;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [picking, setPicking] = useState<Picking>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [fetched, setFetched] = useState<Record<string, string>>({});
  const [copy, setCopy] = useState<"original" | "processed" | "highlights">("processed");
  const [highlightMode, setHighlightMode] = useState(false);
  const [processedUrls, setProcessedUrls] = useState<Record<string, string>>({});
  const [highlightUrls, setHighlightUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (justSealed) setDate(justSealed);
  }, [justSealed]);
  const urls = useRef(new Map<string, string>());

  for (const row of rows) {
    for (const batch of row.batches) {
      for (const clip of batch.clips) {
        if (clip.blob && !urls.current.has(clip.id)) urls.current.set(clip.id, URL.createObjectURL(clip.blob));
      }
    }
  }
  useEffect(() => {
    const made = urls.current;
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const cards: Card[] = rows.flatMap((row) =>
    row.batches.flatMap((batch) =>
      batch.clips.map((clip) => ({ clip, batch, day: row.day, url: urls.current.get(clip.id) ?? fetched[clip.id] ?? "" })),
    ),
  );
  const missingPlayback = cards.filter((card) => !card.url).map((card) => card.clip.id).join(" ");
  useEffect(() => {
    const ids = missingPlayback.split(" ").filter(Boolean).slice(0, 6);
    if (ids.length === 0) return;
    let live = true;
    void Promise.all(
      ids.map(async (id) => {
        try {
          const link = await videoApi.download(id);
          return [id, link.url] as const;
        } catch {
          return null;
        }
      }),
    ).then((pairs) => {
      if (!live) return;
      setFetched((current) => {
        const next = { ...current };
        for (const pair of pairs) if (pair) next[pair[0]] = pair[1];
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [missingPlayback]);
  const shown = cards.filter((card) => {
    if (date && card.day !== date) return false;
    const locked = clipLocked(card.clip, card.batch);
    const sent = clipSent(card.clip, card.batch);
    if (status === "unsent") return !sent;
    if (status === "sent") return sent;
    if (status === "staging") return !locked;
    if (status === "locked") return locked;
    return true;
  });

  const dayRow = date ? rows.find((row) => row.day === date) ?? null : null;
  const missingDay = date && !dayRow ? missing.find((field) => field.day === date) ?? null : null;
  const mine = dayRow?.batches.find((batch) => batch.signerName === signerName) ?? null;
  const playingCard = shown.find((card) => card.clip.id === playing) ?? null;
  const playingCopy = resolveCopy(playingCard?.clip ?? null, highlightMode && copy !== "original" && copy !== "processed" ? "highlights" : copy);
  const playingId = playingCard?.clip.id ?? null;
  useEffect(() => {
    if (!playingId || playingCopy !== "processed" || processedUrls[playingId]) return;
    let live = true;
    void videoApi
      .download(playingId, "inline", "processed")
      .then((link) => live && setProcessedUrls((current) => ({ ...current, [playingId]: link.url })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [playingId, playingCopy, processedUrls]);
  useEffect(() => {
    if (!playingId || playingCopy !== "highlights" || highlightUrls[playingId]) return;
    let live = true;
    void videoApi
      .download(playingId, "inline", "highlights")
      .then((link) => live && setHighlightUrls((current) => ({ ...current, [playingId]: link.url })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [playingId, playingCopy, highlightUrls]);

  const toggle = (id: string) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startPicking = (mode: Picking) => {
    setPicking(mode);
    setPicked(new Set());
    setLeaving(false);
  };

  const chooseDate = (next: string | null) => {
    setPlaying(null);
    setLeaving(false);
    setDate(next);
  };

  const chooseStatus = (next: StatusFilter) => {
    setPlaying(null);
    setLeaving(false);
    setStatus(next);
  };

  const header = headerSlot
    ? createPortal(
        playingCard ? (
          <button type="button" className="vu-crumb back" onClick={() => setPlaying(null)}>
            <ChevronLeft size={15} strokeWidth={1.8} />
            Back to videos
          </button>
        ) : (
          <button type="button" className="vu-head-upload" title={date ? `Add footage for ${dayName(date)}` : "Add a day's footage"} onClick={() => onUpload(date ?? undefined)}>
            <Upload size={16} strokeWidth={1.8} />
            Upload video
          </button>
        ),
        headerSlot,
      )
    : null;

  return (
    <div className={playingCard ? "vu-watch playing" : "vu-watch"}>
      {header}
      <aside className="vu-filters-side" aria-label="Filters">
        <p className="vu-filter-label">Show</p>
        <button type="button" className={!date && status === "all" && !highlightMode ? "vu-filter on" : "vu-filter"} onClick={() => { chooseDate(null); chooseStatus("all"); setHighlightMode(false); setCopy("processed"); }}>
          All video
          <em>{cards.length}</em>
        </button>
        <button
          type="button"
          className={highlightMode ? "vu-filter on" : "vu-filter"}
          onClick={() => {
            setHighlightMode(true);
            chooseDate(null);
            chooseStatus("all");
            setCopy("highlights");
          }}
        >
          Highlights
          <em>{cards.filter((card) => card.clip.highlights?.hasCopy).length}</em>
        </button>

        <p className="vu-filter-label">Days</p>
        {rows.map((row) => (
          <button key={row.day} type="button" className={date === row.day ? "vu-filter on" : "vu-filter"} onClick={() => chooseDate(date === row.day ? null : row.day)}>
            {shortDay(row.day)}
            <em>{row.files}</em>
          </button>
        ))}
        {missing.map((field) => (
          <button key={field.day} type="button" className={date === field.day ? "vu-filter missing on" : "vu-filter missing"} onClick={() => chooseDate(date === field.day ? null : field.day)}>
            {shortDay(field.day)}
            <em>None</em>
          </button>
        ))}

        <p className="vu-filter-label">Status</p>
        {STATUS.map((item) => (
          <button key={item.id} type="button" className={status === item.id ? "vu-filter on" : "vu-filter"} onClick={() => chooseStatus(item.id)}>
            {item.label}
          </button>
        ))}

        {draft && jobs.length === 0 && (
          <button type="button" className="vu-filter draft" onClick={onContinue}>
            Continue upload
            <em>{shortDay(draft.draft.workDate)}</em>
          </button>
        )}
      </aside>

      <div className="vu-watch-main">
        {playingCard ? (
          <div className="vu-player-pane">
            <div className="vu-body">
              <section className="vu-main">
                {(playingCard.clip.processing || playingCard.clip.highlights) && (
                  <div className="vu-copy-switch" role="group" aria-label="Which copy">
                    <button type="button" className={playingCopy === "original" ? "on" : ""} onClick={() => setCopy("original")}>
                      Original
                    </button>
                    <button
                      type="button"
                      className={playingCopy === "processed" ? "on" : ""}
                      disabled={!playingCard.clip.processing?.hasCopy}
                      onClick={() => setCopy("processed")}
                    >
                      Processed
                    </button>
                    <button
                      type="button"
                      className={playingCopy === "highlights" ? "on" : ""}
                      disabled={!playingCard.clip.highlights?.hasCopy}
                      title={highlightTitle(playingCard.clip.highlights)}
                      onClick={() => setCopy("highlights")}
                    >
                      Highlights
                    </button>
                  </div>
                )}
                <Player
                  key={`${playingCard.clip.id}-${playingCopy}`}
                  clip={playable(
                    playingCopy === "highlights"
                      ? { ...playingCard, url: highlightUrls[playingCard.clip.id] ?? "" }
                      : playingCopy === "processed"
                        ? { ...playingCard, url: processedUrls[playingCard.clip.id] ?? "" }
                        : playingCard,
                  )}
                />
                <ProcessingLine
                  processing={playingCard.clip.processing ?? null}
                  canRetry={canManage}
                  onRetry={() => onRetryProcessing(playingCard.clip.id)}
                />
                <HighlightsLine
                  highlights={playingCard.clip.highlights ?? null}
                  canRetry={canManage}
                  onRetry={() => onRetryHighlights(playingCard.clip.id)}
                />
              </section>
              <aside className="vu-rail" aria-label="Clips">
                <div className="vu-rail-head">
                  <span>Clips</span>
                  <em>{shown.length}</em>
                </div>
                {leaving && playingCard.clip.inClientVideo !== false ? (
                  <span className="vu-leave">
                    {(Object.keys(LEFT_OUT_LABEL) as LeftOutReason[]).map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setLeaving(false);
                          onLeaveOut(playingCard.batch.id, playingCard.clip.id, reason);
                        }}
                      >
                        {LEFT_OUT_LABEL[reason]}
                      </button>
                    ))}
                    <button type="button" onClick={() => setLeaving(false)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className="vu-text-btn" onClick={() => (playingCard.clip.inClientVideo === false ? onLeaveOut(playingCard.batch.id, playingCard.clip.id, null) : setLeaving(true))}>
                    {playingCard.clip.inClientVideo === false ? "Put this clip back" : "Leave this clip out"}
                  </button>
                )}
                {shown.map((card) => (
                  <button
                    key={card.clip.id}
                    type="button"
                    className={card.clip.id === playingCard.clip.id ? "vu-card on" : "vu-card"}
                    onClick={() => setPlaying(card.clip.id)}
                  >
                    <span className="vu-thumb">
                      <video src={card.url} muted playsInline preload="metadata" />
                      {card.clip.number != null && <span className="vu-num">#{card.clip.number}</span>}
                      <span className="vu-dur">{card.clip.seconds != null ? clock(card.clip.seconds) : "—"}</span>
                    </span>
                    <span className="vu-card-meta">
                      <span className="vu-card-name">{card.clip.name.replace(/\.[^.]+$/, "")}</span>
                      <span className="vu-card-sub">{dayName(card.day)}</span>
                    </span>
                  </button>
                ))}
              </aside>
            </div>
          </div>
        ) : (
          <>
            {jobs.map((job) => (
              <p key={job.id} className="vu-folder-note">
                Uploading {dayName(job.day)} · {Math.min(job.done + 1, job.files)} of {job.files}. Keep this tab open.
              </p>
            ))}
            {justSealed && date === justSealed && <p className="vu-sealed-line">Certified. The originals are kept as recorded.</p>}
            <ProcessingSummary clips={shown.map((card) => card.clip)} />

            {shown.length === 0 ? (
              <div className="vu-empty">
                <h3>{missingDay ? `No video for ${dayName(missingDay.day)}` : "Nothing to show"}</h3>
                <p>{missingDay ? `${missingDay.names.join(", ") || "Someone"} was scheduled, and nothing has been uploaded.` : "Try another day, or upload."}</p>
              </div>
            ) : (
              <div className="vu-cards">
                {shown.map((card) => (
                  <VideoCard
                    key={card.clip.id}
                    card={card}
                    picking={picking}
                    picked={picked.has(card.clip.id)}
                    onPlay={() => {
                      if (highlightMode) setCopy("highlights");
                      setPlaying(card.clip.id);
                    }}
                    onToggle={() => toggle(card.clip.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!playingCard && <footer className="vu-foot watch">
        {picking ? (
          <>
            <p className="vu-say">
              {picking === "cold" ? "Pick videos that are still in staging." : "Only videos already in cold storage can be sent."} {picked.size > 0 && <b>{picked.size} selected.</b>}
            </p>
            <div className="vu-foot-actions">
              <button type="button" className="vu-btn ghost" onClick={() => startPicking(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="vu-btn go"
                disabled={picked.size === 0}
                onClick={() => {
                  const ids = [...picked];
                  setPicking(null);
                  setPicked(new Set());
                  if (picking === "cold") onCold(ids);
                  else onSend(ids);
                }}
              >
                <Check size={14} strokeWidth={2} />
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="vu-say">{date ? dayName(date, true) : `All video · ${cards.length} ${cards.length === 1 ? "file" : "files"}`}</p>
            <div className="vu-foot-actions">
              {mine &&
                (flagging ? (
                  <span className="vu-flag-note">
                    <input autoFocus placeholder="Note for the office" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
                    <button
                      type="button"
                      className="vu-btn flag"
                      onClick={() => {
                        onFlag(mine.id, note.trim());
                        setFlagging(false);
                      }}
                    >
                      Send
                    </button>
                  </span>
                ) : (
                  <button type="button" className={mine.flag ? "vu-text-btn on" : "vu-text-btn"} onClick={() => (mine.flag ? onFlag(mine.id, null) : setFlagging(true))}>
                    <Flag size={13} strokeWidth={1.8} />
                    {mine.flag ? "Flagged" : "Flag"}
                  </button>
                ))}
              {dayRow && (
                <button type="button" className="vu-text-btn" onClick={() => onCertificate(dayRow)}>
                  <FileCheck2 size={13} strokeWidth={1.8} />
                  Certificate
                </button>
              )}
              {draft &&
                (discarding ? (
                  <span className="vu-leave">
                    <button type="button" onClick={() => setDiscarding(false)}>
                      Keep
                    </button>
                    <button type="button" onClick={onDiscard}>
                      Discard
                    </button>
                  </span>
                ) : (
                  <button type="button" className="vu-text-btn" onClick={() => setDiscarding(true)}>
                    Discard upload
                  </button>
                ))}
              {canManage && (
                <button type="button" className="vu-btn ghost" onClick={() => startPicking("cold")}>
                  <Archive size={14} strokeWidth={1.8} />
                  Cold storage
                </button>
              )}
              {canManage && (
                <button type="button" className="vu-btn go" onClick={() => startPicking("send")}>
                  <Send size={14} strokeWidth={1.8} />
                  Send to client
                </button>
              )}
            </div>
          </>
        )}
      </footer>}
    </div>
  );
}

function resolveCopy(clip: SavedClip | null, requested: "original" | "processed" | "highlights"): "original" | "processed" | "highlights" {
  if (!clip) return "original";
  if (requested === "highlights" && clip.highlights?.hasCopy) return "highlights";
  if (requested === "processed" && clip.processing?.hasCopy) return "processed";
  if (requested === "highlights" && clip.processing?.hasCopy) return "processed";
  return "original";
}

function highlightTitle(highlights: VideoProcessing | null | undefined): string {
  if (!highlights) return "Highlights are not ready yet";
  if (highlights.status === "failed") return highlights.error ?? "Highlights failed";
  if (highlights.status === "queued" || highlights.status === "running") return "Cutting the activity reel";
  if (highlights.unchanged) return "No activity to highlight";
  if (highlights.hasCopy) return "Activity highlights";
  return "Highlights are not ready yet";
}

function playable(card: Card): PlayClip {
  return {
    id: card.clip.id,
    name: card.clip.name,
    kind: card.clip.kind,
    url: card.url,
    number: card.clip.number ?? null,
    seconds: card.clip.seconds,
    recordedAt: card.clip.recordedAt,
    unreadable: false,
    inClientVideo: card.clip.inClientVideo !== false,
    leftOutReason: card.clip.leftOutReason ?? null,
  };
}

function VideoCard({
  card,
  picking,
  picked,
  onPlay,
  onToggle,
}: {
  card: Card;
  picking: Picking;
  picked: boolean;
  onPlay: () => void;
  onToggle: () => void;
}) {
  const locked = clipLocked(card.clip, card.batch);
  const sent = clipSent(card.clip, card.batch);
  const blocked = (picking === "cold" && locked) || (picking === "send" && !locked);
  const title = card.clip.name.replace(/\.[^.]+$/, "");

  return (
    <article className={["vu-vcard", picked && "picked", card.clip.inClientVideo === false && "out", blocked && "blocked"].filter(Boolean).join(" ")}>
      <div className="vu-vcard-frame">
      <video src={card.url} muted playsInline preload="metadata" />
      <div className="vu-vcard-shade" />
      <div className="vu-vcard-marks">
        <span title={locked ? "In cold storage" : "In staging"} className={locked ? "cold" : "stage"}>
          {locked ? <Lock size={18} strokeWidth={1.8} /> : <Archive size={18} strokeWidth={1.8} />}
        </span>
        <span title={sent ? "Sent to the client" : "Not sent to the client"} className={sent ? "sent" : "unsent"}>
          <Send size={18} strokeWidth={1.8} />
          {!sent && <X className="vu-mark-x" size={11} strokeWidth={3} aria-hidden />}
        </span>
      </div>
      {picking && (
        <button
          type="button"
          className={picked ? "vu-tick on" : "vu-tick"}
          aria-pressed={picked}
          disabled={blocked}
          aria-label={blocked ? (picking === "send" ? "Not in cold storage" : "Already locked") : picked ? "Unselect" : "Select"}
          onClick={onToggle}
        >
          {picked && <Check size={16} strokeWidth={3} />}
        </button>
      )}
      <button type="button" className="vu-vcard-play" aria-label={`Play ${card.clip.name}`} onClick={onPlay}>
        <Play size={22} strokeWidth={1.8} fill="currentColor" />
      </button>
      <div className="vu-vcard-copy">
        <strong title={title}>{title}</strong>
        <span className="vu-vcard-meta">
          <span title="Length">
            <Clock size={15} strokeWidth={1.8} />
            {card.clip.seconds != null ? clock(card.clip.seconds) : "—"}
          </span>
          <span title="Uploaded">
            <Upload size={15} strokeWidth={1.8} />
            {shortAt(card.batch.certifiedAt)}
          </span>
          {card.clip.inClientVideo === false && <span title="Left out of the client video">Left out</span>}
          {processingChip(card.clip.processing) && <span title="Viewing copy">{processingChip(card.clip.processing)}</span>}
          {highlightsChip(card.clip.highlights) && <span title="Highlights">{highlightsChip(card.clip.highlights)}</span>}
        </span>
      </div>
      </div>
    </article>
  );
}

/** A word or two for the card. Nothing once the copy is ready. */
function processingChip(processing: VideoProcessing | null | undefined): string | null {
  if (!processing) return null;
  if (processing.status === "failed") return "Processing failed";
  if (processing.status === "waiting") return "Needs claim type";
  if (processing.status === "queued" || processing.status === "running") return "Processing";
  return null;
}

function highlightsChip(highlights: VideoProcessing | null | undefined): string | null {
  if (!highlights) return null;
  if (highlights.status === "failed") return "Highlights failed";
  if (highlights.status === "queued" || highlights.status === "running") return "Highlights";
  if (highlights.hasCopy) return "Highlights ready";
  return null;
}

/** Under the player: what happened to the viewing copy, in plain words. */
function ProcessingLine({
  processing,
  canRetry,
  onRetry,
}: {
  processing: VideoProcessing | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  if (!processing) return null;
  let text: string;
  let tone = "";
  if (processing.status === "done") {
    if (processing.unchanged) {
      text = "No processing needed. The original is the viewing copy.";
    } else {
      const parts = [
        processing.steps?.stamp ? "time stamp added" : "camera's own time stamp kept",
        ...(processing.steps?.color ? ["colors enhanced"] : []),
        processing.steps?.trailer
          ? `title page and trailer added${processing.steps.trailer_match === "fallback" ? " (no trailer for this state, so the general one)" : ""}`
          : "no title page",
        "sound removed",
      ];
      text = `Processed: ${parts.join(", ")}. The original is unchanged.`;
    }
    tone = "ok";
  } else if (processing.status === "waiting") {
    text = "Waiting for the case's claim type. Set it on the case and processing starts.";
    tone = "warn";
  } else if (processing.status === "failed") {
    text = `Processing failed: ${processing.error ?? "unknown error"}`;
    tone = "bad";
  } else if (processing.offline) {
    text = "The processing computer is offline. It will try again on its own.";
    tone = "warn";
  } else {
    text = processing.status === "running" ? "Processing: adding the time stamp and title page." : "Queued for processing.";
  }
  return (
    <p className={`vu-processing ${tone}`}>
      {text}
      {processing.status === "failed" && canRetry && (
        <button type="button" className="vu-text-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}

function HighlightsLine({
  highlights,
  canRetry,
  onRetry,
}: {
  highlights: VideoProcessing | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  if (!highlights) return null;
  let text: string;
  let tone = "";
  if (highlights.status === "done") {
    if (highlights.unchanged) {
      text = "No activity to highlight. Nobody was in frame.";
    } else {
      const windows = highlights.steps?.windows;
      text = windows
        ? `Highlights: ${windows} ${windows === 1 ? "window" : "windows"} of activity. The original is unchanged.`
        : "Highlights reel is ready. The original is unchanged.";
    }
    tone = "ok";
  } else if (highlights.status === "failed") {
    text = `Highlights failed: ${highlights.error ?? "unknown error"}`;
    tone = "bad";
  } else if (highlights.offline) {
    text = "The processing computer is offline. Highlights will try again on its own.";
    tone = "warn";
  } else {
    text = highlights.status === "running" ? "Cutting the activity reel." : "Queued for highlights.";
  }
  return (
    <p className={`vu-processing ${tone}`}>
      {text}
      {highlights.status === "failed" && canRetry && (
        <button type="button" className="vu-text-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}

/** One line over the clips: how many viewing copies are ready, being made, waiting or failed. */
function ProcessingSummary({ clips }: { clips: SavedClip[] }) {
  const jobs = clips.map((clip) => clip.processing).filter((job): job is VideoProcessing => Boolean(job));
  const reels = clips.map((clip) => clip.highlights).filter((job): job is VideoProcessing => Boolean(job));
  if (jobs.length === 0 && reels.length === 0) return null;
  const count = (list: VideoProcessing[], test: (job: VideoProcessing) => boolean) => list.filter(test).length;
  const ready = count(jobs, (job) => job.status === "done");
  const busy = count(jobs, (job) => job.status === "queued" || job.status === "running");
  const waiting = count(jobs, (job) => job.status === "waiting");
  const failed = count(jobs, (job) => job.status === "failed");
  const offline = count(jobs, (job) => job.offline);
  const hlReady = count(reels, (job) => job.hasCopy);
  const hlBusy = count(reels, (job) => job.status === "queued" || job.status === "running");
  const hlFailed = count(reels, (job) => job.status === "failed");
  const parts = [
    ready > 0 && `${ready} processed`,
    busy > 0 && (offline > 0 ? `${busy} waiting for the processing computer` : `${busy} processing`),
    waiting > 0 && `${waiting} waiting for the case's claim type`,
    failed > 0 && `${failed} failed`,
    hlReady > 0 && `${hlReady} highlights`,
    hlBusy > 0 && `${hlBusy} cutting highlights`,
    hlFailed > 0 && `${hlFailed} highlights failed`,
  ].filter(Boolean);
  const tone = failed > 0 || hlFailed > 0 ? "bad" : waiting > 0 || offline > 0 ? "warn" : busy > 0 || hlBusy > 0 ? "" : "ok";
  return (
    <p className={`vu-processing vu-processing-summary ${tone}`}>
      Viewing copies: {parts.join(" · ")}.{(busy > 0 || hlBusy > 0) && " This page updates on its own."}
    </p>
  );
}

