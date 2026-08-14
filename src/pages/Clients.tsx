import { Plus } from "lucide-react";
import { invClients } from "@/lib/mock-data";

export default function Clients() {
  const active = invClients.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="editorial text-[2.25rem] leading-none text-[var(--color-text-hi)]">Clients</h1>
          <p className="mt-1 font-mono text-[0.6875rem] text-[var(--color-text-lo)]">
            {active.length} active · {invClients.length} total
          </p>
        </div>
        <button className="flex h-9 items-center gap-2 rounded-[0.625rem] border border-[rgba(74,127,255,0.4)] bg-[var(--color-accent-soft)] px-3.5 text-[0.75rem] text-[var(--color-text-hi)] hover:shadow-[0_0_0_0.1875rem_var(--color-accent-soft)] transition-shadow">
          <Plus size={13} strokeWidth={1.8} />
          Add client
        </button>
      </div>

      <div className="surface overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                {["Company", "Contact", "Open Cases", "Total Cases", "Last Activity", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left">
                    <span className="eyebrow">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invClients.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-white/[0.022] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="text-[0.8125rem] font-medium text-[var(--color-text-hi)]">{c.company}</div>
                    <div className="font-mono text-[0.625rem] text-[var(--color-text-lo)]">{c.id}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-[0.78125rem] text-[var(--color-text-mid)]">{c.contact}</div>
                    <div className="text-[0.65625rem] text-[var(--color-text-lo)]">{c.contactEmail}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[0.8125rem] text-[var(--color-text-hi)]">{c.openCases}</td>
                  <td className="px-5 py-3.5 font-mono text-[0.75rem] text-[var(--color-text-lo)]">{c.totalCases}</td>
                  <td className="px-5 py-3.5 font-mono text-[0.71875rem] text-[var(--color-text-lo)]">{c.lastActivity}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[0.65625rem] font-medium"
                      style={
                        c.status === "active"
                          ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                          : { background: "rgba(91,102,128,0.15)", color: "#7a8499" }
                      }
                    >
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
