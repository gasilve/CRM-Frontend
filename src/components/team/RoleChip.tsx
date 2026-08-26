import { cn } from "@/lib/cn";
import { roleChipStyle } from "@/lib/format";
import type { RoleSummary } from "@/lib/auth-client";

export function RoleChip({ role, className }: { role: RoleSummary; className?: string }) {
  return (
    <span
      className={cn("rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium", className)}
      style={roleChipStyle(role)}
      title={role.description ?? undefined}
    >
      {role.name}
    </span>
  );
}
