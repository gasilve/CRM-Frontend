import type { RoleSummary } from "@/lib/auth-client";

/** Fallback colour for roles the administrator never picked one for. */
export const DEFAULT_ROLE_COLOR = "#94a3b8";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Role names are author-defined, so display them verbatim; slugs are the fallback. */
export function formatRoleLabel(role: RoleSummary | string): string {
  if (typeof role !== "string") return role.name;
  return role
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRoleList(roles: (RoleSummary | string)[]): string {
  if (roles.length === 0) return "No roles assigned";
  return roles.map(formatRoleLabel).join(" · ");
}

export const roleColor = (role: RoleSummary): string => role.color ?? DEFAULT_ROLE_COLOR;

/**
 * Tints a role chip from its own colour, so custom roles look native without
 * anyone having to add a case to a switch statement.
 */
export function roleChipStyle(role: RoleSummary): React.CSSProperties {
  const color = roleColor(role);
  return {
    backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
    color,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
  };
}
