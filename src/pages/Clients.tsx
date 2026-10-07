import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  clientsApi,
  type CaseClient,
  type ClientCreateBody,
} from "@/lib/crm-api";
import { fetchQuery, getCached, invalidateQueries } from "@/lib/query-cache";
import { PanelLoader } from "@/components/ui/LoadingState";

export default function Clients() {
  const { can } = useAuth();
  const canManage = can("clients.manage");
  const navigate = useNavigate();

  const [clients, setClients] = useState<CaseClient[] | null>(
    () => getCached<{ clients: CaseClient[] }>("clients:list")?.clients ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const load = () => {
    fetchQuery("clients:list", () => clientsApi.list())
      .then((res) => setClients(res.clients))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load clients."));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients ?? [];
    return (clients ?? []).filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.contactEmail?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Clients</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {clients == null ? "…" : `${clients.length} total`}
            {search.trim() ? ` · ${filtered.length} shown` : ""}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="dashboard-modal-btn dashboard-modal-btn--primary inline-flex h-9 items-center gap-2 !px-3.5 !text-[0.75rem]"
          >
            <Plus size={13} strokeWidth={1.8} />
            Add client
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, contact, location…"
          className="h-9 w-full rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] pl-9 pr-3 text-[0.8125rem] text-[var(--color-text-hi)] placeholder:text-[var(--color-text-lo)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-tile)] border border-[var(--color-neg)]/35 bg-[var(--color-neg)]/10 px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      )}

      {clients == null ? (
        <PanelLoader message="Loading clients" />
      ) : filtered.length === 0 ? (
        <div className="surface grid place-items-center px-6 py-16 text-center">
          <Building2 size={22} className="text-[var(--color-text-lo)]" strokeWidth={1.6} />
          <p className="mt-3 font-[family-name:var(--font-display)] text-[1.25rem] italic text-[var(--color-text-mid)]">
            {search.trim() ? "No matching clients" : "No clients yet"}
          </p>
          <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            {search.trim()
              ? "Try a different search"
              : "Clients are created when cases are accepted, or add one here"}
          </p>
        </div>
      ) : (
        <div className="surface overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  {["Company", "Primary contact", "Location", "Contacts", "Cases"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left">
                      <span className="eyebrow">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clients/${c.id}`)}
                    className="cursor-pointer border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.022]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.company}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[0.78125rem] text-[var(--color-text-mid)]">{c.contactName || "—"}</div>
                      {c.contactEmail && (
                        <div className="text-[0.65625rem] text-[var(--color-text-lo)]">{c.contactEmail}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[0.71875rem] text-[var(--color-text-lo)]">
                      {c.location || "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                      {c._count?.contacts ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[0.8125rem] text-[var(--color-text-hi)]">
                      {c._count?.cases ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding && (
        <ClientFormModal
          title="Add client"
          onClose={() => setAdding(false)}
          onSave={async (body) => {
            const { client } = await clientsApi.create(body);
            invalidateQueries("clients:list");
            setAdding(false);
            navigate(`/clients/${client.id}`);
          }}
        />
      )}
    </div>
  );
}

function ClientFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: Partial<ClientCreateBody>;
  onClose: () => void;
  onSave: (body: ClientCreateBody) => Promise<void>;
}) {
  const [company, setCompany] = useState(initial?.company ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!company.trim()) {
      setError("Company name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        company: company.trim(),
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save client.");
      setBusy(false);
    }
  };

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dashboard-modal dashboard-modal--wide surface"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="dashboard-modal__title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-[var(--radius-tile)] border border-[var(--color-line)] text-[var(--color-text-mid)] hover:text-[var(--color-text-hi)]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <p className="dashboard-modal__text mt-1">Insurance company, law firm, or employer account.</p>

        <div className="dashboard-modal__body mt-5 flex flex-col gap-3">
          <Field label="Company *">
            <input autoFocus value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Las Vegas, Colorado…"
                className={inputCls}
              />
            </Field>
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Primary contact">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email">
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>
          {error && <p className="text-[0.8125rem] text-[var(--color-neg)]">{error}</p>}
        </div>

        <div className="dashboard-modal__actions">
          <button type="button" className="dashboard-modal-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="dashboard-modal-btn dashboard-modal-btn--primary inline-flex items-center gap-2"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "rounded-[0.5rem] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-2.5 py-2 text-[0.8125rem] text-[var(--color-text-hi)] focus:border-[var(--color-accent)] focus:outline-none";

export { ClientFormModal, Field, inputCls };
