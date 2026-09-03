
import { Badge } from "@/components/ui/badge";

const variants: Record<string, { className: string; label: string }> = {
  draft: { className: "bg-gray-100 text-gray-700 border-gray-300", label: "Draft" },
  queued: { className: "bg-blue-100 text-blue-700 border-blue-300", label: "Queued" },
  running: { className: "bg-yellow-100 text-yellow-700 border-yellow-300 animate-pulse", label: "Running" },
  completed: { className: "bg-green-100 text-green-700 border-green-300", label: "Completed" },
  failed: { className: "bg-red-100 text-red-700 border-red-300", label: "Failed" },
  cancelled: { className: "bg-gray-100 text-gray-400 border-gray-200 line-through", label: "Cancelled" },
};

export function StatusBadge({ status }: { status: string }) {
  const v = variants[status] || variants.draft;
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}
