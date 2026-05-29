import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  visible: boolean;
  hovered: boolean;
  onHoverChange: (hovered: boolean) => void;
};

export function DragTrash({ visible, hovered, onHoverChange }: Props) {
  if (!visible) return null;

  return createPortal(
    <div
      className={cn("drag-trash-hit", hovered && "is-hovered")}
      role="region"
      aria-label="Drop here to remove widget"
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
    >
      <div className="drag-trash-zone" aria-hidden>
        <Trash2 size={24} strokeWidth={1.75} />
      </div>
    </div>,
    document.body,
  );
}
