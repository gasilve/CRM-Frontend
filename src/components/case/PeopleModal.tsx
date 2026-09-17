import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  casesApi,
  ApiError,
  CASE_PERSON_RELATIONSHIP_LABELS,
  type CaseDetail,
  type CasePerson,
  type CasePersonRelationship,
} from "@/lib/crm-api";
import { AddPhotoPanel, CasePhoto, EntityModal, PhotoLibraryPane, type LibraryPhoto } from "@/components/case/EntityModal";

const ACCENT = "#facc15";
const SOFT = "rgba(250,204,21,0.12)";

const RELATIONSHIPS: CasePersonRelationship[] = ["cohabitant", "family", "neighbor", "coworker", "visitor", "passer_by", "other"];

/**
 * The household side of the case: everyone we've identified around the subject,
 * each with their own photo library and a running note. No facial comparison or
 * details tab here — that machinery belongs to the Subject, not the cast around him.
 */
export function PeopleModal({
  caseId,
  kase,
  canCapture,
  onClose,
  onChanged,
  onError,
}: {
  caseId: string;
  kase: CaseDetail;
  canCapture: boolean;
  onClose: () => void;
  onChanged: () => void;
  onError?: (msg: string) => void;
}) {
  // The subject has their own modal — this is the household/associates roster, so their
  // server-managed mirror row never shows up here.
  const roster = useMemo(() => kase.people.filter((p) => !p.isSubject), [kase.people]);
  const [selectedId, setSelectedId] = useState<string | null>(roster[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRel, setNewRel] = useState<CasePersonRelationship>("cohabitant");
  const [busy, setBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);

  const selected: CasePerson | null = roster.find((p) => p.id === selectedId) ?? roster[0] ?? null;

  useEffect(() => {
    setNotesDraft(selected?.notes ?? "");
  }, [selected?.id, selected?.notes]);

  const entries = useMemo(
    () => kase.days.flatMap((d) => d.entries.map((e) => ({ ...e, date: d.date }))),
    [kase.days],
  );

  const photos = useMemo<LibraryPhoto[]>(() => {
    if (!selected) return [];
    const list: LibraryPhoto[] = [];
    if (selected.photoUrl) {
      list.push({ id: "on-file", url: selected.photoUrl, label: `${selected.name} — photo on file`, when: selected.createdAt, source: "on_file" });
    }
    for (const e of entries) {
      if (e.personId === selected.id && e.photoUrl) {
        list.push({
          id: e.id,
          url: e.photoUrl,
          label: e.body ?? `${selected.name} photo`,
          when: e.createdAt,
          author: e.author?.name ?? null,
          source: "field",
        });
      }
    }
    return list;
  }, [entries, selected]);

  const savePhoto = async (file: File, note: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const uploaded = await casesApi.uploadCapturePhoto(caseId, file);
      await casesApi.addDayEntry(caseId, {
        date: new Date().toISOString().slice(0, 10),
        type: "photo_person",
        body: note || `${selected.name} photo`,
        photoUrl: uploaded.url,
        personId: selected.id,
      });
      setAdding(false);
      onChanged();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Could not save the photo.");
    } finally {
      setBusy(false);
    }
  };

  const createPerson = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const created = await casesApi.addPerson(caseId, { name: newName.trim(), relationship: newRel });
      setSelectedId(created.person.id);
      setNewName("");
      setAddingPerson(false);
      onChanged();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Could not add that person.");
    } finally {
      setBusy(false);
    }
  };

  const notesDirty = selected != null && notesDraft.trim() !== (selected.notes ?? "").trim();

  const saveNotes = async () => {
    if (!selected) return;
    setNotesBusy(true);
    try {
      await casesApi.updatePerson(caseId, selected.id, {
        name: selected.name,
        relationship: selected.relationship,
        photoUrl: selected.photoUrl ?? null,
        phone: selected.phone ?? null,
        address: selected.address ?? null,
        notes: notesDraft.trim() || null,
      });
      onChanged();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : "Could not save that note.");
    } finally {
      setNotesBusy(false);
    }
  };

  return (
    <EntityModal
      accent="rgba(250,204,21,0.45)"
      soft={SOFT}
      eyebrow="Household & associates"
      title={selected ? selected.name : "Nobody logged yet"}
      subtitle={
        selected
          ? `${CASE_PERSON_RELATIONSHIP_LABELS[selected.relationship]}${selected.phone ? ` · ${selected.phone}` : ""}`
          : "Add the first cohabitant, neighbour, or visitor"
      }
      hero={
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[0.75rem]" style={{ background: "rgba(250,204,21,0.25)", color: ACCENT }}>
          <Users size={20} strokeWidth={1.8} />
        </span>
      }
      onClose={onClose}
    >
      <div className="relative flex min-h-0 flex-1">
        {/* Who's on the case */}
        <div className="flex w-[13rem] shrink-0 flex-col border-r border-[var(--color-line)] p-2">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {roster.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-[0.625rem] p-1.5 text-left transition-colors",
                  selected?.id === p.id ? "bg-[rgba(250,204,21,0.14)]" : "hover:bg-white/[0.03]",
                )}
              >
                <CasePhoto caseId={caseId} photoUrl={p.photoUrl} alt={p.name} className="h-9 w-9 shrink-0 rounded-[0.5rem]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-[var(--color-text-hi)]">{p.name}</span>
                  <span className="block truncate font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                    {CASE_PERSON_RELATIONSHIP_LABELS[p.relationship]}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={canCapture ? () => setAddingPerson((v) => !v) : undefined}
            disabled={!canCapture}
            title={canCapture ? "Add person" : "Start the clock to add people"}
            className={cn(
              "mt-1 flex shrink-0 items-center justify-center gap-1.5 rounded-[0.625rem] border-2 border-dashed py-2 text-[0.75rem] font-medium",
              !canCapture && "cursor-not-allowed opacity-40 grayscale",
            )}
            style={{ borderColor: "rgba(250,204,21,0.5)", color: ACCENT }}
          >
            <Plus size={13} strokeWidth={2.2} />
            Add person
          </button>
          {canCapture && addingPerson && (
            <div className="mt-2 shrink-0 rounded-[0.625rem] border border-[var(--color-line-2)] p-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Their name"
                className="w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <select
                value={newRel}
                onChange={(e) => setNewRel(e.target.value as CasePersonRelationship)}
                className="mt-1.5 w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2 py-1.5 text-[0.75rem] text-[var(--color-text-hi)] outline-none"
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {CASE_PERSON_RELATIONSHIP_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !newName.trim()}
                onClick={() => void createPerson()}
                className="mt-1.5 w-full rounded-[0.5rem] px-2 py-1.5 text-[0.75rem] font-semibold text-[#1a1400] disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                Save person
              </button>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {!selected ? (
            <div className="grid flex-1 place-items-center text-center text-[0.8125rem] text-[var(--color-text-lo)]">
              Add someone on the left to start a file on them.
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-hidden">
                <PhotoLibraryPane
                  caseId={caseId}
                  photos={photos}
                  accent={ACCENT}
                  canAdd={canCapture}
                  onAdd={() => setAdding(true)}
                  emptyHint={`No photos of ${selected.name} yet.`}
                />
              </div>

              {/* Name/notes — no separate tab, just a running note about who they are */}
              <div className="shrink-0 border-t border-[var(--color-line)] p-3">
                <div className="mb-1.5 font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--color-text-lo)]">Notes on {selected.name}</div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  disabled={!canCapture}
                  rows={2}
                  placeholder={canCapture ? "Who are they, relation to the subject, anything worth remembering…" : "Start the clock to edit notes…"}
                  className="w-full resize-none rounded-[0.625rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] leading-relaxed text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
                />
                {notesDirty && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      disabled={notesBusy}
                      onClick={() => void saveNotes()}
                      className="flex items-center gap-1.5 rounded-[0.5rem] px-3 py-1.5 text-[0.75rem] font-semibold text-[#1a1400] disabled:opacity-50"
                      style={{ background: ACCENT }}
                    >
                      {notesBusy && <Loader2 size={12} className="animate-spin" />}
                      Save note
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {adding && selected && (
            <AddPhotoPanel
              accent={ACCENT}
              title={`Add a photo of ${selected.name}`}
              hint="Tagged to them, so it lands in their library and the journal."
              busy={busy}
              onSubmit={(file, note) => void savePhoto(file, note)}
              onCancel={() => setAdding(false)}
            />
          )}
        </div>
      </div>
    </EntityModal>
  );
}
