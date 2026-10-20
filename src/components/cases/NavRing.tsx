/** Case Sky View navigation ring — shared by live Sky View and the local preview. */

const CX = 230;
const CY = 230;
const OUTER = 212;
const GAP = 3;
const BAND_MID = 194;
const BAND_MID_HOVER = 201;

export const SKY_NAV = [
  { label: "Case", title: "Case details", color: "#3ee08a", details: true },
  { label: "Investigator view", title: "Investigator view", color: "#ffc857", path: (id: string) => `/cases/${id}/work` },
  { label: "Video", title: "Video upload", color: "#b18cff", video: true },
  { label: "Audio Isolation", title: "Speaker isolation + transcript", color: "#22d3ee", audioIso: true },
  { label: "Medical Canvass", title: "Medical Canvass", color: "#f472b6", medical: true },
  { label: "OSINT", title: "OSINT identity", color: "#38bdf8", osint: true },
  { label: "Forensic", title: "Forensic web collection", color: "#fbbf24", forensic: true },
  { label: "Reports", title: "Reports", color: "#5aa9ff", path: (_id: string) => `/reports` },
  { label: "Back", title: "Back to cases", color: "#ff9f45", path: (_id: string) => `/cases` },
] as const;

const polar = (angle: number, radius: number): [number, number] => {
  const a = ((angle - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
};

const midArc = (a0: number, a1: number, radius: number) => {
  const [x0, y0] = polar(a0, radius);
  const [x1, y1] = polar(a1, radius);
  return `M${x0},${y0} A${radius},${radius} 0 0 1 ${x1},${y1}`;
};

export function NavRing({
  caseId,
  detailsOn = false,
  osintOn = false,
  medicalOn = false,
  forensicOn = false,
  audioIsoOn = false,
  onGo,
  onDetails,
  onMedical,
  onOsint,
  onForensic,
  onVideo,
  onAudioIso,
}: {
  caseId: string;
  detailsOn?: boolean;
  osintOn?: boolean;
  medicalOn?: boolean;
  forensicOn?: boolean;
  audioIsoOn?: boolean;
  onGo: (path: string) => void;
  onDetails: () => void;
  onMedical: () => void;
  onOsint: () => void;
  onForensic: () => void;
  onVideo: () => void;
  onAudioIso: () => void;
}) {
  const seg = 360 / SKY_NAV.length;
  return (
    <svg viewBox="0 0 460 460" role="navigation" aria-label="Case pages">
      {SKY_NAV.map((item, index) => {
        const a0 = index * seg + GAP / 2;
        const a1 = (index + 1) * seg - GAP / 2;
        const mid = (a0 + a1) / 2;
        const [x, y] = polar(mid, OUTER + 20);
        const aim = ((mid - 90) * Math.PI) / 180;
        const active =
          ("details" in item && detailsOn) ||
          ("osint" in item && osintOn) ||
          ("medical" in item && medicalOn) ||
          ("forensic" in item && forensicOn) ||
          ("audioIso" in item && audioIsoOn);
        return (
          <g
            key={item.label}
            className={active ? "nav-g on" : "nav-g"}
            style={{ ["--seg" as string]: item.color }}
            onClick={() => {
              if ("details" in item) onDetails();
              else if ("video" in item) onVideo();
              else if ("audioIso" in item) onAudioIso();
              else if ("medical" in item) onMedical();
              else if ("osint" in item) onOsint();
              else if ("forensic" in item) onForensic();
              else onGo(item.path(caseId));
            }}
          >
            <title>{item.title}</title>
            <path
              className="nav-seg"
              d={midArc(a0, a1, BAND_MID)}
              style={{
                ["--arc" as string]: `path("${midArc(a0, a1, BAND_MID)}")`,
                ["--arc-hot" as string]: `path("${midArc(a0, a1, BAND_MID_HOVER)}")`,
              }}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="dlab"
              style={{
                ["--nx" as string]: `${Math.cos(aim) * 18}px`,
                ["--ny" as string]: `${Math.sin(aim) * 18}px`,
              }}
            >
              {item.label.split(" ").map((line, i, lines) => (
                <tspan key={line} x={x} dy={i === 0 ? (lines.length > 1 ? "-0.55em" : "0") : "1.15em"}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
