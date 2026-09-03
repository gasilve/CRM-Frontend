// @ts-nocheck

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateInvestigation, useRunInvestigation, useEngines, useActiveInvestigators, useSubjectSearch } from '@/osint/lib/queries';
import { toast } from "sonner";
import { ArrowLeft, Play, Save, Camera, FileText } from "lucide-react";
import { startTracking } from "@/lib/investigationProgress";
import { TloxpModal } from "@/osint/components/investigations/TloxpModal";
import type { InvestigationCreate } from '@/osint/lib/types';

function TagInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string; hint?: string;
}) {
  const [input, setInput] = useState("");

  // Split by comma, semicolon, or newline — add all unique non-empty values
  const addItems = (raw: string) => {
    const items = raw.split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 0);
    const unique = items.filter(s => !value.includes(s));
    if (unique.length > 0) {
      onChange([...value, ...unique]);
    }
    setInput("");
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {value.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-blue-50 px-2 py-0.5 text-sm text-blue-600"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-blue-500 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          className="flex-1"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => { if (input.trim()) addItems(input); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              addItems(input);
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.includes(",") || pasted.includes(";") || pasted.includes("\n")) {
              e.preventDefault();
              addItems(pasted);
            }
          }}
        />
        <button
          type="button"
          onClick={() => { if (input.trim()) addItems(input); }}
          className="px-3 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors whitespace-nowrap"
        >+ Add</button>
      </div>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function NewInvestigation() {
  const navigate = useNavigate();
  const createMutation = useCreateInvestigation();
  const runMutation = useRunInvestigation();
  const { data: engines, isLoading: enginesLoading } = useEngines();
  const { data: investigators } = useActiveInvestigators();

  // Auto-fill investigator from session
  const [sessionUser, setSessionUser] = useState<{name?: string; email?: string} | null>(null);
  useEffect(() => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname)
      ? "" : "http://localhost:8000";
    fetch(`${base}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.authenticated && data.user) setSessionUser(data.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!investigators?.length || !sessionUser?.name || form.investigator_id) return;
    const name = sessionUser.name.toLowerCase().trim();
    const parts = name.split(/\s+/);
    // Try exact match first, then partial
    const exact = investigators.find(inv => (inv.full_name || "").toLowerCase().trim() === name);
    if (exact) { setForm(prev => ({ ...prev, investigator_id: exact.id })); return; }
    // Try first+last name match
    const partial = investigators.find(inv => {
      const invName = (inv.full_name || "").toLowerCase();
      return parts.some(p => p.length >= 3 && invName.includes(p));
    });
    if (partial) setForm(prev => ({ ...prev, investigator_id: partial.id }));
  }, [investigators, sessionUser]);

  const [subjectSearch, setSubjectSearch] = useState("");
  const { data: subjectResults } = useSubjectSearch(subjectSearch);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [riEngines, setRiEngines] = useState<Set<string>>(new Set(["facecheck", "yandex"]));
  const [riCredits, setRiCredits] = useState<Record<string, number | null>>({});
  useEffect(() => {
    const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
    fetch(`${base}/api/investigations/reverse-image/credits`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        const c: Record<string, number | null> = {};
        if (data.facecheck?.credits != null) c.facecheck = data.facecheck.credits;
        if (data.lenso?.credits != null) c.lenso = data.lenso.credits;
        if (data.yandex?.credits != null) c.yandex = data.yandex.credits;
        setRiCredits(c);
      })
      .catch(() => {});
  }, []);
  const RI_ENGINES = [
    { id: "facecheck",         label: "FaceCheck.id", color: "#6366f1", emoji: "👤", credits: "" },
    { id: "lenso", label: "Lenso.ai", color: "#7c3aed", emoji: "🔮", credits: "" },
    { id: "yandex", label: "Yandex", color: "#e63329", emoji: "🔴", credits: "∞" },
  ];
  const [showTloxp, setShowTloxp] = useState(false);
  const [form, setForm] = useState({
    subject_name: "",
    subject_usernames: [] as string[],
    subject_emails: [] as string[],
    subject_phones: [] as string[],
    subject_aliases: [] as string[],
    subject_locations: [] as string[],
    subject_counties: [] as string[],
    subject_employers: [] as string[],
    subject_addresses: [] as string[],
    subject_license_plates: [] as string[],
    subject_ssn_last4: "",
    subject_country: "US",
    subject_gender: "unknown",
    subject_race: "unknown",
    subject_relatives: [] as { name: string; relationship: string }[],
    subject_notes: "",
    subject_dob: "",
    investigator_id: null as number | null,
    case_id: null as number | null,
    enabled_engines: ["searxng"] as string[],
    priority: "standard",
  });

  // Relatives input — single-row name + relationship inline
  const [relInput, setRelInput] = useState({ name: "", relationship: "" });
  const addRelative = () => {
    if (!relInput.name.trim()) return;
    setForm(prev => ({
      ...prev,
      subject_relatives: [
        ...prev.subject_relatives,
        { name: relInput.name.trim(), relationship: relInput.relationship.trim() },
      ],
    }));
    setRelInput({ name: "", relationship: "" });
  };

  // Auto-select ALL engines when any identifier is provided
  React.useEffect(() => {
    if (!engines) return;
    const hasAny = form.subject_name.trim().length > 0 || form.subject_usernames.length > 0 || form.subject_emails.length > 0 || form.subject_phones.length > 0;
    if (!hasAny) { setForm(prev => ({ ...prev, enabled_engines: [] })); return; }
    const auto: string[] = [];
    for (const eng of engines) {
      if (!eng.is_active || eng.code === "manual" || eng.code === "historical") continue;
      auto.push(eng.code);
    }
    setForm(prev => ({ ...prev, enabled_engines: auto }));
  }, [engines, form.subject_name, form.subject_usernames.length, form.subject_emails.length, form.subject_phones.length]);

  const handleSubmit = async (andRun: boolean) => {
    if (!form.subject_name.trim() && form.subject_usernames.length === 0) {
      toast.error("Provide at least a subject name or username");
      return;
    }
    // If no subject_name but has username, use username as subject_name for the API
    const effectiveName = form.subject_name.trim() || form.subject_usernames[0];
    const payload: InvestigationCreate = {
      ...form,
      subject_name: effectiveName,
      subject_id: selectedSubjectId,
      // Send null (not empty string) for optional fields — backend rejects empty strings
      subject_dob: form.subject_dob || undefined,
      subject_ssn_last4: form.subject_ssn_last4 && form.subject_ssn_last4.length === 4 ? form.subject_ssn_last4 : undefined,
      subject_notes: form.subject_notes || undefined,
      subject_relatives: form.subject_relatives.length > 0 ? form.subject_relatives : undefined,
      subject_emails: form.subject_emails.length > 0 ? form.subject_emails : undefined,
      subject_phones: form.subject_phones.length > 0 ? form.subject_phones : undefined,
      subject_usernames: form.subject_usernames.length > 0 ? form.subject_usernames : undefined,
      subject_locations: form.subject_locations.length > 0 ? form.subject_locations : undefined,
      subject_employers: form.subject_employers.length > 0 ? form.subject_employers : undefined,
      subject_addresses: form.subject_addresses.length > 0 ? form.subject_addresses : undefined,
      subject_counties: (form as Record<string, unknown>).subject_counties && ((form as Record<string, unknown>).subject_counties as string[]).length > 0
        ? (form as Record<string, unknown>).subject_counties as string[]
        : undefined,
      subject_aliases: form.subject_aliases.length > 0 ? form.subject_aliases : undefined,
      subject_license_plates: form.subject_license_plates.length > 0 ? form.subject_license_plates : undefined,
      investigator_id: form.investigator_id || undefined,
      case_id: form.case_id || undefined,
      created_by: "investigator",
      extra_metadata: refFiles.length > 0 && riEngines.size > 0
        ? { reverse_image_engines: [...riEngines] }
        : undefined,
    };
    try {
      const inv = await createMutation.mutateAsync(payload);
      if (andRun) {
        await runMutation.mutateAsync(inv.id);
        startTracking(inv.id);
        toast.success("Investigation created and started");
      } else {
        toast.success("Investigation saved as draft");
      }
      // Upload reference photos if any
      if (refFiles.length > 0) {
        const formData = new FormData();
        refFiles.forEach(f => formData.append("files", f));
        formData.append("uploaded_by", "investigator");
        try {
          const base = typeof window !== "undefined" && !["localhost","127.0.0.1"].includes(window.location.hostname) ? "" : "http://localhost:8000";
          await fetch(`${base}/api/investigations/${inv.id}/reference-photos`, {
            method: "POST", body: formData, credentials: "include",
          });
        } catch { /* non-critical */ }
      }
      navigate(`/investigations/${inv.id}`);
    } catch {
      toast.error("Failed to create investigation");
    }
  };

  const handleTloxpImport = (data: Record<string, unknown>) => {
    setForm(prev => ({
      ...prev,
      ...(data.subject_name && { subject_name: data.subject_name as string }),
      ...(data.subject_dob && { subject_dob: (() => {
        const raw = data.subject_dob as string;
        // Convert MM/DD/YYYY → YYYY-MM-DD for <input type="date">
        const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
        // Already YYYY-MM-DD or other format — pass through
        return raw;
      })() }),
      ...(data.subject_gender && { subject_gender: data.subject_gender as string }),
      ...((data.subject_aliases as string[] | undefined)?.length && {
        subject_aliases: [...new Set([...prev.subject_aliases, ...(data.subject_aliases as string[])])]
      }),
      ...((data.subject_phones as string[] | undefined)?.length && {
        subject_phones: [...new Set([...prev.subject_phones, ...(data.subject_phones as string[])])]
      }),
      ...((data.subject_emails as string[] | undefined)?.length && {
        subject_emails: [...new Set([...prev.subject_emails, ...(data.subject_emails as string[])])]
      }),
      ...((data.subject_usernames as string[] | undefined)?.length && {
        subject_usernames: [...new Set([...prev.subject_usernames, ...(data.subject_usernames as string[])])]
      }),
      ...((data.subject_addresses as string[] | undefined)?.length && {
        subject_addresses: [...new Set([...prev.subject_addresses, ...(data.subject_addresses as string[])])]
      }),
      ...((data.subject_locations as string[] | undefined)?.length && {
        subject_locations: [...new Set([...prev.subject_locations, ...(data.subject_locations as string[])])]
      }),
      ...((data.subject_relatives as {name:string;relationship:string}[] | undefined)?.length && {
        subject_relatives: [...prev.subject_relatives, ...(data.subject_relatives as {name:string;relationship:string}[])]
      }),
      ...(data.subject_notes && { subject_notes: data.subject_notes as string }),
    }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      {showTloxp && <TloxpModal onImport={handleTloxpImport} onClose={() => setShowTloxp(false)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold">New Investigation</h1>
            <p className="text-sm text-muted-foreground">Create an OSINT search for a subject</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowTloxp(true)}
          className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <FileText className="h-4 w-4" />
          Import TLO Report
        </Button>
      </div>


      {/* Section 1: Subject */}
      <div className="rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Subject Identifiers</h2>

        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Input
            placeholder="Search existing or type new name..."
            value={form.subject_name || subjectSearch}
            onChange={(e) => {
              setSubjectSearch(e.target.value);
              setForm({ ...form, subject_name: e.target.value });
              setSelectedSubjectId(null);
            }}
          />
          {subjectResults && subjectResults.length > 0 && !selectedSubjectId && (
            <div className="rounded border bg-white shadow-sm max-h-40 overflow-y-auto">
              {subjectResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 border-b last:border-0"
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    const phones = [s.phone_number].filter((x): x is string => !!x);
                    const usernames: string[] = [];
                    if (s.facebook_url) {
                      const m = s.facebook_url.match(/facebook\.com\/([^/?]+)/);
                      if (m) usernames.push(m[1]);
                    }
                    const locations: string[] = s.address ? [s.address] : [];
                    const employers: string[] = s.current_employer ? [s.current_employer] : [];
                    setForm({
                      ...form,
                      subject_name: s.full_name,
                      subject_dob: s.dob || "",
                      subject_phones: phones,
                      subject_usernames: usernames,
                      subject_locations: locations,
                      subject_employers: employers,
                    });
                    setSubjectSearch("");
                    toast.success("Subject loaded: fields auto-filled");
                  }}
                >
                  <span className="font-medium">{s.full_name}</span>
                  {s.dob && <span className="ml-2 text-muted-foreground">DOB: {s.dob}</span>}
                </button>
              ))}
            </div>
          )}
          {selectedSubjectId && (
            <p className="text-xs text-green-600">Linked to existing subject #{selectedSubjectId}</p>
          )}
        </div>

        <TagInput label="Usernames" data-field="usernames" value={form.subject_usernames} onChange={(v) => setForm({ ...form, subject_usernames: v })} placeholder="Type username and press Enter" />
        <TagInput label="Emails" data-field="emails" value={form.subject_emails} onChange={(v) => setForm({ ...form, subject_emails: v })} placeholder="email@example.com" />
        <TagInput label="Phones" data-field="phones" value={form.subject_phones} onChange={(v) => setForm({ ...form, subject_phones: v })} placeholder="+1 555-123-4567" />
        <TagInput label="Aliases" value={form.subject_aliases} onChange={(v) => setForm({ ...form, subject_aliases: v })} placeholder="Known aliases" />
        <TagInput label="Cities / Locations" value={form.subject_locations} onChange={(v) => setForm({ ...form, subject_locations: v })} placeholder="City, State" hint="Cities where subject has lived or worked" />
        <TagInput label="Counties" value={(form as Record<string, unknown>).subject_counties as string[] || []}
          onChange={(v) => setForm({ ...form, ...({"subject_counties": v} as Record<string, unknown>) })}
          placeholder="e.g. Queens County, NY · Riverside County, CA"
          hint="Used for criminal records search. Example: 'Queens County' or 'Riverside County'" />
        <TagInput label="Employers" value={form.subject_employers} onChange={(v) => setForm({ ...form, subject_employers: v })} placeholder="Company name" />
        <TagInput label="Addresses" value={form.subject_addresses} onChange={(v) => setForm({ ...form, subject_addresses: v })} placeholder="e.g. 2054 South Birch Street, Santa Ana, CA 92707" hint="Current and historical addresses. Used as disambiguators in name queries." />
        <TagInput label="License plates" value={form.subject_license_plates} onChange={(v) => setForm({ ...form, subject_license_plates: v })} placeholder="e.g. 7ABC123" hint="Triggers DMV/court/insurance dorks via SearXNG. US-only sites are skipped if country ≠ US." />

        <div className="grid grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Date of Birth</Label>
            <Input type="date" value={form.subject_dob} onChange={(e) => setForm({ ...form, subject_dob: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Gender</Label>
            <select
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              value={form.subject_gender}
              onChange={(e) => setForm({ ...form, subject_gender: e.target.value })}
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Race</Label>
            <select
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              value={form.subject_race}
              onChange={(e) => setForm({ ...form, subject_race: e.target.value })}
            >
              <option value="unknown">Unknown</option>
              <option value="white">White</option>
              <option value="black">Black / African American</option>
              <option value="asian">Asian</option>
              <option value="hispanic">Hispanic / Latino</option>
              <option value="native_american">Native American</option>
              <option value="pacific_islander">Pacific Islander</option>
              <option value="other">Other</option>
            </select>
            <p className="text-[10px] text-slate-400">Used by AI to boost photo match confidence (face/age/race consistency)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Country</Label>
            <select
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
              value={form.subject_country}
              onChange={(e) => setForm({ ...form, subject_country: e.target.value })}
            >
              <optgroup label="Americas">
                <option value="US">🇺🇸 United States</option>
                <option value="MX">🇲🇽 Mexico</option>
                <option value="CA">🇨🇦 Canada</option>
                <option value="BR">🇧🇷 Brazil</option>
                <option value="AR">🇦🇷 Argentina</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="VE">🇻🇪 Venezuela</option>
                <option value="DO">🇩🇴 Dominican Republic</option>
                <option value="PR">🇵🇷 Puerto Rico</option>
              </optgroup>
              <optgroup label="Europe">
                <option value="ES">🇪🇸 Spain</option>
                <option value="RU">🇷🇺 Russia</option>
                <option value="UA">🇺🇦 Ukraine</option>
                <option value="PL">🇵🇱 Poland</option>
                <option value="DE">🇩🇪 Germany</option>
                <option value="GB">🇬🇧 United Kingdom</option>
                <option value="FR">🇫🇷 France</option>
                <option value="IT">🇮🇹 Italy</option>
                <option value="RO">🇷🇴 Romania</option>
              </optgroup>
              <optgroup label="Asia / Pacific">
                <option value="CN">🇨🇳 China</option>
                <option value="PH">🇵🇭 Philippines</option>
                <option value="IN">🇮🇳 India</option>
                <option value="VN">🇻🇳 Vietnam</option>
                <option value="KR">🇰🇷 South Korea</option>
                <option value="JP">🇯🇵 Japan</option>
              </optgroup>
              <optgroup label="Middle East / Africa">
                <option value="NG">🇳🇬 Nigeria</option>
                <option value="GH">🇬🇭 Ghana</option>
                <option value="ZA">🇿🇦 South Africa</option>
                <option value="EG">🇪🇬 Egypt</option>
              </optgroup>
              <option value="OTHER">🌐 Other</option>
            </select>
            <p className="text-[10px] text-slate-400">
              {form.subject_country === "US" ? "US: enables TruePeopleSearch, FastPeopleSearch, ThatsThem, NumLookup" :
               form.subject_country === "RU" ? "Russia: enables VK, OK.ru, Telegram search" :
               form.subject_country === "CN" ? "China: enables Weibo, Douyin search" :
               form.subject_country === "BR" || form.subject_country === "AR" || form.subject_country === "CO" ? "LatAm: enables MercadoLibre, regional social search" :
               "Country-specific engines will be added automatically"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">SSN last 4</Label>
            <Input
              type="text"
              maxLength={4}
              pattern="\d{4}"
              placeholder="1234"
              value={form.subject_ssn_last4}
              onChange={(e) => setForm({ ...form, subject_ssn_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
            <p className="text-[10px] text-slate-400">Never broadcast in queries. Used in correlation only when text shows context like &quot;last four&quot;.</p>
          </div>
        </div>

        {/* Relatives */}
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Relatives & Associates</Label>
          <p className="text-[10px] text-slate-400">
            Used by the autopivot phase to search each relative&apos;s social profiles for mentions of the subject.
          </p>
          {form.subject_relatives.length > 0 && (
            <div className="space-y-1 mb-2">
              {form.subject_relatives.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-white border border-slate-300 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{r.name}</span>
                    {r.relationship && <span className="ml-2 text-blue-600">— {r.relationship}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, subject_relatives: form.subject_relatives.filter((_, j) => j !== i) })}
                    className="text-slate-400 hover:text-red-500 text-lg leading-none"
                  >&times;</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              placeholder="Name (e.g. Peter Rivas)"
              value={relInput.name}
              onChange={(e) => setRelInput({ ...relInput, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRelative(); }}}
            />
            <Input
              placeholder="Relationship (e.g. sister, father)"
              value={relInput.relationship}
              onChange={(e) => setRelInput({ ...relInput, relationship: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRelative(); }}}
            />
            <Button type="button" variant="outline" onClick={addRelative}>Add</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Notes</Label>
          <Textarea placeholder="Additional information about the subject..." value={form.subject_notes} onChange={(e) => setForm({ ...form, subject_notes: e.target.value })} />
        </div>
      </div>

      {/* Section 2: Case Linking */}
      <div className="rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold">Case & Investigator</h2>
        <div className="space-y-1.5">
          <Label>Investigator</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={form.investigator_id || ""}
            onChange={(e) => setForm({ ...form, investigator_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Select investigator...</option>
            {investigators?.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Priority */}
      <div className="rounded-lg border p-5 space-y-2">
        <h2 className="font-semibold">Priority</h2>
        <div className="flex gap-4">
          {["low", "standard", "high", "urgent"].map(p => (
            <label key={p} className="flex items-center gap-1.5 text-sm">
              <input type="radio" name="priority" checked={form.priority === p} onChange={() => setForm({ ...form, priority: p })} />
              <span className="capitalize">{p}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Section 4: Reference Photos */}
      <div className="rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold">Reference Photos <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
        <p className="text-xs text-muted-foreground">Upload up to 5 reference photos for automatic face matching. Without photos, you can identify the subject manually from extracted profile pictures.</p>
        <div className="rounded-md border-2 border-dashed p-4 text-center">
          <input type="file" id="ref-photos" multiple accept="image/*" className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []).slice(0, 5);
              setRefFiles(files);
            }} />
          <label htmlFor="ref-photos" className="cursor-pointer text-sm text-blue-600 hover:underline">
            <Camera className="inline h-4 w-4 mr-1" />Click to upload photos
          </label>
          {refFiles.length > 0 && (
            <div className="flex gap-2 mt-3 justify-center">
              {refFiles.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} className="h-16 w-16 rounded object-cover border" alt="" />
                  <button type="button" onClick={() => setRefFiles(refFiles.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {refFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Reverse Image Engines</p>
            <div className="flex flex-wrap gap-2">
              {RI_ENGINES.map(eng => {
                const selected = riEngines.has(eng.id);
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setRiEngines(prev => {
                      const n = new Set(prev);
                      n.has(eng.id) ? n.delete(eng.id) : n.add(eng.id);
                      return n;
                    })}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      selected ? "border-transparent text-white" : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                    style={selected ? { background: eng.color, borderColor: eng.color } : {}}
                  >
                    {eng.emoji} {eng.label}
                    {riCredits[eng.id] != null && (
                      <span className="ml-1.5 opacity-80 text-[9px] bg-black/20 px-1.5 py-0.5 rounded-full">
                        {riCredits[eng.id] === -1 ? "∞" : riCredits[eng.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">These engines will search the reference photo for face matches across the web before the main investigation runs.</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">By uploading, you confirm authorization for biometric face matching against publicly available photos. Embeddings retained 90 days post-completion.</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => handleSubmit(false)} disabled={createMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />Save as Draft
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={createMutation.isPending || runMutation.isPending}>
          <Play className="mr-2 h-4 w-4" />Save and Run
        </Button>
      </div>
    </div>
  );
}
