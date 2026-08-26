import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { CasePage } from "./case-detail-widgets";

type Props = {
  pages: CasePage[];
  activePageId: string;
  editable: boolean;
  onSelect: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onAddPage?: () => void;
  onDeletePage?: (pageId: string) => void;
};

export function CaseDetailPageNav({
  pages,
  activePageId,
  editable,
  onSelect,
  onRename,
  onAddPage,
  onDeletePage,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  // Nothing left to delete once a single page remains.
  const canDelete = editable && !!onDeletePage && pages.length > 1;
  useEffect(() => {
    if (!canDelete) setDeleteMode(false);
  }, [canDelete]);

  const beginRename = (page: CasePage) => {
    if (!editable) return;
    setEditingId(page.id);
    setDraft(page.name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = draft.trim() || "Page";
    onRename(editingId, name.slice(0, 80));
    setEditingId(null);
  };

  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto">
      {pages.map((page) => {
        const active = page.id === activePageId;
        if (editingId === page.id) {
          return (
            <input
              key={page.id}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-8 min-w-[6rem] rounded-[0.625rem] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 text-[0.71875rem] font-medium text-[var(--color-text-hi)] outline-none"
            />
          );
        }
        return (
          <div
            key={page.id}
            className={
              active
                ? "group flex h-8 shrink-0 items-center rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] pl-3 pr-1 text-[0.71875rem] font-medium text-[var(--color-text-hi)]"
                : "group flex h-8 shrink-0 items-center rounded-[0.625rem] border border-transparent pl-3 pr-1 text-[0.71875rem] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line)] hover:text-[var(--color-text-hi)]"
            }
          >
            <button type="button" onClick={() => onSelect(page.id)} className="py-1">
              {page.name}
            </button>
            {deleteMode && canDelete ? (
              <button
                type="button"
                onClick={() => onDeletePage?.(page.id)}
                title="Delete page"
                aria-label={`Delete ${page.name}`}
                className="ml-1 grid h-6 w-6 place-items-center rounded-[0.5rem] text-[var(--color-neg)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-neg)_18%,transparent)]"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            ) : (
              editable && (
                <button
                  type="button"
                  onClick={() => beginRename(page)}
                  title="Rename page"
                  aria-label={`Rename ${page.name}`}
                  className="ml-1 grid h-6 w-6 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] opacity-0 transition-opacity hover:text-[var(--color-text-hi)] group-hover:opacity-100"
                >
                  <Pencil size={11} strokeWidth={1.8} />
                </button>
              )
            )}
          </div>
        );
      })}
      {editable && onAddPage && (
        <button
          type="button"
          onClick={onAddPage}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] border border-dashed border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          aria-label="Add page"
          title="Add page"
        >
          <Plus size={14} strokeWidth={1.8} />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => setDeleteMode((on) => !on)}
          aria-pressed={deleteMode}
          aria-label={deleteMode ? "Done deleting pages" : "Delete pages"}
          title={deleteMode ? "Done" : "Delete pages"}
          className={
            deleteMode
              ? "ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] border border-[color-mix(in_srgb,var(--color-neg)_55%,transparent)] bg-[color-mix(in_srgb,var(--color-neg)_18%,transparent)] text-[var(--color-neg)]"
              : "ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.625rem] border border-transparent text-[var(--color-text-lo)] transition-colors hover:border-[var(--color-line)] hover:text-[var(--color-neg)]"
          }
        >
          <Trash2 size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
