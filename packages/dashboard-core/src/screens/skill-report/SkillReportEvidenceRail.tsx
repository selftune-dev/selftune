"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { EvolutionTimeline } from "@selftune/ui/components";
import type { EvolutionEntry } from "@selftune/ui/types";

export interface SkillReportEvidenceRailProps {
  evolution: EvolutionEntry[];
  activeProposal: string | null;
  onSelect(proposalId: string): void;
  collapsedProposalCount?: number;
}

export function SkillReportEvidenceRail({
  evolution,
  activeProposal,
  onSelect,
  collapsedProposalCount = 6,
}: SkillReportEvidenceRailProps) {
  const proposalCount = useMemo(
    () => new Set(evolution.map((entry) => entry.proposal_id)).size,
    [evolution],
  );
  const shouldCollapse = proposalCount > collapsedProposalCount;
  const [expanded, setExpanded] = useState(!shouldCollapse);

  const visibleEntries = useMemo(() => {
    if (expanded) return evolution;

    const allowed = new Set<string>();
    const collapsed: EvolutionEntry[] = [];
    for (const entry of evolution) {
      if (!allowed.has(entry.proposal_id)) {
        if (allowed.size >= collapsedProposalCount) continue;
        allowed.add(entry.proposal_id);
      }
      collapsed.push(entry);
    }
    return collapsed;
  }, [collapsedProposalCount, evolution, expanded]);

  return (
    <aside className="w-full px-4 py-4 @5xl/main:w-[252px] @5xl/main:self-start @5xl/main:pr-0">
      <div className="@5xl/main:sticky @5xl/main:top-16">
        <div
          className={`rounded-xl border border-border/10 bg-muted/20 px-3 py-3 text-xs ${expanded ? "themed-scroll max-h-[26rem] overflow-y-auto @5xl/main:max-h-[calc(100svh-6rem)]" : "overflow-visible"}`}
        >
          <EvolutionTimeline
            entries={visibleEntries}
            selectedProposalId={activeProposal}
            onSelect={onSelect}
          />
          {shouldCollapse ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon
                className={`size-3 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
              />
              {expanded ? "Collapse timeline" : `Show full timeline (${proposalCount} proposals)`}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
