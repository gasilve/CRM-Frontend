import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  Check,
  CircleUserRound,
  Plus,
  LayoutDashboard,
  Sun,
  Users2,
  Building2,
  FolderOpen,
  CalendarClock,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  BotMessageSquare,
  ScrollText,
  Clapperboard,
  GripVertical,
  Inbox,
  LogOut,
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
import { ThemePicker } from "./ThemePicker";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";
import { invCases } from "@/lib/mock-data";
import { investigatorsApi } from "@/lib/crm-api";
import { useQuery } from "@/lib/query-cache";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingIntake } from "@/contexts/PendingIntakeContext";
import type { Permission } from "@/lib/auth-client";
import { getInitials, formatRoleList } from "@/lib/format";
import accentyLogo from "@/assets/branding/accenty-logo.png";

// Cases badge still on mock data — swap with API later.
const openCases = invCases.filter((c) => c.status === "open").length;

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
  /** Nav entry is shown when the user holds any one of these. Omitted = always visible. */
  permissions?: Permission[];
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

// What each nav entry needs. The dashboard and profile are always available;
// everything else follows whatever the administrator granted the role.
const DEFAULT_GROUPS: Group[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/",              label: "Dashboard",    icon: LayoutDashboard },
      { to: "/my-day",        label: "My Day",       icon: Sun,          permissions: ["cases.view"] },
      { to: "/cases",         label: "Cases",        icon: FolderOpen,   badge: openCases, permissions: ["cases.view"] },
      { to: "/pending-cases", label: "Pending cases", icon: Inbox, permissions: ["intake.view"] },
      { to: "/schedule",      label: "Scheduling",   icon: CalendarClock, permissions: ["schedule.view"] },
      { to: "/investigators", label: "Investigators",icon: Users2,        permissions: ["team.view"] },
      { to: "/clients",       label: "Clients",      icon: Building2,     permissions: ["clients.view"] },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/documents", label: "Report Generator", icon: ScrollText, permissions: ["documents.generate"] },
      { to: "/video", label: "Case Video", icon: Clapperboard, permissions: ["video.use"] },
      { to: "/assistant", label: "AI Assistant", icon: BotMessageSquare, permissions: ["assistant.use"] },
      { to: "/profile", label: "Profile", icon: CircleUserRound },
      { to: "/administration", label: "Administration", icon: ShieldCheck, permissions: ["admin.roles", "admin.users"] },
    ],
  },
];

const ITEM_MAP: Record<string, Item> = Object.fromEntries(
  DEFAULT_GROUPS.flatMap((group) => group.items.map((item) => [item.to, item])),
);
const ALL_ITEM_IDS = Object.keys(ITEM_MAP);

/** Where a nav item belongs before the user drags it somewhere else. */
const DEFAULT_FOLDER_BY_ITEM: Record<string, string> = Object.fromEntries(
  DEFAULT_GROUPS.flatMap((group) => group.items.map((item) => [item.to, group.id])),
);

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
    const parsedFolders = parsed.folders
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
        itemIds: folder.itemIds.filter(
          (itemId): itemId is string => typeof itemId === "string" && !!ITEM_MAP[itemId],
        ),
      }));

    // Drop folders that lost all their items (e.g. a removed feature like
    // Billing) so we don't render stale empty sections after reload.
    const folders = parsedFolders.filter((folder) => folder.itemIds.length > 0);

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
      for (const itemId of missing) {
        const target =
          folders.find((folder) => folder.id === DEFAULT_FOLDER_BY_ITEM[itemId]) ??
          folders.find((folder) => folder.id === "system") ??
          folders[0];
        target.itemIds.push(itemId);
      }
      // Persist so we don't need a mount effect that re-runs on every drag update.
      try {
        localStorage.setItem(SIDEBAR_LS_KEY, JSON.stringify({ folders }));
      } catch {
        /* ignore */
      }
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

