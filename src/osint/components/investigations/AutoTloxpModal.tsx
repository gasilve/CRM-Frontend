// @ts-nocheck
import { useState } from "react";
import { Check, X, Loader2, Search, AlertTriangle, Zap, HelpCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const THRESHOLD = 60;

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <HelpCircle className="h-3 w-3 text-slate-400 hover:text-slate-600 cursor-help" />
      {show && (
        <span className="absolute left-5 top-0 z-50 w-56 rounded-lg bg-slate-800 text-white text-[11px] leading-relaxed px-3 py-2 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

// ── Search type config ────────────────────────────────────────────────────────
const SEARCH_TYPES = [
  {
    id: "comp",
    label: "Comp Profile",
    icon: "👤",
    required: true,
    tooltip: "Perfil completo del sujeto: nombre, DOB, SSN, aliases, addresses, relatives, emails, DL, bankruptcies, judgments, employers, vehículos y propiedades.",
    color: "blue",
  },
  {
    id: "vehicles",
    label: "Vehicles & Properties",
    icon: "🚗",
    required: false,
    tooltip: "Vehículos registrados a nombre del sujeto (make, model, year, plate, VIN) y propiedades actuales e históricas.",
    color: "indigo",
  },
  {
    id: "criminal",
    label: "Criminal & Incarceration",
    icon: "⚖️",
    required: false,
    tooltip: "Registros criminales históricos + arrestos e incarcelaciones en tiempo real desde bases de datos estatales y federales.",
    color: "red",
  },
  {
    id: "employers",
    label: "Employers & Businesses",
    icon: "🏢",
    required: false,
    tooltip: "Empleadores actuales e históricos, ocupación, y afiliaciones corporativas (owner, officer, agent).",
    color: "amber",
  },
  {
    id: "phones",
    label: "Reverse Phone",
    icon: "📞",
    required: false,
    tooltip: "Verifica y enriquece cada teléfono del perfil — confirma carrier, tipo (celular/línea fija) y personas históricamente asociadas al número.",
    color: "green",
  },
  {
    id: "sightings",
    label: "Vehicle Sightings (LPR)",
    icon: "📷",
    required: false,
    tooltip: "Sightings de cámaras LPR para una placa específica — cuándo y dónde se vio el vehículo. Requiere placa conocida.",
    color: "purple",
  },
] as const;

type SearchTypeId = typeof SEARCH_TYPES[number]["id"];

// ── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, selected, onToggle, color, badge }: {
  label: string; selected: boolean; onToggle: () => void; color: string; badge?: string;
}) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-200 text-blue-800",
    green:  "bg-green-50 border-green-200 text-green-800",
    pink:   "bg-pink-50 border-pink-200 text-pink-800",
    amber:  "bg-amber-50 border-amber-200 text-amber-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };
  return (
    <button onClick={onToggle}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono transition-all
        ${selected ? `${colors[color]} ring-2 ring-offset-1 ring-current` : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"}`}>
      {selected ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      {label}
      {badge && <span className="text-[10px] opacity-70">{badge}</span>}
    </button>
  );
}

// ── Search Type Toggle Card ───────────────────────────────────────────────────
function SearchTypeCard({
  type, selected, onToggle, loading, done, error
}: {
  type: typeof SEARCH_TYPES[number];
  selected: boolean;
  onToggle: () => void;
  loading: boolean;
  done: boolean;
  error?: string;
}) {
  const colorMap: Record<string, string> = {
    blue:   "border-blue-300 bg-blue-50",
    indigo: "border-indigo-300 bg-indigo-50",
    red:    "border-red-300 bg-red-50",
    amber:  "border-amber-300 bg-amber-50",
    green:  "border-green-300 bg-green-50",
    purple: "border-purple-300 bg-purple-50",
  };

  return (
    <div
      onClick={type.required ? undefined : onToggle}
      className={`relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all
        ${type.required
          ? `${colorMap[type.color]} cursor-default opacity-100`
          : selected
            ? `${colorMap[type.color]} cursor-pointer`
            : "border-slate-200 bg-white cursor-pointer hover:border-slate-300 hover:bg-slate-50"
        }`}>
      {/* Checkbox */}
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
        ${type.required
          ? "border-blue-400 bg-blue-400"
          : selected
            ? "border-orange-400 bg-orange-400"
            : "border-slate-300 bg-white"}`}>
        {(type.required || selected) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>

      {/* Icon + Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{type.icon}</span>
          <span className="text-sm font-semibold text-slate-800">{type.label}</span>
          {type.required && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-wide">required</span>
          )}
          <Tooltip text={type.tooltip} />
        </div>
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
        {done && !loading && <Check className="h-4 w-4 text-emerald-500" />}
        {error && !loading && <AlertTriangle className="h-4 w-4 text-red-400" />}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AutoTloxpModal({
  invSubjectName,
  invSubjectDob,
  invSubjectState,
  onImport,
  onClose,
}: {
  invSubjectName?: string;
  invSubjectDob?: string;
  invSubjectState?: string;
  onImport: (data: any) => void;
  onClose: () => void;
}) {
  const base = "/api-proxy";

  // ── Form state ──
  const nameParts = (invSubjectName || "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts.length >= 2 ? nameParts[0] : "");
  const [lastName,  setLastName]  = useState(nameParts.length >= 2 ? nameParts[nameParts.length - 1] : "");
  const [dobYear,   setDobYear]   = useState(() => {
    if (invSubjectDob) { const p = invSubjectDob.split("/"); return p[p.length - 1] || ""; }
    return "";
  });
  const [state,  setState]  = useState(invSubjectState || "");
  const [ssn,    setSsn]    = useState("");
  const [plate,  setPlate]  = useState("");
  const [env,    setEnv]    = useState<"demo" | "dev" | "prod">("dev");

  // ── Search type selection (comp always on) ──
  const [selected, setSelected] = useState<Set<SearchTypeId>>(new Set(["comp"]));
  const toggleType = (id: SearchTypeId) => {
    if (id === "comp") return;
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      // if sightings selected and no plate, show plate field
      return n;
    });
  };

  // ── App state ──
  const [step,       setStep]       = useState<"config" | "searching" | "results">("config");
  const [loadingIds, setLoadingIds] = useState<Set<SearchTypeId>>(new Set());
  const [doneIds,    setDoneIds]    = useState<Set<SearchTypeId>>(new Set());
  const [errorMap,   setErrorMap]   = useState<Record<string, string>>({});
  const [result,     setResult]     = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Selection state (for import) ──
  const [selPhones,    setSelPhones]    = useState<Set<string>>(new Set());
  const [selEmails,    setSelEmails]    = useState<Set<string>>(new Set());
  const [selRelatives, setSelRelatives] = useState<Set<string>>(new Set());
  const [selAddresses, setSelAddresses] = useState<Set<string>>(new Set());

  // ── Fetch helper ──
  const callApi = async (endpoint: string, body: object) => {
    const res  = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, env }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
    return json;
  };

  // ── Run search ──
  const handleSearch = async (reportToken?: string) => {
    setError(null);
    setStep("searching");

    const searchBody = reportToken
      ? { report_token: reportToken }
      : {
          first_name: firstName.trim() || undefined,
          last_name:  lastName.trim()  || undefined,
          dob_year:   dobYear.trim()   || undefined,
          state:      state.trim()     || undefined,
          ssn:        ssn.trim()       || undefined,
        };

    try {
      // Step 1: Comp Profile (always runs first)
      setLoadingIds(new Set(["comp"]));
      // Use comp-fetch when additional sections are selected
      const useComp = selected.has("vehicles") || selected.has("criminal") ||
                      selected.has("employers");
      const endpoint = useComp ? "/api/tloxp/comp-fetch" : "/api/tloxp/auto-fetch";
      const compBody: any = { ...searchBody };
      if (useComp) {
        compBody.show_vehicles    = selected.has("vehicles");
        compBody.show_criminal    = selected.has("criminal");
        compBody.show_employers   = selected.has("employers");
        compBody.show_properties  = selected.has("vehicles");
        compBody.show_associates  = true;
        compBody.show_bankruptcies= true;
        compBody.show_corporate   = selected.has("employers");
        compBody.show_judgments   = true;
        compBody.relative_levels  = 1;
      }
      const compRes = await callApi(endpoint, compBody);

      if (compRes.step === "candidates") {
        setCandidates(compRes.candidates);
        setStep("config");
        setLoadingIds(new Set());
        return;
      }

      const data = compRes.data;
      setDoneIds(new Set(["comp"]));
      setLoadingIds(new Set());

      // Auto-select above threshold
      setSelPhones(new Set(data.raw_phones?.filter((p: any) => p.confidence >= THRESHOLD).map((p: any) => p.phone)));
      setSelEmails(new Set(data.raw_emails?.filter((e: any) => e.confidence >= THRESHOLD).map((e: any) => e.email)));
      setSelAddresses(new Set(data.raw_addresses?.map((a: any) => a.address)));
      setSelRelatives(new Set(data.subject_relatives?.map((r: any) => r.name)));

      setResult(data);
      setStep("results");

    } catch (e: any) {
      setError(e.message || "Search failed");
      setStep("config");
      setLoadingIds(new Set());
    }
  };

  // ── Import ──
  const handleImport = () => {
    if (!result) return;
    const out: any = {};
    if (result.subject_name)      out.subject_name      = result.subject_name;
    if (result.subject_dob)       out.subject_dob       = result.subject_dob;
    if (result.subject_ssn_last4) out.subject_ssn_last4 = result.subject_ssn_last4;
    if (result.subject_ssn)       out.subject_ssn       = result.subject_ssn;
    if (result.subject_gender)    out.subject_gender     = result.subject_gender;
    if (result.primary_address)   out.primary_address    = result.primary_address;
    if (result.subject_aliases?.length)   out.subject_aliases   = result.subject_aliases;
    if (result.subject_usernames?.length) out.subject_usernames = result.subject_usernames;
    if (result.subject_locations?.length) out.subject_locations = result.subject_locations;
    if (result.subject_counties?.length)  out.subject_counties  = result.subject_counties;
    if (selPhones.size)    out.subject_phones    = [...selPhones];
    if (selEmails.size)    out.subject_emails    = [...selEmails];
    if (selRelatives.size) out.subject_relatives = result.subject_relatives?.filter((r: any) => selRelatives.has(r.name));
    out.raw_phones = result.raw_phones;
    out.raw_emails = result.raw_emails;
    const selAddrList = result.raw_addresses?.filter((a: any) => selAddresses.has(a.address)).map((a: any) => a.address);
    if (selAddrList?.length) out.subject_addresses = selAddrList;
    const notes: string[] = [];
    if (result.tlo_drivers_licenses?.length)
      notes.push(`DL: ${result.tlo_drivers_licenses.map((dl: any) => `${dl.state} ${dl.number || "xxxxx"}`).join(", ")}`);
    if (result.tlo_bankruptcies) notes.push(`Bankruptcies: ${result.tlo_bankruptcies}`);
    if (result.tlo_judgments)    notes.push(`Judgments: ${result.tlo_judgments}`);
    if (notes.length) out.subject_notes = notes.join(" · ");
    if (result.tlo_employers?.length)
      out.subject_employers = result.tlo_employers.map((e:any) => e.name).filter(Boolean);
    if (result.tlo_vehicles?.length)      out.tlo_vehicles         = result.tlo_vehicles;
    if (result.tlo_criminal_records?.length) out.tlo_criminal_records = result.tlo_criminal_records;
    if (result.tlo_corporate_filings?.length) out.tlo_corporate_filings = result.tlo_corporate_filings;
    onImport(out);
    onClose();
  };

  const reset = () => {
    setStep("config"); setResult(null); setCandidates(null);
    setError(null); setDoneIds(new Set()); setErrorMap({});
  };

  // ── Render: Config step ───────────────────────────────────────────────────
  const renderConfig = () => (
    <div className="space-y-4">
      {/* Search form */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">First Name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">DOB Year</label>
            <input value={dobYear} onChange={e => setDobYear(e.target.value)} placeholder="1985"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">State</label>
            <input value={state} onChange={e => setState(e.target.value.toUpperCase())} placeholder="CA" maxLength={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SSN (opcional)</label>
            <input value={ssn} onChange={e => setSsn(e.target.value)} placeholder="XXX-XX-XXXX" type="password"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Select searches to run</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Search type cards */}
      <div className="space-y-2">
        {SEARCH_TYPES.map(type => (
          <SearchTypeCard
            key={type.id}
            type={type}
            selected={selected.has(type.id)}
            onToggle={() => toggleType(type.id)}
            loading={loadingIds.has(type.id)}
            done={doneIds.has(type.id)}
            error={errorMap[type.id]}
          />
        ))}
      </div>

      {/* Plate field if sightings selected */}
      {selected.has("sightings") && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
          <label className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">License Plate (required for LPR)</label>
          <input value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="7ABC123"
            className="mt-1 w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}
        </div>
      )}
    </div>
  );

  // ── Render: Searching step ────────────────────────────────────────────────
  const renderSearching = () => (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Running searches...</p>
      {SEARCH_TYPES.filter(t => selected.has(t.id)).map(type => (
        <SearchTypeCard
          key={type.id}
          type={type}
          selected={true}
          onToggle={() => {}}
          loading={loadingIds.has(type.id)}
          done={doneIds.has(type.id)}
          error={errorMap[type.id]}
        />
      ))}
    </div>
  );

  // ── Render: Candidates ────────────────────────────────────────────────────
  const renderCandidates = () => (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {candidates!.length} candidate{candidates!.length !== 1 ? "s" : ""} found — select one to load profile
      </p>
      {candidates!.map((c, i) => (
        <button key={i} onClick={() => { setCandidates(null); handleSearch(c.report_token); }}
          className="w-full text-left rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50 px-4 py-3 transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{c.name || "Unknown"}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {[c.dob_year && `Born ${c.dob_year}`, c.age && `Age ${c.age}`, c.address].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-300">{c.report_token}</span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
            </div>
          </div>
        </button>
      ))}
      <button onClick={reset} className="text-xs text-blue-500 hover:underline">← Search again</button>
    </div>
  );

  // ── Render: Results ───────────────────────────────────────────────────────
  const renderResults = () => {
    if (!result) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm text-emerald-800 font-medium">Profile loaded — select fields to import</span>
        </div>

        {/* Name / DOB / SSN */}
        <div className="grid grid-cols-3 gap-3">
          {result.subject_name && (
            <div className="rounded-lg bg-slate-50 border px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Name</p>
              <p className="text-sm font-medium truncate">{result.subject_name}</p>
            </div>
          )}
          {result.subject_dob && (
            <div className="rounded-lg bg-slate-50 border px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">DOB</p>
              <p className="text-sm font-medium">{result.subject_dob}</p>
            </div>
          )}
          {result.subject_ssn_last4 && (
            <div className="rounded-lg bg-slate-50 border px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">SSN Last 4</p>
              <p className="text-sm font-medium font-mono">***-**-{result.subject_ssn_last4}</p>
            </div>
          )}
        </div>

        {/* Badges */}
        {(result.tlo_drivers_licenses?.length > 0 || result.tlo_bankruptcies > 0 || result.tlo_judgments > 0) && (
          <div className="flex flex-wrap gap-2">
            {result.tlo_drivers_licenses?.map((dl: any, i: number) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono">
                🪪 DL {dl.state} {dl.number || "•••••"}
              </span>
            ))}
            {result.tlo_bankruptcies > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
                ⚠️ {result.tlo_bankruptcies} Bankruptcy{result.tlo_bankruptcies > 1 ? "ies" : ""}
              </span>
            )}
            {result.tlo_judgments > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                ⚖️ {result.tlo_judgments} Judgment{result.tlo_judgments > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Aliases */}
        {result.subject_aliases?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Aliases</p>
            <div className="flex flex-wrap gap-1.5">
              {result.subject_aliases.map((a: string, i: number) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full border bg-purple-50 border-purple-200 text-purple-800">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Phones */}
        {result.raw_phones?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Phones</p>
              <div className="flex gap-2 text-[10px] text-slate-400">
                <button className="hover:text-blue-600" onClick={() => setSelPhones(new Set(result.raw_phones.map((p: any) => p.phone)))}>All</button>
                <span>·</span>
                <button className="hover:text-red-500" onClick={() => setSelPhones(new Set())}>None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.raw_phones.map((p: any, i: number) => (
                <Pill key={i} label={p.phone} badge={`${p.confidence}%`} selected={selPhones.has(p.phone)} color="blue"
                  onToggle={() => setSelPhones(prev => { const n = new Set(prev); n.has(p.phone) ? n.delete(p.phone) : n.add(p.phone); return n; })} />
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{selPhones.size} of {result.raw_phones.length} · ≥{THRESHOLD}% auto-selected</p>
          </div>
        )}

        {/* Emails */}
        {result.raw_emails?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Emails</p>
              <div className="flex gap-2 text-[10px] text-slate-400">
                <button className="hover:text-green-600" onClick={() => setSelEmails(new Set(result.raw_emails.map((e: any) => e.email)))}>All</button>
                <span>·</span>
                <button className="hover:text-red-500" onClick={() => setSelEmails(new Set())}>None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.raw_emails.map((e: any, i: number) => (
                <Pill key={i} label={e.email} badge={`${e.confidence}%`} selected={selEmails.has(e.email)} color="green"
                  onToggle={() => setSelEmails(prev => { const n = new Set(prev); n.has(e.email) ? n.delete(e.email) : n.add(e.email); return n; })} />
              ))}
            </div>
          </div>
        )}

        {/* Relatives */}
        {result.subject_relatives?.length > 0 && (
          <div className="rounded-lg border border-pink-200 bg-pink-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-pink-700 uppercase tracking-wider">👥 1st Degree Relatives</p>
              <div className="flex gap-2 text-[10px] text-pink-400">
                <button onClick={() => setSelRelatives(new Set(result.subject_relatives.map((r: any) => r.name)))}>All</button>
                <span>·</span>
                <button onClick={() => setSelRelatives(new Set())}>None</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.subject_relatives.map((r: any, i: number) => (
                <Pill key={i} label={r.name} badge={r.dob_year || undefined} selected={selRelatives.has(r.name)} color="pink"
                  onToggle={() => setSelRelatives(prev => { const n = new Set(prev); n.has(r.name) ? n.delete(r.name) : n.add(r.name); return n; })} />
              ))}
            </div>
          </div>
        )}

        {/* Addresses */}
        {result.raw_addresses?.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Addresses — most recent first</p>
              <div className="flex gap-2 text-[10px] text-slate-400">
                <button onClick={() => setSelAddresses(new Set(result.raw_addresses.map((a: any) => a.address)))}>All</button>
                <span>·</span>
                <button onClick={() => setSelAddresses(new Set())}>None</button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {result.raw_addresses.map((a: any, i: number) => {
                const sel = selAddresses.has(a.address);
                return (
                  <div key={i}
                    onClick={() => setSelAddresses(prev => { const n = new Set(prev); sel ? n.delete(a.address) : n.add(a.address); return n; })}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors"
                    style={{ background: sel ? "rgb(255 251 235)" : "white", borderColor: sel ? "rgb(251 191 36)" : "rgb(226 232 240)" }}>
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="text-xs font-mono text-slate-700 truncate block">{a.address}</span>
                      {a.county && <span className="text-[10px] text-slate-400">{a.county} County</span>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {a.date_label && <span className="text-[9px] text-slate-400">{a.date_label}</span>}
                      {i === 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200">PRIMARY</span>}
                      <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: sel ? "rgb(251 191 36)" : "rgb(203 213 225)" }}>
                        {sel && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vehicles */}
        {result.tlo_vehicles?.length > 0 && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">🚗 Vehicles ({result.tlo_vehicles.length})</p>
            <div className="flex flex-col gap-1.5">
              {result.tlo_vehicles.map((v:any,i:number)=>(
                <div key={i} className="flex items-center justify-between rounded-lg bg-white border border-indigo-100 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{v.make_model || "Unknown"}</p>
                    <p className="text-[10px] text-slate-400">{[v.color, v.plate && `${v.plate_state || ""} ${v.plate}`, v.vin && `VIN: ${v.vin}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 shrink-0">tloxp</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employers */}
        {result.tlo_employers?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">🏢 Employers ({result.tlo_employers.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {result.tlo_employers.map((e:any,i:number)=>(
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800">
                  {e.name}{e.year_last ? ` (${e.year_last})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Criminal */}
        {result.tlo_criminal_records?.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">⚖️ Criminal Records ({result.tlo_criminal_records.length})</p>
            <div className="flex flex-col gap-1.5">
              {result.tlo_criminal_records.map((cr:any,i:number)=>(
                <div key={i} className="rounded-lg bg-white border border-red-100 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-800">{cr.offense || "Unknown offense"}</p>
                  <p className="text-[10px] text-slate-400">{[cr.date, cr.county && `${cr.county} County`, cr.state, cr.disposition].filter(Boolean).join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Corporate Filings */}
        {result.tlo_corporate_filings?.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">🏛 Business Affiliations ({result.tlo_corporate_filings.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {result.tlo_corporate_filings.map((cf:any,i:number)=>(
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                  {cf.name}{cf.state ? ` · ${cf.state}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Data pulled live from TLOxp — review before running investigation.
        </div>

        <button onClick={reset} className="text-xs text-blue-500 hover:underline">← Search again</button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Auto TLOxp Lookup</h2>
              <p className="text-[11px] text-slate-500">Select searches to run — Comp Profile always included</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px]">
              {(["demo", "dev", "prod"] as const).map(e => (
                <button key={e} onClick={() => setEnv(e)}
                  className={`px-2.5 py-1 font-medium capitalize transition-colors ${env === e ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                  {e}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "config" && !candidates && renderConfig()}
          {step === "config" && candidates && renderCandidates()}
          {step === "searching" && renderSearching()}
          {step === "results" && renderResults()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-slate-50">
          <div className="text-[11px] text-slate-400">
            {step === "results" && result &&
              `${selPhones.size} phones · ${selEmails.size} emails · ${selRelatives.size} relatives · ${selAddresses.size} addresses`}
            {step === "config" && `${selected.size} search${selected.size !== 1 ? "es" : ""} selected`}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {step === "config" && !candidates && (
              <Button onClick={() => handleSearch()} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Search className="h-4 w-4" />
                Run {selected.size} Search{selected.size !== 1 ? "es" : ""}
              </Button>
            )}
            {step === "results" && result && (
              <Button onClick={handleImport} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                <Check className="h-4 w-4" />Import to Form
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
