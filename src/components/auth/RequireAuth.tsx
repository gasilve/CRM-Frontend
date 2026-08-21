import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FullScreenLoader from "./FullScreenLoader";

/**
 * Gate order for every route under AppShell:
 *   1. Not authenticated              → /login
 *   2. Authenticated, MFA not enrolled → /mfa-setup   (security gate — applies regardless of roles)
 *   3. Authenticated + MFA'd, no roles → /awaiting-access
 *   4. Otherwise                       → render the route
 */
export default function RequireAuth() {
  const { isPending, isAuthenticated, user, roles } = useAuth();
  const location = useLocation();

  if (isPending) return <FullScreenLoader message="Loading" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (!user?.twoFactorEnabled) {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (roles.length === 0) {
    return <Navigate to="/awaiting-access" replace />;
  }
  return <Outlet />;
}
