import { useEffect, useState } from "react";
import { Car, Eye, Loader2, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EntityModal } from "@/components/case/EntityModal";
import { ApiError, casesApi, type CasePattern, type CasePatternInput } from "@/lib/crm-api";

const emptyDraft = (): CasePatternInput => ({ place: "", whenLabel: "", detail: "", travel: "", title: "" });

export function CasePatternsModal({
  caseId,
  subjectName,
  onClose,
}: {
  caseId: string;
  subjectName: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CasePattern[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CasePatternInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => {
    setError(null);
    casesApi
      .listPatterns(caseId)
      .then((res) => setItems(res.patterns))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load patterns."));
  };

  useEffect(() => {
    load();
  }, [caseId]);

  const save = async () => {
    if (!draft || !draft.whenLabel.trim()) {
      setError("Say when this happens — Mondays, weekday mornings, and so on.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        const res = await casesApi.updatePattern(caseId, editingId, draft);
        setItems((prev) => prev?.map((p) => (p.id === res.pattern.id ? res.pattern : p)) ?? [res.pattern]);
      } else {
        const res = await casesApi.addPattern(caseId, draft);
        setItems((prev) => [res.pattern, ...(prev ?? [])]);
      }
      setDraft(null);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that pattern.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await casesApi.deletePattern(caseId, id);
      setItems((prev) => prev?.filter((p) => p.id !== id) ?? []);
      if (editingId === id) {
        setDraft(null);
        setEditingId(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that pattern.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await casesApi.generatePatterns(caseId);
      if (res.patterns.length === 0) {
        setNotice(
          res.scannedNotes === 0
            ? "No field notes to read yet."
            : `Read ${res.scannedNotes} notes. Nothing repeats on the same day yet.`,
        );
      } else {
        setItems((prev) => [...res.patterns, ...(prev ?? [])]);
        setNotice(
          res.patterns.length === 1
            ? "Added 1 routine from the notes."
            : `Added ${res.patterns.length} routines from the notes.`,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read the notes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <EntityModal
      accent="#4a7fff"
      soft="rgba(74,127,255,0.14)"
      eyebrow="Routines"
      title="Patterns"
      subtitle={`Where ${subjectName} keeps showing up, and how to be there first`}
      onClose={onClose}
    >
        <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-5 py-3">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 text-[0.75rem] font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Generate from notes
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft(emptyDraft());
              setError(null);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-line-2)] px-3 text-[0.75rem] text-[var(--color-text-hi)]"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && <p className="mb-3 text-[0.8125rem] text-[var(--color-neg)]">{error}</p>}
          {notice && <p className="mb-3 text-[0.8125rem] text-[var(--color-text-mid)]">{notice}</p>}

          {draft && (
            <form
              className="mb-4 grid gap-2 rounded-[0.875rem] border border-[var(--color-accent-soft)] bg-[var(--color-ink-2)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="grid gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">Place</span>
                <input
                  value={draft.place ?? ""}
                  onChange={(e) => setDraft({ ...draft, place: e.target.value })}
                  placeholder="The gym on Oak St"
                  className="h-9 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 text-[0.8125rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">When</span>
                <input
                  value={draft.whenLabel}
                  onChange={(e) => setDraft({ ...draft, whenLabel: e.target.value })}
                  placeholder="Monday mornings"
                  className="h-9 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 text-[0.8125rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">How they get there</span>
                <input
                  value={draft.travel ?? ""}
                  onChange={(e) => setDraft({ ...draft, travel: e.target.value })}
                  placeholder="Drives the white Sierra. Set up on the north side of the street."
                  className="h-9 rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 text-[0.8125rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
              <label className="grid gap-1">
                <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">What to watch for</span>
                <textarea
                  value={draft.detail ?? ""}
                  onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                  rows={2}
                  placeholder="Carries shingles up the ladder before noon. No limp on the way down."
                  className="resize-none rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-2 text-[0.8125rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setEditingId(null);
                  }}
                  className="h-8 rounded-full px-3 text-[0.75rem] text-[var(--color-text-mid)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-8 rounded-full bg-[var(--color-accent)] px-3 text-[0.75rem] font-semibold text-white disabled:opacity-50"
                >
                  {editingId ? "Save" : "Add pattern"}
                </button>
              </div>
            </form>
          )}

          {items === null ? (
            <div className="grid place-items-center py-10 text-[var(--color-text-lo)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-[0.875rem] text-[var(--color-text-mid)]">
              No routines yet. Generate them from the journal, or write one yourself.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((pattern) => (
                <li
                  key={pattern.id}
                  className="rounded-[0.875rem] border border-[var(--color-line)] bg-[var(--color-ink-2)]/60 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]">
                      <MapPin size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.875rem] font-medium text-[var(--color-text-hi)]">{pattern.place || pattern.title}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider",
                            pattern.source === "generated"
                              ? "bg-[rgba(74,127,255,0.15)] text-[var(--color-accent-2)]"
                              : "bg-[var(--color-ink-3)] text-[var(--color-text-lo)]",
                          )}
                        >
                          {pattern.source === "generated" ? "From notes" : "Manual"}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-[0.6875rem] text-[var(--color-accent-2)]">{pattern.whenLabel}</div>
                      {pattern.travel && (
                        <p className="mt-1 flex items-start gap-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
                          <Car size={13} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
                          {pattern.travel}
                        </p>
                      )}
                      {pattern.detail && (
                        <p className="mt-1 flex items-start gap-1.5 text-[0.8125rem] text-[var(--color-text-mid)]">
                          <Eye size={13} className="mt-0.5 shrink-0 text-[var(--color-text-lo)]" />
                          {pattern.detail}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Edit pattern"
                      onClick={() => {
                        setEditingId(pattern.id);
                        setDraft({
                          title: pattern.title,
                          place: pattern.place ?? "",
                          whenLabel: pattern.whenLabel,
                          detail: pattern.detail ?? "",
                          travel: pattern.travel ?? "",
                        });
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete pattern"
                      onClick={() => void remove(pattern.id)}
                      className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-text-lo)] hover:text-[var(--color-neg)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
    </EntityModal>
  );
}