function SidebarLink({
  item,
  onNavigate,
}: {
  item: Item;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const base =
    "group relative flex items-center gap-3 rounded-[0.625rem] px-3 py-2 text-[0.8125rem] font-medium transition-colors";

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
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          base,
          isActive
            ? "bg-[var(--color-accent-soft)] text-[var(--color-text-hi)] shadow-[inset_0_0_0_0.0625rem_var(--color-accent-soft)]"
            : "text-[var(--color-text-mid)] hover:bg-white/[0.025] hover:text-[var(--color-text-hi)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="pointer-events-none absolute left-0 top-1/2 h-5 w-[0.125rem] -translate-y-1/2 rounded-r bg-[var(--color-accent)]"
              style={{ boxShadow: "0 0 0.625rem color-mix(in srgb, var(--color-accent) 70%, transparent)" }}
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
                "rounded-full border px-1.5 py-0.5 font-mono text-[0.5625rem] tracking-wider",
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
  onNavigate,
}: {
  itemId: string;
  item: Item;
  onNavigate?: () => void;
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
        <SidebarLink item={item} onNavigate={onNavigate} />
        <button
          type="button"
          className="absolute left-0 top-0 z-10 h-full w-9 cursor-grab rounded-[0.625rem] opacity-0 active:cursor-grabbing group-hover/item:opacity-100"
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
  onNavigate,
}: {
  group: Group;
  index: number;
  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  onNavigate?: () => void;
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
              className="h-6 flex-1 rounded border border-[var(--color-line-2)] bg-[var(--color-ink-2)] px-2 text-[0.625rem] font-medium uppercase tracking-[0.24em] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--color-accent)]"
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
            <div className="flex-1 px-1 text-[0.5625rem] font-medium uppercase tracking-[0.32em] text-[var(--color-text-lo)]">
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
            <SortableItem key={it.to} itemId={it.to} item={it} onNavigate={onNavigate} />
          ))}
        </SortableContext>
        {group.items.length === 0 && (
          <div className="px-2 py-1 text-[0.625rem] text-[var(--color-text-lo)]/80">Drop tabs here</div>
        )}
        <FolderDropZone folderId={group.id} />
      </FolderBodyDropTarget>
    </div>
  );
}

