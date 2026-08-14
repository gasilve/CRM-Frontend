import { cn } from "@/lib/cn";
import { formatRoleLabel } from "@/lib/format";
import type { Role } from "@/lib/auth-client";

export function RoleChip({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.6875rem] font-medium",
        role === "admin"
          ? "bg-[rgba(74,127,255,0.15)] text-[#7aa1ff]"
          : role === "investigator"
            ? "bg-[rgba(74,222,128,0.15)] text-[#4ade80]"
            : "bg-[rgba(148,163,184,0.18)] text-[var(--color-text-mid)]",
      )}
    >
      {formatRoleLabel(role)}
    </span>
  );
}
