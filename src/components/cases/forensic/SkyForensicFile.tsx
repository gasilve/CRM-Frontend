/**
 * Forensic Collection board — same column layout as OSINT / Medical.
 * Mock of Prodigy Firefox extension captures + chain of custody + export.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MOCK_FORENSIC,
  type ForensicCapture,
  type ForensicPipelineStep,
  type ForensicView,
} from "@/components/cases/forensic/mock-data";
import { OsintStepModal } from "@/components/cases/osint/OsintStepModal";
import "@/components/cases/osint/osint-modal.css";
import "@/components/cases/forensic/forensic-board.css";

function stepTone(status: ForensicPipelineStep["status"]) {
  if (status === "done") return "var(--confirmed, #3ee08a)";
  if (status === "running") return "var(--possible, #ffc857)";
  if (status === "skipped") return "var(--ink3)";
  return "rgba(244,246,251,0.28)";
}

function pacific(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function CaptureCard({
  c,
  onToggle,
}: {
  c: ForensicCapture;
  onToggle: () => void;
}) {
  return (
    <article className={`sky-forensic-cap${c.is_relevant ? " on" : ""}`}>
      <header className="sky-forensic-cap__head">
        <div>
          <b>
            {c.smc} · {c.platform}
          </b>
          <span className="sky-forensic-cap__type">{c.media_type}</span>
        </div>
        <button type="button" className={c.is_relevant ? "on" : ""} onClick={onToggle}>
          {c.is_relevant ? "Relevant" : "Hold"}
        </button>
      </header>
      <p className="sky-forensic-cap__title">{c.page_title}</p>
      <a className="sky-forensic-cap__url" href={c.url} target="_blank" rel="noopener noreferrer">
        {c.url.replace(/^https?:\/\//, "").slice(0, 64)}
        {c.url.length > 64 ? "…" : ""}
      </a>
      <div className="sky-forensic-cap__meta">
        <span>{pacific(c.captured_at)} PT</span>
        <span>{c.images_extracted} imgs</span>
        {c.has_wacz ? <span>WACZ</span> : null}
        {c.has_html ? <span>HTML</span> : null}
      </div>
      <div className="sky-forensic-cap__hash">
        <span title={c.content_hash}>PNG · {c.content_hash}</span>
        <span title={c.url_hash}>URL · {c.url_hash}</span>
      </div>
    </article>
  );
}

export default function SkyForensicFile({
  subjectName,
  leaving,
  data = MOCK_FORENSIC,
}: {
  subjectName?: string;
  leaving: boolean;
  data?: ForensicView;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [stepOpen, setStepOpen] = useState<ForensicPipelineStep | null>(null);
  const [notes, setNotes] = useState(data.notes);
  const [captures, setCaptures] = useState(data.captures);
  const [exporting, setExporting] = useState<"zip" | "pdf" | "immutable" | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [midTab, setMidTab] = useState<"all" | "relevant" | "held">("all");

  const title = subjectName || data.subject.name;
  const where = [data.subject.city, data.subject.state].filter(Boolean).join(", ");

  const relevant = useMemo(() => captures.filter((c) => c.is_relevant), [captures]);
  const held = useMemo(() => captures.filter((c) => !c.is_relevant), [captures]);
  const list = midTab === "relevant" ? relevant : midTab === "held" ? held : captures;

  const counts = useMemo(() => {
    let screenshots = 0;
    let recordings = 0;
    let rel = 0;
    for (const c of captures) {
      if (c.media_type === "screenshot") screenshots += 1;
      else recordings += 1;
      if (c.is_relevant) rel += 1;
    }
    return { total: captures.length, relevant: rel, screenshots, recordings };
  }, [captures]);

  const runExport = (kind: "zip" | "pdf" | "immutable") => {
    if (counts.relevant === 0) {
      setExportMsg("Mark at least one capture relevant before export.");
      return;
    }
    setExporting(kind);
    setExportMsg(null);
    window.setTimeout(() => {
      setExporting(null);
      if (kind === "zip") {
        setExportMsg("Would POST /api/forensic/export-case → ZIP + SHA256SUMS.txt (24h URL).");
      } else if (kind === "pdf") {
        setExportMsg("Would GET /api/forensic/report/{inv} → signed PDF (pyHanko · FreeTSA).");
      } else {
        setExportMsg("Would promote to immutable-social-media (Object Lock 7yr) — confirm dialog.");
      }
    }, 700);
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
      <section ref={rootRef} className="sky-file sky-osint sky-forensic" aria-label="Forensic Collection">
        <div className="g id sky-file-card">
          <p className="occ">Forensic Collection</p>
          <h2 className="sky-file-title">{title}</h2>
          <p className="client">
            <span>{where || "—"}</span>
            <span className="cap d">Claim {data.subject.claim}</span>
            <span className="cap d">Inv #{data.investigation_id}</span>
            <span className="cap d">Sample</span>
          </p>

          <div className="sky-osint-steps" aria-label="Forensic pipeline">
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
              <div className="sec">Extension session</div>
              <div className="pl">
                <span className="k">Collector</span>
                <span className="t">
                  {data.collector.name} · {data.collector.title}
                </span>
              </div>
              <div className="pl">
                <span className="k">Session</span>
                <span className="t">{data.session_id}</span>
              </div>
              <p className="sum">Capture This Page · Record scroll · WACZ via Firefox extension.</p>
            </div>
            <div className="fact">
              <div className="sec">Counts</div>
              <div className="pl">
                <span className="k">Captures</span>
                <span className="t">{counts.total}</span>
              </div>
              <div className="pl">
                <span className="k">Relevant</span>
                <span className="t" style={{ color: "var(--confirmed, #3ee08a)" }}>
                  {counts.relevant}
                </span>
              </div>
              <div className="pl">
                <span className="k">Recordings</span>
                <span className="t">{counts.recordings}</span>
              </div>
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
              <button type="button" className={midTab === "all" ? "on" : ""} onClick={() => setMidTab("all")}>
                Captures
                <span>{captures.length}</span>
              </button>
              <button
                type="button"
                className={midTab === "relevant" ? "on" : ""}
                onClick={() => setMidTab("relevant")}
              >
                Relevant
                <span>{relevant.length}</span>
              </button>
              <button type="button" className={midTab === "held" ? "on" : ""} onClick={() => setMidTab("held")}>
                Held
                <span>{held.length}</span>
              </button>
            </div>
            {list.length === 0 ? (
              <p className="sum sky-empty">No captures in this tab.</p>
            ) : (
              <div className="sky-forensic-list">
                {list.map((c) => (
                  <CaptureCard
                    key={c.id}
                    c={c}
                    onToggle={() =>
                      setCaptures((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, is_relevant: !x.is_relevant } : x)),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sky-file-rail">
          <div className="g idl">
            <div className="sec">Capture modes</div>
            <p className="sum" style={{ marginBottom: 8 }}>
              From the Firefox extension (mock — no live calls).
            </p>
            <button
              type="button"
              className="sky-osint-linkbtn sky-medical-search"
              onClick={() => setExportMsg("Would POST /api/forensic/capture (screenshot + HTML ≤5MB).")}
            >
              Capture this page
            </button>
            <button
              type="button"
              className="sky-osint-linkbtn sky-medical-report-sec"
              style={{ marginTop: 8 }}
              onClick={() =>
                setExportMsg("Would POST /api/forensic/capture-scroll-record → stitch + WACZ presign.")
              }
            >
              Record scroll
            </button>
          </div>
          <div className="g idl">
            <div className="sec">Chain of custody</div>
            <p className="sum">
              content_hash = SHA-256 of PNG bytes. Export ships SHA256SUMS.txt. PDF signed + RFC 3161
              timestamp.
            </p>
          </div>
          <div className="g idl">
            <div className="sec">Export</div>
            <div className="sky-medical-report-actions">
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-search"
                disabled={exporting !== null}
                onClick={() => runExport("zip")}
              >
                {exporting === "zip" ? "Building…" : "Export ZIP"}
              </button>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-report-sec"
                disabled={exporting !== null}
                onClick={() => runExport("pdf")}
              >
                {exporting === "pdf" ? "Signing…" : "Forensic PDF"}
              </button>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-report-sec"
                disabled={exporting !== null}
                onClick={() => runExport("immutable")}
              >
                {exporting === "immutable" ? "Promoting…" : "Promote immutable"}
              </button>
            </div>
            {exportMsg && <p className="sum sky-medical-searchmsg">{exportMsg}</p>}
          </div>
        </div>
      </section>

      {stepOpen && (
        <OsintStepModal step={stepOpen} eyebrow="Forensic step" onClose={() => setStepOpen(null)} />
      )}
    </>
  );
}
