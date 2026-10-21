import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, User, X } from "lucide-react";
import {
  MOCK_OSINT,
  PHOTO_BASE,
  type OsintCandidate,
  type OsintView,
} from "@/components/cases/osint/mock-data";
import "./osint-modal.css";

const SIGNAL_LABELS: Record<string, string> = {
  gender_match: "Gender",
  age_match: "Age",
  city_match: "City",
  dob_mention: "DOB",
  face_cluster: "Face",
  language_ok: "Language",
  name_score: "Name",
  activity_ok: "Active",
};

function scoreTone(score: number) {
  if (score >= 80) return { label: "CONFIRMED", color: "var(--confirmed)" };
  if (score >= 65) return { label: "PROBABLE", color: "var(--probable)" };
  if (score >= 40) return { label: "POSSIBLE", color: "var(--possible)" };
  return { label: "LOW", color: "var(--low)" };
}

function photoUrl(path: string | null | undefined) {
  return path ? `${PHOTO_BASE}/${path}` : null;
}

function ageFromDob(dob: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const born = new Date(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const md = now.getMonth() - born.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function Photo({ path, size, className }: { path?: string | null; size: number; className?: string }) {
  const [err, setErr] = useState(false);
  const src = photoUrl(path);
  if (!src || err) {
    return (
      <div className={className ?? "osint-avatar"} style={{ width: size, height: size }} aria-hidden>
        <User size={size * 0.4} strokeWidth={1.6} />
      </div>
    );
  }
  return (
    <img
      className={className ?? "osint-avatar"}
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      onError={() => setErr(true)}
    />
  );
}

function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="osint-score-row">
      <div className="osint-score-bar">
        <i style={{ width: `${Math.min(100, score)}%`, background: tone.color }} />
      </div>
      <span className="osint-score-n" style={{ color: tone.color }}>
        {score}
      </span>
      <span className="osint-badge" style={{ color: tone.color, borderColor: `${tone.color}55`, background: `${tone.color}18` }}>
        {tone.label}
      </span>
    </div>
  );
}

function TopCandidate({ c }: { c: OsintCandidate }) {
  const signals = Object.entries(c.signals);
  const sherlock = Object.entries(c.sherlock ?? {});
  return (
    <article className="osint-top">
      <Photo path={c.photo_minio} size={96} className="osint-top__photo" />
      <div>
        <div className="osint-top__handle">
          <a href={c.url} target="_blank" rel="noopener noreferrer">
            @{c.handle}
          </a>
          <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label="Open profile">
            <ExternalLink size={14} strokeWidth={1.8} color="rgba(244,246,251,0.42)" />
          </a>
        </div>
        <p className="osint-top__platform">
          {c.platform}
          {c.photo_gender && (
            <span>
              {" "}
              · {c.photo_gender}
              {c.photo_age != null ? ` ${c.photo_age}y` : ""}
            </span>
          )}
          {c.tf_bits > 0 && <span> · {c.tf_bits.toFixed(0)} bits</span>}
        </p>
        <ScoreBar score={c.score} />
        <div className="osint-signals">
          {signals.map(([key, sig]) => (
            <span
              key={key}
              className={sig.earned > 0 ? "osint-chip" : "osint-chip osint-chip--off"}
              title={sig.note}
            >
              {SIGNAL_LABELS[key] ?? key}
              {sig.earned > 0 ? ` +${sig.earned}` : ` 0/${sig.max}`}
            </span>
          ))}
        </div>
        {sherlock.length > 0 && (
          <div className="osint-sherlock">
            {sherlock.map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer">
                {name}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function CompactCandidate({ c }: { c: OsintCandidate }) {
  const tone = scoreTone(c.score);
  const earned = Object.entries(c.signals)
    .filter(([, v]) => v.earned > 0)
    .map(([k, v]) => `${SIGNAL_LABELS[k] ?? k} +${v.earned}`);
  return (
    <div className="osint-row">
      <Photo path={c.photo_minio} size={36} />
      <div className="osint-row__main">
        <a className="osint-row__handle" href={c.url} target="_blank" rel="noopener noreferrer">
          @{c.handle}
        </a>
        <div className="osint-row__sub">
          {c.platform}
          {earned.length > 0 ? ` · ${earned.join(" · ")}` : ""}
        </div>
      </div>
      <div className="osint-row__score">
        <b style={{ color: tone.color }}>{c.score}</b>
        <span className="osint-badge" style={{ color: tone.color, borderColor: `${tone.color}55`, background: `${tone.color}18` }}>
          {tone.label}
        </span>
      </div>
    </div>
  );
}

export function OsintModal({
  subjectName,
  onClose,
  data = MOCK_OSINT,
}: {
  subjectName?: string;
  onClose: () => void;
  data?: OsintView;
}) {
  const age = ageFromDob(data.subject.dob);
  const [top, ...rest] = data.candidates;
  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const group of data.evidence) {
      for (const p of group.platforms) set.add(p);
    }
    return [...set];
  }, [data.evidence]);

  const title = subjectName || data.subject.name;

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="osint-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="osint-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="osint-modal__head">
          <div className="osint-modal__head-main">
            <p className="osint-modal__eyebrow">OSINT · Identity</p>
            <h2 id="osint-modal-title" className="osint-modal__title">
              {title}
            </h2>
            <p className="osint-modal__meta">
              {[
                age != null ? `${age} yrs` : null,
                data.subject.dob,
                [data.subject.city, data.subject.state].filter(Boolean).join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="osint-modal__stats">
              <span className="osint-modal__stat">
                <b>{data.candidates.length}</b> candidates
              </span>
              <span className="osint-modal__stat">
                <b>{platforms.length}</b> platforms
                {platforms.length > 0 ? ` · ${platforms.slice(0, 4).join(", ")}` : ""}
              </span>
              <span className="osint-modal__stat">
                <b>{data.mentions_count.toLocaleString()}</b> web mentions
              </span>
              <span className="osint-modal__stat">
                Inv <b>#{data.investigation_id}</b>
              </span>
            </div>
          </div>
          <button type="button" className="osint-modal__close" aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="osint-modal__body">
          <section>
            <h3 className="osint-modal__sec">
              Top match
              <span>highest identity score</span>
            </h3>
            {top ? <TopCandidate c={top} /> : <p className="osint-empty">No candidates yet.</p>}
          </section>

          {rest.length > 0 && (
            <section>
              <h3 className="osint-modal__sec">
                Other candidates
                <span>{rest.length} ranked</span>
              </h3>
              <div className="osint-rest">
                {rest.map((c) => (
                  <CompactCandidate key={`${c.platform}-${c.handle}`} c={c} />
                ))}
              </div>
            </section>
          )}

          {data.people_records.length > 0 && (
            <section>
              <h3 className="osint-modal__sec">
                People records
                <span>Spokeo / Clustal</span>
              </h3>
              <div className="osint-records">
                {data.people_records.map((record) => (
                  <div className="osint-record" key={`${record.engine}-${record.url}`}>
                    <div className="osint-record__engine">
                      {record.engine} · conf {Math.round(record.confidence * 100)}%
                      {record.url && (
                        <a href={record.url} target="_blank" rel="noopener noreferrer">
                          open
                        </a>
                      )}
                    </div>
                    <p>{record.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
