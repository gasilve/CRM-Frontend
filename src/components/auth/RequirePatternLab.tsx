import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPatternLab } from "@/lib/dev-access";

/** Route guard — Pattern Lab is DEV + Valentin allowlist only. */
export default function RequirePatternLab({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!canAccessPatternLab(user?.email)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
