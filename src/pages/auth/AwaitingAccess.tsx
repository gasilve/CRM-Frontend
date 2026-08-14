import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, LogOut, RefreshCw } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { secondaryButtonClass } from "@/components/auth/form";
import { useAuth, getPostAuthPath } from "@/contexts/AuthContext";

export default function AwaitingAccess() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isPending) return;
    if (!auth.isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    const target = getPostAuthPath(auth);
    if (target && target !== "/awaiting-access") navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled, auth.roles.length]);

  return (
    <AuthLayout eyebrow="Signed in" title="Awaiting access" subtitle={undefined}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
          <Hourglass size={20} strokeWidth={1.4} />
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">
          You&apos;re signed in as <strong className="text-[var(--color-text-hi)]">{auth.user?.email}</strong>, but no
          role has been assigned yet. An administrator needs to grant you access before you can use the console.
        </p>
        <div className="flex w-full flex-col gap-2.5">
          <button type="button" onClick={() => auth.refresh()} className={secondaryButtonClass}>
            <RefreshCw size={14} />
            Check again
          </button>
          <button type="button" onClick={() => void auth.logout().then(() => navigate("/login"))} className={secondaryButtonClass}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
