// @ts-nocheck
import { useRef, useState } from "react";
import { Upload, Check, AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TloxpData {
  subject_name: string | null;
  subject_dob: string | null;
  subject_ssn_last4: string | null;
  subject_ssn: string | null;
  subject_gender: string | null;
  subject_aliases: string[];
  subject_phones: string[];
  subject_emails: string[];
  subject_usernames: string[];
  subject_addresses: string[];
  subject_locations: string[];
  subject_relatives: { name: string; relationship: string }[];
  subject_notes: string;
  raw_phones: { phone: string; confidence: number }[];
  raw_emails: { email: string; confidence: number }[];
  raw_addresses: { address: string; date_label: string; is_provided: boolean }[];
  primary_address: string | null;
}

interface TloxpResult {
  success: boolean;
  data: TloxpData;
  summary: {
    name: string | null;
    dob: string | null;
    gender: string | null;
    aliases_count: number;
    phones_above_threshold: number;
    phones_total: number;
    emails_above_threshold: number;
    emails_total: number;
    addresses_count: number;
    relatives_count: number;
  };
}

const THRESHOLD = 60;

const COLORS: Record<string, string> = {
  purple: "bg-purple-50 border-purple-200 text-purple-800",
  amber:  "bg-amber-50 border-amber-200 text-amber-800",
  slate:  "bg-slate-100 border-slate-200 text-slate-600",
  blue:   "bg-blue-50 border-blue-200 text-blue-800",
  pink:   "bg-pink-50 border-pink-200 text-pink-800",
  green:  "bg-green-50 border-green-200 text-green-800",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value}</p>
    </div>
  );
}

