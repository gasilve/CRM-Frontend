import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, KeyRound } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { errorBannerClass, inputClass, labelClass, primaryButtonClass } from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const tokenError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (tokenError || !token) {
    return (
      <AuthLayout title="Link expired">
        <div className={errorBannerClass}>This reset link is invalid or has expired.</div>
        <Link to="/forgot-password" className={`${primaryButtonClass} mt-4 inline-flex`}>
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

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
      const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
      if (resetError) {
        setError(resetError.message ?? "Could not reset your password.");
        return;
      }
      navigate("/login", { replace: true });
    } catch {
      setError("Could not reset your password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div>
          <label className={labelClass} htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoFocus
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
          {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          Reset password
        </button>
      </form>
    </AuthLayout>
  );
}
