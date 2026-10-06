export default function Reports() {
  return (
    <div className="flex h-full min-h-0 items-center justify-center px-6 py-10">
      <div className="surface w-full max-w-[28rem] px-8 py-14 text-center sm:px-12">
        <div className="relative mx-auto mb-8 grid h-[9.5rem] w-[9.5rem] place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full border border-[var(--color-line)]" />
          <span aria-hidden className="absolute inset-[0.7rem] rounded-full border border-[var(--color-accent)]/45" />
          <span aria-hidden className="absolute inset-[1.45rem] rounded-full bg-[var(--color-accent-soft)]" />
          <span className="editorial relative text-[1.65rem] tracking-[-0.03em] text-[var(--color-text-hi)]">Soon</span>
        </div>
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[var(--color-text-lo)]">Reports</p>
        <h1 className="editorial mt-3 text-[3.4rem] leading-none tracking-[-0.03em] text-[var(--color-text-hi)]">
          Coming soon
        </h1>
      </div>
    </div>
  );
}
