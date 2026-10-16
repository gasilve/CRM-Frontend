import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, ChevronLeft, Clock, FileCheck2, Flag, Lock, Play, Send, Upload, X } from "lucide-react";
import type { LeftOutReason, SavedBatch, SavedClip } from "@/components/cases/video-library";
import { videoApi } from "@/lib/crm-api";
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
        <button type="button" className={!date && status === "all" ? "vu-filter on" : "vu-filter"} onClick={() => { chooseDate(null); chooseStatus("all"); }}>
          All video
          <em>{cards.length}</em>
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
                <Player clip={playable(playingCard)} />
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
                    onPlay={() => setPlaying(card.clip.id)}
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

function playable(card: Card): PlayClip {
  return {
    id: card.clip.id,
    name: card.clip.name,
    kind: card.clip.kind,
    url: card.url,
    number: card.clip.number ?? null,
    seconds: card.clip.seconds,
    recordedAt: card.clip.recordedAt,
    unreadable: card.clip.seconds == null,
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
        </span>
      </div>
      </div>
    </article>
  );
}
