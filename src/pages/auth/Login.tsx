import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Loader2, LogIn } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import {
  errorBannerClass,
  footerTextClass,
  inputClass,
  labelClass,
  mutedLinkClass,
  primaryButtonClass,
} from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";
import { useAuth, getPostAuthPath } from "@/contexts/AuthContext";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isPending) return;
    const target = getPostAuthPath(auth);
    if (target) navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled, auth.roles.length]);

  if (auth.isPending || auth.isAuthenticated) return null;

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Could not sign in.");
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        navigate("/mfa-verify");
        return;
      }
      auth.refresh();
      // Fresh session without MFA yet — carry the password so setup doesn't re-ask.
      navigate("/mfa-setup", { replace: true, state: { password, from: from || "/" } });
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" showThemePicker>
      <form className="flex flex-col gap-4 sm:gap-5" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@accenty.ai"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className={`mb-1.5 ${mutedLinkClass}`}>
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          Sign in
        </button>
      </form>
      <p className={`mt-6 ${footerTextClass}`}>
        No account yet?{" "}
        <Link to="/register" className="font-medium text-[var(--color-accent-2)] hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