export default function Sidebar({
  open = false,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  open?: boolean;
  /** Desktop-only: collapse the sidebar to a slim icon rail. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const [sidebarState, setSidebarState] = useState<SidebarState>(readSidebarState);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const { user, roles, canAny, logout } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canSeeIntake = canAny("intake.view");
  const canSeeTeam = canAny("team.view");
  const { pendingReview: pendingCases } = usePendingIntake();
  const investigatorsQuery = useQuery(
    canSeeTeam ? "investigators:list" : null,
    () => investigatorsApi.list(),
  );
  const investigatorCount = investigatorsQuery.data?.investigators.length;

  const groups = useMemo(() => {
    return sidebarState.folders.map((folder) => ({
      id: folder.id,
      label: folder.label,
      items: folder.itemIds
        .map((itemId) => ITEM_MAP[itemId])
        .filter(Boolean)
        .filter((item) => !item.permissions || canAny(...item.permissions))
        .map((item) => {
          if (item.to === "/pending-cases" && canSeeIntake && pendingCases && pendingCases > 0) {
            return { ...item, badge: pendingCases };
          }
          if (item.to === "/investigators" && investigatorCount != null && investigatorCount > 0) {
            return { ...item, badge: investigatorCount };
          }
          return item;
        }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarState, canAny, canSeeIntake, pendingCases, investigatorCount]);

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

  const flatItems = groups.flatMap((g) => g.items);

  return (
    <>
      {/* Collapsed icon rail (desktop only) */}
      {collapsed && (
        <aside className="relative z-30 hidden h-full w-[3.25rem] shrink-0 flex-col items-center border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/80 py-3 lg:flex">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="grid h-8 w-8 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)]"
          >
            <PanelLeftOpen size={15} strokeWidth={1.7} />
          </button>
          <div className="hairline mx-auto my-3 w-7 opacity-60" />
          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
            {flatItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  title={item.label}
                  className={({ isActive }) =>
                    cn(
                      "grid h-9 w-9 place-items-center rounded-[0.625rem] transition-colors",
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-2)]"
                        : "text-[var(--color-text-mid)] hover:bg-white/[0.03] hover:text-[var(--color-text-hi)]",
                    )
                  }
                >
                  <Icon size={16} strokeWidth={1.6} />
                </NavLink>
              );
            })}
          </nav>
          <NavLink
            to="/profile"
            className="mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.625rem] font-medium text-white"
            title={user ? `${user.name} — open profile` : "Open profile"}
            style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
          >
            {user ? getInitials(user.name) : "--"}
          </NavLink>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Sign out"
            title="Sign out"
            className="mt-1.5 rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-neg)]"
          >
            <LogOut size={14} />
          </button>
        </aside>
      )}

      <aside
        className={cn(
          "app-sidebar relative z-30 flex h-full w-[16rem] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-ink-1)]/80",
          open && "is-open",
          collapsed && "lg:hidden",
        )}
      >
      {/* Wordmark */}
      <div className="relative flex h-[var(--shell-chrome-height)] shrink-0 items-center justify-center px-3">
        <img
          src={accentyLogo}
          alt="True Cognition"
          className="h-[4.875rem] w-auto max-w-[16.125rem] object-contain"
        />
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="absolute right-2 top-2 hidden rounded-[0.5rem] p-1.5 text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-text-hi)] lg:block"
          >
            <PanelLeftClose size={15} strokeWidth={1.7} />
          </button>
        )}
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
                onNavigate={onNavigate}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={addFolder}
          className="mt-auto flex w-full items-center gap-1.5 rounded-[0.625rem] px-2 py-1.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-[var(--color-text-lo)] hover:bg-white/[0.03] hover:text-[var(--color-text-mid)]"
        >
          <Plus size={12} />
          Add folder
        </button>
      </nav>

      {/* Footer: appearance controls + user */}
      <div className="relative m-3 mt-2">
        <div className="surface p-3">
          <NavLink
            to="/profile"
            onClick={() => onNavigate?.()}
            title="Open your profile"
            className="-m-1 flex items-center gap-2.5 rounded-[0.625rem] p-1 transition-colors hover:bg-white/[0.03]"
          >
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.625rem] font-medium text-white"
              style={{ background: "linear-gradient(135deg, var(--color-operator-from), var(--color-operator-to))" }}
            >
              {user ? getInitials(user.name) : "--"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[0.78125rem] font-medium text-[var(--color-text-hi)]">
                {user?.name ?? "—"}
              </div>
              <div className="truncate text-[0.65625rem] text-[var(--color-text-lo)]">{formatRoleList(roles)}</div>
            </div>
          </NavLink>
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-[var(--color-line)] pt-2.5">
            <button
              ref={themeButtonRef}
              type="button"
              aria-label="Choose theme"
              title="Theme & background"
              aria-expanded={themeOpen}
              onClick={() => setThemeOpen((v) => !v)}
              className="grid h-7 w-7 place-items-center rounded-[0.5rem] border border-[var(--color-line)] text-[var(--color-text-mid)] transition-colors hover:border-[var(--color-line-2)] hover:text-[var(--color-text-hi)] aria-expanded:border-[var(--color-line-3)] aria-expanded:text-[var(--color-text-hi)]"
            >
              <Palette size={13} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sign out"
              title="Sign out"
              className="ml-auto flex items-center gap-1.5 rounded-[0.5rem] px-2 py-1.5 text-[0.65625rem] text-[var(--color-text-lo)] transition-colors hover:bg-white/[0.05] hover:text-[var(--color-neg)]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
        <ThemePicker
          open={themeOpen}
          onClose={() => setThemeOpen(false)}
          triggerRef={themeButtonRef}
          align="top-start"
        />
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
    </>
  );
}
