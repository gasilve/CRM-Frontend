import { useEffect, useState, type FormEvent } from "react";
import { X, Loader2, FolderPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";
import { SERVICE_LABELS } from "@/lib/mock-data";
import type { InvTag } from "@/lib/mock-data";
import { casesApi, clientsApi, ApiError, REGION_LABELS, type CaseClient, type CaseService, type CasePriority, type CaseDetail, type Region } from "@/lib/crm-api";

const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS) as [CaseService, string][];
const ALL_TAGS: InvTag[] = [
  "Work Comp", "FMLA", "Surveillance", "Background", "Social Media",
  "Domestic", "Disability", "Locate", "Process Serving", "Rush", "Liability",
];
const PRIORITIES: { value: CasePriority; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "rush", label: "Rush" },
];

const inputClass =
  "w-full rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3 py-2 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:outline-none focus:border-[var(--color-accent)] transition-colors";
const labelClass = "mb-1 block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--color-text-lo)]";

export function NewCaseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (kase: CaseDetail) => void;
}) {
  const [clients, setClients] = useState<CaseClient[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [newClientName, setNewClientName] = useState("");

  const [subjectName, setSubjectName] = useState("");
  const [service, setService] = useState<CaseService>("SURV");
  const [priority, setPriority] = useState<CasePriority>("standard");
  const [tags, setTags] = useState<string[]>([]);
  const [claimNumber, setClaimNumber] = useState("");
  const [adjusterName, setAdjusterName] = useState("");
  const [region, setRegion] = useState<Region | "">("");
  const [state, setState] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [imeAt, setImeAt] = useState("");
  const [daysAllotted, setDaysAllotted] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { can } = useAuth();
  const canManageClients = can("clients.manage");

  useEffect(() => {
    if (!open) return;
    clientsApi.list().then((res) => setClients(res.clients)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSubjectName("");
      setService("SURV");
      setPriority("standard");
      setTags([]);
      setClaimNumber("");
      setAdjusterName("");
      setRegion("");
      setState("");
      setDueDate("");
      setImeAt("");
      setDaysAllotted("");
      setAddressLine1("");
      setAddressCity("");
      setAddressState("");
      setAddressZip("");
      setClientId("");
      setNewClientName("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      setError("Subject name is required.");
      return;
    }
    if (clientId === "__new__" && !newClientName.trim()) {
      setError("Enter a name for the new client, or choose none.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let finalClientId: string | null = clientId || null;
      if (clientId === "__new__" && newClientName.trim()) {
        const { client } = await clientsApi.create({ company: newClientName.trim() });
        finalClientId = client.id;
      }

      const { case: created } = await casesApi.create({
        subjectName: subjectName.trim(),
        service,
        priority,
        tags,
        clientId: finalClientId,
        claimNumber: claimNumber.trim() || undefined,
        adjusterName: adjusterName.trim() || undefined,
        region: region || undefined,
        state: state.trim() || undefined,
        dueDate: dueDate || undefined,
        imeAt: imeAt ? new Date(imeAt).toISOString() : undefined,
        daysAllotted: daysAllotted ? Number(daysAllotted) : undefined,
        address: addressLine1.trim()
          ? { line1: addressLine1.trim(), city: addressCity.trim() || undefined, state: addressState.trim() || undefined, zip: addressZip.trim() || undefined }
          : undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create case.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="anim-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(40rem,92vw)] -translate-x-1/2 -translate-y-1/2">
        <form
          onSubmit={submit}
          className="surface anim-modal flex max-h-[85vh] flex-col gap-5 overflow-y-auto rounded-[0.875rem] p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderPlus size={16} strokeWidth={1.8} className="text-[var(--color-accent-2)]" />
              <h2 className="editorial text-[1.375rem] text-[var(--color-text-hi)]">New case</h2>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
              <X size={16} />
            </button>
          </div>

          {error && (
            <div className="anim-banner rounded-[0.5rem] border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.06)] px-3.5 py-2.5 text-[0.78125rem] text-[var(--color-neg)]">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Subject name *</label>
            <input className={inputClass} value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Full name" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Service / type</label>
              <select className={inputClass} value={service} onChange={(e) => setService(e.target.value as CaseService)}>
                {SERVICE_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 rounded-[0.5rem] border px-2 py-2 text-[0.75rem] font-medium transition-colors",
                      priority === p.value
                        ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                        : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Client</label>
              <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— None —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company}</option>
                ))}
                {canManageClients && <option value="__new__">+ New client…</option>}
              </select>
            </div>
            {clientId === "__new__" ? (
              <div>
                <label className={labelClass}>New client name</label>
                <input className={inputClass} value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Company name" />
              </div>
            ) : (
              <div>
                <label className={labelClass}>Adjuster</label>
                <input className={inputClass} value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Adjuster name" />
              </div>
            )}
          </div>
          {clientId === "__new__" && (
            <div>
              <label className={labelClass}>Adjuster</label>
              <input className={inputClass} value={adjusterName} onChange={(e) => setAdjusterName(e.target.value)} placeholder="Adjuster name" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Claim #</label>
              <input className={inputClass} value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input className={inputClass} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} placeholder="NY" />
            </div>
            <div>
              <label className={labelClass}>Days allotted</label>
              <input className={inputClass} type="number" min={0} value={daysAllotted} onChange={(e) => setDaysAllotted(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Region</label>
              <select className={inputClass} value={region} onChange={(e) => setRegion(e.target.value as Region | "")}>
                <option value="">— None —</option>
                {(Object.entries(REGION_LABELS) as [Region, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Due date</label>
              <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>IME</label>
              <input className={inputClass} type="datetime-local" value={imeAt} onChange={(e) => setImeAt(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Subject address</label>
            <div className="grid grid-cols-[1fr_8rem_4rem_6rem] gap-2">
              <input className={inputClass} placeholder="Street" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
              <input className={inputClass} placeholder="City" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
              <input className={inputClass} placeholder="St" maxLength={2} value={addressState} onChange={(e) => setAddressState(e.target.value.toUpperCase())} />
              <input className={inputClass} placeholder="ZIP" value={addressZip} onChange={(e) => setAddressZip(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
                    tags.includes(tag)
                      ? "border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] text-[var(--color-text-hi)]"
                      : "border-[var(--color-line)] text-[var(--color-text-lo)] hover:text-[var(--color-text-mid)]",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[0.625rem] border border-[var(--color-line)] px-4 py-2 text-[0.8125rem] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-4 py-2 text-[0.8125rem] font-medium text-[var(--color-text-hi)] disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Create case
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
