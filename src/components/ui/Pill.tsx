import { cn } from "@/lib/cn";

type Variant = "neutral" | "pos" | "neg" | "warn" | "info";

const map: Record<Variant, string> = {
  neutral: "pill",
  pos: "pill pill-pos",
  neg: "pill pill-neg",
  warn: "pill pill-warn",
  info: "pill pill-info",
};

export function Pill({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return <span className={cn(map[variant], className)}>{children}</span>;
}
