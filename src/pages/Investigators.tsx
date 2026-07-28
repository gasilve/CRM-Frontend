import { useState } from "react";
import { Plus, Clock, MapPin, Briefcase, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { investigators, invCases, type Investigator, type InvStatus } from "@/lib/mock-data";

const STATUS_CONFIG: Record<InvStatus, { label: string; dot: string; bg: string; text: string }> = {
  clocked_in: { label: "Clocked In",  dot: "#4ade80", bg: "rgba(74,222,128,0.15)",  text: "#4ade80" },
  on_case:    { label: "On Case",     dot: "#4a7fff", bg: "rgba(74,127,255,0.15)",  text: "#7aa1ff" },
  off_duty:   { label: "Off Duty",    dot: "#5b6680", bg: "rgba(91,102,128,0.15)",  text: "#7a8499" },
};

export default function Investigators() {
  const [selected, setSelected] = useState<Investigator | null>(null);

  const live = investigators.filter((i) => i.status !== "off_duty");
  const off  = investigators.filter((i) => i.status === "off_duty");

  return (
    <div className="relative flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[36px] leading-none text-[var(--color-text-hi)]">Investigators</h1>
          <p className="mt-1 font-mono text-[11px] text-[var(--color-text-lo)]">
            {live.length} active today · {off.length} off duty
          </p>
        </div>
        <button className="flex h-9 items-center gap-2 rounded-[10px] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3.5 text-[12px] text-[var(--color-text-hi)] hover:shadow-[0_0_0_3px_var(--color-accent-soft)] transition-shadow">
          <Plus size={13} strokeWidth={1.8} />
          Add investigator
        </button>
      </div>

      {/* Live board */}
      {live.length > 0 && (
        <section>
          <div className="eyebrow mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />
            Active Now
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((inv) => (
              <InvestigatorCard key={inv.id} inv={inv} onClick={() => setSelected(inv)} />
            ))}
          </div>
        </section>
      )}

      {/* Off duty */}
      {off.length > 0 && (
        <section>
          <div className="eyebrow mb-3 flex items-center gap-2 text-[var(--color-text-lo)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5b6680]" />
            Off Duty
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {off.map((inv) => (
              <InvestigatorCard key={inv.id} inv={inv} onClick={() => setSelected(inv)} dim />
            ))}
          </div>
        </section>
      )}

      {selected && <InvestigatorDrawer inv={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function InvestigatorCard({
  inv,
  onClick,
  dim,
}: {
  inv: Investigator;
  onClick: () => void;
  dim?: boolean;
}) {
  const cfg = STATUS_CONFIG[inv.status];
  const currentCase = inv.currentCase ? invCases.find((c) => c.id === inv.currentCase) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "surface surface-hover cursor-pointer rounded-[14px] p-4 transition-all",
        dim && "opacity-55",
      )}
    >
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
            >
              {inv.initials}
            </div>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-ink-2)]",
                inv.status !== "off_duty" && "animate-pulse",
              )}
              style={{ background: cfg.dot }}
            />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-[var(--color-text-hi)]">{inv.name}</div>
            <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{inv.id}</div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-medium"
          style={{ background: cfg.bg, color: cfg.text }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<Clock size={10} strokeWidth={1.8} />} label="Hours today" value={inv.status !== "off_duty" ? `${inv.hoursToday.toFixed(1)} hrs` : "—"} />
        <Stat icon={<Briefcase size={10} strokeWidth={1.8} />} label="Open cases" value={String(inv.totalCasesOpen)} />
      </div>

      {/* Current case */}
      {currentCase && (
        <div className="mt-3 rounded-[8px] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-lo)]">On case</div>
          <div className="mt-0.5 truncate text-[12px] font-medium text-[var(--color-text-hi)]">
            {currentCase.subject.name}
          </div>
          <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{currentCase.clientFileNum} · {currentCase.service}</div>
        </div>
      )}

      {/* Location */}
      {inv.location && (
        <div className="mt-2 flex items-center gap-1.5 font-mono text-[9.5px] text-[var(--color-text-lo)]">
          <MapPin size={9} strokeWidth={1.8} />
          {inv.location}
        </div>
      )}

      {/* Clock-in time */}
      {inv.clockInTime && (
        <div className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] text-[var(--color-text-lo)]">
          <Clock size={9} strokeWidth={1.8} />
          Clocked in at {inv.clockInTime}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[var(--color-ink-3)]/60 px-2.5 py-2">
      <div className="mb-0.5 flex items-center gap-1 text-[var(--color-text-lo)]">
        {icon}
        <span className="font-mono text-[8.5px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-[13px] text-[var(--color-text-hi)]">{value}</div>
    </div>
  );
}

function InvestigatorDrawer({ inv, onClose }: { inv: Investigator; onClose: () => void }) {
  const cfg = STATUS_CONFIG[inv.status];
  const assignedCases = invCases.filter((c) => c.assignedTo.includes(inv.id));
  const openCases = assignedCases.filter((c) => c.status === "open");

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[440px] flex-col gap-6 overflow-y-auto border-l border-[var(--color-line-2)] bg-[var(--color-ink-1)] px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="grid h-11 w-11 place-items-center rounded-full text-[14px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#4a7fff,#7aa1ff)" }}
              >
                {inv.initials}
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--color-text-hi)]">{inv.name}</div>
                <div className="font-mono text-[10px] text-[var(--color-text-lo)]">{inv.id}</div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)] transition-colors"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* Status */}
        <div className="surface p-4">
          <div className="eyebrow mb-3">Current Status</div>
          <div className="flex items-center gap-3">
            <span
              className={cn("h-3 w-3 rounded-full", inv.status !== "off_duty" && "animate-pulse")}
              style={{ background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}80` }}
            />
            <span className="text-[14px] font-medium" style={{ color: cfg.text }}>{cfg.label}</span>
            {inv.clockInTime && (
              <span className="ml-auto font-mono text-[10.5px] text-[var(--color-text-lo)]">
                Since {inv.clockInTime}
              </span>
            )}
          </div>
          {inv.location && (
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--color-text-lo)]">
              <MapPin size={10} strokeWidth={1.8} />
              Last known: {inv.location}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat icon={<Clock size={10} strokeWidth={1.8} />} label="Hours today" value={inv.hoursToday > 0 ? `${inv.hoursToday.toFixed(1)}` : "—"} />
            <Stat icon={<Briefcase size={10} strokeWidth={1.8} />} label="Open cases" value={String(inv.totalCasesOpen)} />
          </div>
        </div>

        {/* Assigned cases */}
        {assignedCases.length > 0 && (
          <div>
            <div className="eyebrow mb-3">Assigned Cases</div>
            <div className="flex flex-col gap-2">
              {assignedCases.map((c) => {
                const open = c.status === "open";
                return (
                  <div key={c.id} className="surface rounded-[10px] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[var(--color-text-lo)]">{c.clientFileNum}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-medium"
                        style={open
                          ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                          : { background: "rgba(91,102,128,0.15)", color: "#7a8499" }
                        }
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] font-medium text-[var(--color-text-hi)]">{c.subject.name}</div>
                    <div className="text-[11px] text-[var(--color-text-lo)]">{c.client} · {c.service}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
