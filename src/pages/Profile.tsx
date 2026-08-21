import { useEffect, useState, type FormEvent } from "react";
import { Check, Clock, Loader2, MapPin, Plus } from "lucide-react";
import { PanelLoader } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { RoleChip } from "@/components/team/RoleChip";
import { CredentialCard } from "@/components/team/CredentialCard";
import { AddCredentialForm, fieldClass, fieldLabelClass } from "@/components/team/AddCredentialForm";
import {
  profileApi,
  ApiError,
  REGION_LABELS,
  type Certification,
  type CrmUser,
  type InvestigatorProfile,
  type Region,
} from "@/lib/crm-api";

const REGION_OPTIONS: (Region | "")[] = ["", "tristate", "ca", "texas"];

export default function Profile() {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [profile, setProfile] = useState<InvestigatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [homeAddressLine1, setHomeAddressLine1] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [homeState, setHomeState] = useState("");
  const [homeZip, setHomeZip] = useState("");
  const [timezone, setTimezone] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [certs, setCerts] = useState<Certification[]>([]);
  const [certsBusy, setCertsBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const applyResult = (res: { user: CrmUser; profile: InvestigatorProfile | null }) => {
    setUser(res.user);
    setProfile(res.profile);
    setName(res.user.name);
    setFullName(res.profile?.fullName ?? "");
    setDob(res.profile?.dob ? res.profile.dob.slice(0, 10) : "");
    setPhone(res.profile?.phone ?? "");
    setHomeAddressLine1(res.profile?.homeAddressLine1 ?? "");
    setHomeCity(res.profile?.homeCity ?? "");
    setHomeState(res.profile?.homeState ?? "");
    setHomeZip(res.profile?.homeZip ?? "");
    setTimezone(res.profile?.timezone ?? "");
    setRegion(res.user.region ?? "");
    setCerts(res.profile?.certifications ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    profileApi
      .me()
      .then((res) => {
        if (!cancelled) applyResult(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveDetails = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await profileApi.update({
        name: name.trim() || undefined,
        fullName: fullName.trim() || null,
        dob: dob || null,
        phone: phone.trim() || null,
        homeAddressLine1: homeAddressLine1.trim() || null,
        homeCity: homeCity.trim() || null,
        homeState: homeState.trim() || null,
        homeZip: homeZip.trim() || null,
        timezone: timezone || null,
        region: region || null,
      });
      applyResult(res);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const saveCerts = async (next: Certification[]) => {
    const prev = certs;
    setCerts(next);
    setCertsBusy(true);
    try {
      const res = await profileApi.update({ certifications: next });
      applyResult(res);
      setError(null);
    } catch (err) {
      setCerts(prev);
      setError(err instanceof ApiError ? err.message : "Could not save the credentials.");
    } finally {
      setCertsBusy(false);
    }
  };

  if (loading) {
    return <PanelLoader message="Loading profile" />;
  }

  if (!user) {
    return (
      <div className="surface grid h-full place-items-center text-[0.875rem] text-[var(--color-neg)]">
        {error ?? "Could not load your profile."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Profile</h1>
        <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
          Your details, license, and credentials
        </p>
      </div>

      {error && (
        <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      <div className="surface flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        <div className="flex min-h-0 flex-1 flex-wrap gap-4 overflow-y-auto">
          <div className="flex w-[24rem] shrink-0 flex-col gap-3">
            <div className="rounded-[0.75rem] border border-[var(--color-line)] bg-[var(--color-ink-3)]/40 p-5">
              <div className="flex items-center gap-3.5">
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[1.125rem] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
                >
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[1rem] font-semibold text-[var(--color-text-hi)]">{user.name}</div>
                  <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{user.email}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <RoleChip key={role} role={role} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="hairline my-4" />

              <form className="flex flex-col gap-3" onSubmit={saveDetails}>
                <div>
                  <label className={fieldLabelClass} htmlFor="pf-name">Display name</label>
                  <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={fieldLabelClass} htmlFor="pf-fullname">Full legal name</label>
                  <input id="pf-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldClass} placeholder="As it appears on your license" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelClass} htmlFor="pf-dob">Date of birth</label>
                    <input id="pf-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={fieldLabelClass} htmlFor="pf-phone">Mobile phone</label>
                    <input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} placeholder="(555) 010-2030" />
                  </div>
                </div>
                <div>
                  <label className={fieldLabelClass} htmlFor="pf-address">Home address</label>
                  <input id="pf-address" value={homeAddressLine1} onChange={(e) => setHomeAddressLine1(e.target.value)} className={fieldClass} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
                  <div>
                    <label className={fieldLabelClass} htmlFor="pf-city">City</label>
                    <input id="pf-city" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} className={fieldClass} placeholder="Los Angeles" />
                  </div>
                  <div>
                    <label className={fieldLabelClass} htmlFor="pf-state">State</label>
                    <input id="pf-state" value={homeState} onChange={(e) => setHomeState(e.target.value)} className={fieldClass} placeholder="CA" />
                  </div>
                  <div>
                    <label className={fieldLabelClass} htmlFor="pf-zip">ZIP</label>
                    <input id="pf-zip" value={homeZip} onChange={(e) => setHomeZip(e.target.value)} className={fieldClass} placeholder="90001" />
                  </div>
                </div>
                <div>
                  <label className={fieldLabelClass} htmlFor="pf-timezone">Time zone</label>
                  <div className="relative">
                    <Clock size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
                    <select
                      id="pf-timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={cn(fieldClass, "pl-8")}
                    >
                      <option value="">Select time zone</option>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                  Licenses live under Certifications & licenses on the right.
                </p>
                <div>
                  <span className={fieldLabelClass}>Operating region</span>
                  <div className="flex flex-wrap gap-1.5">
                    {REGION_OPTIONS.map((r) => (
                      <button
                        key={r || "none"}
                        type="button"
                        onClick={() => setRegion(r)}
                        className={cn(
                          "anim-toggle tap flex items-center gap-1 rounded-full border px-3 py-1 text-[0.71875rem]",
                          region === r
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                            : "border-[var(--color-line)] text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
                        )}
                      >
                        {r !== "" && <MapPin size={10} strokeWidth={1.8} />}
                        {r === "" ? "None" : REGION_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-1 flex items-center justify-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2.5 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-[#4ade80]" /> : null}
                  {saved ? "Saved" : "Save details"}
                </button>
              </form>
            </div>
          </div>

          <div className="flex min-w-[22rem] flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="eyebrow">Certifications & licenses</h2>
              <div className="flex items-center gap-2">
                {certsBusy && <Loader2 size={12} className="animate-spin text-[var(--color-text-lo)]" />}
                <button
                  type="button"
                  onClick={() => setAddOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
                >
                  <Plus size={12} strokeWidth={1.8} />
                  Add credential
                </button>
              </div>
            </div>

            {addOpen && (
              <AddCredentialForm
                onAdd={(cert) => {
                  setAddOpen(false);
                  void saveCerts([...certs, cert]);
                }}
                onCancel={() => setAddOpen(false)}
              />
            )}

            {certs.length === 0 && !addOpen ? (
              <div className="grid flex-1 place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] bg-[var(--color-ink-3)]/20 py-14 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                Nothing on file yet — add your licenses and certifications so dispatch knows what you're qualified for.
              </div>
            ) : (
              <div className="anim-stagger flex flex-col gap-2">
                {certs.map((cert) => (
                  <CredentialCard key={cert.id} cert={cert} onRemove={() => void saveCerts(certs.filter((c) => c.id !== cert.id))} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
