import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Check, ClipboardCheck, X } from "lucide-react";

type Item = {
  id: string;
  label: string;
  group?: string;
};

/** Case setup steps. A check only marks the item. */
const ITEMS: Item[] = [
  { id: "subject", label: "Verified subject information", group: "Subject" },
  { id: "address-dob", label: "Confirmed address & DOB", group: "Subject" },
  { id: "subject-photos", label: "Subject photos on file", group: "Subject" },
  { id: "associates", label: "Known associates noted", group: "Subject" },
  { id: "insurance-vehicles", label: "Insurance vehicles", group: "Searches" },
  { id: "vehicle-registration", label: "Vehicle registration", group: "Searches" },
  { id: "driving-record", label: "Driving record", group: "Searches" },
  { id: "vehicle-sightings", label: "Vehicle sightings", group: "Searches" },
  { id: "comprehensive-profile", label: "Comprehensive profile", group: "Searches" },
  { id: "employment", label: "Employment / workplace", group: "Searches" },
  { id: "property-records", label: "Property records", group: "Searches" },
  { id: "court-records", label: "Court records", group: "Searches" },
  { id: "facebook", label: "Facebook", group: "Searches" },
  { id: "instagram", label: "Instagram", group: "Searches" },
  { id: "linkedin", label: "LinkedIn", group: "Searches" },
  { id: "social-media", label: "Other social media", group: "Searches" },
  { id: "intake-docs", label: "Intake documents reviewed", group: "Case" },
  { id: "surveillance-plan", label: "Surveillance plan set", group: "Case" },
];

const storeKey = (caseId: string) => `accenty.sky.onboarding.v1:${caseId}`;
const POS_KEY = "accenty.sky.onboarding.pos.v1";
const BUTTON = 48;
const BUTTON_DONE = 40;
const DRAG_SLOP = 4;
const EDGE = 20;
const SLOT = 76;

/** Snap to a grid anywhere on screen — not locked to the side edges. */
function snapPos(x: number, y: number, size = BUTTON) {
  const maxX = Math.max(EDGE, window.innerWidth - size - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - size - EDGE);
  const slotX = Math.round((x - EDGE) / SLOT);
  const slotY = Math.round((y - EDGE) / SLOT);
  return {
    x: Math.min(maxX, Math.max(EDGE, EDGE + slotX * SLOT)),
    y: Math.min(maxY, Math.max(EDGE, EDGE + slotY * SLOT)),
  };
}

function readPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return snapPos(window.innerWidth, EDGE);
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return snapPos(window.innerWidth, EDGE);
    return snapPos(parsed.x, parsed.y);
  } catch {
    return snapPos(window.innerWidth, EDGE);
  }
}

function readDone(caseId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storeKey(caseId));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Floating case-setup list. A green checklist button on the edge of the screen.
 * Drag snaps to an edge and a row. Opening the list grows toward the middle.
 * When every item is checked it shrinks to a quiet done chip.
 */
export default function SkyOnboardingToast({ caseId }: { caseId: string }) {
  const [done, setDone] = useState(() => readDone(caseId));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(readPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean; last: { x: number; y: number } } | null>(null);
  const left = ITEMS.filter((item) => !done.has(item.id)).length;
  const complete = left === 0;
  const size = complete ? BUTTON_DONE : BUTTON;
  const side = pos.x + size / 2 < window.innerWidth / 2 ? "left" : "right";
  const low = pos.y + size / 2 > window.innerHeight / 2;
  const doneCount = ITEMS.length - left;

  useEffect(() => {
    const fit = () => setPos((current) => snapPos(current.x, current.y, size));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size]);

  useEffect(() => {
    if (!complete) return;
    setOpen(false);
    setPos((current) => snapPos(current.x, current.y, BUTTON_DONE));
  }, [complete]);

  const markItem = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    try {
      localStorage.setItem(storeKey(caseId), JSON.stringify([...next]));
    } catch {
      /* private mode */
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    drag.current = { px: event.clientX, py: event.clientY, x: pos.x, y: pos.y, moved: false, last: pos };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.px;
    const dy = event.clientY - current.py;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!current.moved) setDragging(true);
    current.moved = true;
    current.last = snapPos(current.x + dx, current.y + dy, size);
    setPos(current.last);
  };

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (!current) return;
    if (!current.moved) {
      setOpen((value) => !value);
      return;
    }
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(current.last));
    } catch {
      /* private mode */
    }
  };

  let group = "";

  return createPortal(
    <aside
      className={`sky-todo${open ? " open" : ""}${complete ? " done" : ""}${dragging ? " dragging" : ""} side-${side}${low ? " low" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      aria-label="Case setup"
    >
      <button
        type="button"
        className="sky-todo-head"
        aria-expanded={open}
        aria-label={complete ? "Case setup done" : `Case setup, ${left} left`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {complete ? <BadgeCheck size={20} strokeWidth={1.9} /> : <ClipboardCheck size={19} strokeWidth={1.85} />}
        {left > 0 && <span className="sky-todo-count">{left}</span>}
      </button>

      <div className="sky-todo-sheet" aria-hidden={!open}>
        <header className="sky-todo-title">
          <div>
            <b>Case setup</b>
            <span>
              {complete ? "All done" : `${doneCount} of ${ITEMS.length}`}
            </span>
          </div>
          <button type="button" className="sky-todo-x" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </header>
        <div className="sky-todo-track" aria-hidden>
          <i style={{ width: `${(doneCount / ITEMS.length) * 100}%` }} />
        </div>
        <ul>
          {ITEMS.map((item) => {
            const showGroup = item.group && item.group !== group;
            if (item.group) group = item.group;
            const checked = done.has(item.id);
            return (
              <li key={item.id}>
                {showGroup && <div className="sky-todo-group">{item.group}</div>}
                <button type="button" className={checked ? "on" : ""} onClick={() => markItem(item.id)}>
                  <span className="sky-todo-box" aria-hidden>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>,
    document.body,
  );
}
