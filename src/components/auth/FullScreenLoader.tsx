import { Loader2 } from "lucide-react";

export default function FullScreenLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--color-ink-0)]">
      <Loader2 size={22} className="animate-spin text-[var(--color-text-lo)]" />
    </div>
  );
}
