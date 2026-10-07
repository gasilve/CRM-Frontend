import { useEffect, useRef, useState } from "react";

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
        <div className="surface p-8 text-center max-w-sm">
          <p className="text-lg font-medium text-[var(--color-text-hi)]">Medical Canvass unavailable</p>
          <p className="text-sm mt-2 text-[var(--color-text-mid)]">Could not load the Medical Records Canvass tool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 10, left: "var(--app-sidebar-w, 16rem)" }}>
      <iframe
        ref={iframeRef}
        src="/admin/medical-canvass.html"
        className="w-full h-full border-0"
        title="Medical Records Canvass"
        allow="geolocation"
        onLoad={() => setError(false)}
        onError={() => setError(true)}
      />
    </div>
  );
}
