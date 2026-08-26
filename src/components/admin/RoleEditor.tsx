import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CaseScope, FieldAccessLevel, PeopleScope, ScheduleScope } from "@/lib/auth-client";
import type { AccessCatalog, RoleDetail, RolePayload } from "@/lib/crm-api";
import { ErrorBanner, inputClass, labelClass, SectionHeader, Segmented, Toggle } from "./primitives";

const ROLE_COLORS = ["#4a7fff", "#4ade80", "#f59e0b", "#a78bfa", "#22d3ee", "#f472b6", "#fb923c", "#94a3b8"];

const FIELD_LEVEL_META: Record<FieldAccessLevel, { label: string; title: string; tint: string; icon: typeof Eye }> = {
  hidden: { label: "Hidden", title: "Not shown at all", tint: "#f87171", icon: EyeOff },
  masked: { label: "Masked", title: "Only the last few characters are shown", tint: "#f59e0b", icon: Lock },
  read: { label: "View", title: "Can see it but not change it", tint: "#22d3ee", icon: Eye },
  write: { label: "Edit", title: "Full access", tint: "#4ade80", icon: Pencil },
};

export interface RoleDraft {
  name: string;
  description: string;
  color: string;
  caseScope: CaseScope;
  peopleScope: PeopleScope;
  scheduleScope: ScheduleScope;
  permissions: Set<string>;
  fieldRules: Record<string, FieldAccessLevel>;
}

export const draftFromRole = (role: RoleDetail): RoleDraft => ({
  name: role.name,
  description: role.description ?? "",
  color: role.color ?? ROLE_COLORS[0],
  caseScope: role.caseScope,
  peopleScope: role.peopleScope,
  scheduleScope: role.scheduleScope,
  permissions: new Set(role.permissions),
  fieldRules: { ...role.fieldRules },
});

export const emptyDraft = (): RoleDraft => ({
  name: "",
  description: "",
  color: ROLE_COLORS[0],
  caseScope: "assigned",
  peopleScope: "self",
  scheduleScope: "own",
  permissions: new Set<string>(),
  fieldRules: {},
});

export const draftToPayload = (draft: RoleDraft): RolePayload => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  color: draft.color,
  caseScope: draft.caseScope,
  peopleScope: draft.peopleScope,
  scheduleScope: draft.scheduleScope,
  permissions: [...draft.permissions],
  fieldRules: draft.fieldRules,
});

const sameSet = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every((v) => b.has(v));

const sameRules = (a: Record<string, FieldAccessLevel>, b: Record<string, FieldAccessLevel>): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? "write") === (b[k] ?? "write"));
};

