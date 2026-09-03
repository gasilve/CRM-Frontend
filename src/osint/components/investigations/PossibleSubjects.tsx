// @ts-nocheck

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prodigyApi as api } from "@/osint/lib/api";
import { X, Phone, Mail, MapPin, Users, ExternalLink, User } from "lucide-react";

interface SubjectProfile {
  finding_id: number;
  engine: string;
  source: string;
  sources: string[];
  title: string;
  name: string;
  age: number | null;
  dob: string | null;
  city: string | null;
  phones: string[];
  emails: string[];
  addresses: string[];
  relatives: string[];
  confidence: number;
  url: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  fastpeoplesearch: "FastPeopleSearch",
  truepeoplesearch: "TruePeopleSearch",
  thatsthem: "ThatsThem",
  nationalpublicdata: "NationalPublicData",
  "nationalpublicdata.com": "NationalPublicData",
  npd_search: "NPD",
  people_data: "People Search",
  spokeo: "Spokeo",
  beenverified: "BeenVerified",
  whitepages: "Whitepages",
};

const SOURCE_COLORS: Record<string, string> = {
  fastpeoplesearch: "bg-blue-50 border-blue-200 text-blue-700",
  truepeoplesearch: "bg-indigo-50 border-indigo-200 text-indigo-700",
  thatsthem: "bg-purple-50 border-purple-200 text-purple-700",
  "nationalpublicdata.com": "bg-emerald-50 border-emerald-200 text-emerald-700",
  npd_search: "bg-emerald-50 border-emerald-200 text-emerald-700",
  default: "bg-slate-50 border-slate-200 text-slate-600",
};

function sourceLabel(src: string) {
  return SOURCE_LABELS[src] || src.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function sourceColor(src: string) {
  return SOURCE_COLORS[src] || SOURCE_COLORS.default;
}

function SubjectModal({ subject, onClose }: { subject: SubjectProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-5 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{subject.name || subject.title}</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {subject.age && `Age ${subject.age}`}
              {subject.age && subject.city && " · "}
              {subject.city}
              {subject.dob && <span className="ml-2">DOB: {subject.dob}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source badge */}
        <div className="px-5 py-2 border-b bg-slate-50 flex items-center gap-2">
          <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${sourceColor(subject.source)}`}>
            {sourceLabel(subject.source)}
          </span>
          {subject.url && (
            <a href={subject.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline ml-auto">
              View source <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>

        {/* Data */}
        <div className="px-5 py-4 space-y-3">
          {subject.phones.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Phone className="h-3 w-3" />Phones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subject.phones.map((p, i) => (
                  <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-mono">{p}</span>
                ))}
              </div>
            </div>
          )}

          {subject.emails.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />Emails
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subject.emails.map((e, i) => (
                  <span key={i} className="text-xs bg-green-50 border border-green-200 text-green-800 px-2 py-0.5 rounded-full font-mono">{e}</span>
                ))}
              </div>
            </div>
          )}

          {subject.addresses.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />Addresses
              </p>
              <div className="space-y-1">
                {subject.addresses.map((a, i) => (
                  <p key={i} className="text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded">{a}</p>
                ))}
              </div>
            </div>
          )}

          {subject.relatives.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" />Relatives & Associates
              </p>
              <div className="flex flex-wrap gap-1.5">
                {subject.relatives.map((r, i) => (
                  <span key={i} className="text-xs bg-purple-50 border border-purple-200 text-purple-800 px-2 py-0.5 rounded-full">{r}</span>
                ))}
              </div>
            </div>
          )}

          {subject.phones.length === 0 && subject.emails.length === 0 &&
           subject.addresses.length === 0 && subject.relatives.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No detailed data available for this profile.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SubjectCard({ subject, onClick }: { subject: SubjectProfile; onClick: () => void }) {
  const locationStr = subject.city
    ? subject.city
    : (() => {
        const m = subject.title.match(/\u00b7\s*(.+)$/);
        return m ? m[1].trim() : null;
      })();

  const displayName = subject.name
    .replace(/^(Clustal|NPD|FastPeopleSearch)\s*[\u2014-]\s*/i, "")
    .replace(/,\s*\d+\s*\u00b7.*$/, "").trim() || subject.title;

  const age = subject.age || (() => {
    const m = subject.title.match(/,\s*(\d{2,3})\b/);
    return m ? parseInt(m[1]) : null;
  })();

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-lg border bg-white hover:border-blue-300 hover:shadow-sm transition-all p-2.5 space-y-1">

      <div className="flex items-center justify-between gap-1">
        <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded-full ${sourceColor(subject.source)}`}>
          {sourceLabel(subject.source)}
        </span>
        {subject.dob && (
          <span className="text-[9px] text-slate-400">{subject.dob}</span>
        )}
      </div>

      <div>
        <p className="text-xs font-bold text-slate-900 leading-tight">
          {displayName}
          {age && <span className="text-slate-500 font-normal ml-1 text-[11px]">· {age} yrs</span>}
        </p>
        {locationStr && (
          <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />{locationStr}
          </p>
        )}
      </div>

      {subject.phones.length > 0 && (
        <p className="text-[10px] text-blue-700 font-mono flex items-center gap-0.5">
          <Phone className="h-2.5 w-2.5 shrink-0" />{subject.phones[0]}
          {subject.phones.length > 1 && <span className="text-slate-400 ml-1">+{subject.phones.length - 1}</span>}
        </p>
      )}

      {subject.addresses.length > 0 && (
        <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5">
          <MapPin className="h-2.5 w-2.5 shrink-0 text-slate-400" />
          {subject.addresses[0]}
        </p>
      )}

      <div className="flex gap-2 text-[9px] text-slate-400 pt-0.5 border-t border-slate-100">
        {subject.emails.length > 0 && <span>✉️ {subject.emails.length}</span>}
        {subject.relatives.length > 0 && <span className="ml-1">👥 {subject.relatives.length}</span>}
        <span className="ml-auto text-blue-500">tap →</span>
      </div>
    </button>
  );
}

export function PossibleSubjects({ investigationId }: { investigationId: number }) {
  const [selected, setSelected] = useState<SubjectProfile | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["possible-subjects", investigationId],
    queryFn: async () => {
      const data = await api.get(`/api/investigations/${investigationId}/possible-subjects`);
      return data as { total: number; subjects: SubjectProfile[] };
    },
  });

  if (isLoading || !data || data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[80px] text-slate-300">
        <Users className="h-6 w-6 mb-1" />
        <p className="text-[10px]">No people search data yet</p>
      </div>
    );
  }

  return (
    <>
      {selected && <SubjectModal subject={selected} onClose={() => setSelected(null)} />}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Possible Subjects · {data.total} profile{data.total !== 1 ? "s" : ""} found
        </p>
        <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
          {data.subjects.map(s => (
            <SubjectCard key={s.finding_id} subject={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      </div>
    </>
  );
}
