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

/** Roles are injected server-side by the `customSession` plugin — not part
 * of the client's default TS types, so this app treats them as an untyped
 * passthrough field rather than pulling in crm-api's server types. */
export type Role = "admin" | "investigator" | "user";

export interface AppSessionData {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    twoFactorEnabled: boolean;
  };
  roles: Role[];
}

export const asAppSession = (data: unknown): AppSessionData | null => {
  if (!data || typeof data !== "object") return null;
  const d = data as { user?: unknown; roles?: unknown };
  if (!d.user) return null;
  return { user: d.user as AppSessionData["user"], roles: (d.roles as Role[]) ?? [] };
};

export const INVITE_TOKEN_HEADER = "x-invite-token";
