import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSession, signOut, asAppSession, type Role } from "@/lib/auth-client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  twoFactorEnabled: boolean;
}

interface AuthContextValue {
  isPending: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  roles: Role[];
  hasRole: (role: Role) => boolean;
  hasAnyRole: (...roles: Role[]) => boolean;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = useSession();
  const session = asAppSession(data);
  const roles = session?.roles ?? [];

  const value = useMemo<AuthContextValue>(
    () => ({
      isPending,
      isAuthenticated: !!session,
      user: session?.user ?? null,
      roles,
      hasRole: (role) => roles.includes(role),
      hasAnyRole: (...check) => check.some((role) => roles.includes(role)),
      logout: async () => {
        await signOut();
      },
      refresh: () => void refetch(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending, session?.user.id, session?.user.twoFactorEnabled, roles.join(",")],
  );

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
  if (!auth.user?.twoFactorEnabled) return "/mfa-setup";
  if (auth.roles.length === 0) return "/awaiting-access";
  return "/";
}
