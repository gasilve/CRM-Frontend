import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  NOTE_QUICK_OPTIONS,
  TYPE_QUICK_NOTES,
  type MedicalFacility,
} from "@/components/cases/medical/mock-data";
import "@/components/cases/osint/osint-modal.css";

function typeNotesFor(type: string) {
  return TYPE_QUICK_NOTES[type] ?? TYPE_QUICK_NOTES.other;
}

export function MedicalNoteModal({
  facility,
  onSave,
  onClose,
}: {
  facility: MedicalFacility;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const typeNotes = typeNotesFor(facility.type);
  const initSelected = useMemo(() => {
    if (!facility.note) return [] as string[];
    const parts = facility.note.split(" · ");
    return parts.filter((p) => NOTE_QUICK_OPTIONS.includes(p) || typeNotes.includes(p));
  }, [facility.note, typeNotes]);
  const initCustom = useMemo(() => {
    if (!facility.note) return "";
    return facility.note
      .split(" · ")
      .filter((p) => !NOTE_QUICK_OPTIONS.includes(p) && !typeNotes.includes(p))
      .join(" · ");
  }, [facility.note, typeNotes]);

  const [selected, setSelected] = useState<string[]>(initSelected);
  const [custom, setCustom] = useState(initCustom);

  const toggle = (opt: string) =>
    setSelected((prev) => (prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]));

  const save = () => {
    const parts = [...selected];
    if (custom.trim()) parts.push(custom.trim());
    onSave(parts.join(" · "));
  };

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="osint-modal osint-step-modal sky-medical-note-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="medical-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="osint-modal__head">
          <div className="osint-modal__head-main">
            <p className="osint-modal__eyebrow">Facility notes</p>
            <h2 id="medical-note-title" className="osint-modal__title">
              {facility.name}
            </h2>
            <p className="osint-modal__meta">
              {facility.type.replace(/_/g, " ")} · {facility.address}
            </p>
          </div>
          <button type="button" className="osint-modal__close" aria-label="Close" onClick={onClose}>
            <X size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="osint-step-modal__body">
          <h3 className="osint-modal__sec">Call attempt</h3>
          <div className="sky-medical-note-opts">
            {NOTE_QUICK_OPTIONS.map((opt) => {
              const on = selected.includes(opt);
              return (
                <button key={opt} type="button" className={on ? "on" : ""} onClick={() => toggle(opt)}>
                  {on ? "✓ " : ""}
                  {opt}
                </button>
              );
            })}
          </div>

          <h3 className="osint-modal__sec" style={{ marginTop: 14 }}>
            {facility.type.replace(/_/g, " ")} quick notes
          </h3>
          <div className="sky-medical-note-opts">
            {typeNotes.map((opt) => {
              const on = selected.includes(opt);
              return (
                <button key={opt} type="button" className={on ? "on" : ""} onClick={() => toggle(opt)}>
                  {on ? "✓ " : ""}
                  {opt}
                </button>
              );
            })}
          </div>

          <h3 className="osint-modal__sec" style={{ marginTop: 14 }}>
            Additional notes
          </h3>
          <textarea
            className="sky-osint-notes"
            style={{ maxHeight: "none", minHeight: 72, resize: "vertical" }}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={3}
            placeholder="e.g. Spoke with Cristian, ext. 304 — call back Thursday"
          />

          <div className="sky-medical-note-actions">
            <button type="button" className="sky-osint-linkbtn sky-medical-report-sec" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="sky-osint-linkbtn sky-medical-search" onClick={save}>
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
