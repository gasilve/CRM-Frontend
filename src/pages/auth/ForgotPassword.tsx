import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { errorBannerClass, infoBannerClass, inputClass, labelClass, primaryButtonClass } from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: reqError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (reqError) {
        setError(reqError.message ?? "Could not send a reset link.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send a reset link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={`If an account exists for ${email}, a reset link is on its way.`}>
        <Link to="/login" className={`${primaryButtonClass} inline-flex`}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div className={infoBannerClass}>Invite-only access — you can only reset a password for an existing account.</div>
        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@accenty.ai"
          />
        </div>
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
          Send reset link
        </button>
      </form>
      <p className="mt-6 text-center text-[0.75rem] text-[var(--color-text-mid)]">
        <Link to="/login" className="hover:text-[var(--color-text-hi)]">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
