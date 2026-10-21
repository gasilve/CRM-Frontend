/**
 * Standalone OSINT mockup — no crm-api / case id needed.
 * Open http://localhost:5173/osint-preview
 */
import { OsintModal } from "@/components/cases/osint/OsintModal";

export default function OsintPreview() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0d16",
        display: "grid",
        placeItems: "center",
        color: "rgba(244,246,251,0.55)",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <p style={{ position: "fixed", top: 16, left: 20, margin: 0, fontSize: 13 }}>
        OSINT mockup preview · close the modal and refresh to open it again
      </p>
      <OsintModal onClose={() => {}} />
    </div>
  );
}
