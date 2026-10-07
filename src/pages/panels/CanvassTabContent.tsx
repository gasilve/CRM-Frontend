import type { CaseDetail } from "@/lib/crm-api";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";
import { CanvassGrid } from "@/osint/canvass/CanvassGrid";

export function CanvassTabContent({ kase, ctx }: { kase: CaseDetail; ctx: CasePanelCtx }) {
  return <CanvassGrid kase={kase} ctx={ctx} />;
}
