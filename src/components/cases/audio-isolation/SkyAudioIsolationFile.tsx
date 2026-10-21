/**
 * Audio Isolation board — speaker sep + labels + transcript (mock).
 * Video upload stays on Valentin's Video flow.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MOCK_AUDIO_ISO,
  type AudioIsoPipelineStep,
  type AudioIsolationJob,
  type AudioIsolationView,
  type AudioJobStatus,
  type AudioSpeaker,
} from "@/components/cases/audio-isolation/mock-data";
import { OsintStepModal } from "@/components/cases/osint/OsintStepModal";
import "@/components/cases/osint/osint-modal.css";
import "@/components/cases/forensic/forensic-board.css";

const STATUS_LABEL: Record<AudioJobStatus, string> = {
  queued: "Queued",
  preview: "Preview",
  running: "Isolating",
  done: "Done",
  failed: "Failed",
};

const STATUS_COLOR: Record<AudioJobStatus, string> = {
  queued: "var(--ink3)",
  preview: "var(--possible, #ffc857)",
  running: "var(--possible, #ffc857)",
  done: "var(--confirmed, #3ee08a)",
  failed: "var(--neg, #ff6b6b)",
};

function stepTone(status: AudioIsoPipelineStep["status"]) {
  if (status === "done") return "var(--confirmed, #3ee08a)";
  if (status === "running") return "var(--possible, #ffc857)";
  if (status === "skipped") return "var(--ink3)";
  return "rgba(244,246,251,0.28)";
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function SpeakerChips({ speakers }: { speakers: AudioSpeaker[] }) {
  if (speakers.length === 0) return null;
  return (
    <div className="sky-viso-clip__stats">
      {speakers.map((s) => (
        <span key={s.id} className="sky-audio-spk" style={{ ["--spk" as string]: s.color }}>
          {s.label} · {fmtDur(s.duration_s)}
        </span>
      ))}
    </div>
  );
}

function JobCard({
  job,
  onPreview,
  onFull,
}: {
  job: AudioIsolationJob;
  onPreview: () => void;
  onFull: () => void;
}) {
  return (
    <article className={`sky-viso-clip${job.status === "done" ? " on" : ""}`}>
      <header className="sky-viso-clip__head">
        <div>
          <b>{job.source}</b>
          <span className="sky-viso-clip__meta">
            {job.source_kind} · {fmtDur(job.duration_s)}
            {job.gpu ? " · GPU" : ""}
          </span>
        </div>
        <span style={{ color: STATUS_COLOR[job.status] }}>{STATUS_LABEL[job.status]}</span>
      </header>
      <p className="sky-viso-clip__note">{job.detail}</p>
      <SpeakerChips speakers={job.speakers} />
      {job.transcript.length > 0 ? (
        <ul className="sky-audio-lines">
          {job.transcript.map((line, i) => {
            const sp = job.speakers.find((s) => s.id === line.speaker_id);
            return (
              <li key={`${line.t}-${i}`}>
                <i style={{ background: sp?.color ?? "var(--ink3)" }} />
                <span className="sky-audio-lines__t">{line.t}</span>
                <b>{sp?.label ?? line.speaker_id}</b>
                <span>{line.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="sky-viso-clip__actions">
        <button type="button" disabled={job.status === "running" || job.status === "done"} onClick={onPreview}>
          Preview
        </button>
        <button type="button" disabled={job.status === "running" || job.status === "done"} onClick={onFull}>
          Full isolate
        </button>
      </div>
    </article>
  );
}

export default function SkyAudioIsolationFile({
  subjectName,
  leaving,
  data = MOCK_AUDIO_ISO,
}: {
  subjectName?: string;
  leaving: boolean;
  data?: AudioIsolationView;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [stepOpen, setStepOpen] = useState<AudioIsoPipelineStep | null>(null);
  const [notes, setNotes] = useState(data.notes);
  const [jobs, setJobs] = useState(data.jobs);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const title = subjectName || data.subject.name;
  const where = [data.subject.city, data.subject.state].filter(Boolean).join(", ");
  const gpuBusy = jobs.some((j) => j.status === "running");

  const counts = useMemo(() => {
    const done = jobs.filter((j) => j.status === "done");
    return {
      jobs: jobs.length,
      done: done.length,
      speakers: done.reduce((n, j) => n + j.speakers.length, 0),
      transcript: done.filter((j) => j.transcript.length > 0).length,
    };
  }, [jobs]);

  const runJob = (job: AudioIsolationJob, mode: "preview" | "full") => {
    setBusy(job.id);
    setMsg(null);
    setJobs((prev) =>
      prev.map((x) =>
        x.id === job.id
          ? { ...x, status: "running", gpu: true, detail: mode === "preview" ? "Preview isolate…" : "Full isolate · GPU" }
          : x,
      ),
    );
    window.setTimeout(() => {
      setJobs((prev) =>
        prev.map((x) =>
          x.id === job.id
            ? {
                ...x,
                status: "done",
                gpu: false,
                speakers:
                  x.speakers.length > 0
                    ? x.speakers
                    : [
                        { id: `${x.id}-s1`, label: "Speaker A", color: "#f472b6", duration_s: Math.round(x.duration_s * 0.6) },
                        { id: `${x.id}-s2`, label: "Speaker B", color: "#38bdf8", duration_s: Math.round(x.duration_s * 0.3) },
                      ],
                transcript:
                  x.transcript.length > 0
                    ? x.transcript
                    : [{ t: "00:00:04", speaker_id: `${x.id}-s1`, text: "(preview) Isolated speech." }],
                detail: mode === "preview" ? "Preview stems ready" : "Speakers labeled · transcript ready",
              }
            : x,
        ),
      );
      setBusy(null);
      setMsg(
        mode === "preview"
          ? `Would POST /api/audio/isolate?preview=1 for ${job.source}.`
          : `Would POST /api/audio/isolate for ${job.source} (GPU; Ollama unloaded).`,
      );
    }, mode === "preview" ? 700 : 1100);
  };

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
      <section ref={rootRef} className="sky-file sky-osint sky-audio" aria-label="Audio Isolation">
        <div className="g id sky-file-card">
          <p className="occ">Audio Isolation</p>
          <h2 className="sky-file-title">{title}</h2>
          <p className="client">
            <span>{where || "—"}</span>
            <span className="cap d">Claim {data.subject.claim}</span>
            <span className="cap d">Inv #{data.investigation_id}</span>
            <span className="cap d">Sample</span>
          </p>

          <div className="sky-osint-steps" aria-label="Audio isolation pipeline">
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
              <div className="sec">Jobs</div>
              <div className="pl">
                <span className="k">Queued / running</span>
                <span className="t">{jobs.length - counts.done}</span>
              </div>
              <div className="pl">
                <span className="k">Done</span>
                <span className="t" style={{ color: STATUS_COLOR.done }}>
                  {counts.done}
                </span>
              </div>
            </div>
            <div className="fact">
              <div className="sec">Output</div>
              <div className="pl">
                <span className="k">Speakers</span>
                <span className="t">{counts.speakers}</span>
              </div>
              <div className="pl">
                <span className="k">Transcripts</span>
                <span className="t">{counts.transcript}</span>
              </div>
              <p className="sum">
                GPU {gpuBusy ? "busy — Ollama unloaded" : "idle"}. Video upload stays on Video.
              </p>
            </div>
            <div className="fact">
              <div className="sec">Case notes</div>
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
              <button type="button" className="on">
                Isolation jobs
                <span>{jobs.length}</span>
              </button>
            </div>
            <div className="sky-viso-list">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPreview={() => runJob(job, "preview")}
                  onFull={() => runJob(job, "full")}
                />
              ))}
            </div>
            {busy && <p className="sum sky-medical-searchmsg">Working… {busy}</p>}
            {msg && <p className="sum sky-medical-searchmsg">{msg}</p>}
          </div>
        </div>

        <div className="sky-file-rail">
          <div className="g idl">
            <div className="sec">Source</div>
            <p className="sum" style={{ marginBottom: 8 }}>
              Source a ready field clip or queue standalone audio.
            </p>
            <button
              type="button"
              className="sky-osint-linkbtn sky-medical-search"
              onClick={() => setMsg("Would POST /api/audio/isolate from a ready video clip or uploaded wav.")}
            >
              Queue source
            </button>
          </div>
          <div className="g idl">
            <div className="sec">GPU</div>
            <p className="sum">
              Isolate unloads Ollama while running. Preview is the fast pass; full isolate writes stems + transcript.
            </p>
          </div>
          <div className="g idl">
            <div className="sec">Export</div>
            <div className="sky-medical-report-actions">
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-search"
                onClick={() => setMsg("Would GET isolated stems (WAV) for done jobs.")}
              >
                Download stems
              </button>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-report-sec"
                onClick={() => setMsg("Would GET transcript + job report hash.")}
              >
                Transcript + report
              </button>
            </div>
          </div>
        </div>
      </section>

      {stepOpen && (
        <OsintStepModal step={stepOpen} eyebrow="Audio isolation step" onClose={() => setStepOpen(null)} />
      )}
    </>
  );
}
