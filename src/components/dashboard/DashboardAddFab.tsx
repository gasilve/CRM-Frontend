import { createPortal } from "react-dom";

type Props = {
  visible: boolean;
  onClick: () => void;
};

function WideChevronUp() {
  return (
    <svg
      width="56"
      height="16"
      viewBox="0 0 56 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3 14L28 3L53 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardAddFab({ visible, onClick }: Props) {
  if (!visible) return null;

  return createPortal(
    <button
      type="button"
      className="dashboard-add-fab"
      onClick={onClick}
      title="Add widget"
      aria-label="Add widget"
    >
      <WideChevronUp />
    </button>,
    document.body,
  );
}
