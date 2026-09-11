import { createContext, useContext, useMemo, type ReactNode } from "react";
import { clearQueryCache } from "@/lib/query-cache";
import { isMfaRequired } from "@/lib/mfa";
import {
  useSession,
  signOut,
  asAppSession,
  type CaseScope,
  type EffectiveAccess,
  type FieldAccessLevel,
  type PeopleScope,
  type Permission,
  type RoleSummary,
  type ScheduleScope,
} from "@/lib/auth-client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  twoFactorEnabled: boolean;
}

export interface AuthContextValue {
  isPending: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  roles: RoleSummary[];
  isSuperadmin: boolean;
  caseScope: CaseScope;
  peopleScope: PeopleScope;
  scheduleScope: ScheduleScope;
  /** True when the signed-in user holds this permission. */
  can: (permission: Permission) => boolean;
  /** True when they hold at least one of these. */
  canAny: (...permissions: Permission[]) => boolean;
  /** How much of a protected field they may see — "write" when unrestricted. */
  fieldAccess: (field: string) => FieldAccessLevel;
  /** False only when the field is hidden outright. */
  canSee: (field: string) => boolean;
  canEdit: (field: string) => boolean;
  logout: () => Promise<void>;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_ACCESS: EffectiveAccess = {
  roles: [],
  isSuperadmin: false,
  permissions: [],
  caseScope: "none",
  peopleScope: "self",
  scheduleScope: "own",
  fields: {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = useSession();
  const session = asAppSession(data);
  const access = session?.access ?? EMPTY_ACCESS;

  const value = useMemo<AuthContextValue>(() => {
    const can = (permission: Permission) => access.isSuperadmin || access.permissions.includes(permission);
    const fieldAccess = (field: string): FieldAccessLevel =>
      access.isSuperadmin ? "write" : (access.fields[field] ?? "write");

    return {
      isPending,
      isAuthenticated: !!session,
      user: session?.user ?? null,
      roles: access.roles,
      isSuperadmin: access.isSuperadmin,
      caseScope: access.caseScope,
      peopleScope: access.peopleScope,
      scheduleScope: access.scheduleScope,
      can,
      canAny: (...permissions) => permissions.some(can),
      fieldAccess,
      canSee: (field) => fieldAccess(field) !== "hidden",
      canEdit: (field) => fieldAccess(field) === "write",
      logout: async () => {
        // Cached API data belongs to this user — never let it survive sign-out.
        clearQueryCache();
        await signOut();
      },
      refresh: () => void refetch(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPending,
    session?.user.id,
    session?.user.twoFactorEnabled,
    access.isSuperadmin,
    access.permissions.join(","),
    access.roles.map((r) => r.id).join(","),
    access.caseScope,
    access.peopleScope,
    access.scheduleScope,
    JSON.stringify(access.fields),
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Where a session should land next. `null` means "not authenticated — show /login". */
export function getPostAuthPath(auth: AuthContextValue): string | null {
  if (!auth.isAuthenticated) return null;
  if (isMfaRequired() && !auth.user?.twoFactorEnabled) return "/mfa-setup";
  if (auth.roles.length === 0) return "/awaiting-access";
  return "/";
}