function TagField({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${COLORS[color] || COLORS.slate}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// Selectable pill — toggles on click
function SelectablePill({
  label, selected, onToggle, color, badge
}: {
  label: string; selected: boolean; onToggle: () => void;
  color: string; badge?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono transition-all
        ${selected
          ? `${COLORS[color]} ring-2 ring-offset-1 ring-current opacity-100`
          : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
        }`}
    >
      {selected
        ? <Check className="h-3 w-3 shrink-0" />
        : <X className="h-3 w-3 shrink-0" />
      }
      {label}
      {badge && <span className="text-[10px] opacity-70">{badge}</span>}
    </button>
  );
}

export function TloxpModal({
  onImport,
  onClose,
}: {
  onImport: (data: Partial<{
    subject_name: string;
    subject_dob: string;
    subject_ssn_last4: string;
    subject_gender: string;
    subject_aliases: string[];
    subject_phones: string[];
    subject_emails: string[];
    subject_usernames: string[];
    subject_addresses: string[];
    subject_locations: string[];
    subject_relatives: { name: string; relationship: string }[];
    primary_address: string;
    subject_notes: string;
  }>) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TloxpResult | null>(null);

  // Selection state — which items to import
  const [selPhones, setSelPhones] = useState<Set<string>>(new Set());
  const [selEmails, setSelEmails] = useState<Set<string>>(new Set());
  const [selRelatives, setSelRelatives] = useState<Set<string>>(new Set());
  const [selAddresses, setSelAddresses] = useState<Set<string>>(new Set());

  const togglePhone = (p: string) =>
    setSelPhones(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const toggleEmail = (e: string) =>
    setSelEmails(prev => { const n = new Set(prev); n.has(e) ? n.delete(e) : n.add(e); return n; });
  const toggleRelative = (name: string) =>
    setSelRelatives(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const base = "/api-proxy";
      const res = await fetch(`${base}/api/tloxp/parse`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data: TloxpResult = await res.json();
      setResult(data);

      // Pre-select phones and emails above threshold
      // Sort by confidence descending
      data.data.raw_phones.sort((a: any, b: any) => b.confidence - a.confidence);
      data.data.raw_emails.sort((a: any, b: any) => b.confidence - a.confidence);

      const autoPhones = new Set(data.data.raw_phones.filter((p: any) => p.confidence >= THRESHOLD).map((p: any) => p.phone));
      const autoEmails = new Set(data.data.raw_emails.filter((e: any) => e.confidence >= THRESHOLD).map((e: any) => e.email));
      const autoAddresses = new Set<string>((data.data.raw_addresses || []).map((a: any) => a.address));
      // Pre-select ALL 1st degree relatives
      const autoRel = new Set(data.data.subject_relatives.map(r => r.name));
      setSelPhones(autoPhones);
      setSelEmails(autoEmails);
      setSelAddresses(autoAddresses);
      setSelRelatives(autoRel);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".pdf")) processFile(file);
  };

  const handleConfirm = () => {
    if (!result) return;
    const d = result.data;
    const importData: Parameters<typeof onImport>[0] = {};
    if (d.subject_name)        importData.subject_name     = d.subject_name;
    if (d.subject_dob)         importData.subject_dob      = d.subject_dob;
    if (d.subject_ssn_last4)   importData.subject_ssn_last4 = d.subject_ssn_last4;
    if (d.subject_ssn)         importData.subject_ssn = d.subject_ssn;
    if (d.primary_address)     importData.primary_address   = d.primary_address;
    if (d.subject_gender)      importData.subject_gender   = d.subject_gender;
    if (d.subject_aliases.length) importData.subject_aliases = d.subject_aliases;
    if (selPhones.size)        importData.subject_phones   = [...selPhones];
    if (selEmails.size)        importData.subject_emails   = [...selEmails];
    // Pass raw confidence data for phones/emails
    if (d.raw_phones?.length)  (importData as any).raw_phones  = d.raw_phones;
    if (d.raw_emails?.length)  (importData as any).raw_emails  = d.raw_emails;
    if (d.subject_usernames.length) importData.subject_usernames = d.subject_usernames;
    // Export selected addresses in order (most recent first)
    const selAddrList = (d.raw_addresses || [])
      .filter((a: any) => selAddresses.has(a.address))
      .map((a: any) => a.address);
    if (selAddrList.length) importData.subject_addresses = selAddrList;
    else if (d.subject_addresses.length) importData.subject_addresses = d.subject_addresses;
    if (d.subject_locations.length) importData.subject_locations = d.subject_locations;
    if (selRelatives.size)     importData.subject_relatives = d.subject_relatives.filter(r => selRelatives.has(r.name));
    if (d.subject_notes)       importData.subject_notes    = d.subject_notes;
    onImport(importData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Import TLO/TLOXP Report</h2>
            <p className="text-[11px] text-slate-500">Select which fields to import — click items to include/exclude</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Drop zone */}
          {!result && (
            <div
              className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 cursor-pointer p-12 text-center transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-600">Parsing report...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-slate-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Drop your TLO PDF here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-800 font-medium">
                  Report parsed — click items below to include or exclude
                </span>
              </div>

              {/* Name / DOB / Gender */}
              <div className="grid grid-cols-3 gap-3">
                {result.data.subject_name && <Field label="Name" value={result.data.subject_name} />}
                {result.data.subject_dob && <Field label="Date of Birth" value={result.data.subject_dob} />}
                {result.data.subject_gender && <Field label="Gender" value={result.data.subject_gender} />}
              </div>

              {/* Aliases */}
              {result.data.subject_aliases.length > 0 && (
                <TagField label="Aliases / Other Names" items={result.data.subject_aliases} color="purple" />
              )}

              {/* ── PHONES — selectable ── */}
              {result.data.raw_phones.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Phones — click to include/exclude
                    </p>
                    <div className="flex gap-2 text-[10px] text-slate-400">
                      <button className="hover:text-blue-600" onClick={() =>
                        setSelPhones(new Set(result.data.raw_phones.map(p => p.phone)))
                      }>Select all</button>
                      <span>·</span>
                      <button className="hover:text-red-500" onClick={() => setSelPhones(new Set())}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.data.raw_phones.map((p, i) => (
                      <SelectablePill
                        key={i}
                        label={p.phone}
                        badge={`${p.confidence}%`}
                        selected={selPhones.has(p.phone)}
                        onToggle={() => togglePhone(p.phone)}
                        color="blue"
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selPhones.size} of {result.data.raw_phones.length} selected · ≥{THRESHOLD}% auto-selected
                  </p>
                </div>
              )}

              {/* ── EMAILS — selectable ── */}
              {result.data.raw_emails.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Emails — click to include/exclude
                    </p>
                    <div className="flex gap-2 text-[10px] text-slate-400">
                      <button className="hover:text-green-600" onClick={() =>
                        setSelEmails(new Set(result.data.raw_emails.map(e => e.email)))
                      }>Select all</button>
                      <span>·</span>
                      <button className="hover:text-red-500" onClick={() => setSelEmails(new Set())}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.data.raw_emails.map((e, i) => (
                      <SelectablePill
                        key={i}
                        label={e.email}
                        badge={`${e.confidence}%`}
                        selected={selEmails.has(e.email)}
                        onToggle={() => toggleEmail(e.email)}
                        color="green"
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selEmails.size} of {result.data.raw_emails.length} selected
                  </p>
                </div>
              )}

              {/* ── RELATIVES 1ST DEGREE — selectable ── */}
              {result.data.subject_relatives.length > 0 && (
                <div className="rounded-lg border border-pink-200 bg-pink-50/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-pink-700 uppercase tracking-wider flex items-center gap-1">
                      👥 1st Degree Relatives (from report)
                    </p>
                    <div className="flex gap-2 text-[10px] text-pink-400">
                      <button className="hover:text-pink-700" onClick={() =>
                        setSelRelatives(new Set(result.data.subject_relatives.map(r => r.name)))
                      }>Select all</button>
                      <span>·</span>
                      <button className="hover:text-red-500" onClick={() => setSelRelatives(new Set())}>
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.data.subject_relatives.map((r, i) => (
                      <SelectablePill
                        key={i}
                        label={r.name}
                        selected={selRelatives.has(r.name)}
                        onToggle={() => toggleRelative(r.name)}
                        color="pink"
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-pink-500">
                    {selRelatives.size} of {result.data.subject_relatives.length} selected — will be added to Relatives field
                  </p>
                </div>
              )}

              {/* Addresses — selectable, sorted most recent first */}
              {(result.data.raw_addresses?.length || result.data.subject_addresses.length) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Addresses — most recent first
                    </p>
                    <div className="flex gap-2 text-[10px] text-slate-400">
                      <button className="hover:text-amber-600" onClick={() =>
                        setSelAddresses(new Set((result.data.raw_addresses||[]).map(a => a.address)))
                      }>Select all</button>
                      <span>·</span>
                      <button className="hover:text-red-500" onClick={() => setSelAddresses(new Set())}>Clear</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(result.data.raw_addresses?.length
                      ? result.data.raw_addresses
                      : result.data.subject_addresses.map(a => ({address: a, date_label: "", is_provided: false}))
                    ).map((a, i) => {
                      const sel = selAddresses.has(a.address);
                      return (
                        <div key={i}
                          onClick={() => { const s = new Set(selAddresses); sel ? s.delete(a.address) : s.add(a.address); setSelAddresses(s); }}
                          className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors"
                          style={{ background: sel ? "rgb(255 251 235)" : "white", borderColor: sel ? "rgb(251 191 36)" : "rgb(226 232 240)" }}>
                          <span className="text-xs font-mono text-slate-700 truncate min-w-0 mr-2">{a.address}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {a.is_provided && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">PROVIDED</span>
                            )}
                            {a.date_label && !a.is_provided && (
                              <span className="text-[9px] text-slate-400">{a.date_label}</span>
                            )}
                            {i === 0 && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 border border-blue-200">PRIMARY</span>
                            )}
                            <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                              style={{ borderColor: sel ? "rgb(251 191 36)" : "rgb(203 213 225)" }}>
                              {sel && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {selAddresses.size} of {(result.data.raw_addresses?.length||result.data.subject_addresses.length)} selected · first address used for medical canvass search
                  </p>
                </div>
              )}

              {/* Locations */}
              {result.data.subject_locations.length > 0 && (
                <TagField label="Locations / States" items={result.data.subject_locations} color="slate" />
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Data is auto-extracted — review before running investigation.
                Phones ≥{THRESHOLD}% are pre-selected. All 1st degree relatives are pre-selected.
              </div>

              <button
                onClick={() => { setResult(null); setTimeout(() => fileRef.current?.click(), 100); }}
                className="text-xs text-blue-500 hover:underline"
              >Upload a different file</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t bg-slate-50">
          <div className="text-[11px] text-slate-400">
            {result && (
              <>
                {selPhones.size} phones · {selEmails.size} emails · {selRelatives.size} relatives selected
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {result && (
              <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Check className="h-4 w-4" />
                Import to Form
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
