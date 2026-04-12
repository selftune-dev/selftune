"use client";

import type { ReactNode } from "react";

import { AutonomyHeroCard, SupervisionFeed, TrustWatchlistRail } from "@selftune/ui/components";
import type {
  AttentionItem,
  AutonomousDecision,
  AutonomyStatus,
  TrustWatchlistEntry,
} from "@selftune/ui/types";

export interface OverviewCoreSurfaceProps {
  autonomyStatus: AutonomyStatus;
  lastRun: string | null;
  trustWatchlist: TrustWatchlistEntry[];
  attentionItems: AttentionItem[];
  autonomousDecisions: AutonomousDecision[];
  renderSkillLink?: (skillName: string) => ReactNode;
  heroActions?: ReactNode;
  trustRailFooter?: ReactNode;
  beforeHero?: ReactNode;
  betweenHeroAndFeed?: ReactNode;
  afterFeed?: ReactNode;
}

export function OverviewCoreSurface({
  autonomyStatus,
  lastRun,
  trustWatchlist,
  attentionItems,
  autonomousDecisions,
  renderSkillLink,
  heroActions,
  trustRailFooter,
  beforeHero,
  betweenHeroAndFeed,
  afterFeed,
}: OverviewCoreSurfaceProps) {
  return (
    <div className="@container/main flex flex-1 flex-col py-6">
      <div className="grid grid-cols-12 gap-6 px-4 lg:px-6">
        {beforeHero}

        <div className="col-span-12 @4xl/main:col-span-8">
          <AutonomyHeroCard status={autonomyStatus} lastRun={lastRun} actions={heroActions} />
        </div>

        <div className="col-span-12 @4xl/main:col-span-4 self-start">
          <TrustWatchlistRail
            entries={trustWatchlist}
            renderSkillLink={renderSkillLink}
            footer={trustRailFooter}
          />
        </div>

        {betweenHeroAndFeed}

        <div className="col-span-12">
          <SupervisionFeed
            attention={attentionItems}
            decisions={autonomousDecisions}
            renderSkillLink={renderSkillLink}
          />
        </div>

        {afterFeed}
      </div>
    </div>
  );
}
