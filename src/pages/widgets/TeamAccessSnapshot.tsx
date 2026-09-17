import { ShieldCheck } from "lucide-react";
import { usersApi, rolesApi, REGION_LABELS } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useWidgetLayout } from "@/lib/widget-layout";
import { useAuth } from "@/contexts/AuthContext";
import { WidgetHero, WidgetMetricStrip, WidgetSplit } from "@/components/widgets/WidgetChrome";
import { MiniBarList, WidgetEmpty, WidgetErrorState, WidgetLoading, WidgetShell } from "@/components/widgets/WidgetShell";

export function TeamAccessSnapshot() {
  const { density, showSecondary } = useWidgetLayout();
  const { canAny } = useAuth();
  const canViewUsers = canAny("admin.users", "team.view", "cases.assign", "schedule.manage");
  const canViewRoles = canAny("admin.roles", "admin.users", "team.invite");

  const { data: users, loading: uLoading, error: uError } = useQuery(
    canViewUsers ? "dashboard:users-list" : null,
    () => usersApi.list(),
    { staleMs: 60_000, enabled: canViewUsers },
  );
  const { data: roles } = useQuery(canViewRoles && showSecondary ? "dashboard:roles-list" : null, () => rolesApi.list(), {
    staleMs: 60_000,
    enabled: canViewRoles && showSecondary,
  });

  if (!canViewUsers) {
    return (
      <WidgetShell title="Team & Access" icon={ShieldCheck} eyebrow="Administration">
        <WidgetEmpty icon={ShieldCheck} label="Restricted — you don't have team visibility." />
      </WidgetShell>
    );
  }

  const list = users?.users ?? [];
  const withTwoFactor = list.filter((u) => u.twoFactorEnabled).length;
  const byRegion = new Map<string, number>();
  for (const u of list) byRegion.set(u.region ?? "unassigned", (byRegion.get(u.region ?? "unassigned") ?? 0) + 1);

  return (
    <WidgetShell title="Team & Access" icon={ShieldCheck} eyebrow="Administration">
      {uLoading && !users ? (
        <WidgetLoading />
      ) : uError ? (
        <WidgetErrorState />
      ) : list.length === 0 ? (
        <WidgetEmpty icon={ShieldCheck} label="No team members yet." />
      ) : density === "dense" ? (
        <WidgetHero value={list.length} label="Team members" delta={`${withTwoFactor} with 2FA`} />
      ) : (
        <WidgetSplit
          showSecondary={showSecondary}
          primary={
            <div className="flex min-h-0 flex-col gap-3">
              <WidgetMetricStrip
                columns={2}
                metrics={[
                  { key: "t", label: "Team members", value: list.length },
                  {
                    key: "2fa",
                    label: "2FA enabled",
                    value: `${withTwoFactor}/${list.length}`,
                    tone: withTwoFactor < list.length ? "#f59e0b" : "#4ade80",
                  },
                ]}
              />
              <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">By region</div>
              <MiniBarList
                rows={[...byRegion.entries()].map(([r, count]) => ({
                  key: r,
                  label: r === "unassigned" ? "Unassigned" : REGION_LABELS[r as keyof typeof REGION_LABELS],
                  value: count,
                }))}
              />
            </div>
          }
          secondary={
            roles && roles.roles.length > 0 ? (
              <div>
                <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Roles</div>
                <MiniBarList
                  rows={roles.roles
                    .filter((r) => r.memberCount > 0)
                    .sort((a, b) => b.memberCount - a.memberCount)
                    .map((r) => ({ key: r.id, label: r.name, value: r.memberCount }))}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </WidgetShell>
  );
}
