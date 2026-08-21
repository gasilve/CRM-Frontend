import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Clock,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users2,
  RotateCw,
  Check,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { getCertifications, hasCertification, CERTIFICATION_CATALOG, type Certification as CatalogCert } from "@/lib/certifications";
import { formatHomeAddressShort, formatTimezone } from "@/lib/timezones";
import { useAuth } from "@/contexts/AuthContext";
import { investigatorsApi, invitationsApi, REGION_LABELS, type InvestigatorListItem, type Invitation, type InviteCreateResult, ApiError } from "@/lib/crm-api";
import { PanelLoader } from "@/components/ui/LoadingState";
import { ViewToggle, ViewToggleGroup } from "@/components/ui/ViewToggle";
import type { Role } from "@/lib/auth-client";
import { RoleChip } from "@/components/team/RoleChip";
import { CertificationBadges } from "@/components/team/CertificationBadges";

type TeamNotice =
  | { kind: "invitation"; email: string }
  | { kind: "roles_assigned"; email: string; name: string };

const ROLE_FILTER_CONFIG: Record<Extract<Role, "admin" | "investigator">, { label: string; dot: string }> = {
  admin: { label: "Admin", dot: "#7aa1ff" },
  investigator: { label: "Investigator", dot: "#4ade80" },
};

const PER_PAGE = 8;

/** Real profile certs when saved; otherwise the roster placeholder catalog. */
const rosterCertifications = (person: InvestigatorListItem): CatalogCert[] => {
  const saved = person.profile?.certifications;
  if (saved?.length) {
    return saved.map((c) => ({
      code: c.id,
      label: c.label,
      color: c.color ?? (c.kind === "license" ? "#4ade80" : "#4a7fff"),
    }));
  }
  return getCertifications(person.id);
};

const personHasCertification = (person: InvestigatorListItem, code: string): boolean => {
  const saved = person.profile?.certifications;
  if (saved?.length) return saved.some((c) => c.id === code);
  return hasCertification(person.id, code);
};

