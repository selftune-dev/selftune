"use client";

import { PromptEvidencePanel } from "@selftune/ui/components";
import type { TrustFields } from "@selftune/ui/types";

import {
  SkillReportEvidenceSection,
  type SkillReportEvidenceSectionProps,
} from "./SkillReportEvidenceSection";

export interface SkillReportEvidenceTabContentProps extends SkillReportEvidenceSectionProps {
  examples?: TrustFields["examples"];
}

export function SkillReportEvidenceTabContent({
  examples,
  ...evidenceSectionProps
}: SkillReportEvidenceTabContentProps) {
  return (
    <div data-parity-root="skill-report-evidence" className="space-y-6">
      {examples ? <PromptEvidencePanel examples={examples} /> : null}
      <SkillReportEvidenceSection {...evidenceSectionProps} />
    </div>
  );
}
