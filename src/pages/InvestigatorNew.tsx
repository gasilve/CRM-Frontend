import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPin, Plus, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { CredentialCard } from "@/components/team/CredentialCard";
import { AddCredentialForm, fieldClass, fieldLabelClass } from "@/components/team/AddCredentialForm";
import {
  invitationsApi,
  ApiError,
  REGION_LABELS,
  type Certification,
  type Region,
} from "@/lib/crm-api";
import type { Role } from "@/lib/auth-client";

type InvitableRole = Extract<Role, "admin" | "investigator">;

const ROLE_OPTIONS: { value: InvitableRole; label: string; hint: string }[] = [
  { value: "investigator", label: "Investigator", hint: "Field work, case notes, evidence" },
  { value: "admin", label: "Administrator", hint: "Full access, manage team & roles" },
];

const REGION_OPTIONS: (Region | "")[] = ["", "tristate", "ca", "texas"];

/**
 * Full-profile "add investigator" page — mirrors the investigator detail
 * layout. Everything is prepared up front; the invite goes out at the end and
 * the profile sits inactive until it's accepted.
 */
export default function InvestigatorNew() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [roles, setRoles] = useState<InvitableRole[]>(["investigator"]);
  const [notes, setNotes] = useState("");
  const [certs, setCerts] = useState<Certification[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: InvitableRole) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const sendInvite = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError("Enter the person's full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await invitationsApi.create(email.trim(), roles, {
        fullName: fullName.trim(),
        dob: dob || null,
        phone: phone.trim() || null,
        region: region || null,
        notes: notes.trim() || null,
        certifications: certs,
      });
      navigate("/investigators", { state: { inviteResult: result } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invitation. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative pb-10">
      {/* Header — same shape as the case page */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">
            {fullName.trim() || "New investigator"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.75rem] tracking-wide text-[var(--color-accent-2)]">
              {email.trim() || "profile in preparation"}
            </span>
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
          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={1.8} />}
            Send invite
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.71875rem] font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />
            Inactive — invite pending
          </span>
        </div>
      </div>

      {error && (
        <div className="surface mb-4 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {/* Left: identity & details */}
        <div className="flex w-[24rem] shrink-0 flex-col gap-3">
          <div className="surface p-5">
            <div className="flex items-center gap-3.5">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[1rem] font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
              >
                {fullName.trim() ? getInitials(fullName) : "?"}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="eyebrow">Details</div>
                <div className="mt-0.5 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  Filled in before the invite goes out
                </div>
              </div>
            </div>

            <div className="hairline my-4" />

            <div className="flex flex-col gap-3">
              <div>
                <label className={fieldLabelClass} htmlFor="ni-name">Full name</label>
                <input id="ni-name" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldClass} placeholder="Jane Doe" />
              </div>
              <div>
                <label className={fieldLabelClass} htmlFor="ni-email">Email address</label>
                <input id="ni-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} placeholder="jane@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabelClass} htmlFor="ni-dob">Date of birth</label>
                  <input id="ni-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={fieldLabelClass} htmlFor="ni-phone">Phone</label>
                  <input id="ni-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} placeholder="(555) 010-2030" />
                </div>
              </div>
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
                      {r === "" ? "None yet" : REGION_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={fieldLabelClass}>Roles</span>
                <div className="flex flex-col gap-2">
                  {ROLE_OPTIONS.map((opt) => {
                    const checked = roles.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-[0.625rem] border px-3.5 py-2.5 transition-colors",
                          checked
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                            : "border-[var(--color-line-2)] hover:border-[var(--color-line-3)]",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(opt.value)}
                          className="mt-0.5 accent-[var(--color-accent)]"
                        />
                        <span>
                          <span className="block text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{opt.label}</span>
                          <span className="block text-[0.71875rem] text-[var(--color-text-mid)]">{opt.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="surface p-4">
            <div className="eyebrow mb-2">Internal notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(fieldClass, "min-h-[4rem] resize-none")}
              placeholder="Referred by…, coverage area, availability…"
            />
          </div>
        </div>

        {/* Right: certifications & licenses */}
        <div className="flex min-w-[22rem] flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow">Certifications & licenses</h2>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[rgba(74,127,255,0.45)] hover:text-[var(--color-accent-2)]"
            >
              <Plus size={12} strokeWidth={1.8} />
              Add credential
            </button>
          </div>

          {addOpen && (
            <AddCredentialForm
              onAdd={(cert) => {
                setAddOpen(false);
                setCerts((prev) => [...prev, cert]);
              }}
              onCancel={() => setAddOpen(false)}
            />
          )}

          {certs.length === 0 && !addOpen ? (
            <div className="grid flex-1 place-items-center rounded-[0.75rem] border border-dashed border-[var(--color-line)] py-14 text-center font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              Add their PI license and any certifications — these ship with the invite.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {certs.map((cert) => (
                <CredentialCard key={cert.id} cert={cert} onRemove={() => setCerts((prev) => prev.filter((c) => c.id !== cert.id))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
