import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SERVICE_LABELS } from "@/lib/mock-data";
import {
  ApiError,
  casesApi,
  clientsApi,
  REGION_LABELS,
  type CaseClient,
  type CasePriority,
  type CaseService,
  type Region,
} from "@/lib/crm-api";
import "@/components/cases/sky-v6.css";

const SERVICES = Object.entries(SERVICE_LABELS) as [CaseService, string][];
const REGIONS = Object.entries(REGION_LABELS) as [Region, string][];

const STEPS = [
  { id: "subject", label: "Subject", title: "Who is this about?", hint: "The name is enough to open a case. Birth date and job can wait.", color: "#3ee08a" },
  { id: "claim", label: "Claim", title: "What kind of case is it?", hint: "Type and priority first. Claim, client, and adjuster if you have them.", color: "#ffc857" },
  { id: "place", label: "Place", title: "Where do they live?", hint: "Home address. Region is Texas, California, or Tri-State.", color: "#5aa9ff" },
  { id: "when", label: "Timing", title: "When does it need to happen?", hint: "Due date, how many days, and the exam if one is set.", color: "#b18cff" },
  { id: "review", label: "Review", title: "Open this case?", hint: "Tap a line to change it.", color: "#ff9f45" },
] as const;

const REVIEW_STEP: Record<string, number> = {
  Subject: 0,
  Born: 0,
  Work: 0,
  Type: 1,
  Priority: 1,
  Claim: 1,
  Client: 1,
  Adjuster: 1,
  Address: 2,
  Region: 2,
  Due: 3,
  IME: 3,
  Days: 3,
};

