import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import { errorBannerClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";
import { useAuth, getPostAuthPath } from "@/contexts/AuthContext";

export default function MfaVerify() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isPending) return;
    const target = getPostAuthPath(auth);
    if (target && target !== "/mfa-setup") navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled, auth.roles.length]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
      if (verifyError) {
        setError(verifyError.message ?? "Invalid code.");
        return;
      }
      auth.refresh();
      navigate("/", { replace: true });
    } catch {
      setError("Could not verify this code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Two-factor authentication"
      title="Enter your code"
      subtitle={
        useBackupCode
          ? "Enter one of your saved backup codes."
          : "Open your authenticator app and enter the current 6-digit code."
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error ? <div className={errorBannerClass}>{error}</div> : null}
        <div>
          <label className={labelClass} htmlFor="code">
            {useBackupCode ? "Backup code" : "Authentication code"}
          </label>
          <input
            id="code"
            required
            autoFocus
            inputMode={useBackupCode ? "text" : "numeric"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} text-center tracking-[0.3em]`}
            placeholder={useBackupCode ? "xxxxxxxxxx" : "000000"}
          />
        </div>
        <button type="submit" disabled={loading || !code} className={primaryButtonClass}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          Verify
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setUseBackupCode((v) => !v);
            setCode("");
            setError(null);
          }}
        >
          {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
        </button>
      </form>
    </AuthLayout>
  );
}
