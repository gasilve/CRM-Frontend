import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { reportsApi, type EditableParagraph } from "@/lib/reports-api";
import DocumentPreview from "./DocumentPreview";

export interface AiEditCorrection {
  id: string;
  selectedText: string;
  prompt: string;
  resultText?: string;
  createdAt: string;
}

interface DocumentAiEditorModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onFileChange: (file: File) => void;
  corrections: AiEditCorrection[];
  onStoreCorrection: (
    correction: Omit<AiEditCorrection, "id" | "createdAt">,
  ) => void;
}

export default function DocumentAiEditorModal({
  open,
  file,
  onClose,
  onFileChange,
  corrections,
  onStoreCorrection,
}: DocumentAiEditorModalProps) {
  const [paragraphs, setParagraphs] = useState<EditableParagraph[]>([]);
  const [loadingParagraphs, setLoadingParagraphs] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!open) {
      setParagraphs([]);
      setActiveId(null);
      setDraftText("");
      setOriginalText("");
      setPrompt("");
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoadingParagraphs(true);
    setError(null);

    void reportsApi
      .paragraphs(file)
      .then((list) => {
        if (cancelled) return;
        setParagraphs(list);
        setActiveId((prev) => (prev && list.some((p) => p.id === prev) ? prev : null));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load paragraphs.");
        setParagraphs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingParagraphs(false);
      });

    return () => {
      cancelled = true;
    };
    // Fetch the paragraph list once per open. After an edit we update the list
    // locally (see afterEdit) so we don't pay for a re-fetch every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeId) {
          setActiveId(null);
          setDraftText("");
          setOriginalText("");
          setPrompt("");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, activeId]);

  if (!open || !file) return null;

  const active = paragraphs.find((p) => p.id === activeId) ?? null;
  const dirty = draftText.trim() !== originalText.trim();
  const panelOpen = Boolean(active);

  const selectById = (id: string) => {
    const p = paragraphs.find((x) => x.id === id);
    if (!p) return;
    if (activeId === id) {
      setActiveId(null);
      setDraftText("");
      setOriginalText("");
      setPrompt("");
      return;
    }
    setActiveId(p.id);
    setDraftText(p.text);
    setOriginalText(p.text);
    setPrompt("");
    setError(null);
  };

  const closePanel = () => {
    setActiveId(null);
    setDraftText("");
    setOriginalText("");
    setPrompt("");
  };

  const afterEdit = (
    editedParagraphId: string,
    edited: {
      file: File;
      originalText: string;
      resultText: string;
      instruction: string;
    },
  ) => {
    onFileChange(edited.file);
    onStoreCorrection({
      selectedText: edited.originalText,
      prompt: edited.instruction,
      resultText: edited.resultText,
    });
    // Update locally (skip re-fetch). Empty resultText = paragraph deleted.
    // Otherwise refresh label from the new date lead-in for tick rematch.
    if (!edited.resultText.trim()) {
      setParagraphs((prev) => prev.filter((p) => p.id !== editedParagraphId));
    } else {
      const dayLead =
        edited.resultText.match(
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/i,
        )?.[0] ?? null;
      setParagraphs((prev) =>
        prev.map((p) =>
          p.id === editedParagraphId
            ? {
                ...p,
                text: edited.resultText,
                label: dayLead ? dayLead.replace(/:$/, "") : p.label,
              }
            : p,
        ),
      );
    }
    setPrompt("");
    setActiveId(null);
    setDraftText("");
    setOriginalText("");
    // Bump revision only to trigger a background PDF refresh (non-blocking).
    setRevision((n) => n + 1);
  };

  const handleSaveText = async () => {
    if (!active || !originalText.trim() || !draftText.trim() || !dirty) return;
    const id = active.id;
    setSubmitting(true);
    setError(null);
    try {
      const edited = await reportsApi.plainEdit(file, originalText, draftText.trim());
      afterEdit(id, edited);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiEdit = async () => {
    if (!active || !prompt.trim() || !originalText.trim()) return;
    const id = active.id;
    setSubmitting(true);
    setError(null);
    try {
      const edited = await reportsApi.aiEdit(file, originalText, prompt.trim());
      afterEdit(id, edited);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI edit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-ai-editor-title"
        className="flex h-full max-h-[60rem] w-full max-w-[87.5rem] flex-col overflow-hidden rounded-[0.875rem] border border-[var(--color-line)] bg-[var(--color-ink-2)] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
          <div className="min-w-0">
            <div className="eyebrow mb-0.5">Document editor</div>
            <h2
              id="doc-ai-editor-title"
              className="truncate text-[0.9375rem] font-medium text-[var(--color-text-hi)]"
            >
              {file.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-tile border border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
            aria-label="Close editor"
          >
            <X size={16} />
          </button>
        </header>

        <div
          className={cn(
            "grid min-h-0 flex-1 transition-[grid-template-columns] duration-200",
            panelOpen ? "lg:grid-cols-[1fr_25rem]" : "lg:grid-cols-[1fr]",
          )}
        >
          <section className="relative flex min-h-0 flex-col">
            {loadingParagraphs && (
              <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-tile border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-2.5 py-1.5 text-[0.6875rem] text-[var(--color-text-mid)]">
                <Loader2 size={12} className="animate-spin" />
                Locating paragraphs…
              </div>
            )}
            <DocumentPreview
              file={file}
              revision={revision}
              paragraphs={paragraphs}
              activeId={activeId}
              onSelectParagraph={selectById}
            />
            {!panelOpen && !loadingParagraphs && paragraphs.length > 0 && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[var(--color-line)] bg-[var(--color-ink-2)]/95 px-3 py-1.5 text-[0.6875rem] text-[var(--color-text-mid)] shadow">
                Tick a □ beside a paragraph to edit it
              </div>
            )}
          </section>

          {panelOpen && active ? (
            <aside className="flex min-h-0 flex-col border-t border-[var(--color-line)] lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--color-line)] px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--color-text-hi)]">
                    <Sparkles size={14} className="text-[var(--color-accent-2)]" />
                    Edit paragraph
                  </div>
                  <p className="mt-1 truncate text-[0.6875rem] text-[var(--color-text-lo)]">
                    {active.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-tile border border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
                  aria-label="Close edit panel"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {error && (
                  <div className="rounded-[0.625rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[0.6875rem] text-[var(--color-neg)]">
                    {error}
                  </div>
                )}

                <label className="block">
                  <span className="mb-1 block text-[0.6875rem] text-[var(--color-text-lo)]">
                    Paragraph text
                  </span>
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={10}
                    className="w-full resize-y rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)] px-3 py-2 text-[0.75rem] text-[var(--color-text-hi)] outline-none focus:border-[var(--color-accent-soft)]"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSaveText()}
                  disabled={!dirty || submitting || !draftText.trim()}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-tile py-2 text-[0.75rem] font-medium",
                    "border border-[var(--color-line)] text-[var(--color-text-hi)] hover:bg-[var(--color-ink-1)]",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Save text change
                </button>

                <div className="border-t border-[var(--color-line)] pt-3">
                  <label className="block">
                    <span className="mb-1 block text-[0.6875rem] text-[var(--color-text-lo)]">
                      Instruction for AI
                    </span>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      placeholder="e.g. Remove speculation and keep only observed facts…"
                      className="w-full resize-none rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)] px-3 py-2 text-[0.75rem] text-[var(--color-text-hi)] outline-none focus:border-[var(--color-accent-soft)]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleAiEdit()}
                    disabled={!prompt.trim() || submitting}
                    className={cn(
                      "mt-2 flex w-full items-center justify-center gap-2 rounded-tile py-2.5 text-[0.75rem] font-medium transition-opacity",
                      "bg-[var(--color-accent)] text-white hover:opacity-90",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  >
                    {submitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {submitting ? "Applying…" : "Apply AI edit"}
                  </button>
                </div>

                {corrections.length > 0 && (
                  <div className="mt-2 border-t border-[var(--color-line)] pt-3">
                    <div className="mb-2 text-[0.6875rem] font-medium text-[var(--color-text-mid)]">
                      Session history ({corrections.length})
                    </div>
                    <ul className="space-y-2">
                      {corrections.slice(0, 5).map((c) => (
                        <li
                          key={c.id}
                          className="rounded-[0.625rem] border border-[var(--color-line)] bg-[var(--color-ink-1)]/70 px-3 py-2"
                        >
                          <p className="text-[0.6875rem] text-[var(--color-text-hi)]">{c.prompt}</p>
                          {c.resultText ? (
                            <p className="mt-1 line-clamp-2 text-[0.625rem] text-[var(--color-text-mid)]">
                              After: “{c.resultText}”
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
