import { cn } from "@/lib/cn";

const palette = [
  "from-[#4a7fff] to-[#7aa1ff]",
  "from-[#34d399] to-[#22d3ee]",
  "from-[#f59e0b] to-[#f97316]",
  "from-[#a78bfa] to-[#f472b6]",
  "from-[#22d3ee] to-[#4a7fff]",
  "from-[#fb7185] to-[#f59e0b]",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  initials,
  size = 28,
  className,
}: {
  initials: string;
  size?: number;
  className?: string;
}) {
  const grad = palette[hash(initials) % palette.length];
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-gradient-to-br text-[0.625rem] font-medium tracking-wider text-white/90 shadow-[inset_0_0.0625rem_0_rgba(255,255,255,0.2)]",
        grad,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