export function RoleEditor({
  role,
  catalog,
  onSave,
  onDelete,
  saving,
  error,
}: {
  /** `null` while composing a brand-new role. */
  role: RoleDetail | null;
  catalog: AccessCatalog;
  onSave: (payload: RolePayload) => void;
  onDelete?: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<RoleDraft>(() => (role ? draftFromRole(role) : emptyDraft()));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(role ? draftFromRole(role) : emptyDraft());
    setConfirmDelete(false);
  }, [role?.id, role?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Super Admin role always has everything and is deliberately not editable.
  const locked = role?.isSystem ?? false;

  const baseline = useMemo(() => (role ? draftFromRole(role) : emptyDraft()), [role]);
  const dirty =
    draft.name !== baseline.name ||
    draft.description !== baseline.description ||
    draft.color !== baseline.color ||
    draft.caseScope !== baseline.caseScope ||
    draft.peopleScope !== baseline.peopleScope ||
    draft.scheduleScope !== baseline.scheduleScope ||
    !sameSet(draft.permissions, baseline.permissions) ||
    !sameRules(draft.fieldRules, baseline.fieldRules);

  const requiresByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of catalog.permissionGroups)
      for (const def of group.permissions) map.set(def.key, def.requires ?? []);
    return map;
  }, [catalog]);

  /**
   * Ticking a permission pulls in its prerequisites, and unticking one drops
   * anything that depended on it, so a role can never be saved in a state the
   * API would silently repair.
   */
  const togglePermission = (key: string, next: boolean) => {
    setDraft((prev) => {
      const permissions = new Set(prev.permissions);
      if (next) {
        const visit = (k: string) => {
          if (permissions.has(k)) return;
          permissions.add(k);
          for (const req of requiresByKey.get(k) ?? []) visit(req);
        };
        visit(key);
      } else {
        permissions.delete(key);
        let changed = true;
        while (changed) {
          changed = false;
          for (const held of [...permissions]) {
            if ((requiresByKey.get(held) ?? []).some((req) => !permissions.has(req))) {
              permissions.delete(held);
              changed = true;
            }
          }
        }
      }
      return { ...prev, permissions };
    });
  };

  const setFieldRule = (field: string, level: FieldAccessLevel) => {
    setDraft((prev) => {
      const fieldRules = { ...prev.fieldRules };
      if (level === "write") delete fieldRules[field];
      else fieldRules[field] = level;
      return { ...prev, fieldRules };
    });
  };

  const setAllFieldsInGroup = (fields: { key: string; maskable: boolean }[], level: FieldAccessLevel) => {
    setDraft((prev) => {
      const fieldRules = { ...prev.fieldRules };
      for (const f of fields) {
        if (level === "write") delete fieldRules[f.key];
        else fieldRules[f.key] = level;
      }
      return { ...prev, fieldRules };
    });
  };

  const scopeRow = <T extends string>(
    id: "caseScope" | "peopleScope" | "scheduleScope",
    value: T,
    onChange: (next: T) => void,
  ) => {
    const def = catalog.scopes[id];
    const active = def.options.find((o) => o.value === value);
    return (
      <div key={id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
        <div className="min-w-[12rem] flex-1">
          <div className="text-[0.8125rem] text-[var(--color-text-hi)]">{def.label}</div>
          <div className="text-[0.71875rem] text-[var(--color-text-lo)]">{active?.description ?? def.description}</div>
        </div>
        <Segmented
          value={value}
          disabled={locked}
          onChange={onChange}
          options={def.options.map((o) => ({ value: o.value as T, label: o.label, title: o.description }))}
        />
      </div>
    );
  };

  const restrictedCount = Object.keys(draft.fieldRules).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
        {locked && (
          <div className="flex items-start gap-2.5 rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]/50 px-3.5 py-3">
            <Lock size={13} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
            <p className="text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">
              Super Admin always has full access to everything and can't be changed or deleted. This is what keeps you
              from locking yourself out. Give people this role sparingly.
            </p>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <section>
          <SectionHeader title="Identity" hint="What this role is called wherever it appears in the app." />
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label className={labelClass} htmlFor="role-name">Name</label>
                <input
                  id="role-name"
                  value={draft.name}
                  disabled={locked}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Case Manager"
                  className={cn(inputClass, "disabled:opacity-60")}
                />
              </div>
              <div>
                <span className={labelClass}>Colour</span>
                <div className="flex h-[2.3125rem] items-center gap-1.5">
                  {ROLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={locked}
                      aria-label={`Use colour ${c}`}
                      onClick={() => setDraft((p) => ({ ...p, color: c }))}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-transform disabled:opacity-40",
                        draft.color === c ? "scale-110 border-white/80" : "border-transparent hover:scale-105",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="role-description">Description</label>
              <input
                id="role-description"
                value={draft.description}
                disabled={locked}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                placeholder="Runs the office side of cases — intake, scheduling and reports."
                className={cn(inputClass, "disabled:opacity-60")}
              />
            </div>
          </div>
        </section>

        <section>
          <SectionHeader
            title="How much they see"
            hint="Set the reach of this role before worrying about individual permissions."
          />
          <div className="divide-y divide-[var(--color-line)] rounded-[0.75rem] border border-[var(--color-line)] px-4">
            {scopeRow("caseScope", draft.caseScope, (v: CaseScope) => setDraft((p) => ({ ...p, caseScope: v })))}
            {scopeRow("peopleScope", draft.peopleScope, (v: PeopleScope) => setDraft((p) => ({ ...p, peopleScope: v })))}
            {scopeRow("scheduleScope", draft.scheduleScope, (v: ScheduleScope) =>
              setDraft((p) => ({ ...p, scheduleScope: v })),
            )}
          </div>
        </section>

        <section>
          <SectionHeader
            title="What they can do"
            hint="Turning something on also turns on whatever it depends on."
          />
          <div className="flex flex-col gap-3">
            {catalog.permissionGroups.map((group) => {
              const on = group.permissions.filter((p) => draft.permissions.has(p.key)).length;
              return (
                <div key={group.id} className="rounded-[0.75rem] border border-[var(--color-line)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
                    <div>
                      <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{group.label}</div>
                      <div className="text-[0.6875rem] text-[var(--color-text-lo)]">{group.description}</div>
                    </div>
                    <span className="shrink-0 font-mono text-[0.625rem] text-[var(--color-text-lo)]">
                      {locked ? group.permissions.length : on}/{group.permissions.length}
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.015]"
                      >
                        <Toggle
                          label={perm.label}
                          disabled={locked}
                          checked={locked || draft.permissions.has(perm.key)}
                          onChange={(next) => togglePermission(perm.key, next)}
                        />
                        <span className="min-w-0">
                          <span className="block text-[0.78125rem] text-[var(--color-text-hi)]">{perm.label}</span>
                          <span className="block text-[0.6875rem] leading-snug text-[var(--color-text-lo)]">
                            {perm.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeader
            title="Sensitive information"
            hint="Everything is fully visible unless you restrict it here. Masked shows only the last few characters."
            action={
              restrictedCount > 0 ? (
                <span className="shrink-0 rounded-full bg-[rgba(245,158,11,0.14)] px-2.5 py-1 font-mono text-[0.625rem] text-[#f59e0b]">
                  {restrictedCount} restricted
                </span>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-3">
            {catalog.fieldGroups.map((group) => (
              <div key={group.id} className="rounded-[0.75rem] border border-[var(--color-line)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
                  <div>
                    <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{group.label}</div>
                    <div className="text-[0.6875rem] text-[var(--color-text-lo)]">{group.description}</div>
                  </div>
                  {!locked && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllFieldsInGroup(group.fields, "hidden")}
                        className="rounded-[0.375rem] border border-[var(--color-line-2)] px-2 py-1 text-[0.625rem] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-mid)]"
                      >
                        Hide all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllFieldsInGroup(group.fields, "write")}
                        className="rounded-[0.375rem] border border-[var(--color-line-2)] px-2 py-1 text-[0.625rem] text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line-3)] hover:text-[var(--color-text-mid)]"
                      >
                        Allow all
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-[var(--color-line)]">
                  {group.fields.map((field) => {
                    const level: FieldAccessLevel = locked ? "write" : (draft.fieldRules[field.key] ?? "write");
                    const levels = catalog.fieldAccessLevels.filter((l) => l !== "masked" || field.maskable);
                    return (
                      <div key={field.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <div className="min-w-[10rem] flex-1">
                          <div className="text-[0.78125rem] text-[var(--color-text-hi)]">{field.label}</div>
                          <div className="text-[0.6875rem] leading-snug text-[var(--color-text-lo)]">
                            {field.description}
                          </div>
                        </div>
                        <Segmented
                          size="sm"
                          value={level}
                          disabled={locked}
                          onChange={(next: FieldAccessLevel) => setFieldRule(field.key, next)}
                          options={levels.map((l) => ({
                            value: l,
                            label: FIELD_LEVEL_META[l].label,
                            title: FIELD_LEVEL_META[l].title,
                            tint: FIELD_LEVEL_META[l].tint,
                          }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!locked && (
        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-4">
          <button
            type="button"
            disabled={saving || !dirty || !draft.name.trim()}
            onClick={() => onSave(draftToPayload(draft))}
            className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.75rem] text-[var(--color-text-hi)] transition-shadow hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] disabled:pointer-events-none disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {role ? "Save changes" : "Create role"}
          </button>
          {dirty && role && (
            <button
              type="button"
              onClick={() => setDraft(draftFromRole(role))}
              className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2 text-[0.75rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
            >
              Discard
            </button>
          )}
          {onDelete && role && (
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-[0.625rem] border px-3.5 py-2 text-[0.75rem] transition-colors",
                confirmDelete
                  ? "border-[var(--color-neg)] bg-[rgba(248,113,113,0.1)] text-[var(--color-neg)]"
                  : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:border-[rgba(248,113,113,0.4)] hover:text-[var(--color-neg)]",
              )}
            >
              <Trash2 size={13} />
              {confirmDelete ? "Click again to delete" : "Delete role"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