export default function NewCase() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<CaseClient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [subjectDob, setSubjectDob] = useState("");
  const [subjectJobTitle, setSubjectJobTitle] = useState("");
  const [service, setService] = useState<CaseService>("SURV");
  const [priority, setPriority] = useState<CasePriority>("standard");
  const [claimNumber, setClaimNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [adjusterName, setAdjusterName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zip, setZip] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [dueDate, setDueDate] = useState("");
  const [imeAt, setImeAt] = useState("");
  const [daysAllotted, setDaysAllotted] = useState("");

  useEffect(() => {
    clientsApi.list().then((res) => setClients(res.clients)).catch(() => {});
  }, []);

  const current = STEPS[step];
  const nameMissing = !subjectName.trim();

  const goNext = () => {
    if (step === 0 && nameMissing) {
      setError("A subject name is required.");
      return;
    }
    setError(null);
    setStep((n) => Math.min(STEPS.length - 1, n + 1));
  };

  const goBack = () => {
    setError(null);
    if (step === 0) navigate("/cases");
    else setStep((n) => n - 1);
  };

  const create = async () => {
    if (nameMissing) {
      setStep(0);
      setError("A subject name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let finalClientId: string | null = clientId || null;
      if (clientId === "__new__" && newClientName.trim()) {
        const { client } = await clientsApi.create({ company: newClientName.trim() });
        finalClientId = client.id;
      }
      const { case: created } = await casesApi.create({
        subjectName: subjectName.trim(),
        subjectDob: subjectDob || undefined,
        subjectJobTitle: subjectJobTitle.trim() || undefined,
        service,
        priority,
        claimNumber: claimNumber.trim() || undefined,
        clientId: finalClientId,
        adjusterName: adjusterName.trim() || undefined,
        region: region || undefined,
        state: addressState.trim() || undefined,
        dueDate: dueDate || undefined,
        imeAt: imeAt ? new Date(imeAt).toISOString() : undefined,
        daysAllotted: daysAllotted ? Number(daysAllotted) : undefined,
        address: line1.trim()
          ? {
              line1: line1.trim(),
              city: city.trim() || undefined,
              state: addressState.trim() || undefined,
              zip: zip.trim() || undefined,
            }
          : undefined,
      });
      navigate(`/cases/${created.id}/skyview`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the case.");
      setBusy(false);
    }
  };

  const clientLabel =
    clientId === "__new__"
      ? newClientName.trim() || "New client"
      : clients.find((client) => client.id === clientId)?.company;

  const review: { label: string; value: string }[] = [
    { label: "Subject", value: subjectName.trim() },
    { label: "Born", value: subjectDob },
    { label: "Work", value: subjectJobTitle.trim() },
    { label: "Type", value: SERVICE_LABELS[service] },
    { label: "Priority", value: priority === "rush" ? "Rush" : "Standard" },
    { label: "Claim", value: claimNumber.trim() },
    { label: "Client", value: clientLabel ?? "" },
    { label: "Adjuster", value: adjusterName.trim() },
    { label: "Address", value: [line1, city, addressState, zip].map((part) => part.trim()).filter(Boolean).join(", ") },
    { label: "Region", value: region ? REGION_LABELS[region] : "" },
    { label: "Due", value: dueDate },
    { label: "IME", value: imeAt ? imeAt.replace("T", " ") : "" },
    { label: "Days", value: daysAllotted },
  ].filter((row) => row.value);

  return (
    <div className="sky-v6">
      <div className="scene" aria-hidden>
        <div className="scene-fill">
          <div className="sky">
            <div className="orb o1" />
            <div className="orb o2" />
            <div className="orb o3" />
          </div>
          <div className="scrim" />
          <div className="grain" />
        </div>
      </div>

      <form
        className="page guide"
        onSubmit={(event) => {
          event.preventDefault();
          if (step === STEPS.length - 1) void create();
          else goNext();
        }}
      >
        <div className="guide-steps" role="tablist" aria-label="Case steps">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === step}
              className={index === step ? "on" : index < step ? "done" : ""}
              style={{ ["--seg" as string]: item.color }}
              onClick={() => {
                if (index > 0 && nameMissing) {
                  setError("A subject name is required.");
                  return;
                }
                setError(null);
                setStep(index);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="g guide-card" style={{ ["--seg" as string]: current.color }}>
          <p className="guide-kicker" style={{ color: current.color }}>
            Step {step + 1} of {STEPS.length}
          </p>
          <h1>{current.title}</h1>
          <p className="guide-hint">{current.hint}</p>

          {error && <p className="guide-error">{error}</p>}

          {current.id === "subject" && (
            <div className="guide-fields">
              <label>
                Subject name
                <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Full name" autoFocus />
              </label>
              <div className="guide-split">
                <label>
                  Date of birth
                  <input type="date" value={subjectDob} onChange={(e) => setSubjectDob(e.target.value)} />
                </label>
                <label>
                  Job
                  <input value={subjectJobTitle} onChange={(e) => setSubjectJobTitle(e.target.value)} placeholder="What they do" />
                </label>
              </div>
            </div>
          )}

          {current.id === "claim" && (
            <div className="guide-fields">
              <div className="guide-block">
                <span>Type</span>
                <div className="choices">
                  {SERVICES.map(([value, label]) => (
                    <button key={value} type="button" className={service === value ? "on" : ""} onClick={() => setService(value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="guide-block">
                <span>Priority</span>
                <div className="choices">
                  <button type="button" className={priority === "standard" ? "on" : ""} onClick={() => setPriority("standard")}>
                    Standard
                  </button>
                  <button type="button" className={priority === "rush" ? "on hot" : ""} onClick={() => setPriority("rush")}>
                    Rush
                  </button>
                </div>
              </div>
              <label>
                Claim number
                <input value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} placeholder="Claim or file number" />
              </label>
              <div className="guide-block">
                <span>Client</span>
                <div className="choices" role="listbox" aria-label="Client">
                  <button type="button" role="option" aria-selected={clientId === ""} className={clientId === "" ? "on" : ""} onClick={() => setClientId("")}>
                    None
                  </button>
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      role="option"
                      aria-selected={clientId === client.id}
                      className={clientId === client.id ? "on" : ""}
                      onClick={() => setClientId(client.id)}
                    >
                      {client.company}
                    </button>
                  ))}
                  <button type="button" role="option" aria-selected={clientId === "__new__"} className={clientId === "__new__" ? "on" : ""} onClick={() => setClientId("__new__")}>
                    New client…
                  </button>
                </div>
              </div>
              {clientId === "__new__" && (
                <label>
                  New client
                  <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Company name" autoFocus />
                </label>
              )}
              <label>
                Adjuster
                <input value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Adjuster name" />
              </label>
            </div>
          )}

          {current.id === "place" && (
            <div className="guide-fields">
              <label>
                Street
                <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" />
              </label>
              <div className="guide-split place">
                <label>
                  City
                  <input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label>
                  State
                  <input value={addressState} maxLength={2} onChange={(e) => setAddressState(e.target.value.toUpperCase())} placeholder="NJ" />
                </label>
                <label>
                  ZIP
                  <input value={zip} onChange={(e) => setZip(e.target.value)} />
                </label>
              </div>
              <div className="guide-block">
                <span>Region</span>
                <div className="choices">
                  {REGIONS.map(([value, label]) => (
                    <button key={value} type="button" className={region === value ? "on" : ""} onClick={() => setRegion(region === value ? "" : value)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {current.id === "when" && (
            <div className="guide-fields">
              <div className="guide-split">
                <label>
                  Due date
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
                <label>
                  Days allotted
                  <input type="number" min={0} value={daysAllotted} onChange={(e) => setDaysAllotted(e.target.value)} />
                </label>
              </div>
              <label>
                Independent medical exam
                <input type="datetime-local" value={imeAt} onChange={(e) => setImeAt(e.target.value)} />
              </label>
            </div>
          )}

          {current.id === "review" && (
            <div className="review">
              {review.map((row) => (
                <button
                  key={row.label}
                  type="button"
                  className="review-line"
                  onClick={() => {
                    setError(null);
                    setStep(REVIEW_STEP[row.label] ?? 0);
                  }}
                >
                  <span>{row.label}</span>
                  <b>{row.value}</b>
                </button>
              ))}
            </div>
          )}

          <div className="guide-nav">
            <button type="button" className="btn" onClick={goBack}>
              {step === 0 ? "Cancel" : "Back"}
            </button>
            {step < STEPS.length - 1 ? (
              <button type="submit" className="btn next">Next</button>
            ) : (
              <button type="submit" className="btn next" disabled={busy}>
                {busy ? "Opening…" : "Open case"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
