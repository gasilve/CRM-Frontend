import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">Reports</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-lo)]">Company reporting &amp; analytics</p>
      </div>
      <div className="surface flex flex-col items-center justify-center gap-4 py-24 text-center">
        <BarChart3 size={32} strokeWidth={1.2} className="text-[var(--color-text-lo)]" />
        <div className="editorial text-[22px] text-[var(--color-text-mid)]">Coming soon</div>
        <p className="max-w-[360px] text-[13px] leading-relaxed text-[var(--color-text-lo)]">
          Time tracker report · Billing audit · Case activity by period ·
          Investigator performance · Work assignment summary.
        </p>
      </div>
    </div>
  );
}
