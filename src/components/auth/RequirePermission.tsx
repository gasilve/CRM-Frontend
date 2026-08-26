import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Permission } from "@/lib/auth-client";

/**
 * Gate for routes that need a capability. Holding any one of the listed
 * permissions is enough, which matches how the sidebar decides what to show.
 *
 * Must be nested under <RequireAuth /> so session and MFA checks already ran.
 * This is a convenience for the user, not a security boundary — the API
 * enforces the same permissions on every request.
 */
export default function RequirePermission({ anyOf }: { anyOf: Permission[] }) {
  const { canAny } = useAuth();

  if (!canAny(...anyOf)) return <Navigate to="/" replace />;
  return <Outlet />;
}
