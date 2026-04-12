"use client";

import type { ReactNode } from "react";

import { DataQualityPanel } from "@selftune/ui/components";
import { Card, CardContent } from "@selftune/ui/primitives";
import type { TrustFields } from "@selftune/ui/types";

export interface SkillReportDataQualityTabContentProps {
  evidenceQuality?: TrustFields["evidence_quality"];
  dataHygiene?: TrustFields["data_hygiene"];
  emptyState?: ReactNode;
}

export function SkillReportDataQualityTabContent({
  evidenceQuality,
  dataHygiene,
  emptyState,
}: SkillReportDataQualityTabContentProps) {
  if (!evidenceQuality && !dataHygiene) {
    return (
      emptyState ?? (
        <Card className="rounded-2xl border border-border/15 bg-card">
          <CardContent className="py-12">
            <p className="text-center text-sm text-muted-foreground">
              Detailed data-quality metrics are not available for this skill yet.
            </p>
          </CardContent>
        </Card>
      )
    );
  }

  return <DataQualityPanel evidenceQuality={evidenceQuality} dataHygiene={dataHygiene} />;
}
