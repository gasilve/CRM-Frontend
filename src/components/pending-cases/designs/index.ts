import type { ComponentType } from "react";
import type { PendingCaseView } from "../design-kit";
import AtlasDesign from "./AtlasDesign";
import CommandDesign from "./CommandDesign";
import DossierDesign from "./DossierDesign";
import GridDesign from "./GridDesign";
import LedgerDesign from "./LedgerDesign";
import TriageDesign from "./TriageDesign";

export type DesignId = "dossier" | "command" | "triage" | "atlas" | "ledger" | "grid";

export interface DesignEntry {
  id: DesignId;
  name: string;
  blurb: string;
  Component: ComponentType<{ view: PendingCaseView }>;
}

export const PENDING_CASE_DESIGNS: DesignEntry[] = [
  {
    id: "dossier",
    name: "Dossier",
    blurb: "Editorial and airy — numbered sections with a provenance timeline",
    Component: DossierDesign,
  },
  {
    id: "command",
    name: "Command",
    blurb: "Dense operator console — metrics strip and tabbed panes",
    Component: CommandDesign,
  },
  {
    id: "triage",
    name: "Triage",
    blurb: "Decision-first — readiness score, checklist and gap flags",
    Component: TriageDesign,
  },
  {
    id: "atlas",
    name: "Atlas",
    blurb: "Bento grid — everything visible at once in asymmetric tiles",
    Component: AtlasDesign,
  },
  {
    id: "ledger",
    name: "Ledger",
    blurb: "Typeset as a formal document with dotted leaders",
    Component: LedgerDesign,
  },
  {
    id: "grid",
    name: "Grid",
    blurb: "Regular case layout — preview after accept",
    Component: GridDesign,
  },
];

export const DEFAULT_DESIGN: DesignId = "dossier";

export const isDesignId = (value: unknown): value is DesignId =>
  PENDING_CASE_DESIGNS.some((entry) => entry.id === value);
