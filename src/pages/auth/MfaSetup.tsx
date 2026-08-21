import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { BeamLoader, LoadingCaption } from "@/components/ui/LoadingState";
import AuthLayout from "@/components/auth/AuthLayout";
import {
  errorBannerClass,
  inputClass,
  labelClass,
  mutedLinkClass,
  primaryButtonClass,
} from "@/components/auth/form";
import { authClient } from "@/lib/auth-client";
import { useAuth, getPostAuthPath } from "@/contexts/AuthContext";

type Step = "password" | "verify";

/** Passed from register / invite / login so we don't re-ask for the password. */
export type MfaSetupLocationState = {
  password?: string;
  from?: string;
};

export default function MfaSetup() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as MfaSetupLocationState | null) ?? {};

  const [step, setStep] = useState<Step>(navState.password ? "verify" : "password");
  const [password, setPassword] = useState(navState.password ?? "");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!!navState.password);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const returnTo = navState.from || "/";

  useEffect(() => {
    if (auth.isPending) return;
    if (!auth.isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    const target = getPostAuthPath(auth);
    if (target && target !== "/mfa-setup") navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled, auth.roles.length]);

  const enableWithPassword = async (pwd: string): Promise<boolean> => {
    const { data, error: enableError } = await authClient.twoFactor.enable({ password: pwd });
    if (enableError || !data) {
      setError(enableError?.message ?? "Could not start MFA setup.");
      setStep("password");
      setBootstrapping(false);
      return false;
    }
    setTotpUri(data.totpURI);
    setStep("verify");
    setBootstrapping(false);
    // Drop password from history so a refresh / back doesn't keep it around.
    navigate(".", { replace: true, state: { from: returnTo } });
    return true;
  };

  useEffect(() => {
    if (!navState.password || autoStarted.current || auth.isPending || !auth.isAuthenticated) return;
    if (auth.user?.twoFactorEnabled) return;
    autoStarted.current = true;
    setLoading(true);
    void enableWithPassword(navState.password).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isPending, auth.isAuthenticated, auth.user?.twoFactorEnabled]);

  const manualSecret = totpUri ? new URLSearchParams(totpUri.split("?")[1] ?? "").get("secret") : null;

  const onEnable = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await enableWithPassword(password);
    } catch {
      setError("Could not start MFA setup. Try again.");
      setBootstrapping(false);
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
      if (verifyError) {
        setError(verifyError.message ?? "That code didn't match. Try again.");
        return;
      }
      auth.refresh();
      navigate(returnTo, { replace: true });
    } catch {
      setError("Could not verify this code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (bootstrapping || (step === "verify" && !totpUri && loading)) {
    return (
      <AuthLayout title="Setting up MFA">
        <div className="flex flex-col items-center gap-3 py-6" role="status" aria-live="polite" aria-busy="true">
          <BeamLoader className="w-32" />
          <LoadingCaption>Preparing authenticator</LoadingCaption>
        </div>
      </AuthLayout>
    );
  }

  if (step === "password") {
    return (
      <AuthLayout
        title="Set up MFA"
        subtitle="Confirm your password once to generate your authenticator QR."
      >
        <form className="flex flex-col gap-4" onSubmit={onEnable}>
          {error ? <div className={errorBannerClass}>{error}</div> : null}
          <div>
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading || !password} className={primaryButtonClass}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            Continue
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Two-factor setup" maxWidth="58rem" maxHeight="calc(100vh - 4rem)">
      {error ? <div className={`${errorBannerClass} mb-5`}>{error}</div> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col items-center gap-5 lg:items-stretch">
          {totpUri ? (
            <div className="mx-auto rounded-[1rem] border border-[var(--color-line-2)] bg-white p-4 shadow-[0_0.5rem_1.5rem_-0.75rem_rgba(15,23,64,0.18)]">
              <QRCode value={totpUri} size={196} />
            </div>
          ) : null}
          <p className="text-center text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)] lg:text-left">
            Scan with Google Authenticator, Authy, or 1Password.
          </p>

          {manualSecret ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(manualSecret);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center justify-between gap-2 rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--color-line-3)]"
            >
              <span className="truncate font-mono text-[0.75rem] tracking-wide text-[var(--color-text-mid)]">
                {manualSecret}
              </span>
              <span className={`shrink-0 flex items-center gap-1 ${mutedLinkClass}`}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-center gap-6 rounded-[1rem] border border-[var(--color-line-2)] bg-[var(--color-accent-soft)] px-6 py-10 sm:px-10">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_0.5rem_1.25rem_-0.375rem_var(--color-accent-glow)]">
            <ShieldCheck size={26} strokeWidth={2} />
          </div>
          <div className="text-center">
            <h2 className="editorial text-[1.75rem] leading-tight text-[var(--color-text-hi)] sm:text-[2rem]">
              Enter the code
            </h2>
            <p className="mt-1.5 text-[0.875rem] text-[var(--color-text-mid)]">
              The 6-digit code from your authenticator app
            </p>
          </div>
          <form className="flex w-full max-w-[22rem] flex-col gap-5" onSubmit={onVerify}>
            <input
              id="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              className="w-full rounded-[0.75rem] border-2 border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-4 py-4 text-center font-mono text-[2rem] tracking-[0.4em] text-[var(--color-text-hi)] shadow-[inset_0_0.0625rem_0_var(--color-surface-shine)] transition-colors focus:border-[var(--color-accent)] focus:outline-none"
              placeholder="000000"
              maxLength={8}
            />
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className={primaryButtonClass}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Finish setup
            </button>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
