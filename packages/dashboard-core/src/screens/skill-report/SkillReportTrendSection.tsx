"use client";

import type { ReactNode } from "react";

import { PassRateTrendChart, type PassRateTrendPoint } from "@selftune/ui/components";
import { Card, CardContent, CardHeader, CardTitle } from "@selftune/ui/primitives";

export interface SkillReportTrendSectionProps {
  data: PassRateTrendPoint[];
  title?: ReactNode;
  mode?: "pass_rate" | "volume";
  isLoading?: boolean;
  loadingState?: ReactNode;
}

export function SkillReportTrendSection({
  data,
  title = "Pass Rate Trend",
  mode = "pass_rate",
  isLoading = false,
  loadingState,
}: SkillReportTrendSectionProps) {
  return (
    <Card className="bg-muted border-none shadow-none ring-0">
      <CardHeader>
        <CardTitle className="font-headline text-lg tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && loadingState ? loadingState : <PassRateTrendChart data={data} mode={mode} />}
      </CardContent>
    </Card>
  );
}
