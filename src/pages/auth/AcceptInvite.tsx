import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, UserPlus } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { errorBannerClass, inputClass, labelClass, primaryButtonClass } from "@/components/auth/form";
import { authClient, INVITE_TOKEN_HEADER } from "@/lib/auth-client";
import { invitationsApi, type InvitationPreview, ApiError } from "@/lib/crm-api";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABELS: Record<string, string> = { admin: "Administrator", investigator: "Investigator" };

export default function AcceptInvite() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPreviewError("This invite link is missing a token.");
      setLoadingPreview(false);
      return;
    }
    invitationsApi
      .preview(token)
      .then(setPreview)
      .catch((err) => {
        setPreviewError(err instanceof ApiError ? err.message : "This invitation is invalid or has expired.");
      })
      .finally(() => setLoadingPreview(false));
  }, [token]);

  if (auth.isAuthenticated) {
    return (
      <AuthLayout title="Already signed in">
        <p className="text-center text-[0.8125rem] text-[var(--color-text-mid)]">
          You&apos;re signed in as <strong className="text-[var(--color-text-hi)]">{auth.user?.email}</strong>. Sign
          out first to accept an invitation for a different account.
        </p>
        <Link to="/" className={`${primaryButtonClass} mt-5`}>
          Go to console
        </Link>
      </AuthLayout>
    );
  }

  if (loadingPreview) {
    return (
      <AuthLayout title="Checking your invitation…">
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-lo)]" />
        </div>
      </AuthLayout>
    );
  }

  if (previewError || !preview) {
    return (
      <AuthLayout title="Invitation unavailable">
        <div className={errorBannerClass}>{previewError ?? "This invitation is invalid or has expired."}</div>
        <p className="mt-4 text-center text-[0.75rem] text-[var(--color-text-mid)]">
          Ask an administrator to send a new invitation, or{" "}
          <Link to="/login" className="text-[var(--color-accent-2)] hover:underline">
            sign in
          </Link>
          .
        </p>
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
    setSubmitting(true);
    try {
      const { error: signUpError } = await authClient.signUp.email(
        { email: preview.email, password, name },
        { headers: { [INVITE_TOKEN_HEADER]: token } },
      );
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account.");
        return;
      }
      auth.refresh();
      navigate("/mfa-setup", { replace: true, state: { password } });
    } catch {
      setError("Could not create your account. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const roleList = preview.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");

  return (
    <AuthLayout
      eyebrow="You're invited"
      title="Create your account"
      subtitle={`Joining as ${roleList} · ${preview.email}`}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div>
          <label className={labelClass} htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Jane Investigator"
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
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
          Create account
        </button>
      </form>
    </AuthLayout>
  );
}
