import { createPortal } from "react-dom";
import { Bookmark, BookmarkX, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  visible: boolean;
  trashHovered: boolean;
  onTrashHoverChange: (hovered: boolean) => void;
  /** Case pages only: drop a saved custom widget here to remove it from the reusable list. */
  showUnsave?: boolean;
  unsaveHovered?: boolean;
  onUnsaveHoverChange?: (hovered: boolean) => void;
  /** Case pages only: drop a custom widget here to keep it in the reusable list. */
  showSave?: boolean;
  saveHovered?: boolean;
  onSaveHoverChange?: (hovered: boolean) => void;
};

/**
 * Drop targets that appear under the cursor while a widget is being dragged.
 * Centered on the content pane (not the viewport) so they line up with the
 * action bar rather than drifting under the sidebar.
 */
export function DragDock({
  visible,
  trashHovered,
  onTrashHoverChange,
  showUnsave = false,
  unsaveHovered = false,
  onUnsaveHoverChange,
  showSave = false,
  saveHovered = false,
  onSaveHoverChange,
}: Props) {
  if (!visible) return null;

  return createPortal(
    <div className="drag-dock">
      <div
        className={cn("drag-dock-hit drag-trash-hit", trashHovered && "is-hovered")}
        role="region"
        aria-label="Drop here to remove widget"
        onPointerEnter={() => onTrashHoverChange(true)}
        onPointerLeave={() => onTrashHoverChange(false)}
      >
        <div className="drag-trash-zone" aria-hidden>
          <Trash2 size={24} strokeWidth={1.75} />
        </div>
      </div>

      {showSave && (
        <div
          className={cn("drag-dock-hit drag-save-hit", saveHovered && "is-hovered")}
          role="region"
          aria-label="Drop here to save widget for reuse"
          onPointerEnter={() => onSaveHoverChange?.(true)}
          onPointerLeave={() => onSaveHoverChange?.(false)}
        >
          <div className="drag-save-zone" aria-hidden>
            <Bookmark size={24} strokeWidth={1.75} />
          </div>
        </div>
      )}

      {showUnsave && (
        <div
          className={cn("drag-dock-hit drag-unsave-hit", unsaveHovered && "is-hovered")}
          role="region"
          aria-label="Drop here to remove widget from saved list"
          onPointerEnter={() => onUnsaveHoverChange?.(true)}
          onPointerLeave={() => onUnsaveHoverChange?.(false)}
        >
          <div className="drag-unsave-zone" aria-hidden>
            <BookmarkX size={24} strokeWidth={1.75} />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
