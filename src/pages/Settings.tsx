import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">Settings</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-lo)]">System preferences &amp; configuration</p>
      </div>
      <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
        <SettingsIcon size={32} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
        <div className="editorial text-[22px] text-[var(--color-text-mid)]">Coming soon</div>
        <p className="max-w-[300px] text-[13px] leading-relaxed text-[var(--color-text-lo)]">
          User management · Notification preferences · Integrations · API keys.
        </p>
      </div>
    </div>
  );
}
