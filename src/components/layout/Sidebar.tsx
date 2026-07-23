import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  Check,
  Plus,
  LayoutDashboard,
  Users2,
  FolderOpen,
  CalendarDays,
  Building2,
  FileText,
  BarChart3,
  Settings,
  BotMessageSquare,
  ScrollText,
  FlaskConical,
  GripVertical,
  Pencil,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  closestCenter,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import { invCases, investigators } from "@/lib/mock-data";
import accentyLogo from "@/assets/branding/accenty-logo.png";

// Live badge counts — swap with API data later
const openCases = invCases.filter((c) => c.status === "open").length;
const clockedIn = investigators.filter((i) => i.status !== "off_duty").length;

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
};

type Group = { id: string; label: string; items: Item[] };
type SidebarState = {
  folders: {
    id: string;
    label: string;
    itemIds: string[];
  }[];
};

const SIDEBAR_LS_KEY = "accenty.crm.sidebar.layout.v2";

const DEFAULT_GROUPS: Group[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/",              label: "Dashboard",    icon: LayoutDashboard },
      { to: "/cases",         label: "Cases",        icon: FolderOpen,   badge: openCases },
      { to: "/investigators", label: "Investigators",icon: Users2,        badge: clockedIn > 0 ? `${clockedIn} live` : undefined },
      { to: "/calendar",      label: "Calendar",     icon: CalendarDays },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { to: "/clients",  label: "Clients",  icon: Building2 },
      { to: "/billing",  label: "Billing",  icon: FileText },
      { to: "/reports",  label: "Reports",  icon: BarChart3 },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/documents", label: "Report Generator", icon: ScrollText },
      { to: "/report-testing", label: "Report Testing", icon: FlaskConical },
      { to: "/assistant", label: "AI Assistant", icon: BotMessageSquare },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ITEM_MAP: Record<string, Item> = Object.fromEntries(
  DEFAULT_GROUPS.flatMap((group) => group.items.map((item) => [item.to, item])),
);
const ALL_ITEM_IDS = Object.keys(ITEM_MAP);

const DEFAULT_SIDEBAR_STATE: SidebarState = {
  folders: DEFAULT_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    itemIds: group.items.map((item) => item.to),
  })),
};

const readSidebarState = (): SidebarState => {
  try {
    const raw = localStorage.getItem(SIDEBAR_LS_KEY);
    if (!raw) return DEFAULT_SIDEBAR_STATE;
    const parsed = JSON.parse(raw) as SidebarState;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.folders)) {
      return DEFAULT_SIDEBAR_STATE;
    }
    const folders = parsed.folders
      .filter(
        (x): x is { id: string; label: string; itemIds: string[] } =>
          !!x &&
          typeof x === "object" &&
          typeof x.id === "string" &&
          typeof x.label === "string" &&
          Array.isArray(x.itemIds),
      )
      .map((folder) => ({
        id: folder.id,
        label: folder.label,
        // Keep empty folders — user may have cleared or just created them.
        itemIds: folder.itemIds.filter(
          (itemId): itemId is string => typeof itemId === "string" && !!ITEM_MAP[itemId],
        ),
      }));

    // Trust saved folders as-is (including deleted defaults). Only place
    // brand-new nav items that aren't in any folder yet.
    if (folders.length === 0) return DEFAULT_SIDEBAR_STATE;

    const seen = new Set<string>();
    for (const folder of folders) {
      folder.itemIds = folder.itemIds.filter((itemId) => {
        if (seen.has(itemId)) return false;
        seen.add(itemId);
        return true;
      });
    }
    const missing = ALL_ITEM_IDS.filter((id) => !seen.has(id));
    if (missing.length > 0) {
      const target =
        folders.find((folder) => folder.id === "system") ??
        folders.find((folder) => folder.id === "operations") ??
        folders[0];
      target.itemIds.push(...missing);
    }

    return { folders };
  } catch {
    return DEFAULT_SIDEBAR_STATE;
  }
};

