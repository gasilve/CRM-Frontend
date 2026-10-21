/**
 * Sky View case layout with Forensic + Audio Isolation + OSINT + Medical on the circle.
 * Video stays the existing upload modal (Valentin) — not a board.
 *
 * http://127.0.0.1:5174/admin/skyview-preview
 */
import { useEffect, useRef, useState } from "react";
import { NavRing } from "@/components/cases/NavRing";
import SkyOsintFile from "@/components/cases/osint/SkyOsintFile";
import SkyMedicalFile from "@/components/cases/medical/SkyMedicalFile";
import SkyForensicFile from "@/components/cases/forensic/SkyForensicFile";
import SkyAudioIsolationFile from "@/components/cases/audio-isolation/SkyAudioIsolationFile";
import "@/components/cases/sky-v6.css";
import "@/components/cases/osint/osint-modal.css";

const SUBJECT = "Karen Suley Cisneros";

type Board = "case" | "osint" | "medical" | "forensic" | "audioIso";

export default function SkyviewPreview() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [detailsOn, setDetailsOn] = useState(false);
  const [osintOn, setOsintOn] = useState(false);
  const [osintShown, setOsintShown] = useState(false);
  const [osintLeaving, setOsintLeaving] = useState(false);
  const [medicalOn, setMedicalOn] = useState(false);
  const [medicalShown, setMedicalShown] = useState(false);
  const [medicalLeaving, setMedicalLeaving] = useState(false);
  const [forensicOn, setForensicOn] = useState(false);
  const [forensicShown, setForensicShown] = useState(false);
  const [forensicLeaving, setForensicLeaving] = useState(false);
  const [audioIsoOn, setAudioIsoOn] = useState(false);
  const [audioIsoShown, setAudioIsoShown] = useState(false);
  const [audioIsoLeaving, setAudioIsoLeaving] = useState(false);

  const boardActive = detailsOn || osintOn || medicalOn || forensicOn || audioIsoOn;
  const boardBusy = osintLeaving || medicalLeaving || forensicLeaving || audioIsoLeaving;

  const closeOsint = () => {
    setOsintOn(false);
    setOsintShown(false);
    setOsintLeaving(false);
  };
  const closeMedical = () => {
    setMedicalOn(false);
    setMedicalShown(false);
    setMedicalLeaving(false);
  };
  const closeForensic = () => {
    setForensicOn(false);
    setForensicShown(false);
    setForensicLeaving(false);
  };
  const closeAudioIso = () => {
    setAudioIsoOn(false);
    setAudioIsoShown(false);
    setAudioIsoLeaving(false);
  };

  const closeSiblings = (keep: Board) => {
    if (keep !== "case") setDetailsOn(false);
    if (keep !== "osint" && osintOn) closeOsint();
    if (keep !== "medical" && medicalOn) closeMedical();
    if (keep !== "forensic" && forensicOn) closeForensic();
    if (keep !== "audioIso" && audioIsoOn) closeAudioIso();
  };

  const openBoard = (which: Exclude<Board, "case">) => {
    pageRef.current?.parentElement?.scrollTo({ top: 0 });
    if (which === "osint") setOsintOn(true);
    if (which === "medical") setMedicalOn(true);
    if (which === "forensic") setForensicOn(true);
    if (which === "audioIso") setAudioIsoOn(true);
  };

  const toggleOsint = () => {
    if (boardBusy) return;
    closeSiblings("osint");
    if (!osintOn) openBoard("osint");
    else setOsintLeaving(true);
  };
  const toggleMedical = () => {
    if (boardBusy) return;
    closeSiblings("medical");
    if (!medicalOn) openBoard("medical");
    else setMedicalLeaving(true);
  };
  const toggleForensic = () => {
    if (boardBusy) return;
    closeSiblings("forensic");
    if (!forensicOn) openBoard("forensic");
    else setForensicLeaving(true);
  };
  const toggleAudioIso = () => {
    if (boardBusy) return;
    closeSiblings("audioIso");
    if (!audioIsoOn) openBoard("audioIso");
    else setAudioIsoLeaving(true);
  };
  const toggleDetails = () => {
    if (boardBusy) return;
    closeSiblings("case");
    setDetailsOn((v) => !v);
  };

  useEffect(() => {
    if (!osintOn) {
      setOsintShown(false);
      setOsintLeaving(false);
      return;
    }
    setOsintShown(true);
  }, [osintOn]);
  useEffect(() => {
    if (!osintLeaving) return;
    const timer = window.setTimeout(() => setOsintOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [osintLeaving]);

  useEffect(() => {
    if (!medicalOn) {
      setMedicalShown(false);
      setMedicalLeaving(false);
      return;
    }
    setMedicalShown(true);
  }, [medicalOn]);
  useEffect(() => {
    if (!medicalLeaving) return;
    const timer = window.setTimeout(() => setMedicalOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [medicalLeaving]);

  useEffect(() => {
    if (!forensicOn) {
      setForensicShown(false);
      setForensicLeaving(false);
      return;
    }
    setForensicShown(true);
  }, [forensicOn]);
  useEffect(() => {
    if (!forensicLeaving) return;
    const timer = window.setTimeout(() => setForensicOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [forensicLeaving]);

  useEffect(() => {
    if (!audioIsoOn) {
      setAudioIsoShown(false);
      setAudioIsoLeaving(false);
      return;
    }
    setAudioIsoShown(true);
  }, [audioIsoOn]);
  useEffect(() => {
    if (!audioIsoLeaving) return;
    const timer = window.setTimeout(() => setAudioIsoOn(false), 340);
    return () => window.clearTimeout(timer);
  }, [audioIsoLeaving]);

  const hint = boardActive ? null : "Tap Forensic, Audio Isolation, OSINT, or Medical on the ring";

  return (
    <div className="sky-v6 sky-v6--preview">
      <div className="sky-v6-scale">
        <div className="scene" aria-hidden>
          <div className="scene-fill">
            <div className="sky">
              <div className="orb o1" />
              <div className="orb o2" />
              <div className="orb o3" />
            </div>
            <div className="scrim" />
            <div className="grain" />
          </div>
        </div>

        <div ref={pageRef} className={boardActive ? "page details-on" : "page"}>
          <div className="id-col">
            <div className="g id">
              <p className="occ" style={{ marginBottom: 8, color: "var(--ink3)", fontSize: 12 }}>
                Preview · Forensic · Audio Isolation · OSINT · Medical
              </p>
              <h1 className="name">
                {SUBJECT}
                <span className="age">36</span>
              </h1>
              <p className="occ">Subject</p>
              <p className="addr">
                <b>Long Beach, CA</b>
                <span className="cap d">suburban</span>
              </p>
              <p className="client">
                Mock client
                <span className="cap c">Workers&apos; Comp</span>
              </p>
              <div className="facts">
                <div className="fact eat">
                  <div className="big">
                    <span>6:30 AM</span>
                    <span className="eat-lab">EAT</span>
                  </div>
                </div>
                <div className="fact">
                  <div className="sec">Transport</div>
                  <div className="pl">
                    <span className="k">Drives</span>
                    <span className="t">Mode</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="center">
            <div className="wheel">
              <NavRing
                caseId="preview"
                detailsOn={detailsOn}
                osintOn={osintOn}
                medicalOn={medicalOn}
                forensicOn={forensicOn}
                audioIsoOn={audioIsoOn}
                onGo={() => {}}
                onDetails={toggleDetails}
                onMedical={toggleMedical}
                onOsint={toggleOsint}
                onForensic={toggleForensic}
                onVideo={() => {}}
                onAudioIso={toggleAudioIso}
              />
              <div className="core g">
                <div className="ime-core">IME</div>
                <div className="n">—</div>
                <div className="l">Preview</div>
              </div>
            </div>

            {hint && (
              <div className="g assign">
                <div className="items">
                  <span className="ai done">{hint}</span>
                </div>
              </div>
            )}

            <div className="ledger">
              <div className="r">
                <div className="d">
                  <b>Mon</b> Oct 19
                </div>
                <div className="i">unassigned</div>
                <div className="o" style={{ color: "var(--ink3)" }}>
                  Open
                </div>
              </div>
            </div>
          </div>

          <div className="rail">
            <div className="g idl">
              <div className="sec">Summary</div>
              <p className="sum">
                Forensic Collection and Audio Isolation swap these boxes in place — same motion as
                OSINT / Medical / Case. Video opens the existing upload flow.
              </p>
            </div>
          </div>

          {osintShown && <SkyOsintFile subjectName={SUBJECT} leaving={osintLeaving} />}
          {medicalShown && <SkyMedicalFile subjectName={SUBJECT} leaving={medicalLeaving} />}
          {forensicShown && <SkyForensicFile subjectName={SUBJECT} leaving={forensicLeaving} />}
          {audioIsoShown && <SkyAudioIsolationFile subjectName={SUBJECT} leaving={audioIsoLeaving} />}
        </div>
      </div>
    </div>
  );
}
