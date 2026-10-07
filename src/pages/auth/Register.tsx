import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import FullScreenLoader from "@/components/auth/FullScreenLoader";
import {
  errorBannerClass,
  footerTextClass,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";
import { useAuth, getPostAuthPath } from "@/contexts/AuthContext";
import { isMfaRequired } from "@/lib/mfa";

export default function Register() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isPending) return;
    const target = getPostAuthPath(auth);
    if (target) navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled, auth.roles.length]);

  if (auth.isAuthenticated) return <FullScreenLoader message="Signing you in" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({ email, password, name });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account.");
        return;
      }
      auth.refresh();
      if (isMfaRequired()) {
        navigate("/mfa-setup", { replace: true, state: { password } });
        return;
      }
      navigate("/", { replace: true });
    } catch {
      setError("Could not create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" showThemePicker>
      <form className="flex flex-col gap-4 sm:gap-5" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div>
          <label className={labelClass} htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            required
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Jane Investigator"
          />
        </div>
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
            placeholder="you@truecognition.ai"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder="Repeat your password"
          />
        </div>
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Create account
        </button>
      </form>
      <p className={`mt-6 ${footerTextClass}`}>
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-[var(--color-accent-2)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
