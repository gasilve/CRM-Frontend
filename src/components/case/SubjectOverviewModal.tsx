import { useMemo, useState } from "react";
import { Camera, ScanFace, User } from "lucide-react";
import { placeholderPhotoFor, SERVICE_LABELS, type EvidencePhoto } from "@/lib/mock-data";
import { casesApi, ApiError, type CaseDetail } from "@/lib/crm-api";
import { ImageComparisonModal } from "@/components/case/ImageComparisonModal";
import {
  AddPhotoPanel,
  CasePhoto,
  ComparePicker,
  ComparisonHistory,
  comparisonsFromEntries,
  DetailField,
  EntityModal,
  PhotoLibraryPane,
  type EntityTab,
  type LibraryPhoto,
} from "@/components/case/EntityModal";

const ACCENT = "#f87171";
const SOFT = "rgba(248,113,113,0.12)";

type Tab = "photos" | "compare" | "details";

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

/**
 * Everything we hold on the subject in one place: the photo library (on-file
 * portrait plus every field still), the visual-comparison bench with its full
 * history, and the identity details the investigator's role is allowed to see.
 */
export function SubjectOverviewModal({
  caseId,
  kase,
  showAliases,
  showDob,
  showEmployment,
  showSsn,
  showDescription,
  canCapture,
  onClose,
  onChanged,
  onError,
}: {
  caseId: string;
  kase: CaseDetail;
  showAliases: boolean;
  showDob: boolean;
  showEmployment: boolean;
  showSsn: boolean;
  showDescription: boolean;
  canCapture: boolean;
  onClose: () => void;
  onChanged: () => void;
  onError?: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("photos");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const entries = useMemo(
    () => kase.days.flatMap((d) => d.entries.map((e) => ({ ...e, date: d.date }))),
    [kase.days],
  );

  /** On-file portrait first, then every subject-tagged field still, newest last. */
  const photos = useMemo<LibraryPhoto[]>(() => {
    const list: LibraryPhoto[] = [];
    if (kase.subjectPhotoUrl) {
      list.push({
        id: "on-file",
        url: kase.subjectPhotoUrl,
        label: `${kase.subjectName} — photo on file from pre-surveillance`,
        when: kase.dateOpened ?? null,
        source: "on_file",
      });
    }
    for (const e of entries) {
      if (e.type === "photo_person" && !e.personId && e.photoUrl) {
        list.push({
          id: e.id,
          url: e.photoUrl,
          label: e.body ?? "Subject photo",
          when: e.createdAt,
          author: e.author?.name ?? null,
          source: "field",
        });
      }
    }
    return list;
  }, [entries, kase.dateOpened, kase.subjectName, kase.subjectPhotoUrl]);

  const comparisons = useMemo(() => comparisonsFromEntries(entries), [entries]);

  const [subjectPick, setSubjectPick] = useState<string | null>(photos[0]?.id ?? null);
  const [probePick, setProbePick] = useState<string | null>(photos.find((p) => p.source === "field")?.id ?? null);

  const evidencePhotos: EvidencePhoto[] = photos.map((p) => ({
    id: p.id,
    caseId,
    url: p.url,
    label: p.label.length > 60 ? `${p.label.slice(0, 57)}…` : p.label,
    kind: p.source === "on_file" ? "primary" : "surveillance",
    capturedAt: p.when ?? new Date().toISOString(),
  }));

  const savePhoto = async (file: File, note: string) => {
    setBusy(true);
    try {
      const uploaded = await casesApi.uploadCapturePhoto(caseId, file);
      await casesApi.addDayEntry(caseId, {
        date: new Date().toISOString().slice(0, 10),
        type: "photo_person",
        body: note || "Subject photo",
        photoUrl: uploaded.url,
      });
      setAdding(false);
      onChanged();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Could not save the photo.");
    } finally {
      setBusy(false);
    }
  };

  const tabs: EntityTab[] = [
    { key: "photos", label: "Photos", icon: Camera, badge: photos.length },
    { key: "compare", label: "Visual comparison", icon: ScanFace, badge: comparisons.length },
    { key: "details", label: "Details", icon: User },
  ];

  return (
    <>
      <EntityModal
        accent="rgba(248,113,113,0.45)"
        soft={SOFT}
        eyebrow="Subject overview"
        title={kase.subjectName}
        subtitle={`${kase.caseNumber} · ${SERVICE_LABELS[kase.service]}${kase.subjectWorkStatus ? ` · ${kase.subjectWorkStatus}` : ""}`}
        hero={
          <CasePhoto
            caseId={caseId}
            photoUrl={kase.subjectPhotoUrl || placeholderPhotoFor(kase.id)}
            alt={kase.subjectName}
            className="h-12 w-12 shrink-0 rounded-[0.75rem]"
          />
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={(k) => setTab(k as Tab)}
        onClose={onClose}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          {tab === "photos" && (
            <PhotoLibraryPane
              caseId={caseId}
              photos={photos}
              accent={ACCENT}
              canAdd={canCapture}
              onAdd={() => setAdding(true)}
              onCompare={(p) => {
                setProbePick(p.id);
                setSubjectPick(photos.find((x) => x.source === "on_file")?.id ?? photos[0]?.id ?? null);
                setTab("compare");
              }}
              emptyHint="No subject stills yet — add one with the dashed tile and it becomes comparable straight away."
            />
          )}

          {tab === "compare" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ComparePicker
                caseId={caseId}
                photos={photos}
                accent={ACCENT}
                subjectId={subjectPick}
                probeId={probePick}
                onPick={(slot, id) => (slot === "subject" ? setSubjectPick(id) : setProbePick(id))}
                onRun={() => setCompareOpen(true)}
                disabled={photos.length < 2}
              />
              {photos.length < 2 && (
                <p className="mt-2 text-[0.75rem] text-[var(--color-text-lo)]">
                  You need at least two photos to compare — add a field still on the Photos tab.
                </p>
              )}
              <div className="mt-4 mb-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                Comparison history
              </div>
              <ComparisonHistory caseId={caseId} records={comparisons} />
            </div>
          )}

          {tab === "details" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <DetailField label="Name" value={kase.subjectName} />
                {showAliases && <DetailField label="Aliases" value={kase.subjectAliases.join(" · ")} />}
                {showDob && <DetailField label="Date of birth" value={fmtDate(kase.subjectDob)} />}
                <DetailField label="Work status" value={kase.subjectWorkStatus} />
                {showEmployment && (
                  <>
                    <DetailField label="Employer" value={kase.subjectEmployer} />
                    <DetailField label="Job title" value={kase.subjectJobTitle} />
                  </>
                )}
                <DetailField label="SSN" value={showSsn ? kase.subjectSsn : "Hidden for your role"} />
                <DetailField label="Driver's licence" value={kase.subjectDriverLicense} />
                <DetailField label="Language" value={kase.subjectLanguage} />
                <DetailField
                  label="Address"
                  value={
                    kase.addresses[0]
                      ? [kase.addresses[0].line1, kase.addresses[0].city, kase.addresses[0].state].filter(Boolean).join(", ")
                      : "—"
                  }
                />
                <DetailField label="Household" value={`${kase.people.length} known, ${kase.vehicles.length} vehicles`} />
              </div>

              {showDescription && kase.subjectDescription && (
                <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                    Physical description
                  </div>
                  <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{kase.subjectDescription}</p>
                </div>
              )}

              {kase.presurveillance?.summary && (
                <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">
                    Pre-surveillance
                  </div>
                  <p className="text-[0.8125rem] leading-relaxed text-[var(--color-text-mid)]">{kase.presurveillance.summary}</p>
                </div>
              )}
            </div>
          )}

          {adding && (
            <AddPhotoPanel
              accent={ACCENT}
              title="Add a subject photo"
              hint="It lands in the journal and the library, and is immediately comparable."
              busy={busy}
              onSubmit={(file, note) => void savePhoto(file, note)}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      </EntityModal>

      <ImageComparisonModal
        open={compareOpen}
        caseId={caseId}
        photos={evidencePhotos}
        subjectOnFileId={subjectPick ?? undefined}
        uploadedId={probePick ?? undefined}
        subjectName={kase.subjectName}
        caseReference={kase.caseNumber}
        onClose={() => {
          setCompareOpen(false);
          onChanged();
        }}
      />
    </>
  );
}
