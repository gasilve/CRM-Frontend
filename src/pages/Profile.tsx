import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Check,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PanelLoader } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";
import { getInitials, roleChipStyle, roleColor } from "@/lib/format";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { useAuth } from "@/contexts/AuthContext";
import { authClient } from "@/lib/auth-client";
import type { FieldAccessLevel } from "@/lib/auth-client";
import { CredentialCard } from "@/components/team/CredentialCard";
import { AddCredentialForm, fieldClass, fieldLabelClass } from "@/components/team/AddCredentialForm";
import {
  profileApi,
  rolesApi,
  ApiError,
  REGION_LABELS,
  type AccessCatalog,
  type Certification,
  type CrmUser,
  type InvestigatorProfile,
  type Region,
} from "@/lib/crm-api";

const REGION_OPTIONS: (Region | "")[] = ["", "tristate", "ca", "texas"];

type Tab = "details" | "credentials" | "security" | "access";

const TABS: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "details", label: "Details", icon: UserRound },
  { id: "credentials", label: "Credentials", icon: Award },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "access", label: "My access", icon: ShieldCheck },
];

export default function Profile() {
  const { user: sessionUser, roles, isSuperadmin } = useAuth();
  const [tab, setTab] = useState<Tab>("details");

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

  if (loading) return <PanelLoader message="Loading profile" />;

  if (!user) {
    return (
      <div className="surface grid h-full place-items-center text-[0.875rem] text-[var(--color-neg)]">
        {error ?? "Could not load your profile."}
      </div>
    );
  }

  const accent = roles.length > 0 ? roleColor(roles[0]) : "#4a7fff";
  const expiringSoon = certs.filter((c) => {
    if (!c.expiresAt) return false;
    const days = (new Date(`${c.expiresAt}T00:00:00`).getTime() - Date.now()) / 86_400_000;
    return days < 60;
  }).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Hero */}
      <div className="surface relative shrink-0 overflow-hidden">
        <div
          className="h-20 w-full"
          style={{
            background: `linear-gradient(120deg, color-mix(in srgb, ${accent} 42%, transparent), color-mix(in srgb, ${accent} 8%, transparent) 60%, transparent)`,
          }}
        />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div
            className="-mt-9 grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full border-4 border-[var(--color-ink-1)] text-[1.375rem] font-semibold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
          >
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="editorial truncate text-[1.75rem] leading-tight text-[var(--color-text-hi)]">{user.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              <span className="truncate">{user.email}</span>
              {profile?.timezone && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {profile.timezone.split("/").pop()?.replace(/_/g, " ")}
                </span>
              )}
              {user.region && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {REGION_LABELS[user.region]}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {roles.map((role) => (
              <span
                key={role.id}
                className="rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium"
                style={roleChipStyle(role)}
              >
                {role.name}
              </span>
            ))}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem]",
                sessionUser?.twoFactorEnabled
                  ? "border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.1)] text-[#4ade80]"
                  : "border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] text-[var(--color-neg)]",
              )}
            >
              {sessionUser?.twoFactorEnabled ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
              {sessionUser?.twoFactorEnabled ? "MFA on" : "MFA off"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[0.8125rem] transition-colors",
              tab === t.id
                ? "border-[var(--color-accent)] text-[var(--color-text-hi)]"
                : "border-transparent text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
            )}
          >
            <t.icon size={14} strokeWidth={1.8} />
            {t.label}
            {t.id === "credentials" && expiringSoon > 0 && (
              <span className="rounded-full bg-[rgba(251,191,36,0.16)] px-1.5 text-[0.625rem] text-[#fbbf24]">
                {expiringSoon}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="anim-banner shrink-0 rounded-[0.625rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "details" && (
          <form onSubmit={saveDetails} className="flex flex-col gap-4">
            <Card title="Who you are" hint="Shown to colleagues across the app.">
              <div className="grid gap-3 md:grid-cols-2">
                <Field id="pf-name" label="Display name">
                  <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </Field>
                <Field id="pf-fullname" label="Full legal name">
                  <input
                    id="pf-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldClass}
                    placeholder="As it appears on your license"
                  />
                </Field>
                <Field id="pf-dob" label="Date of birth">
                  <input id="pf-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={fieldClass} />
                </Field>
                <Field id="pf-phone" label="Mobile phone">
                  <input
                    id="pf-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                    placeholder="(555) 010-2030"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Where you are" hint="Used for scheduling and travel estimates.">
              <div className="flex flex-col gap-3">
                <Field id="pf-address" label="Home address">
                  <input
                    id="pf-address"
                    value={homeAddressLine1}
                    onChange={(e) => setHomeAddressLine1(e.target.value)}
                    className={fieldClass}
                    placeholder="123 Main St"
                  />
                </Field>
                <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
                  <Field id="pf-city" label="City">
                    <input id="pf-city" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} className={fieldClass} placeholder="Los Angeles" />
                  </Field>
                  <Field id="pf-state" label="State">
                    <input id="pf-state" value={homeState} onChange={(e) => setHomeState(e.target.value)} className={fieldClass} placeholder="CA" />
                  </Field>
                  <Field id="pf-zip" label="ZIP">
                    <input id="pf-zip" value={homeZip} onChange={(e) => setHomeZip(e.target.value)} className={fieldClass} placeholder="90001" />
                  </Field>
                </div>
                <Field id="pf-timezone" label="Time zone">
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
                </Field>
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
              </div>
            </Card>

            <div className="sticky bottom-0 flex items-center gap-3 bg-gradient-to-t from-[var(--color-ink-1)] via-[var(--color-ink-1)] to-transparent pb-1 pt-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-5 py-2.5 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-[#4ade80]" /> : null}
                {saved ? "Saved" : "Save changes"}
              </button>
            </div>
          </form>
        )}

        {tab === "credentials" && (
          <Card
            title="Certifications & licenses"
            hint="Keep these current so dispatch knows what you're qualified for."
            action={
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
            }
          >
            <div className="flex flex-col gap-2">
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
                <div className="grid place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] bg-[var(--color-ink-3)]/20 py-14 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                  Nothing on file yet.
                </div>
              ) : (
                <div className="anim-stagger flex flex-col gap-2">
                  {certs.map((cert) => (
                    <CredentialCard key={cert.id} cert={cert} onRemove={() => void saveCerts(certs.filter((c) => c.id !== cert.id))} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === "security" && <SecurityTab twoFactorEnabled={!!sessionUser?.twoFactorEnabled} />}

        {tab === "access" && <AccessTab isSuperadmin={isSuperadmin} />}
      </div>
    </div>
  );
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-[var(--color-text-hi)]">{title}</h2>
          {hint && <p className="mt-0.5 text-[0.71875rem] text-[var(--color-text-lo)]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={fieldLabelClass} htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

// ─── Security ───────────────────────────────────────────────────────────────

function SecurityTab({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) {
      setErr("Use at least 8 characters for the new password.");
      return;
    }
    if (next !== confirm) {
      setErr("The two new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setErr(res.error.message ?? "Could not change your password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      window.setTimeout(() => setDone(false), 3000);
    } catch {
      setErr("Could not change your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Two-factor authentication" hint="Required on every account before you can reach the case book.">
        <div className="flex flex-wrap items-center gap-4 rounded-[0.75rem] border border-[var(--color-line)] p-4">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-[0.625rem]",
              twoFactorEnabled ? "bg-[rgba(74,222,128,0.12)]" : "bg-[rgba(248,113,113,0.1)]",
            )}
          >
            {twoFactorEnabled ? (
              <ShieldCheck size={19} strokeWidth={1.7} className="text-[#4ade80]" />
            ) : (
              <ShieldAlert size={19} strokeWidth={1.7} className="text-[var(--color-neg)]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
              {twoFactorEnabled ? "Authenticator app is set up" : "Not set up yet"}
            </div>
            <p className="text-[0.71875rem] text-[var(--color-text-lo)]">
              {twoFactorEnabled
                ? "You'll be asked for a code from your authenticator app each time you sign in."
                : "Set this up now — you can't open cases without it."}
            </p>
          </div>
          {!twoFactorEnabled && (
            <Link
              to="/mfa-setup"
              className="shrink-0 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
            >
              Set up
            </Link>
          )}
        </div>
      </Card>

      <Card title="Password" hint="Changing it signs you out of every other device.">
        <form onSubmit={submit} className="flex max-w-[26rem] flex-col gap-3">
          {err && (
            <div className="rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3 py-2 text-[0.75rem] text-[var(--color-neg)]">
              {err}
            </div>
          )}
          <Field id="pw-current" label="Current password">
            <input
              id="pw-current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field id="pw-next" label="New password">
            <div className="relative">
              <input
                id="pw-next"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={cn(fieldClass, "pr-9")}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]"
              >
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </Field>
          <Field id="pw-confirm" label="Confirm new password">
            <input
              id="pw-confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <button
            type="submit"
            disabled={busy || !current || !next}
            className="mt-1 flex items-center justify-center gap-2 self-start rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-5 py-2.5 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : done ? <Check size={13} className="text-[#4ade80]" /> : <KeyRound size={13} />}
            {done ? "Password changed" : "Change password"}
          </button>
        </form>
      </Card>
    </div>
  );
}

// ─── Access summary ─────────────────────────────────────────────────────────

const LEVEL_META: Record<Exclude<FieldAccessLevel, "write">, { label: string; tint: string }> = {
  hidden: { label: "Hidden from you", tint: "#f87171" },
  masked: { label: "Partly hidden", tint: "#f59e0b" },
  read: { label: "View only", tint: "#22d3ee" },
};

function AccessTab({ isSuperadmin }: { isSuperadmin: boolean }) {
  const { can, roles, caseScope, peopleScope, scheduleScope, fieldAccess } = useAuth();
  const [catalog, setCatalog] = useState<AccessCatalog | null>(null);

  useEffect(() => {
    rolesApi.catalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  if (!catalog) return <PanelLoader message="Loading access" />;

  const scopeLabel = (id: "caseScope" | "peopleScope" | "scheduleScope", value: string) =>
    catalog.scopes[id].options.find((o) => o.value === value)?.label ?? value;

  const restricted = catalog.fieldGroups
    .flatMap((g) => g.fields)
    .map((f) => ({ field: f, level: fieldAccess(f.key) }))
    .filter((r): r is { field: (typeof catalog.fieldGroups)[number]["fields"][number]; level: Exclude<FieldAccessLevel, "write"> } =>
      r.level !== "write",
    );

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Your roles"
        hint={
          isSuperadmin
            ? "You're a Super Admin — nothing in the app is hidden from you."
            : "You get the most permissive combination of every role you hold."
        }
      >
        <div className="flex flex-wrap gap-2">
          {roles.length === 0 && (
            <span className="text-[0.8125rem] text-[var(--color-text-lo)]">No roles assigned yet.</span>
          )}
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded-[0.625rem] border px-3.5 py-2.5"
              style={roleChipStyle(role)}
            >
              <div className="text-[0.8125rem] font-medium">{role.name}</div>
              {role.description && <div className="text-[0.6875rem] opacity-80">{role.description}</div>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="How much you see" hint="Set by an administrator on your roles.">
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["caseScope", caseScope],
              ["peopleScope", peopleScope],
              ["scheduleScope", scheduleScope],
            ] as const
          ).map(([id, value]) => (
            <div key={id} className="rounded-[0.625rem] border border-[var(--color-line)] px-3.5 py-3">
              <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                {catalog.scopes[id].label}
              </div>
              <div className="mt-1 text-[0.8125rem] text-[var(--color-text-hi)]">{scopeLabel(id, value)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="What you can do">
        <div className="flex flex-col gap-3">
          {catalog.permissionGroups.map((group) => {
            const granted = group.permissions.filter((p) => can(p.key as never));
            if (granted.length === 0) return null;
            return (
              <div key={group.id}>
                <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                  {group.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {granted.map((p) => (
                    <span
                      key={p.key}
                      title={p.description}
                      className="flex items-center gap-1.5 rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-1 text-[0.6875rem] text-[var(--color-text-mid)]"
                    >
                      <Check size={10} className="text-[#4ade80]" />
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {restricted.length > 0 && (
        <Card title="Information kept from you" hint="These are hidden or partly hidden on the records you open.">
          <div className="flex flex-col divide-y divide-[var(--color-line)]">
            {restricted.map(({ field, level }) => (
              <div key={field.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Lock size={12} className="shrink-0 text-[var(--color-text-lo)]" />
                <span className="min-w-0 flex-1 truncate text-[0.78125rem] text-[var(--color-text-mid)]">
                  {field.label}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[0.625rem]"
                  style={{
                    background: `color-mix(in srgb, ${LEVEL_META[level].tint} 16%, transparent)`,
                    color: LEVEL_META[level].tint,
                  }}
                >
                  {LEVEL_META[level].label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