const writeSidebarState = (state: SidebarState): void => {
  try {
    localStorage.setItem(SIDEBAR_LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

const getDragType = (id: string): "folder" | "item" | "folder-drop" | "folder-body" | null => {
  if (id.startsWith("folder:")) return "folder";
  if (id.startsWith("item:")) return "item";
  if (id.startsWith("folder-drop:")) return "folder-drop";
  if (id.startsWith("folder-body:")) return "folder-body";
  return null;
};

const stripDragPrefix = (id: string): string =>
  id
    .replace(/^folder:/, "")
    .replace(/^item:/, "")
    .replace(/^folder-drop:/, "")
    .replace(/^folder-body:/, "");

const findFolderIndexByItemId = (state: SidebarState, itemId: string): number =>
  state.folders.findIndex((folder) => folder.itemIds.includes(itemId));
const findFolderIdByItemId = (state: SidebarState, itemId: string): string | null =>
  state.folders.find((folder) => folder.itemIds.includes(itemId))?.id ?? null;

const findFolderIdByOverTarget = (
  state: SidebarState,
  overId: string,
  overType: ReturnType<typeof getDragType>,
): string | null => {
  if (!overType) return null;
  if (overType === "item") return findFolderIdByItemId(state, stripDragPrefix(overId));
  if (overType === "folder" || overType === "folder-drop" || overType === "folder-body") {
    return stripDragPrefix(overId);
  }
  return null;
};

const moveItemBetweenFolders = (
  state: SidebarState,
  itemId: string,
  targetFolderId: string,
  targetItemId?: string,
): SidebarState => {
  const sourceFolderIndex = findFolderIndexByItemId(state, itemId);
  const targetFolderIndex = state.folders.findIndex((folder) => folder.id === targetFolderId);
  if (sourceFolderIndex < 0 || targetFolderIndex < 0) return state;

  const next: SidebarState = {
    folders: state.folders.map((folder) => ({ ...folder, itemIds: [...folder.itemIds] })),
  };
  const sourceFolder = next.folders[sourceFolderIndex];
  const targetFolder = next.folders[targetFolderIndex];
  const sourceIndex = sourceFolder.itemIds.indexOf(itemId);
  if (sourceIndex < 0) return state;

  if (sourceFolder.id === targetFolder.id) {
    if (!targetItemId) {
      const without = sourceFolder.itemIds.filter((id) => id !== itemId);
      sourceFolder.itemIds = [...without, itemId];
      return next;
    }
    const targetIndex = sourceFolder.itemIds.indexOf(targetItemId);
    if (targetIndex < 0 || targetIndex === sourceIndex) return state;
    sourceFolder.itemIds = arrayMove(sourceFolder.itemIds, sourceIndex, targetIndex);
    return next;
  }

  sourceFolder.itemIds.splice(sourceIndex, 1);
  if (!targetItemId) {
    targetFolder.itemIds.push(itemId);
    return next;
  }

  const targetIndex = targetFolder.itemIds.indexOf(targetItemId);
  if (targetIndex < 0) targetFolder.itemIds.push(itemId);
  else targetFolder.itemIds.splice(targetIndex, 0, itemId);
  return next;
};

function SidebarLink({ item }: { item: Item }) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-colors";

  if (item.disabled) {
    return (
      <div className={cn(base, "cursor-not-allowed text-[var(--color-text-lo)] hover:bg-white/[0.015]")}>
        <Icon size={16} strokeWidth={1.6} />
        <span className="flex-1">{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          base,
          isActive
            ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_1px_var(--color-accent-soft)]"
            : "text-[var(--color-text-mid)] hover:bg-white/[0.025] hover:text-[var(--color-text-hi)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="pointer-events-none absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-[var(--color-accent)]"
              style={{ boxShadow: "0 0 10px color-mix(in srgb, var(--color-accent) 70%, transparent)" }}
            />
          )}
          <Icon
            size={16}
            strokeWidth={1.6}
            className={isActive ? "text-[var(--color-accent-2)]" : ""}
          />
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 font-mono text-[9px] tracking-wider",
                isActive
                  ? "border-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                  : "border-[var(--color-line-2)] text-[var(--color-text-lo)]",
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SortableItem({
  itemId,
  item,
}: {
  itemId: string;
  item: Item;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `item:${itemId}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/item", isDragging && "opacity-40")}
    >
      <div className="relative">
        <SidebarLink item={item} />
        <button
          type="button"
          className="absolute left-0 top-0 h-full w-9 cursor-grab rounded-[10px] opacity-0 active:cursor-grabbing"
          aria-label={`Drag ${item.label}`}
          {...attributes}
          {...listeners}
        />
      </div>
    </div>
  );
}

function FolderDropZone({ folderId }: { folderId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-drop:${folderId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-2 rounded border border-dashed border-transparent transition-colors",
        isOver && "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)]/35",
      )}
    />
  );
}

function FolderBodyDropTarget({
  folderId,
  children,
}: {
  folderId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-body:${folderId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "ml-4 border-l border-[var(--color-line)]/60 pl-2 transition-colors",
        isOver && "border-[var(--color-accent-soft)]/80",
      )}
    >
      {children}
    </div>
  );
}

function SortableFolder({
  group,
  index,
  onRename,
  onDelete,
  canDelete,
}: {
  group: Group;
  index: number;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `folder:${group.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group.label);
  const trimmed = draft.trim();

  const save = () => {
    onRename(group.id, trimmed || group.label);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(group.label);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(index > 0 && "mt-5", isDragging && "opacity-40")}
    >
      <div className="group/folder mb-2 flex items-center gap-1.5 pl-0 pr-2">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-[var(--color-text-lo)] hover:bg-white/[0.045] hover:text-[var(--color-text-mid)] active:cursor-grabbing"
          aria-label={`Drag ${group.label} folder`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
        {editing ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              autoFocus
              className="h-6 flex-1 rounded border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              className="rounded p-1 text-[var(--color-text-lo)] hover:bg-white/[0.045] hover:text-[var(--color-text-hi)]"
              onClick={save}
              aria-label="Save folder name"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              className="rounded p-1 text-[var(--color-text-lo)] hover:bg-white/[0.045] hover:text-[var(--color-neg)]"
              onClick={cancel}
              aria-label="Cancel edit"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 px-1 text-[9px] font-medium uppercase tracking-[0.32em] text-[var(--color-text-lo)]">
              {group.label}
            </div>
            <button
              type="button"
              className="rounded p-1 text-[var(--color-text-lo)] opacity-0 transition-opacity hover:bg-white/[0.045] hover:text-[var(--color-text-mid)] group-hover/folder:opacity-100"
              onClick={() => {
                setDraft(group.label);
                setEditing(true);
              }}
              aria-label={`Edit ${group.label} folder name`}
            >
              <Pencil size={12} />
            </button>
            {canDelete && (
              <button
                type="button"
                className="rounded p-1 text-[var(--color-text-lo)] opacity-0 transition-opacity hover:bg-white/[0.045] hover:text-[var(--color-neg)] group-hover/folder:opacity-100"
                onClick={() => onDelete(group.id)}
                aria-label={`Delete ${group.label} folder`}
              >
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
      <FolderBodyDropTarget folderId={group.id}>
        <SortableContext items={group.items.map((it) => `item:${it.to}`)} strategy={verticalListSortingStrategy}>
          {group.items.map((it) => (
            <SortableItem key={it.to} itemId={it.to} item={it} />
          ))}
        </SortableContext>
        {group.items.length === 0 && (
          <div className="px-2 py-1 text-[10px] text-[var(--color-text-lo)]/80">Drop tabs here</div>
        )}
        <FolderDropZone folderId={group.id} />
      </FolderBodyDropTarget>
    </div>
  );
}

export default function Sidebar() {
  const [sidebarState, setSidebarState] = useState<SidebarState>(readSidebarState);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);

  // Pick up nav items added after the sidebar state was created (HMR / new routes).
  useEffect(() => {
    const seen = new Set(sidebarState.folders.flatMap((f) => f.itemIds));
    const missing = ALL_ITEM_IDS.filter((id) => !seen.has(id));
    if (missing.length === 0) return;
    const next: SidebarState = {
      folders: sidebarState.folders.map((folder) => ({
        ...folder,
        itemIds: [...folder.itemIds],
      })),
    };
    const target =
      next.folders.find((folder) => folder.id === "system") ??
      next.folders.find((folder) => folder.id === "operations") ??
      next.folders[0];
    if (!target) return;
    target.itemIds.push(...missing);
    setSidebarState(next);
    writeSidebarState(next);
  }, [sidebarState]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo(() => {
    return sidebarState.folders
      .map((folder) => ({
        id: folder.id,
        label: folder.label,
        items: folder.itemIds.map((itemId) => ITEM_MAP[itemId]).filter(Boolean),
      }));
  }, [sidebarState]);

  const updateState = (next: SidebarState) => {
    setSidebarState(next);
    writeSidebarState(next);
  };

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const activeId = String(args.active.id);
    const activeType = getDragType(activeId);
    if (activeType === "folder") {
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          String(c.id).startsWith("folder:"),
        ),
      });
    }
    return closestCenter(args);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeType = getDragType(activeId);
    const overType = getDragType(overId);
    if (activeType === "folder") {
      const sourceId = stripDragPrefix(activeId);
      const targetId = findFolderIdByOverTarget(sidebarState, overId, overType);
      if (!targetId || sourceId === targetId) return;
      const oldIndex = sidebarState.folders.findIndex((f) => f.id === sourceId);
      const newIndex = sidebarState.folders.findIndex((f) => f.id === targetId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      updateState({
        folders: arrayMove(sidebarState.folders, oldIndex, newIndex),
      });
      return;
    }
    if (activeType !== "item") return;

    const itemId = stripDragPrefix(activeId);
    const targetFolderId = findFolderIdByOverTarget(sidebarState, overId, overType);
    if (!targetFolderId) return;
    const sourceFolderIndex = findFolderIndexByItemId(sidebarState, itemId);
    const targetFolderIndex = sidebarState.folders.findIndex((f) => f.id === targetFolderId);
    if (sourceFolderIndex < 0 || targetFolderIndex < 0 || sourceFolderIndex === targetFolderIndex) return;
    updateState(moveItemBetweenFolders(sidebarState, itemId, targetFolderId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeType = getDragType(activeId);
    const overType = getDragType(overId);

    if (activeType === "folder" && overType === "folder") {
      const sourceId = stripDragPrefix(activeId);
      const targetId = stripDragPrefix(overId);
      if (sourceId === targetId) return;
      const oldIndex = sidebarState.folders.findIndex((f) => f.id === sourceId);
      const newIndex = sidebarState.folders.findIndex((f) => f.id === targetId);
      if (oldIndex < 0 || newIndex < 0) return;
      updateState({
        folders: arrayMove(sidebarState.folders, oldIndex, newIndex),
      });
      return;
    }
    if (activeType === "folder" && (overType === "item" || overType === "folder-drop" || overType === "folder-body")) {
      const sourceId = stripDragPrefix(activeId);
      const targetId = findFolderIdByOverTarget(sidebarState, overId, overType);
      if (!targetId || sourceId === targetId) return;
      const oldIndex = sidebarState.folders.findIndex((f) => f.id === sourceId);
      const newIndex = sidebarState.folders.findIndex((f) => f.id === targetId);
      if (oldIndex < 0 || newIndex < 0) return;
      updateState({
        folders: arrayMove(sidebarState.folders, oldIndex, newIndex),
      });
      return;
    }

    if (activeType !== "item" || !overType) return;
    const itemId = stripDragPrefix(activeId);
    if (!ITEM_MAP[itemId]) return;

    if (overType === "item") {
      const targetItemId = stripDragPrefix(overId);
      const targetFolderIndex = findFolderIndexByItemId(sidebarState, targetItemId);
      if (targetFolderIndex < 0) return;
      const targetFolderId = sidebarState.folders[targetFolderIndex].id;
      updateState(moveItemBetweenFolders(sidebarState, itemId, targetFolderId, targetItemId));
      return;
    }

    if (overType === "folder" || overType === "folder-drop" || overType === "folder-body") {
      const targetFolderId = findFolderIdByOverTarget(sidebarState, overId, overType);
      if (!targetFolderId) return;
      updateState(moveItemBetweenFolders(sidebarState, itemId, targetFolderId));
    }
  };

  const renameFolder = (id: string, nextLabel: string) => {
    updateState({
      folders: sidebarState.folders.map((f) => (f.id === id ? { ...f, label: nextLabel } : f)),
    });
  };

  const addFolder = () => {
    const id = `custom-${Date.now()}`;
    updateState({
      folders: [...sidebarState.folders, { id, label: "New Folder", itemIds: [] }],
    });
  };

  const deleteFolder = (folderId: string) => {
    if (sidebarState.folders.length <= 1) return;
    const toDelete = sidebarState.folders.find((f) => f.id === folderId);
    if (!toDelete) return;
    const remaining = sidebarState.folders.filter((f) => f.id !== folderId);
    const target = remaining.find((f) => f.id === "operations") ?? remaining[0];
    const nextFolders = remaining.map((f) =>
      f.id === target.id ? { ...f, itemIds: [...f.itemIds, ...toDelete.itemIds] } : f,
    );
    updateState({ folders: nextFolders });
    setConfirmDeleteFolderId(null);
  };

  return (
    <aside className="app-sidebar relative z-10 flex h-full w-[256px] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/80 backdrop-blur-xl">
      {/* Wordmark */}
      <div className="flex h-[var(--shell-chrome-height)] shrink-0 items-center justify-center px-3">
        <img
          src={accentyLogo}
          alt="Accenty AI"
          className="h-[4.875rem] w-auto max-w-[258px] object-contain"
        />
      </div>

      <div className="hairline mx-3 mb-2 opacity-60" />

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={groups.map((g) => `folder:${g.id}`)} strategy={verticalListSortingStrategy}>
            {groups.map((group, gi) => (
              <SortableFolder
                key={group.id}
                group={group}
                index={gi}
                onRename={renameFolder}
                onDelete={setConfirmDeleteFolderId}
                canDelete={groups.length > 1}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={addFolder}
          className="mt-auto flex w-full items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-lo)] hover:bg-white/[0.03] hover:text-[var(--color-text-mid)]"
        >
          <Plus size={12} />
          Add folder
        </button>
      </nav>

      {/* Footer */}
      <div className="m-3 mt-2">
        <div className="surface p-3">
          <div className="eyebrow mb-1">Operator</div>
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-full text-[10px] font-medium text-white"
              style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
            >
              TM
            </div>
            <div className="leading-tight">
              <div className="text-[12.5px] font-medium text-[var(--color-text-hi)]">Todd Montgomery</div>
              <div className="text-[10.5px] text-[var(--color-text-lo)]">President</div>
            </div>
          </div>
        </div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <ConfirmModal
            open={!!confirmDeleteFolderId}
            title="Delete folder?"
            description={
              <p className="dashboard-modal__text">
                Tabs in{" "}
                <strong className="text-[var(--color-text-hi)]">
                  {groups.find((g) => g.id === confirmDeleteFolderId)?.label ?? "this folder"}
                </strong>{" "}
                will be moved to another folder.
              </p>
            }
            confirmLabel="Delete folder"
            danger
            onCancel={() => setConfirmDeleteFolderId(null)}
            onConfirm={() => {
              if (confirmDeleteFolderId) deleteFolder(confirmDeleteFolderId);
            }}
          />,
          document.body,
        )}
    </aside>
  );
}
