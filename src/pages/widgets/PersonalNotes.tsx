import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWidgetLayout } from "@/lib/widget-layout";
import { WidgetShell } from "@/components/widgets/WidgetShell";

function notesKey(userId: string | undefined) {
  return `accenty.crm.personal-notes.${userId ?? "anon"}`;
}

/** Private scratch pad — stored locally per user. */
export function PersonalNotes() {
  const { user } = useAuth();
  const { density } = useWidgetLayout();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      setText(localStorage.getItem(notesKey(user?.id)) ?? "");
      setSaved(true);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    setSaved(false);
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(notesKey(user?.id), text);
        setSaved(true);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [text, user?.id]);

  return (
    <WidgetShell title="Notes" icon={StickyNote} eyebrow="Personal">
      <div className="flex h-full min-h-0 flex-col gap-2">
        {density !== "dense" && (
          <div className="flex shrink-0 items-center justify-between">
            <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--color-text-lo)]">
              Private · this device
            </span>
            <span className="font-mono text-[0.5rem] text-[var(--color-text-lo)]">{saved ? "Saved" : "Saving…"}</span>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scratch notes…"
          className="min-h-0 flex-1 resize-none rounded-[0.625rem] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-ink-3)_35%,transparent)] p-2.5 text-[0.75rem] leading-relaxed text-[var(--color-text-hi)] outline-none placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-line-2)]"
        />
      </div>
    </WidgetShell>
  );
}
