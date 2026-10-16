import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HardDrive, HelpCircle, Loader2, Mail, Plus, ShieldAlert, ShieldCheck, Shield, UserPlus, Users2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials, roleChipStyle, roleColor } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { PanelLoader } from "@/components/ui/LoadingState";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { ErrorBanner } from "@/components/admin/primitives";
import { RoleEditor } from "@/components/admin/RoleEditor";
import { QuestionBankTab } from "@/components/admin/QuestionBankTab";
import { StorageBrowser } from "@/components/admin/StorageBrowser";
import {
  ApiError,
  rolesApi,
  usersApi,
  type AccessCatalog,
  type CrmUser,
  type RoleDetail,
  type RolePayload,
} from "@/lib/crm-api";

type Tab = "roles" | "people" | "invitations" | "questions" | "storage";

export default function Administration() {
  const { can } = useAuth();
  const canEditRoles = can("admin.roles");
  const canAssignRoles = can("admin.users");
  const canManageQuestions = can("admin.questionBank");

  const tabs = useMemo(() => {
    const out: { id: Tab; label: string; icon: typeof Shield }[] = [];
    if (canEditRoles || canAssignRoles) out.push({ id: "roles", label: "Roles & permissions", icon: Shield });
    if (canAssignRoles) out.push({ id: "people", label: "People", icon: Users2 });
    if (can("team.invite")) out.push({ id: "invitations", label: "Invitations", icon: Mail });
    if (canManageQuestions) out.push({ id: "questions", label: "Question bank", icon: HelpCircle });
    if (canEditRoles || canAssignRoles) out.push({ id: "storage", label: "Video storage", icon: HardDrive });
    return out;
  }, [canEditRoles, canAssignRoles, canManageQuestions, can]);

  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "roles");

  const [catalog, setCatalog] = useState<AccessCatalog | null>(null);
  const [roles, setRoles] = useState<RoleDetail[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([rolesApi.catalog(), rolesApi.list()])
      .then(([cat, res]) => {
        if (cancelled) return;
        setCatalog(cat);
        setRoles(res.roles);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Could not load the access settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Administration</h1>
        <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
          {tab === "storage"
            ? "Staging on the left, cold storage on the right. Double-click a video to play it."
            : "Who is on the team, and what each of them is allowed to see and do"}
        </p>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-[var(--color-line)]">
        {tabs.map((t) => (
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
          </button>
        ))}
      </div>

      {loadError && <ErrorBanner message={loadError} />}

      {tab === "roles" &&
        (catalog && roles ? (
          <RolesTab catalog={catalog} roles={roles} setRoles={setRoles} readOnly={!canEditRoles} />
        ) : (
          !loadError && <PanelLoader message="Loading roles" />
        ))}

      {tab === "people" && <PeopleTab roles={roles ?? []} onRolesChanged={(next) => setRoles(next)} />}

      {tab === "invitations" && <InvitationsTab />}

      {tab === "questions" && <QuestionBankTab />}

      {tab === "storage" && (
        <div className="min-h-0 flex-1">
          <StorageBrowser />
        </div>
      )}
    </div>
  );
}

// ─── Roles ──────────────────────────────────────────────────────────────────

function RolesTab({
  catalog,
  roles,
  setRoles,
  readOnly,
}: {
  catalog: AccessCatalog;
  roles: RoleDetail[];
  setRoles: (roles: RoleDetail[]) => void;
  readOnly: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(roles[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = creating ? null : (roles.find((r) => r.id === selectedId) ?? roles[0] ?? null);

  const save = async (payload: RolePayload) => {
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        const { role } = await rolesApi.create(payload);
        setRoles([...roles, role]);
        setSelectedId(role.id);
        setCreating(false);
      } else if (selected) {
        const { role } = await rolesApi.update(selected.id, payload);
        setRoles(roles.map((r) => (r.id === role.id ? role : r)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the role.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await rolesApi.remove(selected.id);
      const next = roles.filter((r) => r.id !== selected.id);
      setRoles(next);
      setSelectedId(next[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
      <div className="surface flex w-[17rem] shrink-0 flex-col gap-1.5 overflow-y-auto p-3">
        {roles.map((role) => {
          const active = !creating && selected?.id === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(role.id);
                setError(null);
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-[0.625rem] border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                  : "border-transparent hover:bg-white/[0.025]",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: roleColor(role) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] text-[var(--color-text-hi)]">{role.name}</span>
                <span className="block font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                  {role.memberCount} {role.memberCount === 1 ? "person" : "people"}
                  {role.isSystem && " · system"}
                </span>
              </span>
            </button>
          );
        })}

        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className={cn(
              "mt-1 flex items-center gap-2 rounded-[0.625rem] border border-dashed px-3 py-2.5 text-[0.75rem] transition-colors",
              creating
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                : "border-[var(--color-line-2)] text-[var(--color-text-lo)] hover:border-[var(--color-line-3)] hover:text-[var(--color-text-mid)]",
            )}
          >
            <Plus size={13} strokeWidth={1.8} />
            New role
          </button>
        )}
      </div>

      <div className="surface min-w-0 flex-1 overflow-hidden p-5">
        {creating || selected ? (
          <RoleEditor
            key={creating ? "new" : selected!.id}
            role={creating ? null : selected}
            catalog={catalog}
            saving={saving}
            error={error}
            onSave={save}
            onDelete={!readOnly && selected && !selected.isSystem ? remove : undefined}
          />
        ) : (
          <div className="grid h-full place-items-center text-[0.8125rem] text-[var(--color-text-lo)]">
            Select a role to see what it can do.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── People ─────────────────────────────────────────────────────────────────

function PeopleTab({ roles, onRolesChanged }: { roles: RoleDetail[]; onRolesChanged: (roles: RoleDetail[]) => void }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<CrmUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .list()
      .then((res) => setUsers(res.users))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the team."));
  }, []);

  const toggleRole = async (target: CrmUser, role: RoleDetail) => {
    const held = target.roles.some((r) => r.id === role.id);
    const nextIds = held
      ? target.roles.filter((r) => r.id !== role.id).map((r) => r.id)
      : [...target.roles.map((r) => r.id), role.id];

    setBusyId(target.id);
    setError(null);
    try {
      const { user: updated } = await rolesApi.setUserRoles(target.id, nextIds);
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
      // Member counts on the Roles tab are now stale.
      onRolesChanged(
        roles.map((r) => (r.id === role.id ? { ...r, memberCount: r.memberCount + (held ? -1 : 1) } : r)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this person's roles.");
    } finally {
      setBusyId(null);
    }
  };

  if (!users && !error) return <PanelLoader message="Loading team" />;

  return (
    <div className="surface flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      {error && <ErrorBanner message={error} />}

      <p className="text-[0.75rem] text-[var(--color-text-lo)]">
        A person gets the most permissive combination of every role they hold.
      </p>

      <div className="flex flex-col divide-y divide-[var(--color-line)]">
        {users?.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
            >
              {getInitials(u.name)}
            </div>
            <div className="min-w-[10rem] flex-1">
              <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
                {u.name}
                {u.id === me?.id && <span className="ml-1.5 text-[0.6875rem] text-[var(--color-text-lo)]">(you)</span>}
              </div>
              <div className="flex items-center gap-2 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
                <span className="truncate">{u.email}</span>
                <span
                  title={u.twoFactorEnabled ? "MFA enabled" : "MFA not set up"}
                  className={u.twoFactorEnabled ? "text-[var(--color-text-lo)]" : "text-[var(--color-neg)]"}
                >
                  {u.twoFactorEnabled ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {busyId === u.id && <Loader2 size={12} className="animate-spin text-[var(--color-text-lo)]" />}
              {roles.map((role) => {
                const held = u.roles.some((r) => r.id === role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => toggleRole(u, role)}
                    title={role.description ?? undefined}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors disabled:opacity-50",
                      !held &&
                        "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-mid)]",
                    )}
                    style={held ? roleChipStyle(role) : undefined}
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Invitations ────────────────────────────────────────────────────────────

function InvitationsTab() {
  const navigate = useNavigate();
  return (
    <div className="surface flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-[var(--color-text-lo)]">
          People who have been invited but haven't set up their account yet.
        </p>
        <button
          type="button"
          onClick={() => navigate("/investigators/new")}
          className="flex shrink-0 items-center gap-1.5 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3.5 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)]"
        >
          <UserPlus size={13} strokeWidth={1.8} />
          Invite someone
        </button>
      </div>
      <PendingInvitations />
    </div>
  );
}
