import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  CLIENT_CONTACT_ROLE_LABELS,
  clientsApi,
  type ClientContact,
  type ClientContactBody,
  type ClientContactRole,
  type ClientDetail,
  type ClientUpdateBody,
} from "@/lib/crm-api";
import { invalidateQueries } from "@/lib/query-cache";
import { PanelLoader } from "@/components/ui/LoadingState";
import { ClientFormModal, Field, inputCls } from "./Clients";
import { cn } from "@/lib/cn";

const ROLE_OPTIONS = Object.entries(CLIENT_CONTACT_ROLE_LABELS) as [ClientContactRole, string][];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can("clients.manage");
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    clientsApi
      .get(id)
      .then((res) => setClient(res.client))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load client."));
  }, [id]);

  useEffect(load, [load]);

  if (error && !client) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/clients" className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]">
          <ArrowLeft size={12} /> Clients
        </Link>
        <div className="rounded-[var(--radius-tile)] border border-[var(--color-neg)]/35 bg-[var(--color-neg)]/10 px-4 py-3 text-[0.8125rem] text-[var(--color-neg)]">
          {error}
        </div>
      </div>
    );
  }

  if (!client) return <PanelLoader message="Loading client" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-[var(--color-text-lo)] hover:text-[var(--color-text-hi)]"
          >
            <ArrowLeft size={12} /> Clients
          </Link>
          <h1 className="editorial mt-2 text-[2.1rem] leading-none text-[var(--color-text-hi)]">{client.company}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
            {client.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {client.location}
              </span>
            )}
            <span>
              {client._count?.contacts ?? client.contacts.length} contact
              {(client._count?.contacts ?? client.contacts.length) === 1 ? "" : "s"}
            </span>
            <span>
              {client._count?.cases ?? client.cases.length} case
              {(client._count?.cases ?? client.cases.length) === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="dashboard-modal-btn inline-flex h-9 items-center gap-2 !px-3.5 !text-[0.75rem]"
          >
            <Pencil size={13} />
            Edit client
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="surface p-5">
          <h2 className="eyebrow text-[var(--color-text-lo)]">Company</h2>
          <dl className="mt-4 flex flex-col gap-3 text-[0.8125rem]">
            <Row label="Address" value={client.address} />
            <Row label="Location" value={client.location} />
            <Row label="Primary contact" value={client.contactName} />
            <Row label="Email" value={client.contactEmail} />
            <Row label="Phone" value={client.contactPhone} />
            <Row label="Notes" value={client.notes} />
          </dl>
        </section>

        <section className="surface flex flex-col p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow text-[var(--color-text-lo)]">Contacts</h2>
            {canManage && (
              <button
                type="button"
                onClick={() => setAddingContact(true)}
                className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-[var(--color-accent-2)] hover:text-[var(--color-text-hi)]"
              >
                <Plus size={12} /> Add contact
              </button>
            )}
          </div>

          {client.contacts.length === 0 ? (
            <div className="mt-6 grid flex-1 place-items-center py-8 text-center">
              <UserRound size={20} className="text-[var(--color-text-lo)]" />
              <p className="mt-2 text-[0.8125rem] text-[var(--color-text-mid)]">No contacts yet</p>
              <p className="mt-1 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">
                Adjusters, lawyers, risk managers…
              </p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {client.contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="rounded-[var(--radius-tile)] border border-[var(--color-line-2)] bg-[var(--color-ink-3)] px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[0.875rem] font-medium text-[var(--color-text-hi)]">
                        {contact.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-accent-2)]">
                        {CLIENT_CONTACT_ROLE_LABELS[contact.role]}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => setEditingContact(contact)}
                          className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] hover:bg-[var(--color-ink-2)] hover:text-[var(--color-text-hi)]"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          onClick={async () => {
                            if (!confirm(`Remove ${contact.name}?`)) return;
                            await clientsApi.deleteContact(client.id, contact.id);
                            invalidateQueries("clients:list");
                            load();
                          }}
                          className="grid h-7 w-7 place-items-center rounded-[0.5rem] text-[var(--color-text-lo)] hover:bg-[var(--color-ink-2)] hover:text-[var(--color-neg)]"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-[0.75rem] text-[var(--color-text-mid)]">
                    {contact.lawFirmName && <span>Firm · {contact.lawFirmName}</span>}
                    {contact.matterNumber && (
                      <span className="font-mono text-[0.6875rem]">Matter · {contact.matterNumber}</span>
                    )}
                    {contact.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {contact.location}
                      </span>
                    )}
                    {contact.address && <span>{contact.address}</span>}
                    {contact.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} /> {contact.email}
                      </span>
                    )}
                    {contact.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {contact.phone}
                      </span>
                    )}
                    {contact.notes && <span className="text-[var(--color-text-lo)]">{contact.notes}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="surface overflow-hidden p-0">
        <div className="border-b border-[var(--color-line)] px-5 py-3">
          <h2 className="eyebrow text-[var(--color-text-lo)]">Cases</h2>
        </div>
        {client.cases.length === 0 ? (
          <div className="grid place-items-center px-6 py-12 text-center">
            <Building2 size={18} className="text-[var(--color-text-lo)]" />
            <p className="mt-2 text-[0.8125rem] text-[var(--color-text-mid)]">No cases linked yet</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                {["Case", "Subject", "Service", "Status"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left">
                    <span className="eyebrow">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {client.cases.map((kase) => (
                <tr
                  key={kase.id}
                  onClick={() => navigate(`/cases/${kase.id}`)}
                  className="cursor-pointer border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-white/[0.022]"
                >
                  <td className="px-5 py-3">
                    <div className="font-mono text-[0.75rem] text-[var(--color-text-hi)]">{kase.caseNumber}</div>
                    {kase.claimNumber && (
                      <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{kase.claimNumber}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[0.8125rem] text-[var(--color-text-mid)]">{kase.subjectName}</td>
                  <td className="px-5 py-3 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">{kase.service}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
                        kase.status === "open" && "bg-[var(--color-pos)]/15 text-[var(--color-pos)]",
                        kase.status === "suspended" && "bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
                        kase.status === "closed" && "bg-[var(--color-ink-3)] text-[var(--color-text-lo)]",
                      )}
                    >
                      {kase.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <ClientFormModal
          title="Edit client"
          initial={{
            company: client.company,
            location: client.location ?? undefined,
            address: client.address ?? undefined,
            contactName: client.contactName ?? undefined,
            contactEmail: client.contactEmail ?? undefined,
            contactPhone: client.contactPhone ?? undefined,
            notes: client.notes ?? undefined,
          }}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            const payload: ClientUpdateBody = {
              company: body.company,
              location: body.location ?? null,
              address: body.address ?? null,
              contactName: body.contactName ?? null,
              contactEmail: body.contactEmail ?? null,
              contactPhone: body.contactPhone ?? null,
              notes: body.notes ?? null,
            };
            const { client: updated } = await clientsApi.update(client.id, payload);
            setClient(updated);
            invalidateQueries("clients:list");
            setEditing(false);
          }}
        />
      )}

      {(addingContact || editingContact) && (
        <ContactFormModal
          title={editingContact ? "Edit contact" : "Add contact"}
          initial={editingContact ?? undefined}
          onClose={() => {
            setAddingContact(false);
            setEditingContact(null);
          }}
          onSave={async (body) => {
            if (editingContact) {
              await clientsApi.updateContact(client.id, editingContact.id, body);
            } else {
              await clientsApi.createContact(client.id, body);
            }
            invalidateQueries("clients:list");
            setAddingContact(false);
            setEditingContact(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--color-text-mid)]">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function ContactFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: Partial<ClientContact>;
  onClose: () => void;
  onSave: (body: ClientContactBody) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<ClientContactRole>(initial?.role ?? "claims_adjuster");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lawFirmName, setLawFirmName] = useState(initial?.lawFirmName ?? "");
  const [matterNumber, setMatterNumber] = useState(initial?.matterNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLawyer = role === "lawyer";

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        role,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        lawFirmName: lawFirmName.trim() || undefined,
        matterNumber: matterNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save contact.");
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
        <p className="dashboard-modal__text mt-1">
          Adjuster, lawyer, risk manager, or other person at this client.
        </p>

        <div className="dashboard-modal__body mt-5 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ClientContactRole)}
                className={inputCls}
              >
                {ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </Field>
          </div>
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
          {(isLawyer || lawFirmName || matterNumber) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Law firm">
                <input value={lawFirmName} onChange={(e) => setLawFirmName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Matter / case #">
                <input
                  value={matterNumber}
                  onChange={(e) => setMatterNumber(e.target.value)}
                  placeholder="Their file number"
                  className={inputCls}
                />
              </Field>
            </div>
          )}
          {!isLawyer && !lawFirmName && !matterNumber && (
            <button
              type="button"
              className="self-start font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--color-text-lo)] hover:text-[var(--color-accent-2)]"
              onClick={() => setRole("lawyer")}
            >
              + Add law firm / matter fields
            </button>
          )}
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
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
