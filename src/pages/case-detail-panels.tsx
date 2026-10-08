import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns2, MapPin, User, Plus, X, Loader2, Car, ShieldQuestion, StickyNote,
  ImagePlus, ScanFace, UserPlus, Lock, Paperclip, FileText, Eye, Home, Briefcase, Users2, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getInitials } from "@/lib/format";
import { useWidgetSize } from "@/lib/widget-size";
import { SERVICE_LABELS, TAG_COLORS, placeholderPhotoFor, type InvTag } from "@/lib/mock-data";
import {
  casesApi,
  caseFilePath,
  fileDownloadUrl,
  geocodeApi,
  noteVersionsOf,
  stakeoutApi,
  type CaseDetail,
  type CaseStatus,
  type CaseDayEntry,
  type CaseDayEntryType,
  type UpdateCasePayload,
} from "@/lib/crm-api";
import { ImageComparisonModal } from "@/components/case/ImageComparisonModal";
import { CasePhoto } from "@/components/case/EntityModal";
import { chooseSubjectPhoto } from "@/lib/subject-photo";
import { FileViewerModal } from "@/components/case/FileViewerModal";
import { CaseMap } from "@/components/case/CaseMap";
import { StakeoutMapModal } from "@/components/stakeout/StakeoutMapModal";
import { useQuery } from "@/lib/query-cache";
import type { CasePanelCtx } from "./case-detail-widgets";
import { formatCalendarDate } from "@/lib/dates";