export default function Investigators() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const navigate = useNavigate();
  const location = useLocation();

  const [people, setPeople] = useState<InvestigatorListItem[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<TeamNotice | null>(null);

  // Result handed back by the "Add investigator" page after sending an invite.
  useEffect(() => {
    const result = (location.state as { inviteResult?: InviteCreateResult } | null)?.inviteResult;
    if (!result) return;
    if (result.kind === "invitation") setNotice({ kind: "invitation", email: result.invitation.email });
    else setNotice({ kind: "roles_assigned", email: result.user.email, name: result.user.name });
    window.history.replaceState({}, "");
  }, [location.state]);
  const [view, setView] = useState<"roster" | "pending">("roster");
  const [roleFilter, setRoleFilter] = useState<Extract<Role, "admin" | "investigator"> | null>(null);
  const [certFilter, setCertFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadPeople = () => {
    investigatorsApi
      .list()
      .then((res) => setPeople(res.investigators))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load investigators."));
  };

  const loadInvitations = () => {
    if (!isAdmin) return;
    invitationsApi
      .list()
      .then((res) => setInvitations(res.invitations))
      .catch(() => {
        /* non-fatal — pending toggle just stays empty */
      });
  };

  useEffect(loadPeople, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadInvitations, [isAdmin]);
  useEffect(() => setPage(1), [view, roleFilter, certFilter]);

  const pendingInvites = useMemo(() => invitations?.filter((i) => !i.acceptedAt) ?? [], [invitations]);

  const filteredPeople = useMemo(() => {
    let list = people ?? [];
    if (roleFilter) list = list.filter((p) => p.roles.includes(roleFilter));
    if (certFilter) list = list.filter((p) => personHasCertification(p, certFilter));
    return list;
  }, [people, roleFilter, certFilter]);

  const filteredInvites = useMemo(() => {
    let list = pendingInvites;
    if (roleFilter) list = list.filter((i) => i.roles.includes(roleFilter));
    // Certification filter doesn't apply to invites — nobody's earned certs yet.
    return list;
  }, [pendingInvites, roleFilter]);

  const rosterCount = people?.length ?? 0;
  const totalCount = view === "roster" ? filteredPeople.length : filteredInvites.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const pagedPeople = filteredPeople.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pagedInvites = filteredInvites.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const resendInvite = async (invitation: Invitation) => {
    setBusyKey(`resend:${invitation.id}`);
    setError(null);
    try {
      const { invitation: updated } = await invitationsApi.resend(invitation.id);
      setInvitations((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resend invitation.");
    } finally {
      setBusyKey(null);
    }
  };

  const revokeInvite = async (invitation: Invitation) => {
    setBusyKey(`revoke:${invitation.id}`);
    setError(null);
    try {
      await invitationsApi.revoke(invitation.id);
      setInvitations((prev) => prev?.filter((i) => i.id !== invitation.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke invitation.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Investigators</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {view === "roster"
              ? people
                ? `${rosterCount} on the roster`
                : "Loading roster…"
              : `${pendingInvites.length} pending invitation${pendingInvites.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <ViewToggleGroup>
              <ViewToggle
                active={view === "roster"}
                onClick={() => setView("roster")}
                icon={<Users2 size={13} strokeWidth={1.8} />}
                label="Roster"
              />
              <ViewToggle
                active={view === "pending"}
                onClick={() => setView("pending")}
                icon={<Mail size={13} strokeWidth={1.8} />}
                label="Pending"
                badge={pendingInvites.length > 0 ? pendingInvites.length : undefined}
              />
            </ViewToggleGroup>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/investigators/new")}
              className="flex h-9 items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3.5 text-[0.75rem] text-[var(--color-text-hi)] hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] transition-shadow"
            >
              <Plus size={13} strokeWidth={1.8} />
              Add investigator
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex shrink-0 flex-col gap-3">
        {/* Role chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "admin", "investigator"] as const).map((r) => {
            const active = r === "all" ? roleFilter === null : roleFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r === "all" ? null : r)}
                className={cn(
                  "anim-toggle tap flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.71875rem] font-medium",
                  active
                    ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                    : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)] hover:border-[var(--color-line-2)]",
                )}
              >
                {r !== "all" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_FILTER_CONFIG[r].dot }} />}
                {r === "all" ? "All roles" : ROLE_FILTER_CONFIG[r].label}
              </button>
            );
          })}
        </div>
        {/* Certification chips — placeholder catalog, doesn't apply to pending invites */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 transition-opacity",
            view === "pending" && "pointer-events-none opacity-40",
          )}
        >
          {CERTIFICATION_CATALOG.map((cert) => {
            const active = certFilter === cert.code;
            return (
              <button
                key={cert.code}
                onClick={() => setCertFilter(active ? null : cert.code)}
                className="anim-toggle tap rounded-full border px-2.5 py-0.5 text-[0.65625rem] font-medium tracking-wide"
                style={
                  active
                    ? { background: `${cert.color}26`, color: cert.color, borderColor: `${cert.color}60` }
                    : { background: "transparent", color: "var(--color-text-lo)", borderColor: "var(--color-line)" }
                }
              >
                {cert.label}
              </button>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="surface flex shrink-0 items-center gap-3 rounded-[0.875rem] border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-4 py-3">
          <Mail size={15} className="shrink-0 text-[#4ade80]" />
          <p className="text-[0.78125rem] text-[var(--color-text-mid)]">
            {notice.kind === "invitation" ? (
              <>
                Invitation sent to <span className="font-medium text-[var(--color-text-hi)]">{notice.email}</span>.
                They&apos;ll receive an email with a link to create their account.
              </>
            ) : (
              <>
                <span className="font-medium text-[var(--color-text-hi)]">{notice.name}</span> ({notice.email}) already
                had an account — roles were granted immediately.
              </>
            )}
          </p>
          <button
            onClick={() => setNotice(null)}
            className="ml-auto shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="anim-banner surface shrink-0 rounded-[0.875rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      {/* Content — table fills remaining height; no scroll; pagination pinned */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden">
          {view === "roster" ? (
            !people ? (
              <PanelLoader message="Loading roster" />
            ) : (
              /* Keyed on the page so paging replays the row stagger. */
              <RosterTable
                key={`roster-${page}`}
                items={pagedPeople}
                onRowClick={(p) => navigate(`/investigators/${p.id}`)}
                emptyTitle={people.length > 0 ? "No matches" : "No investigators yet"}
                emptyMessage={
                  people.length > 0
                    ? "No investigators match the current filters."
                    : isAdmin
                      ? "Invite your field team to get started — they'll set up MFA on first login."
                      : "Ask an administrator to invite field investigators."
                }
              />
            )
          ) : (
            <InvitesTable
              key={`invites-${page}`}
              items={pagedInvites}
              busyKey={busyKey}
              onResend={resendInvite}
              onRevoke={revokeInvite}
              emptyTitle={pendingInvites.length > 0 ? "No matches" : "No pending invitations"}
              emptyMessage={
                pendingInvites.length > 0
                  ? "No invitations match the current filters."
                  : "Invites you send will show up here until they're accepted."
              }
            />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between pb-0.5">
            <span className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, totalCount)} of {totalCount}{" "}
              {view === "roster" ? "investigators" : "invitations"}
            </span>
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                <ChevronLeft size={13} strokeWidth={1.8} />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | "…")[]>((acc, n, idx, arr) => {
                  if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                      …
                    </span>
                  ) : (
                    <PageBtn key={item} onClick={() => setPage(item as number)} active={page === item}>
                      {item}
                    </PageBtn>
                  ),
                )}
              <PageBtn
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={13} strokeWidth={1.8} />
              </PageBtn>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Roster table ─────────────────────────────────────────────────────────────

const ROSTER_COLS =
  "grid grid-cols-[minmax(12rem,1.35fr)_minmax(6.5rem,0.75fr)_minmax(5.5rem,0.65fr)_minmax(5.5rem,0.65fr)_minmax(9rem,1.1fr)_3.5rem_5rem] items-center gap-x-3 px-5";

function RosterTable({
  items,
  onRowClick,
  emptyTitle,
  emptyMessage,
}: {
  items: InvestigatorListItem[];
  onRowClick: (person: InvestigatorListItem) => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[i] ?? null);

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className={cn(ROSTER_COLS, "shrink-0 border-b border-[var(--color-line)] py-2.5")}>
        <span className="eyebrow">Investigator</span>
        <span className="eyebrow">Mobile</span>
        <span className="eyebrow">Region</span>
        <span className="eyebrow">Time zone</span>
        <span className="eyebrow">Certifications</span>
        <span className="eyebrow text-center">MFA</span>
        <span className="eyebrow text-right">Joined</span>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <div className="editorial text-[1.25rem] text-[var(--color-text-mid)]">{emptyTitle}</div>
            <p className="mx-auto mt-2 max-w-[18.75rem] text-[0.8125rem] leading-relaxed text-[var(--color-text-lo)]">
              {emptyMessage}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="anim-stagger anim-stagger-tight grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}
        >
          {slots.map((person, i) =>
            person ? (
              <RosterRow key={person.id} person={person} onClick={() => onRowClick(person)} showDivider={i < PER_PAGE - 1} />
            ) : (
              <div key={`pad-${i}`} aria-hidden className={cn(i < PER_PAGE - 1 && "border-b border-[var(--color-line)]")} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function RosterRow({
  person,
  onClick,
  showDivider,
}: {
  person: InvestigatorListItem;
  onClick: () => void;
  showDivider: boolean;
}) {
  const profile = person.profile;
  const displayRegion = person.region ?? profile?.region ?? null;
  const certs = rosterCertifications(person);
  const contactBits = [
    profile?.dob
      ? new Date(`${profile.dob}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      : null,
    profile ? formatHomeAddressShort(profile) : null,
  ].filter((v) => v && v !== "—");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        ROSTER_COLS,
        "h-full min-h-0 cursor-pointer overflow-hidden transition-colors hover:bg-white/[0.022]",
        showDivider && "border-b border-[var(--color-line)]",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
        >
          {getInitials(person.name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[0.8125rem] font-medium leading-tight text-[var(--color-text-hi)]">{person.name}</div>
          <div className="truncate font-mono text-[0.625rem] leading-tight text-[var(--color-text-lo)]">{person.email}</div>
          {contactBits.length > 0 && (
            <div className="mt-0.5 truncate text-[0.625rem] leading-tight text-[var(--color-text-mid)]">
              {contactBits.join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 truncate text-[0.75rem] text-[var(--color-text-mid)]">
        {profile?.phone ?? "—"}
      </div>

      <div className="min-w-0 truncate text-[0.75rem] text-[var(--color-text-mid)]">
        {displayRegion ? REGION_LABELS[displayRegion] : "—"}
      </div>

      <div className="min-w-0 truncate text-[0.6875rem] text-[var(--color-text-mid)]">
        {profile?.timezone ? formatTimezone(profile.timezone) : "—"}
      </div>

      <div className="min-w-0 overflow-hidden">
        <CertificationBadges items={certs} max={4} />
      </div>

      <div className="flex justify-center">
        <span
          title={person.twoFactorEnabled ? "Two-factor enabled" : "Two-factor not set up"}
          className={cn(
            "flex items-center gap-1 text-[0.625rem]",
            person.twoFactorEnabled ? "text-[var(--color-text-lo)]" : "text-[var(--color-neg)]",
          )}
        >
          {person.twoFactorEnabled ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
        </span>
      </div>

      <div className="min-w-0 text-right font-mono text-[0.6875rem] leading-tight text-[var(--color-text-lo)]">
        {new Date(person.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

// ─── Pending invitations table ────────────────────────────────────────────────

const INVITE_COLS =
  "grid grid-cols-[minmax(10rem,1.1fr)_minmax(9rem,1fr)_minmax(5.5rem,0.65fr)_minmax(5.5rem,0.65fr)_minmax(6rem,0.7fr)_minmax(6.5rem,0.75fr)_5.5rem_8.5rem] items-center gap-x-2 px-4";

function InvitesTable({
  items,
  busyKey,
  onResend,
  onRevoke,
  emptyTitle,
  emptyMessage,
}: {
  items: Invitation[];
  busyKey: string | null;
  onResend: (invitation: Invitation) => void;
  onRevoke: (invitation: Invitation) => void;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const slots = Array.from({ length: PER_PAGE }, (_, i) => items[i] ?? null);

  return (
    <div className="surface flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className={cn(INVITE_COLS, "shrink-0 border-b border-[var(--color-line)] py-2.5")}>
        <span className="eyebrow">Name</span>
        <span className="eyebrow">Email</span>
        <span className="eyebrow">Mobile</span>
        <span className="eyebrow">Region</span>
        <span className="eyebrow">Time zone</span>
        <span className="eyebrow">Roles</span>
        <span className="eyebrow">Expires</span>
        <span className="eyebrow text-right">Actions</span>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <div className="editorial text-[1.25rem] text-[var(--color-text-mid)]">{emptyTitle}</div>
            <p className="mx-auto mt-2 max-w-[18.75rem] text-[0.8125rem] leading-relaxed text-[var(--color-text-lo)]">
              {emptyMessage}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="anim-stagger anim-stagger-tight grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(0, 1fr))` }}
        >
          {slots.map((inv, i) =>
            inv ? (
              <InviteRow
                key={inv.id}
                invitation={inv}
                busyKey={busyKey}
                onResend={() => onResend(inv)}
                onRevoke={() => onRevoke(inv)}
                showDivider={i < PER_PAGE - 1}
              />
            ) : (
              <div key={`pad-${i}`} aria-hidden className={cn(i < PER_PAGE - 1 && "border-b border-[var(--color-line)]")} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invitation,
  busyKey,
  onResend,
  onRevoke,
  showDivider,
}: {
  invitation: Invitation;
  busyKey: string | null;
  onResend: () => void;
  onRevoke: () => void;
  showDivider: boolean;
}) {
  const resending = busyKey === `resend:${invitation.id}`;
  const revoking = busyKey === `revoke:${invitation.id}`;
  const [justResent, setJustResent] = useState(false);
  const profile = invitation.profile;
  const displayRegion = profile?.region ?? null;

  return (
    <div className={cn(INVITE_COLS, "h-full min-h-0 overflow-hidden", showDivider && "border-b border-[var(--color-line)]")}>
      <div className="min-w-0 truncate text-[0.8125rem] font-medium leading-tight text-[var(--color-text-hi)]">
        {profile?.fullName ?? "—"}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
          <Mail size={12} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
        </div>
        <div className="min-w-0 truncate text-[0.75rem] leading-tight text-[var(--color-text-mid)]">
          {invitation.email}
        </div>
      </div>

      <div className="min-w-0 truncate text-[0.75rem] text-[var(--color-text-mid)]">
        {profile?.phone ?? "—"}
      </div>

      <div className="min-w-0 truncate text-[0.75rem] text-[var(--color-text-mid)]">
        {displayRegion ? REGION_LABELS[displayRegion] : "—"}
      </div>

      <div className="min-w-0 truncate text-[0.6875rem] text-[var(--color-text-mid)]">
        {formatTimezone(profile?.timezone)}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-hidden">
        {invitation.roles.map((role) => (
          <RoleChip key={role} role={role} />
        ))}
      </div>

      <div className="flex items-center gap-1 font-mono text-[0.6875rem] leading-tight text-[var(--color-text-lo)]">
        <Clock size={10} />
        {new Date(invitation.expiresAt).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          disabled={resending || revoking}
          onClick={() => {
            onResend();
            setJustResent(true);
            setTimeout(() => setJustResent(false), 3000);
          }}
          title="Resend invitation email"
          className="flex items-center gap-1.5 rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1.5 text-[0.65625rem] font-medium text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] transition-colors disabled:opacity-50"
        >
          {resending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : justResent ? (
            <Check size={11} className="text-[#4ade80]" />
          ) : (
            <RotateCw size={11} />
          )}
          {justResent ? "Sent" : "Resend"}
        </button>
        <button
          disabled={resending || revoking}
          onClick={onRevoke}
          aria-label="Revoke invitation"
          title="Revoke invitation"
          className="shrink-0 rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] hover:bg-white/[0.05] hover:text-[var(--color-neg)] transition-colors disabled:opacity-50"
        >
          {revoking ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function PageBtn({
  children,
  onClick,
  disabled,
  active,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "grid h-7 min-w-[1.75rem] place-items-center rounded-[0.4375rem] px-1.5 font-mono text-[0.6875rem] transition-colors",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_rgba(74,127,255,0.4)]"
          : "text-[var(--color-text-mid)] hover:bg-[var(--color-ink-3)] hover:text-[var(--color-text-hi)]",
        disabled && "pointer-events-none opacity-30",
      )}
    >
      {children}
    </button>
  );
}
