import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, UserPlus, ShieldCheck, ShieldAlert } from "lucide-react";
import { BeamLoader, LoadingCaption } from "@/components/ui/LoadingState";
import { cn } from "@/lib/cn";
import { getInitials, formatRoleLabel } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, rolesApi, ApiError, type CrmUser } from "@/lib/crm-api";
import type { Role } from "@/lib/auth-client";
import { RoleChip } from "@/components/team/RoleChip";
import { PendingInvitations } from "@/components/team/PendingInvitations";

const ALL_ROLES: Role[] = ["admin", "investigator", "user"];

export default function Settings() {
  const { user, roles: myRoles, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Settings</h1>
        <p className="mt-1 text-[0.8125rem] text-[var(--color-text-lo)]">Account &amp; team access</p>
      </div>

      <section className="surface p-5">
        <div className="eyebrow mb-4">Your account</div>
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[0.875rem] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
          >
            {user ? getInitials(user.name) : "--"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">{user?.name}</div>
            <div className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">{user?.email}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {myRoles.map((role) => (
              <RoleChip key={role} role={role} />
            ))}
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 text-[0.75rem]",
              user?.twoFactorEnabled ? "text-[var(--color-text-lo)]" : "text-[var(--color-neg)]",
            )}
          >
            {user?.twoFactorEnabled ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {user?.twoFactorEnabled ? "MFA enabled" : "MFA not set up"}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <TeamAdminPanel />
      ) : (
        <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
          <SettingsIcon size={32} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
          <div className="editorial text-[1.375rem] text-[var(--color-text-mid)]">More coming soon</div>
          <p className="max-w-[18.75rem] text-[0.8125rem] leading-relaxed text-[var(--color-text-lo)]">
            Notification preferences &amp; integrations. Team management is available to administrators.
          </p>
        </div>
      )}
    </div>
  );
}

function TeamAdminPanel() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<CrmUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [invitesReloadToken] = useState(0);

  const load = () => {
    usersApi
      .list()
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load team."));
  };

  useEffect(load, []);

  const toggleRole = async (target: CrmUser, role: Role) => {
    const key = `${target.id}:${role}`;
    setBusyKey(key);
    setError(null);
    try {
      const hasIt = target.roles.includes(role);
      const { user: updated } = hasIt ? await rolesApi.revoke(target.id, role) : await rolesApi.assign(target.id, role);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update role.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <section className="surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="eyebrow">Team</div>
          <button
            onClick={() => navigate("/investigators/new")}
            className="flex h-8 items-center gap-1.5 rounded-[0.5rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3 text-[0.71875rem] text-[var(--color-text-hi)] hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] transition-shadow"
          >
            <UserPlus size={12} strokeWidth={1.8} />
            Invite
          </button>
        </div>

        {error && (
          <div className="anim-banner mb-4 rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-2.5 text-[0.78125rem] text-[var(--color-neg)]">
            {error}
          </div>
        )}

        {!users && (
          <div className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite" aria-busy="true">
            <BeamLoader className="w-32" />
            <LoadingCaption>Loading team</LoadingCaption>
          </div>
        )}

        {users && (
          <div className="anim-stagger flex flex-col divide-y divide-[var(--color-line)]">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
                >
                  {getInitials(u.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
                    {u.name}
                    {u.id === me?.id && <span className="ml-1.5 text-[0.6875rem] text-[var(--color-text-lo)]">(you)</span>}
                  </div>
                  <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{u.email}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map((role) => {
                    const active = u.roles.includes(role);
                    const key = `${u.id}:${role}`;
                    return (
                      <button
                        key={role}
                        disabled={busyKey === key}
                        onClick={() => toggleRole(u, role)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium capitalize transition-colors disabled:opacity-50",
                          active
                            ? role === "admin"
                              ? "border-transparent bg-[rgba(74,127,255,0.15)] text-[#7aa1ff]"
                              : role === "investigator"
                                ? "border-transparent bg-[rgba(74,222,128,0.15)] text-[#4ade80]"
                                : "border-transparent bg-[rgba(148,163,184,0.18)] text-[var(--color-text-mid)]"
                            : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
                        )}
                      >
                        {formatRoleLabel(role)}
                      </button>
                    );
                  })}
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-[0.6875rem]",
                    u.twoFactorEnabled ? "text-[var(--color-text-lo)]" : "text-[var(--color-neg)]",
                  )}
                >
                  {u.twoFactorEnabled ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface p-5">
        <div className="eyebrow mb-4">Pending invitations</div>
        <PendingInvitations reloadToken={invitesReloadToken} />
      </section>
    </>
  );
}