const fmtFileSize = (bytes: number | null): string => {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_CONFIG: Record<CaseStatus, { label: string; dot: string; pill: string; text: string }> = {
  open: { label: "Open", dot: "#4ade80", pill: "rgba(74,222,128,0.15)", text: "#4ade80" },
  suspended: { label: "Suspended", dot: "#f59e0b", pill: "rgba(245,158,11,0.15)", text: "#f59e0b" },
  closed: { label: "Closed", dot: "#5b6680", pill: "rgba(91,102,128,0.15)", text: "#7a8499" },
};

export function Field({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div className={mono ? "font-mono text-[0.71875rem] text-[var(--color-text-hi)]" : "text-[0.78125rem] text-[var(--color-text-hi)]"}>
        {value}
      </div>
    </div>
  );
}

export function PanelShell({ title, icon, children, className, action }: { title: string; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("surface flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div className="widget-shell-header eyebrow shrink-0 border-b border-[var(--color-line)] px-4 py-2.5 flex items-center gap-2">
        {icon}
        {title}
        {action && <span className="ml-auto normal-case tracking-normal">{action}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const maskSsn = (ssn: string | null): string => {
  if (!ssn) return "—";
  const digits = ssn.replace(/\D/g, "");
  return digits.length >= 4 ? `•••-••-${digits.slice(-4)}` : ssn;
};

/**
 * Renders a protected field, or a "restricted" placeholder when the viewer's
 * role hides it. The value is already stripped server-side — this just explains
 * the gap instead of showing a bare em-dash the user cannot account for.
 */
function ProtectedField({
  ctx,
  field,
  label,
  value,
  mono = true,
}: {
  ctx: CasePanelCtx;
  field: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (ctx.canSee(field)) return <Field label={label} value={value} mono={mono} />;
  return (
    <div>
      <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div className="inline-flex items-center gap-1 font-mono text-[0.71875rem] text-[var(--color-text-lo)]" title="Hidden by your role's privacy settings">
        <Lock size={9} strokeWidth={2} />
        Restricted
      </div>
    </div>
  );
}

// ─── Subject photo ──────────────────────────────────────────────────────────

type PhotoTab = "subject" | "vehicle" | "residence" | "cohabitant";

type PanelPhoto = {
  id: string;
  caseId: string;
  url: string;
  label: string;
  kind: "primary" | "surveillance";
  capturedAt: string;
};

const PHOTO_TABS: { id: PhotoTab; label: string; icon: typeof User }[] = [
  { id: "subject", label: "Subject", icon: User },
  { id: "vehicle", label: "Vehicle", icon: Car },
  { id: "residence", label: "Residence", icon: Home },
  { id: "cohabitant", label: "Cohabitant", icon: Users2 },
];

function photosForTab(c: CaseDetail, tab: PhotoTab, animalPlaceholder: boolean): PanelPhoto[] {
  if (tab === "subject") {
    const entries = c.days.flatMap((d) => d.entries.filter((e) => e.type === "photo_person"));
    const url = c.subjectPhotoUrl ?? (animalPlaceholder ? placeholderPhotoFor(c.id) : null);
    const primary: PanelPhoto[] = url
      ? [{
          id: `${c.id}-primary`,
          caseId: c.id,
          url,
          label: "Subject primary",
          kind: "primary",
          capturedAt: c.dateOpened,
        }]
      : [];
    return [
      ...primary,
      ...entries.map((e) => ({
        id: e.id,
        caseId: c.id,
        url: e.photoUrl ?? placeholderPhotoFor(e.id),
        label: e.body || "Field photo",
        kind: "surveillance" as const,
        capturedAt: e.createdAt,
      })),
    ];
  }

  if (tab === "vehicle") {
    const fromVehicles = c.vehicles
      .filter((v) => v.photoUrl)
      .map((v) => ({
        id: `vehicle-${v.id}`,
        caseId: c.id,
        url: v.photoUrl!,
        label: [v.year, v.color, v.make, v.model].filter(Boolean).join(" ") || v.licensePlate || "Vehicle",
        kind: "surveillance" as const,
        capturedAt: c.dateOpened,
      }));
    const fromDays = c.days.flatMap((d) =>
      d.entries
        .filter((e) => e.type === "photo_vehicle")
        .map((e) => ({
          id: e.id,
          caseId: c.id,
          url: e.photoUrl ?? placeholderPhotoFor(e.id),
          label: e.body || "Vehicle photo",
          kind: "surveillance" as const,
          capturedAt: e.createdAt,
        })),
    );
    return [...fromVehicles, ...fromDays];
  }

  if (tab === "cohabitant") {
    return c.people
      .filter((p) => p.relationship === "cohabitant")
      .map((p) => ({
        id: `person-${p.id}`,
        caseId: c.id,
        url: p.photoUrl ?? placeholderPhotoFor(p.id),
        label: p.name,
        kind: "surveillance" as const,
        capturedAt: p.updatedAt ?? p.createdAt,
      }));
  }

  // Residence photos aren't a dedicated API field yet.
  return [];
}

const isDirectPhoto = (url: string) => /^(https?:|data:|blob:)/.test(url);

/** A public or blob URL renders directly. A case-file id is loaded through the case. */
function PanelPhotoImg({ photo }: { photo: PanelPhoto }) {
  if (isDirectPhoto(photo.url)) {
    return <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" />;
  }
  return <CasePhoto caseId={photo.caseId} photoUrl={photo.url} alt={photo.label} className="h-full w-full" />;
}

export function SubjectPhotoPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const pending = c.caseNumber === "PENDING";
  const { pxWidth, pxHeight } = useWidgetSize();
  const [tab, setTab] = useState<PhotoTab>("subject");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [uploadedId, setUploadedId] = useState<string | undefined>();
  const portraitFileId = useMemo(() => {
    if (c.subjectPhotoUrl) return null;
    const files = [...(c.files ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return chooseSubjectPhoto(files)?.id ?? null;
  }, [c.subjectPhotoUrl, c.files]);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const loadBlob = ctx.loadFileBlob;
  useEffect(() => {
    if (!portraitFileId) {
      setPortraitUrl(null);
      setPortraitLoading(false);
      return;
    }
    let revoke: string | null = null;
    let cancelled = false;
    setPortraitLoading(true);
    const load = loadBlob ? loadBlob(portraitFileId) : casesApi.fileBlob(c.id, portraitFileId);
    load
      .then((blob) => {
        if (cancelled) return;
        revoke = URL.createObjectURL(blob);
        setPortraitUrl(revoke);
        setPortraitLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setPortraitUrl(null);
          setPortraitLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [portraitFileId, c.id, loadBlob]);

  const shown = portraitUrl ? { ...c, subjectPhotoUrl: portraitUrl } : c;
  const photos = useMemo(() => photosForTab(shown, tab, !pending), [shown, tab, pending]);

  useEffect(() => {
    setActiveId(photos[0]?.id ?? null);
  }, [tab, photos]);

  const primary = photos.find((p) => p.id === activeId) ?? photos[0] ?? null;
  const gallery = photos.filter((p) => p.id !== primary?.id);
  // Wide widget → thumbs on the right; tall widget → thumbs below.
  const galleryBeside = gallery.length > 0 && pxWidth > 0 && pxWidth >= pxHeight;

  const openCompare = (probeId?: string) => {
    if (photos.length < 2) return;
    setUploadedId(probeId ?? photos[1]?.id ?? photos[0]?.id);
    setCompareOpen(true);
  };

  if (!ctx.canSee("case.subjectPhoto")) {
    return (
      <PanelShell title="Photos" icon={<User size={11} strokeWidth={1.8} />}>
        <RestrictedPanelBody />
      </PanelShell>
    );
  }

  const thumbBtn = (p: PanelPhoto) => (
    <button
      key={p.id}
      type="button"
      title={`${p.label} · ${fmtDate(p.capturedAt)}`}
      onClick={() => setActiveId(p.id)}
      className={cn(
        "relative h-12 w-12 shrink-0 overflow-hidden rounded-[0.5rem] border bg-[var(--color-ink-2)] transition-opacity hover:opacity-90",
        p.id === activeId ? "border-[var(--color-accent)]" : "border-[var(--color-line-2)]",
      )}
    >
      <PanelPhotoImg photo={p} />
    </button>
  );

  return (
    <PanelShell title="Photos" icon={<User size={11} strokeWidth={1.8} />}>
      <div className="flex h-full min-h-0 flex-col gap-2.5">
        <div className="flex shrink-0 gap-0.5 overflow-x-auto rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-3)] p-0.5">
          {PHOTO_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              title={label}
              className={cn(
                "inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[0.375rem] px-1.5 py-1.5 font-mono text-[0.5625rem] uppercase tracking-wider transition-colors",
                tab === id
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]",
              )}
            >
              <Icon size={11} strokeWidth={1.8} className="shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-1 gap-2",
            galleryBeside ? "flex-row" : "flex-col",
          )}
        >
          <div className="relative min-h-[7.5rem] min-w-0 flex-1 overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]">
            {primary ? (
              <PanelPhotoImg photo={primary} />
            ) : portraitLoading && tab === "subject" ? (
              <div className="grid h-full place-items-center">
                <Loader2 size={18} className="animate-spin text-[var(--color-text-lo)]" />
              </div>
            ) : (
              <div className="grid h-full place-items-center px-4 text-center">
                <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
                  {tab === "residence" ? "No residence photos on file." : `No ${tab} photos on file.`}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => openCompare()}
              disabled={photos.length < 2}
              title="Visual comparison"
              aria-label="Visual comparison"
              className={cn(
                "absolute bottom-2 right-2 z-[1] grid h-8 w-8 place-items-center rounded-[0.5rem] border shadow-lg backdrop-blur transition-colors",
                photos.length < 2
                  ? "cursor-not-allowed border-[var(--color-line)] bg-[var(--color-ink-2)]/70 text-[var(--color-text-lo)] opacity-50"
                  : "border-[var(--color-line)] bg-[var(--color-ink-2)]/92 text-[var(--color-text-mid)] hover:border-[var(--color-line-3)] hover:text-[var(--color-text-hi)]",
              )}
            >
              <Columns2 size={14} strokeWidth={1.8} />
            </button>
          </div>

          {gallery.length > 0 && (
            <div
              className={cn(
                "flex gap-1.5",
                galleryBeside
                  ? "h-full w-12 shrink-0 flex-col overflow-y-auto overflow-x-hidden"
                  : "w-full shrink-0 flex-row overflow-x-auto overflow-y-hidden pb-0.5",
              )}
            >
              {gallery.map(thumbBtn)}
            </div>
          )}
        </div>
      </div>

      <ImageComparisonModal
        open={compareOpen}
        photos={photos}
        uploadedId={uploadedId}
        subjectOnFileId={photos[0]?.id}
        subjectName={c.subjectName}
        caseReference={c.claimNumber ?? c.caseNumber}
        caseId={c.id}
        onClose={() => setCompareOpen(false)}
      />
    </PanelShell>
  );
}

// ─── Identity / Work ────────────────────────────────────────────────────────

export function IdentityPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  return (
    <PanelShell title="Identity" icon={<User size={11} strokeWidth={1.8} />}>
      <div className="space-y-2.5">
        {ctx.canSee("case.subjectAliases") && c.subjectAliases.length > 0 && (
          <div>
            <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">AKA</div>
            <div className="flex flex-wrap gap-1">
              {c.subjectAliases.map((a) => (
                <span key={a} className="rounded-full border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-0.5 text-[0.65625rem] text-[var(--color-text-mid)]">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
        <ProtectedField ctx={ctx} field="case.subjectDob" label="Date of birth" value={formatCalendarDate(c.subjectDob)} />
        {/* Already masked server-side when the role says so; maskSsn keeps the display consistent. */}
        <ProtectedField ctx={ctx} field="case.subjectSsn" label="SSN" value={maskSsn(c.subjectSsn)} />
        <ProtectedField
          ctx={ctx}
          field="case.subjectDriverLicense"
          label="Driver license"
          value={c.subjectDriverLicense ?? "—"}
        />
        {c.subjectLanguage && <Field label="Language" value={c.subjectLanguage} mono={false} />}
        {ctx.canSee("case.subjectDescription") && c.subjectDescription && (
          <div>
            <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Description</div>
            <div className="text-[0.71875rem] leading-relaxed text-[var(--color-text-mid)]">{c.subjectDescription}</div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function WorkPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  // Employment is one privacy field covering all four columns.
  if (!ctx.canSee("case.subjectEmployment")) {
    return (
      <PanelShell title="Work" icon={<UserPlus size={11} strokeWidth={1.8} />}>
        <RestrictedPanelBody />
      </PanelShell>
    );
  }
  return (
    <PanelShell title="Work" icon={<UserPlus size={11} strokeWidth={1.8} />}>
      <div className="space-y-2.5">
        <Field label="Job title" value={c.subjectJobTitle ?? "—"} mono={false} />
        <Field label="Employer" value={c.subjectEmployer ?? "—"} mono={false} />
        {c.subjectEmployerAddress && <Field label="Employer address" value={c.subjectEmployerAddress} mono={false} />}
        <Field label="Status" value={c.subjectWorkStatus ?? "—"} mono={false} />
      </div>
    </PanelShell>
  );
}

function RestrictedPanelBody() {
  return (
    <div className="grid h-full place-items-center gap-1.5 text-center">
      <Lock size={16} strokeWidth={1.5} className="text-[var(--color-text-lo)]" />
      <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
        Restricted by your role
      </span>
    </div>
  );
}

// ─── Client / Adjuster ──────────────────────────────────────────────────────

export function ClientAdjusterPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  return (
    <PanelShell title="Client & adjuster">
      <div className="space-y-2.5">
        <ProtectedField ctx={ctx} field="case.client" label="Client" value={c.client?.company ?? "—"} mono={false} />
        <ProtectedField ctx={ctx} field="case.claimNumber" label="Claim #" value={c.claimNumber ?? "—"} />
        {ctx.canSee("case.policyNumber") && c.policyNumber && <Field label="Policy #" value={c.policyNumber} />}
        <ProtectedField ctx={ctx} field="case.adjuster" label="Adjuster" value={c.adjusterName ?? "—"} mono={false} />
        {ctx.canSee("case.adjuster") && c.adjusterEmail && <Field label="Adjuster email" value={c.adjusterEmail} />}
      </div>
    </PanelShell>
  );
}

// ─── Case info ──────────────────────────────────────────────────────────────

export function CaseInfoPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const cfg = STATUS_CONFIG[c.status];
  const [saving, setSaving] = useState(false);

  const changeStatus = async (status: CaseStatus) => {
    if (status === c.status) return;
    setSaving(true);
    try {
      await casesApi.update(c.id, { status });
      ctx.onRefresh();
    } catch {
      /* surfaced via page-level reload on next refresh */
    } finally {
      setSaving(false);
    }
  };

  const primaryAddress = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];
  const city = [primaryAddress?.city, primaryAddress?.state ?? c.state].filter(Boolean).join(", ");

  return (
    <PanelShell
      title="Assignment details"
      action={
        ctx.canEdit ? (
          <select
            value={c.status}
            disabled={saving}
            onChange={(e) => changeStatus(e.target.value as CaseStatus)}
            className="rounded-full border-0 px-2.5 py-1 text-[0.65625rem] font-medium focus:outline-none"
            style={{ background: cfg.pill, color: cfg.text }}
          >
            {(Object.keys(STATUS_CONFIG) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65625rem] font-medium" style={{ background: cfg.pill, color: cfg.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
          </span>
        )
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="space-y-3">
          <ProtectedField ctx={ctx} field="case.client" label="Client" value={c.client?.company ?? "—"} mono={false} />
          <Field label="City" value={city || "—"} mono={false} />
          <Field label="Start time" value={c.startTime ?? "—"} />
          <ProtectedField ctx={ctx} field="case.adjuster" label="Adjuster" value={c.adjusterName ?? "—"} mono={false} />
          <ProtectedField ctx={ctx} field="case.dateOfInjury" label="Date of injury" value={formatCalendarDate(c.dateOfInjury)} />
        </div>
        <div className="space-y-3">
          <ProtectedField ctx={ctx} field="case.claimNumber" label="Claim #" value={c.claimNumber ?? "—"} />
          <ProtectedField ctx={ctx} field="case.policyNumber" label="Policy #" value={c.policyNumber ?? "—"} />
          <Field label="Due date" value={formatCalendarDate(c.dueDate)} />
          <Field label="Days" value={c.daysAllotted != null ? String(c.daysAllotted) : "—"} />
          <Field label="Service" value={SERVICE_LABELS[c.service]} mono={false} />
        </div>
      </div>
    </PanelShell>
  );
}

export function TagsPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  return (
    <PanelShell title="Tags">
      <div className="flex flex-wrap gap-2">
        {c.tags.length === 0 && <span className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">No tags.</span>}
        {c.tags.map((tag) => {
          const col = TAG_COLORS[tag as InvTag];
          return (
            <span key={tag} className="rounded-full px-3 py-1 text-[0.6875rem] font-medium tracking-wide" style={col ? { background: col.bg, color: col.text } : { background: "var(--color-ink-3)", color: "var(--color-text-mid)" }}>
              {tag}
            </span>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ─── Description ────────────────────────────────────────────────────────────

export function DescriptionPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const [value, setValue] = useState(c.description ?? "");
  const save = async () => {
    if (value === (c.description ?? "")) return;
    await casesApi.update(c.id, { description: value });
    ctx.onRefresh();
  };
  if (!ctx.canSee("case.description")) {
    return (
      <PanelShell title="Description">
        <RestrictedPanelBody />
      </PanelShell>
    );
  }
  return (
    <PanelShell title="Description">
      {ctx.canEdit && ctx.canEditField("case.description") ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          placeholder="Case summary / scope of work…"
          className="h-full w-full resize-none rounded-[0.5rem] border border-transparent bg-transparent p-0 text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)] placeholder:text-[var(--color-text-lo)] focus:outline-none"
        />
      ) : (
        <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{c.description || "No description on file."}</p>
      )}
    </PanelShell>
  );
}

// ─── Addresses + map ────────────────────────────────────────────────────────

export function AddressesMapPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const [adding, setAdding] = useState(false);
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  /** Client-only pins for read-only views (pending cases) that can't PATCH addresses. */
  const [localPins, setLocalPins] = useState<Record<string, { lat: number; lng: number }>>({});
  const geocodeAttempted = useRef(new Set<string>());
  const canEdit = ctx.canEdit;
  const onRefresh = ctx.onRefresh;
  const [stakeoutOpen, setStakeoutOpen] = useState(false);
  const canSeeAddresses = ctx.canSee("case.subjectAddresses");
  const stakeouts = useQuery(canSeeAddresses ? `case:${c.id}:stakeout` : null, () => stakeoutApi.list(c.id));

  // Backfill pins for addresses that landed without lat/lng (pre-Photon ingest / pending proposals).
  useEffect(() => {
    const missing = c.addresses.filter(
      (a) => (a.lat == null || a.lng == null) && !geocodeAttempted.current.has(a.id),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    void (async () => {
      let changed = false;
      const pinUpdates: Record<string, { lat: number; lng: number }> = {};
      for (const a of missing) {
        geocodeAttempted.current.add(a.id);
        try {
          const { result } = await geocodeApi.lookup({
            line1: a.line1,
            city: a.city ?? undefined,
            state: a.state ?? undefined,
            zip: a.zip ?? undefined,
          });
          if (cancelled || !result) continue;
          if (canEdit) {
            await casesApi.updateAddress(c.id, a.id, { line1: a.line1, lat: result.lat, lng: result.lng });
            changed = true;
          } else {
            pinUpdates[a.id] = { lat: result.lat, lng: result.lng };
          }
        } catch {
          /* best-effort */
        }
      }
      if (cancelled) return;
      if (Object.keys(pinUpdates).length > 0) {
        setLocalPins((prev) => ({ ...prev, ...pinUpdates }));
      }
      if (changed) onRefresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [c.id, c.addresses, canEdit, onRefresh]);

  useEffect(() => {
    if (focusId && !c.addresses.some((a) => a.id === focusId)) setFocusId(null);
  }, [c.addresses, focusId]);

  const addressesForMap = c.addresses.map((a) => {
    if (a.lat != null && a.lng != null) return a;
    const pin = localPins[a.id];
    return pin ? { ...a, lat: pin.lat, lng: pin.lng } : a;
  });

  const submit = async () => {
    if (!line1.trim()) return;
    setBusy(true);
    try {
      await casesApi.addAddress(c.id, { line1, city, state, zip, isPrimary: c.addresses.length === 0 });
      setLine1(""); setCity(""); setState(""); setZip("");
      setAdding(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (addressId: string) => {
    await casesApi.deleteAddress(c.id, addressId);
    ctx.onRefresh();
  };

  if (!ctx.canSee("case.subjectAddresses")) {
    return (
      <PanelShell title="Addresses & map" icon={<MapPin size={11} strokeWidth={1.8} />}>
        <RestrictedPanelBody />
      </PanelShell>
    );
  }

  const activeId = focusId ?? c.addresses.find((a) => a.isPrimary)?.id ?? c.addresses[0]?.id ?? null;

  return (
    <PanelShell
      title="Addresses & map"
      icon={<MapPin size={11} strokeWidth={1.8} />}
      action={
        <span className="inline-flex items-center gap-2">
          {c.addresses.length > 0 && (
            <button
              type="button"
              onClick={() => setStakeoutOpen(true)}
              title="Open the investigator map"
              aria-label="Open the investigator map"
              className="text-[var(--color-accent-2)]"
            >
              <Maximize2 size={12} />
            </button>
          )}
          {ctx.canEdit && !adding && <button type="button" onClick={() => setAdding(true)} className="text-[var(--color-accent-2)]"><Plus size={13} /></button>}
        </span>
      }
    >
      {stakeoutOpen && (
        <StakeoutMapModal
          caseId={c.id}
          subjectName={c.subjectName}
          addresses={addressesForMap}
          canEdit={ctx.canEdit}
          onChanged={(positions) => stakeouts.mutate({ positions })}
          onClose={() => setStakeoutOpen(false)}
        />
      )}
      <div className="relative h-full min-h-0 min-w-0">
        <CaseMap addresses={addressesForMap} focusAddressId={focusId} stakeouts={stakeouts.data?.positions} />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col gap-1.5 p-2">
          <div className="pointer-events-auto flex max-h-[42%] flex-wrap content-start gap-1 overflow-y-auto">
            {c.addresses.length === 0 && !adding && (
              <span className="rounded-[0.5rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/92 px-2.5 py-1.5 font-mono text-[0.625rem] text-[var(--color-text-lo)] shadow-lg backdrop-blur">
                No addresses on file
              </span>
            )}
            {c.addresses.map((a) => {
              const selected = a.id === activeId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setFocusId(a.id)}
                  title={[a.line1, a.city, a.state, a.zip].filter(Boolean).join(", ")}
                  className={cn(
                    "group inline-flex max-w-full items-center gap-1.5 rounded-[0.5rem] border px-2 py-1.5 text-left shadow-lg backdrop-blur transition-colors",
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                      : "border-[var(--color-line)] bg-[var(--color-ink-2)]/92 text-[var(--color-text-mid)] hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]",
                  )}
                >
                  <MapPin size={11} className="shrink-0 opacity-70" />
                  <span className="min-w-0 truncate text-[0.65625rem] font-medium">{a.line1}</span>
                  {a.isPrimary && (
                    <span className="shrink-0 rounded-full bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.5rem] uppercase tracking-wider text-[var(--color-accent-2)]">
                      Primary
                    </span>
                  )}
                  {ctx.canEdit && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(a.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          void remove(a.id);
                        }
                      }}
                      className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:inline-flex"
                      title="Remove address"
                      aria-label="Remove address"
                    >
                      <X size={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {adding && (
            <div className="pointer-events-auto flex max-w-sm flex-col gap-1 rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 p-2 shadow-lg backdrop-blur">
              <input autoFocus placeholder="Street" value={line1} onChange={(e) => setLine1(e.target.value)} className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
              <div className="flex gap-1">
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
                <input placeholder="St" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="w-10 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
                <input placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} className="w-14 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={submit} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-[0.375rem] bg-[var(--color-accent-soft)] py-1 text-[0.625rem] text-[var(--color-text-hi)]">
                  {busy ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-[0.375rem] border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-text-mid)]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

// ─── Vehicles ───────────────────────────────────────────────────────────────

export function VehiclesPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const [adding, setAdding] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!make.trim() && !model.trim()) return;
    setBusy(true);
    try {
      await casesApi.addVehicle(c.id, { make, model, color, licensePlate: plate, photoUrl: placeholderPhotoFor(`${c.id}-veh-${c.vehicles.length}`) });
      setMake(""); setModel(""); setColor(""); setPlate("");
      setAdding(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vehicleId: string) => {
    await casesApi.deleteVehicle(c.id, vehicleId);
    ctx.onRefresh();
  };

  if (!ctx.canSee("case.vehicles")) {
    return (
      <PanelShell title="Vehicles" icon={<Car size={11} strokeWidth={1.8} />}>
        <RestrictedPanelBody />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Vehicles"
      icon={<Car size={11} strokeWidth={1.8} />}
      action={ctx.canEdit && !adding && <button onClick={() => setAdding(true)} className="text-[var(--color-accent-2)]"><Plus size={13} /></button>}
    >
      {c.vehicles.length === 0 && !adding ? (
        <div className="grid h-full place-items-center">
          <span className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">No vehicles on file.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {c.vehicles.map((v) => (
            <div key={v.id} className="group relative overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)]">
              <img src={v.photoUrl ?? placeholderPhotoFor(v.id)} alt="" className="h-16 w-full object-cover" />
              <div className="bg-[var(--color-ink-3)] px-2 py-1.5">
                <div className="truncate text-[0.71875rem] font-medium text-[var(--color-text-hi)]">
                  {[v.color, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                </div>
                {v.licensePlate && <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{v.licensePlate}</div>}
              </div>
              {ctx.canEdit && (
                <button onClick={() => remove(v.id)} className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block">
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          {adding && (
            <div className="col-span-2 flex flex-col gap-1.5 rounded-[0.625rem] border border-[var(--color-line-2)] p-2.5">
              <div className="flex gap-1.5">
                <input placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} className="w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
                <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} className="w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
              </div>
              <div className="flex gap-1.5">
                <input placeholder="Color" value={color} onChange={(e) => setColor(e.target.value)} className="w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
                <input placeholder="Plate" value={plate} onChange={(e) => setPlate(e.target.value)} className="w-0 flex-1 rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none" />
              </div>
              <div className="flex gap-1.5">
                <button onClick={submit} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-[0.375rem] bg-[var(--color-accent-soft)] py-1 text-[0.625rem] text-[var(--color-text-hi)]">
                  {busy ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                </button>
                <button onClick={() => setAdding(false)} className="rounded-[0.375rem] border border-[var(--color-line)] px-2 py-1 text-[0.625rem] text-[var(--color-text-mid)]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}

// ─── Files ──────────────────────────────────────────────────────────────────

/**
 * Documents carried over from the proposal when the case was accepted. A row
 * with no `storageKey` is one that was listed but could not be saved — it stays
 * listed (losing it would hide that the document exists) and opens a
 * placeholder instead of a broken download.
 */
export function CaseFilesPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const files = c.files ?? [];
  const [viewing, setViewing] = useState<string | null>(null);

  const ctxLoadBlob = ctx.loadFileBlob;
  const ctxHref = ctx.fileDownloadHref;
  const loadBlob = useCallback(
    (fileId: string, signal?: AbortSignal) =>
      ctxLoadBlob ? ctxLoadBlob(fileId, signal) : casesApi.fileBlob(c.id, fileId, signal),
    [c.id, ctxLoadBlob],
  );
  const downloadUrl = useCallback(
    (fileId: string) => (ctxHref ? ctxHref(fileId) : fileDownloadUrl(caseFilePath(c.id, fileId))),
    [c.id, ctxHref],
  );

  const stored = files.filter((f) => f.storageKey).length;

  return (
    <PanelShell
      title="Files"
      icon={<Paperclip size={11} strokeWidth={1.8} />}
      action={
        files.length > 0 && (
          <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
            {stored}/{files.length} stored
          </span>
        )
      }
    >
      {files.length === 0 ? (
        <div className="grid h-full place-items-center px-4">
          <div className="text-center">
            <Paperclip size={18} className="mx-auto text-[var(--color-text-lo)]" strokeWidth={1.6} />
            <p className="mt-2 font-[family-name:var(--font-display)] text-[1.05rem] italic text-[var(--color-text-mid)]">
              No documents yet
            </p>
            <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
              Attachments arrive with the referral email
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {files.map((file) => {
            const stored = Boolean(file.storageKey);
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setViewing(file.id)}
                className="group flex items-center gap-2.5 rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/40"
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-[0.5rem] border",
                    stored
                      ? "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                      : "border-[var(--color-line-2)] text-[var(--color-text-lo)]",
                  )}
                >
                  <FileText size={13} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-hi)]">{file.filename}</div>
                  <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {stored ? `${fmtFileSize(file.sizeBytes)} · ${file.storage}` : "listed, not stored"}
                  </div>
                </div>
                <Eye
                  size={13}
                  className="shrink-0 text-[var(--color-text-lo)] opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            );
          })}
        </div>
      )}

      <FileViewerModal
        open={viewing !== null}
        files={files}
        initialFileId={viewing}
        onClose={() => setViewing(null)}
        loadBlob={loadBlob}
        downloadUrl={downloadUrl}
      />
    </PanelShell>
  );
}

// ─── Assignment ─────────────────────────────────────────────────────────────

export function AssignmentPanel({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  const available = ctx.investigatorOptions.filter((i) => !c.assignments.some((a) => a.userId === i.id));

  const assign = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await casesApi.assign(c.id, selected);
      setSelected("");
      setPicking(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (userId: string) => {
    await casesApi.unassign(c.id, userId);
    ctx.onRefresh();
  };

  return (
    <PanelShell
      title="Assigned investigators"
      action={ctx.canAssign && !picking && available.length > 0 && <button onClick={() => setPicking(true)} className="text-[var(--color-accent-2)]"><Plus size={13} /></button>}
    >
      <div className="flex flex-col gap-3">
        {c.assignments.map((a) => (
          <div key={a.id} className="group flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full text-[0.6875rem] font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}>
              {getInitials(a.user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{a.user.name}</div>
              <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{a.role}</div>
            </div>
            {ctx.canAssign && (
              <button onClick={() => unassign(a.userId)} className="hidden shrink-0 text-[var(--color-text-lo)] hover:text-[var(--color-neg)] group-hover:block">
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {c.assignments.length === 0 && !picking && (
          <div>
            <div className="font-mono text-[0.71875rem] text-[var(--color-text-lo)]">No investigators on this case yet.</div>
            <div className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-mid)]">Assign here or schedule them on the board — same roster.</div>
          </div>
        )}
        {picking && (
          <div className="flex flex-col gap-1.5 rounded-[0.5rem] border border-[var(--color-line-2)] p-2">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none">
              <option value="">Select investigator…</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <button onClick={assign} disabled={busy || !selected} className="flex flex-1 items-center justify-center gap-1 rounded-[0.375rem] bg-[var(--color-accent-soft)] py-1.5 text-[0.6875rem] text-[var(--color-text-hi)] disabled:opacity-50">
                {busy ? <Loader2 size={11} className="animate-spin" /> : "Assign"}
              </button>
              <button onClick={() => setPicking(false)} className="rounded-[0.375rem] border border-[var(--color-line)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--color-text-mid)]">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

// ─── Days / chrono journal ──────────────────────────────────────────────────

const ENTRY_ICON: Record<CaseDayEntryType, typeof StickyNote> = {
  note: StickyNote,
  qa: ShieldQuestion,
  photo_person: ImagePlus,
  photo_vehicle: Car,
  photo_home: Home,
  face_match: ScanFace,
  manager_note: Briefcase,
};

const ENTRY_LABEL: Record<CaseDayEntryType, string> = {
  note: "Note",
  qa: "Q&A",
  photo_person: "Subject photo",
  photo_vehicle: "Vehicle photo",
  photo_home: "Home photo",
  face_match: "Face match",
  manager_note: "Office note",
};

function EntryCard({ entry, caseId }: { entry: CaseDayEntry; caseId: string }) {
  const Icon = ENTRY_ICON[entry.type];
  const isPhoto = entry.type === "photo_person" || entry.type === "photo_vehicle" || entry.type === "photo_home" || entry.type === "face_match";
  const versions = noteVersionsOf(entry);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="group flex gap-2.5 rounded-[0.625rem] border border-[var(--color-line)] p-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-ink-3)] text-[var(--color-accent-2)]">
        <Icon size={13} strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[0.59375rem] uppercase tracking-wider text-[var(--color-text-lo)]">{ENTRY_LABEL[entry.type]}</span>
          <span className="text-[var(--color-text-lo)]">·</span>
          <span className="font-mono text-[0.59375rem] text-[var(--color-text-lo)]">{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {entry.author && <span className="truncate font-mono text-[0.59375rem] text-[var(--color-text-lo)]">· {entry.author.name}</span>}
          {versions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
            >
              Edited · {versions.length} prior
            </button>
          )}
        </div>
        {entry.type === "qa" && (
          <div className="mt-1">
            <div className="text-[0.75rem] font-medium text-[var(--color-text-hi)]">{entry.question}</div>
            <div className="mt-0.5 text-[0.75rem] text-[var(--color-text-mid)]">{entry.body}</div>
          </div>
        )}
        {(entry.type === "note" || entry.type === "manager_note") && (
          <p className="mt-1 text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">{entry.body}</p>
        )}
        {showHistory && versions.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1 border-t border-[var(--color-line)] pt-1.5">
            {[...versions].reverse().map((v, i) => (
              <div key={`${v.at}-${i}`} className="rounded-[0.375rem] bg-[var(--color-ink-3)] px-2 py-1">
                <div className="font-mono text-[0.53125rem] text-[var(--color-text-lo)]">
                  {new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {v.authorName ? ` · ${v.authorName}` : ""}
                </div>
                <p className="text-[0.6875rem] text-[var(--color-text-mid)]">{v.body}</p>
              </div>
            ))}
          </div>
        )}
        {isPhoto && (
          <div className="mt-1.5 flex items-center gap-2">
            <img src={entry.photoUrl ?? placeholderPhotoFor(entry.id)} alt="" className="h-12 w-12 shrink-0 rounded-[0.375rem] object-cover" />
            {entry.body && <span className="text-[0.71875rem] text-[var(--color-text-mid)]">{entry.body}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Physical-folder journal: tabs across the top (one tab per worked date),
 * folder body below. Rendered as a fixed section under the widget grid —
 * not a widget. */
export function CaseJournalFolder({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  // Scope already restricts which cases are reachable, so the permission alone
  // decides whether this viewer can add to the journal.
  const canPost = ctx.canPostJournal;

  const days = useMemo(() => [...c.days].sort((a, b) => a.date.localeCompare(b.date)), [c.days]);

  // Tab id: PRESURV_TAB | day id | pending new-day iso date. The folder always
  // opens on pre-surveillance — the "day zero" of the investigation.
  const [activeTab, setActiveTab] = useState<string>(PRESURV_TAB);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const activeDay = days.find((d) => d.id === activeTab) ?? null;
  const isPending = pendingDate !== null && activeTab === `pending:${pendingDate}`;

  const fmtTab = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const startNewDay = () => {
    const exists = days.find((d) => d.date.slice(0, 10) === newDayDate);
    setAddingDay(false);
    if (exists) {
      setActiveTab(exists.id);
      return;
    }
    setPendingDate(newDayDate);
    setActiveTab(`pending:${newDayDate}`);
  };

  const tabBase =
    "anim-toggle tap relative -mb-px flex shrink-0 items-center gap-1.5 rounded-t-[0.625rem] border px-3.5 py-2 font-mono text-[0.65625rem] tracking-wide";
  const tabActive =
    "z-10 border-[var(--color-line-2)] border-b-transparent bg-[var(--color-ink-2)] text-[var(--color-text-hi)]";
  const tabIdle =
    "translate-y-[0.125rem] border-[var(--color-line)] bg-[var(--color-ink-1)]/70 text-[var(--color-text-lo)] hover:bg-[var(--color-ink-2)]/60 hover:text-[var(--color-text-mid)]";

  return (
    <div className="case-journal-folder">
      {/* Folder tab strip */}
      <div className="flex items-end gap-1 overflow-x-auto px-1">
        <button
          type="button"
          onClick={() => setActiveTab(PRESURV_TAB)}
          className={cn(tabBase, activeTab === PRESURV_TAB ? tabActive : tabIdle)}
          title="Pre-surveillance information"
        >
          <ShieldQuestion size={11} strokeWidth={1.8} />
          PRE-SURV
        </button>
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActiveTab(d.id)}
            className={cn(tabBase, activeTab === d.id ? tabActive : tabIdle)}
          >
            {fmtTab(d.date)}
            <span className="rounded-full bg-[var(--color-ink-3)] px-1.5 text-[0.5625rem] text-[var(--color-text-lo)]">
              {d.entries.length}
            </span>
          </button>
        ))}
        {isPending && (
          <button type="button" className={cn(tabBase, tabActive)}>
            {fmtTab(pendingDate!)}
            <span className="rounded-full bg-[var(--color-accent-soft)] px-1.5 text-[0.5625rem] text-[var(--color-accent-2)]">new</span>
          </button>
        )}
        {canPost && !addingDay && (
          <button
            type="button"
            onClick={() => setAddingDay(true)}
            className={cn(tabBase, tabIdle, "text-[var(--color-accent-2)]")}
            title="Add a day folder"
          >
            <Plus size={11} strokeWidth={2} />
            DAY
          </button>
        )}
        {addingDay && (
          <span className={cn(tabBase, tabIdle, "gap-1 py-1")}>
            <input
              type="date"
              autoFocus
              value={newDayDate}
              onChange={(e) => setNewDayDate(e.target.value)}
              className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-1.5 py-0.5 text-[0.625rem] text-[var(--color-text-hi)] focus:outline-none"
            />
            <button type="button" onClick={startNewDay} className="text-[var(--color-accent-2)]">
              <Plus size={12} strokeWidth={2} />
            </button>
            <button type="button" onClick={() => setAddingDay(false)} className="text-[var(--color-text-lo)] hover:text-[var(--color-neg)]">
              <X size={11} />
            </button>
          </span>
        )}
      </div>

      {/* Folder body */}
      <div className="surface rounded-[0.875rem] rounded-tl-none border border-[var(--color-line-2)] p-5">
        {activeTab === PRESURV_TAB ? (
          <PresurveillanceFolder ctx={ctx} />
        ) : !activeTab && days.length === 0 && !isPending ? (
          <div className="py-8 text-center text-[0.8125rem] text-[var(--color-text-lo)]">
            No journal days yet{canPost ? " — add a day to start." : "."}
          </div>
        ) : (
          <DayFolderContent
            ctx={ctx}
            day={activeDay}
            pendingDate={isPending ? pendingDate : null}
            canPost={canPost}
            onPosted={() => {
              setPendingDate(null);
              ctx.onRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

const PRESURV_TAB = "presurv";

const PRESURV_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  fetched: { label: "Fetched", color: "#4ade80" },
  not_available: { label: "Not available", color: "#7a8499" },
};

/** One case field editable in place — writes through casesApi.update. */
function PresurvEditableField({
  ctx,
  label,
  field,
  value,
  type = "text",
}: {
  ctx: CasePanelCtx;
  label: string;
  /** UpdateCasePayload key this field writes to. */
  field: "subjectName" | "subjectDob" | "claimNumber" | "dueDate";
  value: string | null;
  type?: "text" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = ctx.canEdit && ctx.canEditField(field);

  const save = async () => {
    setBusy(true);
    try {
      const payload: UpdateCasePayload = {};
      payload[field] = draft.trim() || undefined;
      await casesApi.update(ctx.case.id, payload);
      setEditing(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div>
        <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
        <div className="flex items-center gap-1">
          <input
            type={type}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-1.5 py-1 font-mono text-[0.6875rem] text-[var(--color-text-hi)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)] disabled:opacity-50"
          >
            {busy && <Loader2 size={11} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        setDraft(type === "date" && value ? value.slice(0, 10) : value ?? "");
        setEditing(true);
      }}
      className={cn("group text-left", canEdit && "cursor-pointer")}
      title={canEdit ? `Edit ${label.toLowerCase()}` : undefined}
    >
      <div className="mb-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</div>
      <div className="font-mono text-[0.71875rem] text-[var(--color-text-hi)]">
        {value ? (type === "date" ? value.slice(0, 10) : value) : "—"}
        {canEdit && (
          <span className="ml-1.5 font-mono text-[0.5rem] uppercase tracking-wider text-[var(--color-accent-2)] opacity-0 transition-opacity group-hover:opacity-100">
            edit
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * "Day zero" of the case folder — everything known before surveillance starts:
 * the pre-surveillance record (status + summary, both editable), the basic
 * case data (editable in place), and the ingested documents.
 */
function PresurveillanceFolder({ ctx }: { ctx: CasePanelCtx }) {
  const c = ctx.case;
  const ps = c.presurveillance;
  const status = PRESURV_STATUS[ps?.status ?? "pending"] ?? PRESURV_STATUS.pending;
  const files = c.files ?? [];

  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const ctxLoadBlob = ctx.loadFileBlob;
  const ctxHref = ctx.fileDownloadHref;
  const loadBlob = useCallback(
    (fileId: string, signal?: AbortSignal) =>
      ctxLoadBlob ? ctxLoadBlob(fileId, signal) : casesApi.fileBlob(c.id, fileId, signal),
    [c.id, ctxLoadBlob],
  );
  const downloadUrl = useCallback(
    (fileId: string) => (ctxHref ? ctxHref(fileId) : fileDownloadUrl(caseFilePath(c.id, fileId))),
    [c.id, ctxHref],
  );

  const saveSummary = async () => {
    setBusy(true);
    try {
      await casesApi.updatePresurveillance(c.id, { summary: summaryDraft.trim() || null });
      setEditingSummary(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (next: "pending" | "fetched" | "not_available") => {
    setBusy(true);
    try {
      await casesApi.updatePresurveillance(c.id, { status: next });
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const primaryAddress = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="editorial text-[1.125rem] text-[var(--color-text-hi)]">Pre-surveillance information</div>
          <div className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            What is known before the first day in the field
          </div>
        </div>
        {ctx.canEdit ? (
          <select
            value={ps?.status ?? "pending"}
            disabled={busy}
            onChange={(e) => void setStatus(e.target.value as "pending" | "fetched" | "not_available")}
            className="rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider focus:outline-none"
            style={{ color: status.color }}
            title="Pre-surveillance status"
          >
            {Object.entries(PRESURV_STATUS).map(([value, cfg]) => (
              <option key={value} value={value}>
                {cfg.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${status.color} 14%, transparent)`, color: status.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
            {status.label}
          </span>
        )}
      </div>

      {/* Basic data — editable in place */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-4 sm:grid-cols-3">
        <PresurvEditableField ctx={ctx} label="Subject" field="subjectName" value={c.subjectName} />
        <PresurvEditableField ctx={ctx} label="Date of birth" field="subjectDob" value={c.subjectDob} type="date" />
        <PresurvEditableField ctx={ctx} label="Claim #" field="claimNumber" value={c.claimNumber} />
        <PresurvEditableField ctx={ctx} label="Report due" field="dueDate" value={c.dueDate} type="date" />
        <Field label="Primary address" value={primaryAddress?.line1 ?? "—"} />
        <Field label="Client" value={c.client?.company ?? "—"} />
      </div>

      {/* Editable summary */}
      <div className="rounded-[0.75rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            Pre-surveillance summary
          </span>
          {ctx.canEdit && !editingSummary && (
            <button
              type="button"
              onClick={() => {
                setSummaryDraft(ps?.summary ?? "");
                setEditingSummary(true);
              }}
              className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
            >
              {ps?.summary ? "Edit" : "Write"}
            </button>
          )}
        </div>
        {editingSummary ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <textarea
              autoFocus
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              placeholder="Background checks, social media findings, address confirmations, anything gathered ahead of day one…"
              className="min-h-[6rem] resize-none rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-2 text-[0.78125rem] leading-relaxed text-[var(--color-text-hi)] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingSummary(false)}
                className="rounded-[0.5rem] border border-[var(--color-line)] px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-lo)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSummary}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
              >
                {busy && <Loader2 size={11} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        ) : ps?.summary ? (
          <p className="mt-2 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{ps.summary}</p>
        ) : (
          <p className="mt-2 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            Nothing recorded yet{ctx.canEdit ? " — write down what was gathered before day one." : "."}
          </p>
        )}
      </div>

      {/* Case documents */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Paperclip size={11} strokeWidth={1.8} className="text-[var(--color-text-lo)]" />
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            Documents ({files.length})
          </span>
        </div>
        {files.length === 0 ? (
          <p className="font-mono text-[0.6875rem] text-[var(--color-text-lo)]">No documents on this case.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setViewing(file.id)}
                className="group flex items-center gap-2.5 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)]/40 px-2.5 py-2 text-left transition-colors hover:border-[var(--color-accent)]"
              >
                <FileText
                  size={14}
                  strokeWidth={1.8}
                  className={file.storageKey ? "shrink-0 text-[var(--color-text-mid)]" : "shrink-0 text-[var(--color-text-lo)]"}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[0.6875rem] text-[var(--color-text-hi)]">{file.filename}</div>
                  <div className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {file.storageKey ? fmtFileSize(file.sizeBytes) : "listed, not stored"}
                  </div>
                </div>
                <Eye size={13} className="shrink-0 text-[var(--color-text-lo)] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      <FileViewerModal
        open={viewing !== null}
        files={files}
        initialFileId={viewing}
        onClose={() => setViewing(null)}
        loadBlob={loadBlob}
        downloadUrl={downloadUrl}
      />
    </div>
  );
}

function DaySummaryBlock({
  ctx,
  dateIso,
  summary,
  canPost,
}: {
  ctx: CasePanelCtx;
  dateIso: string;
  summary: string | null;
  canPost: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await casesApi.setDaySummary(ctx.case.id, dateIso, draft.trim() || null);
      setEditing(false);
      ctx.onRefresh();
    } finally {
      setBusy(false);
    }
  };

  if (!summary && !canPost) return null;

  return (
    <div className="rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
          Day summary
        </span>
        {canPost && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(summary ?? "");
              setEditing(true);
            }}
            className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
          >
            {summary ? "Edit" : "Write"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="How did the day wrap up?"
            className="min-h-[3.5rem] resize-none rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-[0.5rem] border border-[var(--color-line)] px-2.5 py-1 text-[0.625rem] text-[var(--color-text-lo)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex items-center gap-1 rounded-[0.5rem] bg-[var(--color-accent-soft)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
            >
              {busy && <Loader2 size={10} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      ) : summary ? (
        <p className="mt-1 whitespace-pre-wrap text-[0.75rem] leading-relaxed text-[var(--color-text-mid)]">{summary}</p>
      ) : (
        <p className="mt-1 font-mono text-[0.625rem] text-[var(--color-text-lo)]">No wrap-up written for this day.</p>
      )}
    </div>
  );
}

function DayFolderContent({
  ctx,
  day,
  pendingDate,
  canPost,
  onPosted,
}: {
  ctx: CasePanelCtx;
  day: { id: string; date: string; summary: string | null; entries: CaseDayEntry[] } | null;
  pendingDate: string | null;
  canPost: boolean;
  onPosted: () => void;
}) {
  const c = ctx.case;
  const dateIso = pendingDate ?? day?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<CaseDayEntryType>("note");
  const [question, setQuestion] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const entries = day?.entries ?? [];
  const photos = entries.filter((e) => e.type === "photo_person" || e.type === "photo_vehicle" || e.type === "face_match");
  const rest = entries.filter((e) => !photos.includes(e));

  const submit = async () => {
    if (type === "qa" && !question.trim()) return;
    if (type === "note" && !body.trim()) return;
    setBusy(true);
    try {
      await casesApi.addDayEntry(c.id, {
        date: dateIso,
        type,
        question: type === "qa" ? question : undefined,
        body: body || undefined,
        photoUrl: type === "photo_person" || type === "photo_vehicle" || type === "face_match"
          ? placeholderPhotoFor(`${c.id}-${Date.now()}`)
          : undefined,
      });
      setQuestion("");
      setBody("");
      onPosted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[0.9375rem] font-medium text-[var(--color-text-hi)]">
          {new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </span>
        <span className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </span>
      </div>

      <DaySummaryBlock ctx={ctx} dateIso={dateIso} summary={day?.summary ?? null} canPost={canPost} />

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((e) => (
            <div key={e.id} className="w-36 overflow-hidden rounded-[0.625rem] border border-[var(--color-line-2)]">
              <img src={e.photoUrl ?? placeholderPhotoFor(e.id)} alt="" className="h-24 w-full object-cover" />
              <div className="bg-[var(--color-ink-3)] px-2 py-1">
                <div className="font-mono text-[0.53125rem] uppercase tracking-wider text-[var(--color-text-lo)]">{ENTRY_LABEL[e.type]}</div>
                {e.body && <div className="truncate text-[0.625rem] text-[var(--color-text-mid)]" title={e.body}>{e.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {rest.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            caseId={c.id}
          />
        ))}
        {entries.length === 0 && (
          <div className="grid place-items-center rounded-[0.625rem] border border-dashed border-[var(--color-line)] py-8 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {pendingDate ? "New day — add the first entry below." : "Nothing logged for this day."}
          </div>
        )}
      </div>

      {canPost && (
        <div className="flex flex-col gap-1.5 rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-1)]/40 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(ENTRY_LABEL) as CaseDayEntryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[0.625rem] transition-colors",
                  type === t ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]" : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
                )}
              >
                {ENTRY_LABEL[t]}
              </button>
            ))}
          </div>
          {type === "qa" && (
            <input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} className="rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none" />
          )}
          <textarea
            placeholder={type === "qa" ? "Answer" : type === "note" ? "Note…" : "Caption (optional)"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[3rem] resize-none rounded-[0.375rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:outline-none"
          />
          <button onClick={submit} disabled={busy} className="flex items-center justify-center gap-1.5 self-end rounded-[0.5rem] bg-[var(--color-accent-soft)] px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add entry
          </button>
        </div>
      )}
    </div>
  );
}
