const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  investigator: "Investigator",
  user: "User",
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function formatRoleList(roles: string[]): string {
  if (roles.length === 0) return "No roles assigned";
  return roles.map(formatRoleLabel).join(" · ");
}
