"use client";

import type { ReactNode } from "react";

import { InvocationsPanel, type InvocationRow, type SessionMeta } from "@selftune/ui/components";

export interface SkillReportInvocationsSectionProps {
  invocations: InvocationRow[];
  sessionMetadata?: SessionMeta[];
  callout?: ReactNode;
}

export function SkillReportInvocationsSection({
  invocations,
  sessionMetadata,
  callout,
}: SkillReportInvocationsSectionProps) {
  return (
    <div className="space-y-2">
      {callout}
      <InvocationsPanel invocations={invocations} sessionMetadata={sessionMetadata} />
    </div>
  );
}
