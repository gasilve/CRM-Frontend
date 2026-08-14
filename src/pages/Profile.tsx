import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
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

  // Editable fields
  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Certifications
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
    return (
      <div className="grid h-full place-items-center">
        <Loader2 size={22} className="animate-spin text-[var(--color-text-lo)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid h-full place-items-center text-[0.875rem] text-[var(--color-neg)]">
        {error ?? "Could not load your profile."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Profile</h1>
        <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
          Your details, license, and credentials
        </p>
      </div>

      {error && (
        <div className="surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {/* Left: identity + editable details */}
        <div className="flex w-[24rem] shrink-0 flex-col gap-3 overflow-y-auto pb-1">
          <div className="surface p-5">
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
                  <label className={fieldLabelClass} htmlFor="pf-phone">Phone</label>
                  <input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} placeholder="(555) 010-2030" />
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
                        "flex items-center gap-1 rounded-full border px-3 py-1 text-[0.71875rem] transition-colors",
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

        {/* Right: certifications & licenses manager */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-1">
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
            <div className="grid flex-1 place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-14 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              Nothing on file yet — add your licenses and certifications so dispatch knows what you're qualified for.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {certs.map((cert) => (
                <CredentialCard key={cert.id} cert={cert} onRemove={() => void saveCerts(certs.filter((c) => c.id !== cert.id))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

