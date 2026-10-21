/**
 * Medical Canvass board — same column layout as SkyCaseFile / SkyOsintFile.
 * Address + type chips are editable; Google Places search is an explicit action.
 * Type chips also filter the facility list. Notes open in a modal (Prodigy-style).
 * When `caseId` is set, loads/saves via CRM → proti; falls back to mock on unlink.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FACILITY_TYPE_OPTIONS,
  MOCK_MEDICAL,
  type MedicalFacility,
  type MedicalFacilityStatus,
  type MedicalPipelineStep,
  type MedicalCanvassView,
} from "@/components/cases/medical/mock-data";
import { MedicalNoteModal } from "@/components/cases/medical/MedicalNoteModal";
import { MedicalCanvassMap } from "@/components/cases/medical/MedicalCanvassMap";
import { OsintStepModal } from "@/components/cases/osint/OsintStepModal";
import { ApiError, protiApi } from "@/lib/crm-api";
import "@/components/cases/osint/osint-modal.css";

const STATUS_LABEL: Record<MedicalFacilityStatus, string> = {
  pending: "Pending",
  with_record: "With record",
  chart_only: "Chart only",
  no_record: "No record",
  dismissed: "Dismissed",
};

const STATUS_COLOR: Record<MedicalFacilityStatus, string> = {
  pending: "var(--ink3)",
  with_record: "var(--confirmed, #3ee08a)",
  chart_only: "var(--possible, #ffc857)",
  no_record: "var(--ink3)",
  dismissed: "var(--ink3)",
};

function stepTone(status: MedicalPipelineStep["status"]) {
  if (status === "done") return "var(--confirmed, #3ee08a)";
  if (status === "running") return "var(--possible, #ffc857)";
  if (status === "skipped") return "var(--ink3)";
  return "rgba(244,246,251,0.28)";
}

function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `tel:+1${digits}` : `tel:+${digits}`;
}

function typeLabel(id: string) {
  return FACILITY_TYPE_OPTIONS.find((t) => t.id === id)?.label ?? id.replace(/_/g, " ");
}

function FacilityCard({
  f,
  onNotes,
  onStatus,
}: {
  f: MedicalFacility;
  onNotes: () => void;
  onStatus: (s: MedicalFacilityStatus) => void;
}) {
  const tel = telHref(f.phone);
  return (
    <article className={`sky-medical-fac sky-medical-fac--${f.status}`}>
      <header className="sky-medical-fac__head">
        <div>
          <b>{f.name}</b>
          <span className="sky-medical-fac__type">{typeLabel(f.type)}</span>
        </div>
        <span className="sky-medical-fac__status" style={{ color: STATUS_COLOR[f.status] }}>
          {STATUS_LABEL[f.status]}
        </span>
      </header>
      <p className="sky-medical-fac__addr">{f.address}</p>
      <div className="sky-medical-fac__meta">
        {tel ? (
          <a className="sky-medical-fac__phone" href={tel}>
            {f.phone}
          </a>
        ) : (
          <span className="sky-medical-fac__phone sky-empty">No phone</span>
        )}
        <span>{f.distance_mi.toFixed(1)} mi</span>
      </div>
      {f.note ? <p className="sky-medical-fac__note">{f.note}</p> : null}
      <div className="sky-medical-fac__actions">
        <button type="button" onClick={onNotes}>
          {f.note ? "Edit notes" : "Add notes"}
        </button>
        <div className="sky-medical-seg" role="group" aria-label="Call result">
          {(
            [
              ["pending", "Pending"],
              ["with_record", "Record"],
              ["chart_only", "Chart"],
              ["no_record", "None"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={f.status === id ? "on" : ""}
              aria-pressed={f.status === id}
              onClick={() => onStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function SkyMedicalFile({
  subjectName,
  leaving,
  caseId,
  data: dataProp,
}: {
  subjectName?: string;
  leaving: boolean;
  /** CRM case UUID — when set, wires search/notes/report to proti. */
  caseId?: string;
  data?: MedicalCanvassView;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [live, setLive] = useState<MedicalCanvassView | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "live" | "mock">("idle");
  const [loadMsg, setLoadMsg] = useState<string | null>(null);
  const data = live ?? dataProp ?? MOCK_MEDICAL;
  const liveMode = Boolean(caseId) && loadState === "live";

  const [stepOpen, setStepOpen] = useState<MedicalPipelineStep | null>(null);
  const [noteFac, setNoteFac] = useState<MedicalFacility | null>(null);
  const [notes, setNotes] = useState(data.notes);
  const [address, setAddress] = useState(data.address);
  const [radius, setRadius] = useState(data.radius_mi);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => [...data.types]);
  const [facilities, setFacilities] = useState(data.facilities);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState<"docx" | "pdf" | "share" | null>(null);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [midTab, setMidTab] = useState<"all" | "pending" | "results">("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const title = subjectName || data.subject.name;
  const where = [data.subject.city, data.subject.state].filter(Boolean).join(", ");
  const claimSlug = title.replace(/\s+/g, "_");

  const applyView = (view: MedicalCanvassView) => {
    setLive(view);
    setNotes(view.notes);
    setAddress(view.address);
    setRadius(view.radius_mi);
    setSelectedTypes([...view.types]);
    setFacilities(view.facilities);
  };

  useEffect(() => {
    if (!caseId || dataProp) {
      setLoadState(dataProp ? "live" : "mock");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    setLoadMsg(null);
    void protiApi
      .canvass(caseId)
      .then((view) => {
        if (cancelled) return;
        applyView(view);
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
              : "Could not load canvass from proti";
        setLoadMsg(`${msg} — showing sample board.`);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, dataProp]);

  const pipeline = useMemo(() => {
    if (!reportDone) return data.pipeline;
    return data.pipeline.map((step) =>
      step.id === "report"
        ? {
            ...step,
            status: "done" as const,
            detail: "DOCX / PDF ready",
            hits: [
              ...step.hits.filter((h) => !h.startsWith("Waiting")),
              liveMode
                ? `Generated canvass_report_${claimSlug}`
                : `Generated mock canvass_report_${claimSlug}.docx`,
            ],
          }
        : step,
    );
  }, [data.pipeline, reportDone, claimSlug, liveMode]);

  const dirty =
    address.trim() !== data.address.trim() ||
    radius !== data.radius_mi ||
    selectedTypes.length !== data.types.length ||
    selectedTypes.some((t) => !data.types.includes(t));

  /** Type chips filter the list; empty selection shows nothing until you turn some on. */
  const typed = useMemo(
    () => facilities.filter((f) => selectedTypes.includes(f.type)),
    [facilities, selectedTypes],
  );
  const results = useMemo(
    () => typed.filter((f) => f.status === "with_record" || f.status === "chart_only" || f.status === "no_record"),
    [typed],
  );
  const pending = useMemo(() => typed.filter((f) => f.status === "pending"), [typed]);
  const list = midTab === "pending" ? pending : midTab === "results" ? results : typed;

  const counts = useMemo(() => {
    let with_record = 0;
    let chart_only = 0;
    let no_record = 0;
    let pendingN = 0;
    for (const f of typed) {
      if (f.status === "with_record") with_record += 1;
      else if (f.status === "chart_only") chart_only += 1;
      else if (f.status === "no_record") no_record += 1;
      else if (f.status === "pending") pendingN += 1;
    }
    return { total: typed.length, with_record, chart_only, no_record, pending: pendingN };
  }, [typed]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    setSearchMsg(null);
  };

  const persistStatus = async (facility: MedicalFacility, status: MedicalFacilityStatus, note?: string) => {
    setFacilities((prev) =>
      prev.map((f) => (f.id === facility.id ? { ...f, status, note: note ?? f.note } : f)),
    );
    if (!liveMode || !caseId) return;
    setSavingId(facility.id);
    try {
      await protiApi.saveCanvassResult(caseId, {
        facility_id: facility.id,
        status,
        notes: note ?? facility.note,
        facility: {
          name: facility.name,
          address: facility.address,
          phone: facility.phone,
          type: facility.type,
          distance_mi: facility.distance_mi,
        },
      });
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "Failed to save facility result");
    } finally {
      setSavingId(null);
    }
  };

  const runReport = (kind: "docx" | "pdf" | "share") => {
    if (counts.with_record + counts.chart_only === 0) {
      setReportMsg("Mark at least one with_record / chart_only before generating.");
      return;
    }
    setReporting(kind);
    setReportMsg(null);
    if (!liveMode || !caseId) {
      window.setTimeout(() => {
        setReporting(null);
        setReportDone(true);
        if (kind === "docx") {
          setReportMsg(`Would POST canvass-report-docx → download canvass_report_${claimSlug}.docx`);
        } else if (kind === "pdf") {
          setReportMsg(`Would POST canvass-report-pdf → download canvass_report_${claimSlug}.pdf`);
        } else {
          setReportMsg("Would POST canvass-report-save-to-share → W:\\…\\MEDICAL CANVASS");
        }
      }, 700);
      return;
    }
    void protiApi
      .reportCanvass(caseId, kind)
      .then((result) => {
        setReporting(null);
        setReportDone(true);
        if (result.kind === "share") {
          setReportMsg("Saved to MEDICAL CANVASS share via proti.");
          return;
        }
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        setReportMsg(`Downloaded ${result.filename}`);
      })
      .catch((err: unknown) => {
        setReporting(null);
        setReportMsg(err instanceof Error ? err.message : "Report failed");
      });
  };

  const runGoogleSearch = () => {
    if (!address.trim()) {
      setSearchMsg("Set an address first.");
      return;
    }
    if (selectedTypes.length === 0) {
      setSearchMsg("Pick at least one facility type.");
      return;
    }
    setSearching(true);
    setSearchMsg(null);
    if (!liveMode || !caseId) {
      window.setTimeout(() => {
        setFacilities(data.facilities);
        setSearching(false);
        setSearchMsg(
          `Would call Google Places Nearby (${selectedTypes.length} types · ${radius} mi driving) for “${address.trim()}”. Mock keeps ${data.facilities.length} facilities.`,
        );
      }, 650);
      return;
    }
    void protiApi
      .searchCanvass(caseId, { address: address.trim(), types: selectedTypes, radius_mi: radius })
      .then((view) => {
        applyView(view);
        setSearching(false);
        setSearchMsg(`Loaded ${view.facilities.length} facilities from proti (${view.address}).`);
      })
      .catch((err: unknown) => {
        setSearching(false);
        setSearchMsg(err instanceof Error ? err.message : "Facility search failed");
      });
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
      root.style.setProperty("--sky-wheel-h", `${Math.max(200, Math.min(gap, room))}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section ref={rootRef} className="sky-file sky-osint sky-medical" aria-label="Medical Canvass">
        <div className="g id sky-file-card">
          <p className="occ">Medical Canvass</p>
          <h2 className="sky-file-title">{title}</h2>
          <p className="client">
            <span>{where || "—"}</span>
            <span className="cap d">Inv #{data.investigation_id}</span>
            {loadState === "loading" && <span className="cap d">Loading proti…</span>}
            {loadState === "live" && <span className="cap d">Live</span>}
            {loadState === "mock" && caseId && <span className="cap d">Sample</span>}
            {savingId && <span className="cap d">Saving…</span>}
          </p>
          {loadMsg ? <p className="sky-osint-load-msg">{loadMsg}</p> : null}

          <div className="sky-osint-steps" aria-label="Canvass pipeline">
            {pipeline.map((step) => (
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
              <div className="sec">Search center</div>
              <label className="sky-medical-field">
                <span>Address</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setSearchMsg(null);
                  }}
                  placeholder="Street, city, state…"
                />
              </label>
              <label className="sky-medical-field sky-medical-field--row">
                <span>Radius (driving mi)</span>
                <div className="sky-medical-radius">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    step={1}
                    value={radius}
                    onChange={(e) => {
                      setRadius(Number(e.target.value));
                      setSearchMsg(null);
                    }}
                  />
                  <b>{radius} mi</b>
                </div>
              </label>
              <p className="sum">
                Default 30 mi (Prodigy). Change address/types, then Search — Places call is explicit.
              </p>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-search"
                disabled={searching}
                onClick={runGoogleSearch}
              >
                {searching ? "Searching Places…" : dirty ? "Search Google Places" : "Re-search Google Places"}
              </button>
              {searchMsg && <p className="sum sky-medical-searchmsg">{searchMsg}</p>}
            </div>

            <div className="fact sky-medical-counts">
              <div className="sec">Counts (filtered)</div>
              <div className="pl">
                <span className="k">Shown</span>
                <span className="t">{counts.total}</span>
              </div>
              <div className="pl">
                <span className="k">With record</span>
                <span className="t" style={{ color: STATUS_COLOR.with_record }}>
                  {counts.with_record}
                </span>
              </div>
              <div className="pl">
                <span className="k">Pending calls</span>
                <span className="t">{counts.pending}</span>
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
                Facilities
                <span>{typed.length}</span>
              </button>
              <button type="button" className={midTab === "pending" ? "on" : ""} onClick={() => setMidTab("pending")}>
                To call
                <span>{pending.length}</span>
              </button>
              <button type="button" className={midTab === "results" ? "on" : ""} onClick={() => setMidTab("results")}>
                Marked
                <span>{results.length}</span>
              </button>
            </div>

            {selectedTypes.length === 0 ? (
              <p className="sum sky-empty">Turn on facility type chips to filter the list.</p>
            ) : list.length === 0 ? (
              <p className="sum sky-empty">No facilities for the selected types / tab.</p>
            ) : (
              <div className="sky-medical-faclist">
                {list.map((f) => (
                  <FacilityCard
                    key={f.id}
                    f={f}
                    onNotes={() => setNoteFac(f)}
                    onStatus={(status) => void persistStatus(f, status)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sky-file-rail">
          <div className="g idl">
            <div className="sec">Facility types · filters</div>
            <p className="sum" style={{ marginBottom: 8 }}>
              Toggle = filter list + types sent on Search.
            </p>
            <div className="sky-medical-chips">
              {FACILITY_TYPE_OPTIONS.map((t) => {
                const on = selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={on ? "sky-medical-chip on" : "sky-medical-chip"}
                    aria-pressed={on}
                    onClick={() => toggleType(t.id)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="g idl">
            <div className="sec">Map</div>
            <MedicalCanvassMap center={data.center} radiusMi={radius} facilities={typed} />
          </div>

          <div className="g idl">
            <div className="sec">Report</div>
            <div className="sky-medical-report-actions">
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-search"
                disabled={reporting !== null}
                onClick={() => runReport("docx")}
              >
                {reporting === "docx" ? "Generating…" : "Generate DOCX"}
              </button>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-report-sec"
                disabled={reporting !== null}
                onClick={() => runReport("pdf")}
              >
                {reporting === "pdf" ? "Generating…" : "Generate PDF"}
              </button>
              <button
                type="button"
                className="sky-osint-linkbtn sky-medical-report-sec"
                disabled={reporting !== null}
                onClick={() => runReport("share")}
              >
                {reporting === "share" ? "Saving…" : "Save to share"}
              </button>
            </div>
            {reportDone && (
              <div className="pl" style={{ marginTop: 8 }}>
                <span className="k">Status</span>
                <span className="t" style={{ color: STATUS_COLOR.with_record }}>
                  Ready
                </span>
              </div>
            )}
            {reportMsg && <p className="sum sky-medical-searchmsg">{reportMsg}</p>}
          </div>
        </div>
      </section>

      {stepOpen && (
        <OsintStepModal step={stepOpen} eyebrow="Canvass step" onClose={() => setStepOpen(null)} />
      )}
      {noteFac && (
        <MedicalNoteModal
          facility={noteFac}
          onClose={() => setNoteFac(null)}
          onSave={(note) => {
            void persistStatus(noteFac, noteFac.status, note);
            setNoteFac(null);
          }}
        />
      )}
    </>
  );
}
