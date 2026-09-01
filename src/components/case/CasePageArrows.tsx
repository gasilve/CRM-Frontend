import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Page = { id: string; name: string };

type Props = {
  pages: Page[];
  activePageId: string;
  onSelect: (pageId: string) => void;
};

/** Prev/next carousel controls — portaled to body so position:fixed tracks the viewport. */
export function CasePageArrows({ pages, activePageId, onSelect }: Props) {
  const idx = pages.findIndex((p) => p.id === activePageId);
  if (idx < 0) return null;

  const prev = idx > 0 ? pages[idx - 1] : null;
  const next = idx < pages.length - 1 ? pages[idx + 1] : null;
  if (!prev && !next) return null;

  const btn = (page: Page, dir: "prev" | "next", icon: React.ReactNode) => (
    <button
      key={dir}
      type="button"
      className={cn("case-page-arrow", dir === "prev" ? "case-page-arrow--prev" : "case-page-arrow--next")}
      aria-label={`${dir === "prev" ? "Previous" : "Next"} page — ${page.name}`}
      title={page.name}
      onClick={() => onSelect(page.id)}
    >
      {icon}
    </button>
  );

  return createPortal(
    <>
      {prev && btn(prev, "prev", <ChevronLeft size={20} strokeWidth={1.8} />)}
      {next && btn(next, "next", <ChevronRight size={20} strokeWidth={1.8} />)}
    </>,
    document.body,
  );
}
