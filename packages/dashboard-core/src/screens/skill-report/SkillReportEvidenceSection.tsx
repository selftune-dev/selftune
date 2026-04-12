"use client";

import type { ReactNode } from "react";

import { EvidenceViewer } from "@selftune/ui/components";
import { Card, CardContent } from "@selftune/ui/primitives";
import type { EvidenceEntry, EvolutionEntry } from "@selftune/ui/types";

import { SkillReportEvidenceRail } from "./SkillReportEvidenceRail";

export interface SkillReportEvidenceSectionProps {
  evolution: EvolutionEntry[];
  activeProposal: string | null;
  onSelect: (proposalId: string) => void;
  evidence: EvidenceEntry[];
  viewerProposalId: string;
  showViewer: boolean;
  emptyState?: ReactNode;
}

export function SkillReportEvidenceSection({
  evolution,
  activeProposal,
  onSelect,
  evidence,
  viewerProposalId,
  showViewer,
  emptyState,
}: SkillReportEvidenceSectionProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/15 bg-card">
      <div className="flex flex-col @5xl/main:grid @5xl/main:grid-cols-[252px_minmax(0,1fr)] @5xl/main:items-start">
        {evolution.length > 0 ? (
          <SkillReportEvidenceRail
            evolution={evolution}
            activeProposal={activeProposal}
            onSelect={onSelect}
          />
        ) : null}

        <div className="min-w-0 p-4 @xl/main:p-5">
          {showViewer ? (
            <EvidenceViewer
              proposalId={viewerProposalId}
              evolution={evolution}
              evidence={evidence}
            />
          ) : (
            (emptyState ?? (
              <Card className="rounded-2xl">
                <CardContent className="py-12">
                  <div className="flex items-center justify-center text-sm text-muted-foreground">
                    No recent evaluation evidence available
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
