/**
 * OSINT identity board — same column layout as SkyCaseFile.
 * Wheel stays put; left/mid/rail boxes swap in when OSINT is on the ring.
 * When `caseId` is set, loads from CRM → proti; falls back to mock on error / unlink.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MessageCircle, User } from "lucide-react";
import {
  MOCK_OSINT,
  PHOTO_BASE,
  type OsintCandidate,
  type OsintPipelineStep,
  type OsintView,
} from "@/components/cases/osint/mock-data";
import { OsintPhotosModal } from "@/components/cases/osint/OsintPhotosModal";
import { OsintStepModal } from "@/components/cases/osint/OsintStepModal";
import { ApiError, protiApi } from "@/lib/crm-api";
import "@/components/cases/osint/osint-modal.css";

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
  if (score >= 80) return { label: "CONFIRMED", color: "var(--confirmed, #3ee08a)" };
  if (score >= 65) return { label: "PROBABLE", color: "var(--probable, #ff9f45)" };
  if (score >= 40) return { label: "POSSIBLE", color: "var(--possible, #ffc857)" };
  return { label: "LOW", color: "var(--low, #9aa5b8)" };
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
  const src = path ? `${PHOTO_BASE}/${path}` : null;
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

function stepTone(status: OsintPipelineStep["status"]) {
  if (status === "done") return "var(--confirmed, #3ee08a)";
  if (status === "running") return "var(--possible, #ffc857)";
  if (status === "skipped") return "var(--ink3)";
  return "rgba(244,246,251,0.28)";
}

export default function SkyOsintFile({
  subjectName,
  leaving,
  caseId,
  data: dataProp,
}: {
  subjectName?: string;
  leaving: boolean;
  /** CRM case UUID — when set, loads live proti OSINT (mock fallback). */
  caseId?: string;
  data?: OsintView;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [live, setLive] = useState<OsintView | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "live" | "mock">("idle");
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const data = live ?? dataProp ?? MOCK_OSINT;

  const [photosOpen, setPhotosOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState<OsintPipelineStep | null>(null);
  const [notes, setNotes] = useState(data.notes);
  const [midTab, setMidTab] = useState<"candidates" | "findings">("findings");
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
  const where = [data.subject.city, data.subject.state].filter(Boolean).join(", ");
  const topSignals = top ? Object.entries(top.signals) : [];
  const sherlock = top ? Object.entries(top.sherlock ?? {}) : [];
  const previewPhotos = data.photos.slice(0, 4);
  const wa = data.whatsapp;

  useEffect(() => {
    if (!caseId || dataProp) {
      setLoadState(dataProp ? "live" : "mock");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    setLoadMsg(null);
    void protiApi
      .osint(caseId)
      .then((view) => {
        if (cancelled) return;
        setLive(view);
        setNotes(view.notes);
        setLoadState("live");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLive(null);
        setLoadState("mock");
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not load OSINT from proti";
        setLoadMsg(`${msg} — showing sample board.`);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, dataProp]);

  useEffect(() => {
    if (!leaving) return;
    const root = rootRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>(".sky-file-card, .sky-file-bottom, .sky-file-rail");
    nodes.forEach((node) => {
      for (const animation of node.getAnimations()) {
        const name = (animation as Animation & { animationName?: string }).animationName;
        if (name !== "sky-col-in") continue;
        animation.reverse();
      }
    });
  }, [leaving]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const page = root?.closest<HTMLElement>(".page");
    const frame = page?.closest<HTMLElement>(".sky-v6-scale");
    if (!root || !page || !frame) return;
    const measure = () => {
      const view = Math.max(frame.clientHeight, 640);
      root.style.height = `${view}px`;
      const wheel = page.querySelector<HTMLElement>(":scope > .center > .wheel");
      if (!wheel) return;
      // Extra pad so ring labels (e.g. Medical Canvass) stay above the mid panel.
      const gap = wheel.offsetTop + wheel.offsetHeight + 48;
      const room = view - 40 - 28 - 260;
      root.style.setProperty("--sky-wheel-h", `${Math.max(180, Math.min(gap, room))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section ref={rootRef} className="sky-file sky-osint" aria-label="OSINT identity">
        <div className="g id sky-file-card">
          <p className="occ">OSINT · Identity</p>
          <h2 className="sky-file-title">{title}</h2>
          <p className="client">
            <span>{where || "—"}</span>
            {age != null && <span className="cap">{age} yrs</span>}
            <span className="cap d">Inv #{data.investigation_id}</span>
            {loadState === "loading" && <span className="cap d">Loading proti…</span>}
            {loadState === "live" && <span className="cap d">Live</span>}
            {loadState === "mock" && caseId && <span className="cap d">Sample</span>}
          </p>
          {loadMsg ? <p className="sky-osint-load-msg">{loadMsg}</p> : null}

          <div className="sky-osint-steps" aria-label="Investigation pipeline">
            {data.pipeline.map((step) => (
              <button
                key={step.id}
                type="button"
                className={`sky-osint-step sky-osint-step--${step.status}`}
                onClick={() => setStepOpen(step)}
              >
                <i style={{ background: stepTone(step.status) }} />
                <b>{step.label}</b>
                <span>{step.detail}</span>
              </button>
            ))}
          </div>

          <div className="facts">
            <div className="fact">
              <div className="sec">Top match</div>
              {top ? (
                <>
                  <div className="sky-osint-top">
                    <Photo path={top.photo_minio} size={52} className="osint-top__photo" />
                    <div>
                      <div className="osint-top__handle">
                        <a href={top.url} target="_blank" rel="noopener noreferrer">
                          @{top.handle}
                        </a>
                        <a href={top.url} target="_blank" rel="noopener noreferrer" aria-label="Open profile">
                          <ExternalLink size={14} strokeWidth={1.8} color="rgba(244,246,251,0.42)" />
                        </a>
                      </div>
                      <p className="osint-top__platform">
                        {top.platform}
                        {top.photo_gender && (
                          <span>
                            {" "}
                            · {top.photo_gender}
                            {top.photo_age != null ? ` ${top.photo_age}y` : ""}
                          </span>
                        )}
                      </p>
                      <ScoreBar score={top.score} />
                    </div>
                  </div>
                  <div className="osint-signals">
                    {topSignals.map(([key, sig]) => (
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
                </>
              ) : (
                <p className="sum sky-empty">No candidates yet.</p>
              )}
            </div>

            <div className="fact">
              <div className="sec">Notes</div>
              <textarea
                className="sky-osint-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Investigator notes…"
              />
            </div>
          </div>
        </div>

        <div className="sky-file-mid">
          <div className="sky-file-gap" />
          <div className="g sky-file-bottom">
            <div className="sky-osint-tabs">
              <button
                type="button"
                className={midTab === "findings" ? "on" : ""}
                onClick={() => setMidTab("findings")}
              >
                Findings
                <span>{data.findings.length}</span>
              </button>
              <button
                type="button"
                className={midTab === "candidates" ? "on" : ""}
                onClick={() => setMidTab("candidates")}
              >
                Candidates
                <span>{rest.length}</span>
              </button>
            </div>

            {midTab === "findings" ? (
              data.findings.length === 0 ? (
                <p className="sum sky-empty">No findings yet.</p>
              ) : (
                data.findings.map((f) => (
                  <div className="pl sky-file-row" key={f.id}>
                    <span className="k">
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noopener noreferrer">
                          {f.platform}
                        </a>
                      ) : (
                        f.platform
                      )}
                    </span>
                    <span className="i">
                      <b>
                        {f.handle !== "people" && f.handle !== "web" && f.handle !== "email"
                          ? `@${f.handle}`
                          : f.type}
                      </b>
                      {f.content ? ` · ${f.content}` : ""}
                    </span>
                    <span className="a" style={{ color: scoreTone(Math.round(f.confidence * 100)).color }}>
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                ))
              )
            ) : rest.length === 0 ? (
              <p className="sum sky-empty">No other ranked handles.</p>
            ) : (
              <div className="osint-rest">
                {rest.map((c) => (
                  <CompactCandidate key={`${c.platform}-${c.handle}`} c={c} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sky-file-rail">
          <div className="g idl">
            <div className="sec">Photos</div>
            {data.photos.length === 0 ? (
              <p className="sum sky-empty">No photos extracted.</p>
            ) : (
              <>
                <div className="sky-osint-thumbs">
                  {previewPhotos.map((p) => (
                    <button key={p.id} type="button" className="sky-osint-thumb" onClick={() => setPhotosOpen(true)} title={`${p.platform} · @${p.handle}`}>
                      <Photo path={p.photo_minio} size={40} />
                    </button>
                  ))}
                </div>
                <button type="button" className="sky-osint-linkbtn" onClick={() => setPhotosOpen(true)}>
                  Open gallery · {data.photos.length} by platform
                </button>
              </>
            )}
          </div>

          <div className="g idl">
            <div className="sec">WhatsApp</div>
            <p className="sky-file-who" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageCircle size={18} strokeWidth={1.8} style={{ opacity: 0.7 }} />
              {wa.status === "found" ? "Found" : wa.status === "not_found" ? "Not found" : "Unchecked"}
            </p>
            {wa.phone && (
              <div className="pl">
                <span className="k">Phone</span>
                <span className="t">{wa.phone}</span>
              </div>
            )}
            {wa.profile_url && (
              <div className="pl">
                <span className="k">Link</span>
                <span className="t">
                  <a href={wa.profile_url} target="_blank" rel="noopener noreferrer">
                    wa.me
                  </a>
                </span>
              </div>
            )}
            <p className="sum">
              Salalah WA Web → scrape photos → gallery tagged WhatsApp. Scaffold only.
            </p>
          </div>

          <div className="g idl">
            <div className="sec">People · coverage</div>
            <div className="pl">
              <span className="k">Platforms</span>
              <span className="t">{platforms.length || "—"}</span>
            </div>
            <div className="pl">
              <span className="k">Mentions</span>
              <span className="t">{data.mentions_count.toLocaleString()}</span>
            </div>
            {data.people_records.length === 0 ? (
              <p className="sum sky-empty">No people records.</p>
            ) : (
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
            )}
          </div>
        </div>
      </section>

      {photosOpen && <OsintPhotosModal photos={data.photos} onClose={() => setPhotosOpen(false)} />}
      {stepOpen && <OsintStepModal step={stepOpen} onClose={() => setStepOpen(null)} />}
    </>
  );
}
