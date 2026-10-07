/**
 * MedicalCanvassPanel — Panel draggable del grid del case detail.
 * Usa el mismo PanelShell que todos los otros panels (Assignment, Files, etc.)
 * y embebe el CanvassPanel con las CSS vars del sistema.
 */
import { lazy, Suspense, useState } from "react";
import { Stethoscope } from "lucide-react";
import { PanelShell } from "@/pages/case-detail-panels";
import { PanelLoader } from "@/components/ui/LoadingState";
import type { CasePanelCtx } from "@/pages/case-detail-widgets";

const CanvassPanel = lazy(() =>
  import("@/osint/components/investigations/CanvassPanel").then((m) => ({
    default: m.CanvassPanel,
  }))
);

const PRODIGY_BASE = "/api-proxy";

function cssVar(name: string): string {
  if (typeof document === "undefined") return "#888";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

export function MedicalCanvassPanel({ ctx }: { ctx: CasePanelCtx }) {
  const kase = ctx.case;
  const [ready, setReady] = useState(false);

  const isMedical = ((kase as any)._prodigy_case_types ?? [(kase as any)._prodigy_type]).includes("medical_canvass");

  const meta = (kase as any)._prodigy_meta ?? {
    claim_number: kase.claimNumber,
    body_parts: null,
    client_company: kase.client?.company ?? null,
    adjuster_name: kase.adjusterName,
  };

  const inv = {
    id: Number(kase.id),
    subject_name: kase.subjectName,
    subject_dob: kase.subjectDob,
    subject_addresses: (kase.addresses ?? []).map((a) =>
      [a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")
    ),
    subject_phones: (kase as any)._prodigy_phones ?? [],
    extra_metadata: meta,
  };

  if (!isMedical) {
    return (
      <PanelShell title="Medical Canvass" icon={<Stethoscope size={11} strokeWidth={1.8} />}>
        <div className="flex h-full items-center justify-center">
          <p className="text-[0.75rem] text-[var(--color-text-lo)]">Not a medical canvass case</p>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Medical Canvass"
      icon={<Stethoscope size={11} strokeWidth={1.8} />}
      action={
        meta.claim_number ? (
          <span className="font-mono text-[0.5625rem] text-[var(--color-text-lo)]">
            #{meta.claim_number}
          </span>
        ) : undefined
      }
    >
      <div className="h-full min-h-0 overflow-auto">
        <Suspense fallback={<PanelLoader message="Loading canvass…" />}>
          <CanvassPanel
            inv={inv}
            meta={meta}
            isDark={true}
            base={PRODIGY_BASE}
            canSeePII={true}
            userRole="admin"
            acc={cssVar("--color-accent")}
            sec={cssVar("--color-text-mid")}
            txt={cssVar("--color-text-hi")}
            bg1={cssVar("--color-ink-2")}
            bg2={cssVar("--color-ink-1")}
            bdr={cssVar("--color-line-2")}
            mut={cssVar("--color-text-lo")}
          />
        </Suspense>
      </div>
    </PanelShell>
  );
}
