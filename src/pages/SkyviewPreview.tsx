/**
 * Sky View case layout with Medical Canvass + OSINT on the circle.
 * Boards swap boxes in-place (like Case), no modal.
 *
 * http://127.0.0.1:5174/admin/skyview-preview
 */
import { useEffect, useRef, useState } from "react";
import { NavRing } from "@/components/cases/NavRing";
import SkyOsintFile from "@/components/cases/osint/SkyOsintFile";
import SkyMedicalFile from "@/components/cases/medical/SkyMedicalFile";
import "@/components/cases/sky-v6.css";
import "@/components/cases/osint/osint-modal.css";

const SUBJECT = "Karen Suley Cisneros";

export default function SkyviewPreview() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [detailsOn, setDetailsOn] = useState(false);
  const [osintOn, setOsintOn] = useState(false);
  const [osintShown, setOsintShown] = useState(false);
  const [osintLeaving, setOsintLeaving] = useState(false);
  const [medicalOn, setMedicalOn] = useState(false);
  const [medicalShown, setMedicalShown] = useState(false);
  const [medicalLeaving, setMedicalLeaving] = useState(false);
  const boardActive = detailsOn || osintOn || medicalOn;
  const boardBusy = osintLeaving || medicalLeaving;

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

  const toggleOsint = () => {
    if (boardBusy) return;
    if (detailsOn) setDetailsOn(false);
    if (medicalOn) closeMedical();
    if (!osintOn) {
      pageRef.current?.parentElement?.scrollTo({ top: 0 });
      setOsintOn(true);
      return;
    }
    setOsintLeaving(true);
  };

  const toggleMedical = () => {
    if (boardBusy) return;
    if (detailsOn) setDetailsOn(false);
    if (osintOn) closeOsint();
    if (!medicalOn) {
      pageRef.current?.parentElement?.scrollTo({ top: 0 });
      setMedicalOn(true);
      return;
    }
    setMedicalLeaving(true);
  };

  const toggleDetails = () => {
    if (boardBusy) return;
    if (osintOn) closeOsint();
    if (medicalOn) closeMedical();
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

  const hint = boardActive
    ? null
    : "Tap OSINT (blue) or Medical Canvass (pink) on the ring";

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
                Preview · OSINT + Medical in-skyview
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
                onGo={() => {}}
                onVideo={() => {}}
                onDetails={toggleDetails}
                onMedical={toggleMedical}
                onOsint={toggleOsint}
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
                OSINT and Medical Canvass swap these boxes in place — same motion as Case file.
              </p>
            </div>
          </div>

          {osintShown && <SkyOsintFile subjectName={SUBJECT} leaving={osintLeaving} />}
          {medicalShown && <SkyMedicalFile subjectName={SUBJECT} leaving={medicalLeaving} />}
        </div>
      </div>
    </div>
  );
}
