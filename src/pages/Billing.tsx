import { FileText } from "lucide-react";

export default function Billing() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">Billing</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-lo)]">Time logs · Invoice generation · Payment history</p>
      </div>
      <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
        <FileText size={32} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
        <div className="editorial text-[22px] text-[var(--color-text-mid)]">Coming soon</div>
        <p className="max-w-[360px] text-[13px] leading-relaxed text-[var(--color-text-lo)]">
          Time log per case · Invoice generator with auto-populated line items from time entries ·
          PDF export with investigator hours and GPS location data.
        </p>
      </div>
    </div>
  );
}
