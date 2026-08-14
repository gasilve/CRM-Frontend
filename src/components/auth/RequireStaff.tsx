import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Gate for routes reserved for staff (admin/investigator).
 * Plain "user" accounts are bounced back to the dashboard.
 * Must be nested under <RequireAuth /> so session/MFA/role checks already ran.
 */
export default function RequireStaff() {
  const { hasAnyRole } = useAuth();

  if (!hasAnyRole("admin", "investigator")) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
