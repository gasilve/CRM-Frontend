import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const CRM_API_URL = import.meta.env.VITE_CRM_API_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: CRM_API_URL,
  // Redirects are handled per-call (see Login.tsx) instead of a global
  // onTwoFactorRedirect, so this just registers authClient.twoFactor.*.
  plugins: [twoFactorClient()],
});

export const { useSession, signIn, signOut } = authClient;

/**
 * Permission keys mirror the catalog in crm-api/src/auth/permissions.ts. They
 * are a union rather than plain strings so a typo in `can(...)` fails the build.
 */
export type Permission =
  | "cases.view"
  | "cases.create"
  | "cases.edit"
  | "cases.delete"
  | "cases.assign"
  | "cases.journal.write"
  | "cases.journal.moderate"
  | "intake.view"
  | "intake.manage"
  | "schedule.view"
  | "schedule.manage"
  | "clients.view"
  | "clients.manage"
  | "team.view"
  | "team.manage"
  | "team.invite"
  | "documents.generate"
  | "reports.manage"
  | "assistant.use"
  | "video.use"
  | "admin.roles"
  | "admin.users";

export type CaseScope = "all" | "assigned" | "none";
export type PeopleScope = "all" | "self";
export type ScheduleScope = "all" | "own";
export type FieldAccessLevel = "hidden" | "masked" | "read" | "write";

/** A role as it appears on a user — the full definition lives in the Administration page. */
export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
}

/**
 * The caller's roles flattened into one profile, computed server-side and
 * embedded in the session so the UI never guesses at what it may show.
 */
export interface EffectiveAccess {
  roles: RoleSummary[];
  isSuperadmin: boolean;
  permissions: Permission[];
  caseScope: CaseScope;
  peopleScope: PeopleScope;
  scheduleScope: ScheduleScope;
  /** Only restricted fields appear here; anything absent is fully editable. */
  fields: Partial<Record<string, FieldAccessLevel>>;
}

export interface AppSessionData {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    twoFactorEnabled: boolean;
  };
  access: EffectiveAccess;
}

const EMPTY_ACCESS: EffectiveAccess = {
  roles: [],
  isSuperadmin: false,
  permissions: [],
  caseScope: "none",
  peopleScope: "self",
  scheduleScope: "own",
  fields: {},
};

/** Access is injected server-side by the `customSession` plugin, so it is not part of the client's default types. */
export const asAppSession = (data: unknown): AppSessionData | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as { user?: unknown; access?: unknown };
  if (!d.user) return null;
  return {
    user: d.user as AppSessionData["user"],
    access: (d.access as EffectiveAccess) ?? EMPTY_ACCESS,
  };
};

export const INVITE_TOKEN_HEADER = "x-invite-token";
