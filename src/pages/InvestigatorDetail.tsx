import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { getInitials } from "@/lib/format";
import { getCertifications } from "@/lib/certifications";
import { RoleChip } from "@/components/team/RoleChip";
import { CredentialCard } from "@/components/team/CredentialCard";
import {
  investigatorsApi,
  ApiError,
  REGION_LABELS,
  type Certification,
  type CrmUser,
  type InvestigatorProfile,
} from "@/lib/crm-api";

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const ageFrom = (dobIso: string): number => {
  const dob = new Date(dobIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getUTCFullYear();
  if (now.getMonth() < dob.getUTCMonth() || (now.getMonth() === dob.getUTCMonth() && now.getDate() < dob.getUTCDate())) age -= 1;
  return age;
};

/** Placeholder credentials from the demo catalog, until real ones are saved. */
const placeholderCreds = (seed: string): Certification[] =>
  getCertifications(seed).map((c) => ({ id: c.code, label: c.label, kind: "certification" as const, color: c.color }));

export default function InvestigatorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<CrmUser | null>(null);
  const [profile, setProfile] = useState<InvestigatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    investigatorsApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setUser(res.user);
        setProfile(res.profile);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load the investigator.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-lo)]" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="font-mono text-[0.75rem] text-[var(--color-text-lo)]">INVESTIGATOR NOT FOUND</div>
        <div className="editorial text-[2rem] text-[var(--color-text-hi)]">404</div>
        <button onClick={() => navigate("/investigators")} className="eyebrow text-[var(--color-accent)]">
          ← Back to Investigators
        </button>
      </div>
    );
  }

  const creds = profile?.certifications?.length ? profile.certifications : placeholderCreds(user.id);
  const usingPlaceholders = !profile?.certifications?.length;
  const mfaOn = user.twoFactorEnabled;

  const infoRows: [string, React.ReactNode][] = [
    ["Full legal name", profile?.fullName ?? "—"],
    ["Date of birth", profile?.dob ? `${fmtDate(profile.dob)} (${ageFrom(profile.dob)})` : "—"],
    [
      "Phone",
      profile?.phone ? (
        <span className="inline-flex items-center gap-1.5">
          <Phone size={11} strokeWidth={1.8} className="text-[var(--color-text-lo)]" />
          {profile.phone}
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Region",
      user.region ? (
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={11} strokeWidth={1.8} className="text-[var(--color-text-lo)]" />
          {REGION_LABELS[user.region]}
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Joined",
      <span key="joined" className="inline-flex items-center gap-1.5">
        <CalendarDays size={11} strokeWidth={1.8} className="text-[var(--color-text-lo)]" />
        {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
      </span>,
    ],
  ];

  return (
    <div className="relative pb-10">
      {/* Header — same shape as the case page */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[1rem] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
          >
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">{user.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.75rem] tracking-wide text-[var(--color-accent-2)]">{user.email}</span>
              <span className="text-[var(--color-text-lo)]" aria-hidden>·</span>
              {user.roles.map((role) => (
                <RoleChip key={role} role={role} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/investigators")}
            className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={13} strokeWidth={1.8} />
            Investigators
          </button>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.71875rem] font-medium"
            style={{
              background: mfaOn ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
              color: mfaOn ? "#4ade80" : "#f87171",
            }}
          >
            {mfaOn ? <ShieldCheck size={12} strokeWidth={1.8} /> : <ShieldAlert size={12} strokeWidth={1.8} />}
            {mfaOn ? "MFA enabled" : "MFA pending"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {/* Left: details */}
        <div className="flex w-[24rem] shrink-0 flex-col gap-3">
          <div className="surface p-5">
            <div className="eyebrow mb-4">Details</div>
            <dl className="flex flex-col gap-2.5">
              {infoRows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</dt>
                  <dd className="min-w-0 truncate text-right text-[0.8125rem] text-[var(--color-text-hi)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {profile?.notes && (
            <div className="surface p-5">
              <div className="eyebrow mb-2">Internal notes</div>
              <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{profile.notes}</p>
            </div>
          )}
        </div>

        {/* Right: certifications & licenses */}
        <div className="flex min-w-[22rem] flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="eyebrow">Certifications & licenses</h2>
            {usingPlaceholders && (
              <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">
                sample data — real credentials appear once added on their profile
              </span>
            )}
          </div>
          {creds.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-14 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              No certifications or licenses on file.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {creds.map((cert) => (
                <CredentialCard key={cert.id} cert={cert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
