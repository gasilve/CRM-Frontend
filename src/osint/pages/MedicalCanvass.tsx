import { useEffect, useRef, useState } from "react";

const PRODIGY_BASE = import.meta.env.VITE_PRODIGY_API_URL || "http://localhost:8000";

export default function MedicalCanvass() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setError(true), 15000);
    return () => clearTimeout(t);
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-[var(--color-text-mid)]">
          <p className="text-lg font-medium">Medical Canvass unavailable</p>
          <p className="text-sm mt-1">Make sure the Prodigy backend is running at {PRODIGY_BASE}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 10, left: "var(--app-sidebar-w, 16rem)" }}>
      <iframe
        ref={iframeRef}
        src={`${PRODIGY_BASE}/medical-canvass.html`}
        className="w-full h-full border-0"
        title="Medical Records Canvass"
        allow="geolocation"
        onLoad={() => setError(false)}
        onError={() => setError(true)}
      />
    </div>
  );
}
