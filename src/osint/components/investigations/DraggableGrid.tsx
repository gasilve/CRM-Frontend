// @ts-nocheck

/**
 * DraggableGrid — whole-box drag to reorder + corner resize
 * Drag: hold anywhere on the box 200ms → drop to swap positions
 * Resize: click ↗ corner cycles ⅓ → ⅔ → full width
 * Layout persists in localStorage per storageKey
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  rectSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface GridItem {
  id: string;
  colSpan?: 1 | 2 | 3;
  content: React.ReactNode;
  title?: string;
}

interface DraggableGridProps {
  items: GridItem[];
  storageKey: string;
  cols?: number;
  onOrderChange?: (ids: string[]) => void;
  acc: string; bdr: string; bg1: string; isDark: boolean;
}

// ── Resize corner ────────────────────────────────────────────────────────────
function ResizeHandle({ onResize, currentSpan, acc, isDark }: {
  onResize: (span: 1|2|3) => void; currentSpan: 1|2|3;
  acc: string; isDark: boolean;
}) {
  const [hov, setHov] = useState(false);
  const labels: Record<number, string> = { 1: "⅓", 2: "⅔", 3: "━" };
  const next = (s: 1|2|3): 1|2|3 => s >= 3 ? 1 : (s + 1) as 1|2|3;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={e => { e.stopPropagation(); e.preventDefault(); onResize(next(currentSpan)); }}
      title={`Width ${currentSpan}/3 — click to resize`}
      style={{
        position: "absolute", bottom: 4, right: 4,
        width: 18, height: 18, borderRadius: 4,
        background: hov ? acc : isDark ? "#2d3748" : "#e2e8f0",
        color: hov ? "#fff" : isDark ? "#718096" : "#718096",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700, cursor: "pointer",
        opacity: hov ? 1 : 0.5, transition: "all 0.15s",
        zIndex: 10, userSelect: "none",
      }}>
      {labels[currentSpan]}
    </div>
  );
}

// ── Single sortable item ─────────────────────────────────────────────────────
function SortableItem({ item, acc, bdr, isDark, onResize, isDraggingAny }: {
  item: GridItem; acc: string; bdr: string; isDark: boolean;
  onResize: (id: string, span: 1|2|3) => void; isDraggingAny: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: item.id });
  const [hov, setHov] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 180ms ease",
        gridColumn: `span ${item.colSpan || 1}`,
        opacity: isDragging ? 0.35 : 1,
        position: "relative",
        background: isDark ? "#1e2433" : "#fff",
        border: `1px solid ${isDragging ? acc : isOver ? `${acc}77` : hov ? `${acc}44` : bdr}`,
        borderRadius: 10,
        overflow: "visible",
        cursor: isDraggingAny ? "grabbing" : "grab",
        boxShadow: isDragging
          ? `0 0 0 2px ${acc}, 0 12px 32px rgba(0,0,0,0.2)`
          : isOver ? `0 0 0 2px ${acc}44` : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
        userSelect: "none",
      }}>
      {/* Content — pointer-events on so inputs/buttons still work */}
      <div
        style={{ overflow: "hidden", borderRadius: 10, pointerEvents: "auto" }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          // Prevent dnd-kit KeyboardSensor from hijacking Enter/Space/Arrows
          // when user is typing in an input or textarea inside a card
          const tag = (e.target as HTMLElement).tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
            e.stopPropagation();
            // Also prevent default for Space (dnd-kit uses it to start drag)
            if (e.key === " ") e.preventDefault();
          }
        }}>
        {item.content}
      </div>

      {/* Resize corner */}
      <ResizeHandle
        currentSpan={item.colSpan || 1}
        onResize={span => onResize(item.id, span)}
        acc={acc} isDark={isDark}
      />
    </div>
  );
}

// ── Main DraggableGrid ───────────────────────────────────────────────────────
export function DraggableGrid({
  items: initialItems, storageKey, cols = 2,
  onOrderChange, acc, bdr, bg1, isDark,
}: DraggableGridProps) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const prevIds = useRef("");

  // Load persisted order + sizes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dgrid_${storageKey}`);
      if (saved) {
        const parsed: { id: string; colSpan?: 1|2|3 }[] = JSON.parse(saved);
        const map = Object.fromEntries(initialItems.map(i => [i.id, i]));
        const ordered = parsed
          .filter(p => map[p.id])
          .map(p => ({ ...map[p.id], colSpan: p.colSpan || (map[p.id].colSpan as 1|2|3) || 1 }));
        const newOnes = initialItems.filter(i => !parsed.find(p => p.id === i.id));
        setItems([...ordered, ...newOnes]);
        return;
      }
    } catch {}
    setItems(initialItems);
  }, [storageKey]);

  // Sync content without losing layout
  useEffect(() => {
    const ids = initialItems.map(i => i.id).join(",");
    if (ids === prevIds.current) return;
    prevIds.current = ids;
    setItems(prev => {
      const prevMap = Object.fromEntries(prev.map(i => [i.id, i]));
      return initialItems.map(i => ({
        ...i,
        colSpan: (prevMap[i.id]?.colSpan || i.colSpan || 1) as 1|2|3,
      }));
    });
  }, [initialItems]);

  const persist = useCallback((updated: GridItem[]) => {
    try {
      localStorage.setItem(`dgrid_${storageKey}`,
        JSON.stringify(updated.map(i => ({ id: i.id, colSpan: i.colSpan || 1 }))));
    } catch {}
    onOrderChange?.(updated.map(i => i.id));
  }, [storageKey, onOrderChange]);

  // Custom KeyboardSensor that doesn't activate when focus is in an input/textarea
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      onActivation: ({ event }: { event: KeyboardEvent }) => {
        const tag = (event.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
          return false;
        }
      },
    })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.id === active.id);
      const newIdx = prev.findIndex(i => i.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      persist(next);
      return next;
    });
  };

  const handleResize = useCallback((id: string, span: 1|2|3) => {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, colSpan: span } : i);
      persist(next);
      return next;
    });
  }, [persist]);

  const activeItem = items.find(i => i.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 8,
          alignItems: "start",
        }}>
          {items.map(item => (
            <SortableItem key={item.id} item={item}
              acc={acc} bdr={bdr} isDark={isDark}
              onResize={handleResize}
              isDraggingAny={activeId !== null}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeItem && (
          <div style={{
            background: isDark ? "#1e2433" : "#fff",
            border: `2px solid ${acc}`,
            borderRadius: 10, padding: "10px 14px",
            opacity: 0.85, boxShadow: "0 16px 32px rgba(0,0,0,0.2)",
            fontSize: 12, fontWeight: 600,
            color: isDark ? "#94a3b8" : "#64748b",
            pointerEvents: "none",
          }}>
            {activeItem.title || activeItem.id}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function useGridEditMode() {
  const [editMode, setEditMode] = useState(false);
  return { editMode, toggleEditMode: () => setEditMode(v => !v) };
}
