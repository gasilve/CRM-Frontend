import { useState } from "react";
import { createPortal } from "react-dom";
import type { CaseService } from "@/lib/crm-api";
import { VideoIntakeModal } from "@/components/cases/VideoIntakeModal";
import { SkyVideoDesign } from "@/components/cases/video-designs/SkyVideoDesign";
import { WorkVideoDesign } from "@/components/cases/video-designs/WorkVideoDesign";
import { SiteVideoDesign } from "@/components/cases/video-designs/SiteVideoDesign";
import { useVideoIntake } from "@/components/cases/video-designs/use-video-intake";
import "./video-designs.css";

const TABS = [
  { id: "original", label: "Original" },
  { id: "sky", label: "Sky View" },
  { id: "work", label: "Work page" },
  { id: "site", label: "Site" },
] as const;

type DesignId = (typeof TABS)[number]["id"];

export function VideoDesignGallery({
  caseId,
  subjectName,
  claimNumber,
  caseNumber,
  service,
  signerName,
  crew = [],
  onClose,
}: {
  caseId: string;
  subjectName: string;
  claimNumber: string | null;
  caseNumber: string;
  service: CaseService;
  signerName: string;
  crew?: string[];
  onClose: () => void;
}) {
  const [design, setDesign] = useState<DesignId>("original");
  const intake = useVideoIntake({ caseId, signerName, onClose });
  const claim = claimNumber ? `Claim ${claimNumber}` : caseNumber;
  const shared = { intake, subjectName, claim, service, signerName, crew, onClose };

  return createPortal(
    <div className="dashboard-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={design === "original" ? "vd-stack original flex max-h-full flex-col items-center gap-3" : "vd-stack flex max-h-full flex-col items-center gap-3"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vd-switch" role="tablist" aria-label="Choose a video modal">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" className={design === tab.id ? "on" : ""} onClick={() => setDesign(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        {design === "original" && (
          <div className="sky-v6 vd-original">
            <VideoIntakeModal
              caseId={caseId}
              subjectName={subjectName}
              claimNumber={claimNumber}
              caseNumber={caseNumber}
              service={service}
              signerName={signerName}
              crew={crew}
              onClose={onClose}
            />
          </div>
        )}
        {design === "sky" && <SkyVideoDesign {...shared} />}
        {design === "work" && <WorkVideoDesign {...shared} />}
        {design === "site" && <SiteVideoDesign {...shared} />}
      </div>
      <input
        ref={intake.fileRef}
        type="file"
        accept="video/*,.mp4,.m4v,.mov,.mts,.m2ts,.avi,.mkv,.wmv,.webm"
        multiple
        hidden
        onChange={(event) => intake.addFiles(event.target.files)}
      />
    </div>,
    document.body,
  );
}
