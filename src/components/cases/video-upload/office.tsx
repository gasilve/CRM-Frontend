import { useEffect, useState, type ReactNode } from "react";
import { Archive, Check, Copy, Plus, Send, X } from "lucide-react";
import type { CaseService } from "@/lib/crm-api";
import type { SavedBatch, SavedClip } from "@/components/cases/video-library";
import { CAMERA, clock, dayName, packageNote, stampNote, timeOf } from "@/components/cases/video-upload/checks";
import { batchSends, clipSent, type DayRow } from "@/components/cases/video-upload/ledger";

export type Recipient = { role: string; name: string | null; email: string };

/** A panel that sits over the modal body. Escape and the scrim both close it. */
export function Panel({ title, kicker, onClose, children, foot }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; foot: ReactNode }) {
  return (
    <div
      className="vu-panel-layer"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <button type="button" className="vu-panel-scrim" aria-label="Close" onClick={onClose} />
      <div className="vu-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            {kicker && <p className="vu-kicker">{kicker}</p>}
            <h3>{title}</h3>
          </div>
          <button type="button" className="vu-close" aria-label="Close" onClick={onClose}>
            <X size={15} strokeWidth={1.6} />
          </button>
        </header>
        <div className="vu-panel-body">{children}</div>
        <footer>{foot}</footer>
      </div>
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PreviewClip = { clip: SavedClip; batch: SavedBatch; day: string };

function clipsOf(rows: DayRow[]): PreviewClip[] {
  return rows.flatMap((row) => row.batches.flatMap((batch) => batch.clips.map((clip) => ({ clip, batch, day: row.day }))));
}

/** Small stills of the videos a confirm panel is about to act on. */
function ClipPreview({ items }: { items: PreviewClip[] }) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const key = items.map((item) => item.clip.id).join(" ");

  useEffect(() => {
    const next = new Map<string, string>();
    for (const item of items) next.set(item.clip.id, URL.createObjectURL(item.clip.blob));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
    // The id list is the identity of this preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (items.length === 0) return null;
  return (
    <ul className="vu-preview">
      {items.map((item) => {
        const title = item.clip.name.replace(/\.[^.]+$/, "");
        return (
          <li key={item.clip.id}>
            <video src={urls.get(item.clip.id)} muted playsInline preload="metadata" />
            <strong title={title}>{title}</strong>
            <em>
              {dayName(item.day)}
              {item.clip.seconds != null ? ` · ${clock(item.clip.seconds)}` : ""}
            </em>
          </li>
        );
      })}
    </ul>
  );
}

export function SendPanel({
  rows,
  recipients,
  service,
  state,
  onClose,
  onSend,
}: {
  rows: DayRow[];
  recipients: Recipient[];
  service: CaseService;
  state: string | null;
  onClose: () => void;
  onSend: (to: string[], note: string) => Promise<void>;
}) {
  const earlier = [...new Set(rows.flatMap((row) => row.batches.flatMap((batch) => batchSends(batch).flatMap((send) => send.to))))];
  const known = new Map<string, Recipient>();
  for (const person of recipients) known.set(person.email.toLowerCase(), person);
  for (const email of earlier) if (!known.has(email.toLowerCase())) known.set(email.toLowerCase(), { role: "Sent before", name: null, email });
  const people = [...known.values()];

  const [chosen, setChosen] = useState<Set<string>>(() => new Set(people.slice(0, 1).map((person) => person.email.toLowerCase())));
  const [extra, setExtra] = useState("");
  const [note, setNote] = useState("");
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Recipient[]>([]);

  const picked = clipsOf(rows);
  const going = picked.filter((item) => item.clip.inClientVideo !== false);
  const held = picked.filter((item) => item.clip.inClientVideo === false);
  const resent = picked.filter((item) => clipSent(item.clip, item.batch));
  const clips = going.length;
  const left = held.length;
  const to = [...people, ...added].filter((person) => chosen.has(person.email.toLowerCase())).map((person) => person.email);
  const blocked = to.length === 0 || (resent.length > 0 && !again) || clips === 0;

  const addEmail = () => {
    const email = extra.trim();
    if (!EMAIL.test(email)) return;
    const id = email.toLowerCase();
    if (!known.has(id) && !added.some((person) => person.email.toLowerCase() === id)) setAdded((list) => [...list, { role: "Added", name: null, email }]);
    setChosen((set) => new Set(set).add(id));
    setExtra("");
  };

  const toggle = (email: string) =>
    setChosen((set) => {
      const next = new Set(set);
      const id = email.toLowerCase();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Panel
      kicker="Send to client"
      title={clips === 1 ? "Send this video?" : `Send ${clips} videos?`}
      onClose={onClose}
      foot={
        <>
          <span className="vu-foot-note">
            {clips === 0 ? "Every clip is left out. Put one back first." : to.length === 0 ? "Choose who gets it." : resent.length > 0 && !again ? "Confirm the resend above." : `${to.length} ${to.length === 1 ? "person" : "people"}`}
          </span>
          <button type="button" className="vu-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="vu-btn go"
            disabled={blocked || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSend(to, note.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send size={14} strokeWidth={1.8} />
            {busy ? "Sending…" : resent.length > 0 ? "Send again" : "Send"}
          </button>
        </>
      }
    >
      <section className="vu-p-sec">
        <h4>These videos go to the client</h4>
        <ClipPreview items={going} />
        <p className="vu-p-note">
          {packageNote(service, state)}
          {left > 0 ? ` ${left} ${left === 1 ? "clip stays" : "clips stay"} on the case and out of this send.` : ""}
        </p>
      </section>

      {resent.length > 0 && (
        <label className={again ? "vu-p-again on" : "vu-p-again"}>
          <input type="checkbox" checked={again} onChange={(event) => setAgain(event.target.checked)} />
          <span>
            <strong>
              {resent.length === going.length ? (going.length === 1 ? "This video was" : "These videos were") : `${resent.length} of these videos were`} already sent.
            </strong>
            Send {resent.length === 1 ? "it" : "them"} again anyway.
          </span>
        </label>
      )}

      <section className="vu-p-sec">
        <h4>Send to</h4>
        <div className="vu-p-people">
          {[...people, ...added].map((person) => {
            const on = chosen.has(person.email.toLowerCase());
            const addedHere = person.role === "Added";
            return (
              <span key={person.email} className={on ? "vu-person on" : "vu-person"}>
                <button type="button" aria-pressed={on} onClick={() => toggle(person.email)}>
                  <i>{on && <Check size={11} strokeWidth={3} />}</i>
                  <span>
                    <strong>{person.name ?? person.email}</strong>
                    <em>{person.name ? `${person.role} · ${person.email}` : person.role}</em>
                  </span>
                </button>
                {addedHere && (
                  <button
                    type="button"
                    className="vu-person-x"
                    aria-label={`Remove ${person.email}`}
                    onClick={() => {
                      setAdded((list) => list.filter((item) => item.email.toLowerCase() !== person.email.toLowerCase()));
                      setChosen((set) => {
                        const next = new Set(set);
                        next.delete(person.email.toLowerCase());
                        return next;
                      });
                    }}
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                )}
              </span>
            );
          })}
          {people.length + added.length === 0 && <p className="vu-p-note">There's no email on the case for the adjuster. Add one below.</p>}
        </div>
        <div className="vu-p-add">
          <input
            type="email"
            placeholder="Add an email — attorney, employer…"
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEmail();
              }
            }}
          />
          <button type="button" className="vu-btn ghost" disabled={!EMAIL.test(extra.trim())} onClick={addEmail}>
            <Plus size={14} strokeWidth={1.8} />
            Add
          </button>
        </div>
      </section>

      <section className="vu-p-sec">
        <h4>Note</h4>
        <textarea placeholder="Optional message with the link" value={note} maxLength={600} onChange={(event) => setNote(event.target.value)} />
      </section>
    </Panel>
  );
}

export function ColdPanel({ rows, onClose, onConfirm }: { rows: DayRow[]; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const picked = clipsOf(rows);
  const files = picked.length;
  const unsent = picked.filter((item) => !clipSent(item.clip, item.batch)).length;
  const one = files === 1;
  return (
    <Panel
      kicker="Cold storage"
      title={one ? "Lock this video?" : `Lock ${files} videos?`}
      onClose={onClose}
      foot={
        <>
          <span className="vu-foot-note">This can't be undone.</span>
          <button type="button" className="vu-btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="vu-btn cold"
            disabled={!sure || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Archive size={14} strokeWidth={1.8} />
            {busy ? "Locking…" : "Move to cold storage"}
          </button>
        </>
      }
    >
      <section className="vu-p-sec">
        <p className="vu-p-lede">
          {one ? "This video" : `These ${files} videos`} will be locked. You can still watch {one ? "it" : "them"} and download a copy. Nobody can change or delete {one ? "it" : "them"} after this, not even the office.
        </p>
        <ClipPreview items={picked} />
        <ul className="vu-p-list">
          <li>You can still send {one ? "it" : "them"} to the client, and send again later.</li>
          <li>A clip can still be left out of what the client sees. The locked file stays as it was recorded.</li>
          <li>Nothing comes back out of cold storage. Watching and downloading leave the file locked.</li>
        </ul>
        {unsent > 0 && (
          <p className="vu-p-note warn">
            {unsent === 1 ? "One of these videos hasn't" : `${unsent} of these videos haven't`} been sent to the client yet. You can still send after locking.
          </p>
        )}
      </section>
      <label className={sure ? "vu-p-again on" : "vu-p-again"}>
        <input type="checkbox" checked={sure} onChange={(event) => setSure(event.target.checked)} />
        <span>
          <strong>I understand this is permanent.</strong>
          Lock {one ? "this video" : "these videos"}.
        </span>
      </label>
    </Panel>
  );
}

/** What the investigator swore to, as it was signed. */
export function CertificatePanel({ row, onClose }: { row: DayRow; onClose: () => void }) {
  return (
    <Panel kicker="Certificate" title={dayName(row.day, true)} onClose={onClose} foot={<button type="button" className="vu-btn ghost" onClick={onClose}>Close</button>}>
      {row.batches.map((batch) => (
        <Certificate key={batch.id} batch={batch} />
      ))}
    </Panel>
  );
}

function Certificate({ batch }: { batch: SavedBatch }) {
  const [copied, setCopied] = useState<string | null>(null);
  const changed =
    batch.declaredFirst && batch.declared && (batch.declaredFirst.files !== batch.declared.files || batch.declaredFirst.seconds !== batch.declared.seconds);
  const certified = new Date(batch.certifiedAt);
  return (
    <article className="vu-cert">
      <header>
        <strong>{batch.signerName}</strong>
        <span>
          {batch.camera ? CAMERA[batch.camera].label : "Video"} · signed {certified.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {timeOf(batch.certifiedAt)}
        </span>
      </header>
      <dl>
        <div>
          <dt>They said</dt>
          <dd>{batch.declared ? `${batch.declared.files} files · ${clock(batch.declared.seconds)}` : `${batch.minutes} min`}</dd>
        </div>
        <div>
          <dt>We measured</dt>
          <dd>
            {batch.clips.length} files · {batch.measuredSeconds != null ? clock(batch.measuredSeconds) : "length checked on the server"}
          </dd>
        </div>
        {changed && batch.declaredFirst && (
          <div>
            <dt>First answer</dt>
            <dd className="warn">
              {batch.declaredFirst.files} files · {clock(batch.declaredFirst.seconds)} (changed after seeing the files)
            </dd>
          </div>
        )}
        {batch.series && (
          <div>
            <dt>Clip numbers</dt>
            <dd className={batch.series.missing.length ? "warn" : ""}>
              {batch.series.first != null ? `${batch.series.first}–${batch.series.last}` : "Not numbered"}
              {batch.series.missing.length > 0 && ` · missing ${batch.series.missing.join(", ")}`}
            </dd>
          </div>
        )}
        {batch.series?.explanation && (
          <div>
            <dt>Their reason</dt>
            <dd>“{batch.series.explanation}”</dd>
          </div>
        )}
        {batch.camera && (
          <div>
            <dt>Processing</dt>
            <dd>{stampNote(batch.camera)}.</dd>
          </div>
        )}
      </dl>
      {batch.attest && (
        <ul className="vu-cert-oath">
          {batch.attest.map((line) => (
            <li key={line}>
              <Check size={11} strokeWidth={3} />
              {line}
            </li>
          ))}
        </ul>
      )}
      {batch.signature && (
        <figure className="vu-cert-sign">
          <img src={batch.signature} alt={`Signature of ${batch.signerName}`} />
          <figcaption>{batch.signerName}</figcaption>
        </figure>
      )}
      <details className="vu-cert-hash">
        <summary>File fingerprints</summary>
        <ul>
          {batch.clips.map((clip) => (
            <li key={clip.id}>
              <span>{clip.name}</span>
              {clip.sha256 ? (
                <button
                  type="button"
                  title="Copy the full fingerprint"
                  onClick={() => {
                    void navigator.clipboard?.writeText(clip.sha256 ?? "");
                    setCopied(clip.id);
                  }}
                >
                  <code>{clip.sha256.slice(0, 16)}…</code>
                  {copied === clip.id ? <Check size={11} strokeWidth={3} /> : <Copy size={11} strokeWidth={1.8} />}
                </button>
              ) : (
                <em>Taken on the server</em>
              )}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
