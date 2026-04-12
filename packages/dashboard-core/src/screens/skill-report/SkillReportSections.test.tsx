import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@selftune/ui/components", () => ({
  DataQualityPanel: ({
    evidenceQuality,
    dataHygiene,
  }: {
    evidenceQuality?: { prompt_link_rate: number };
    dataHygiene?: { raw_checks: number };
  }) => (
    <div>
      Data Quality
      {evidenceQuality ? ` / prompt ${evidenceQuality.prompt_link_rate}` : ""}
      {dataHygiene ? ` / rows ${dataHygiene.raw_checks}` : ""}
    </div>
  ),
  EvidenceViewer: ({ proposalId }: { proposalId: string }) => (
    <div>Evidence Viewer {proposalId}</div>
  ),
  InvocationsPanel: ({
    invocations,
    sessionMetadata,
  }: {
    invocations: Array<unknown>;
    sessionMetadata?: Array<unknown>;
  }) => (
    <div>
      Invocations {invocations.length}
      {sessionMetadata ? ` / sessions ${sessionMetadata.length}` : ""}
    </div>
  ),
  PromptEvidencePanel: ({
    examples,
  }: {
    examples: { good: Array<unknown>; missed: Array<unknown>; noisy: Array<unknown> };
  }) => (
    <div>
      Prompt Evidence / good {examples.good.length} / missed {examples.missed.length} / noisy{" "}
      {examples.noisy.length}
    </div>
  ),
}));

vi.mock("@selftune/ui/primitives", () => ({
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./SkillReportEvidenceRail", () => ({
  SkillReportEvidenceRail: ({ activeProposal }: { activeProposal: string | null }) => (
    <div>Evidence Rail {activeProposal ?? "none"}</div>
  ),
}));

import { SkillReportEvidenceSection } from "./SkillReportEvidenceSection";
import { SkillReportEvidenceTabContent } from "./SkillReportEvidenceTabContent";
import { SkillReportInvocationsSection } from "./SkillReportInvocationsSection";
import { SkillReportDataQualityTabContent } from "./SkillReportDataQualityTabContent";

describe("Skill report shared sections", () => {
  it("renders the shared evidence viewer layout", () => {
    const html = renderToStaticMarkup(
      <SkillReportEvidenceSection
        evolution={[
          {
            proposal_id: "p1",
            action: "validated",
            timestamp: "2026-04-11T00:00:00Z",
            details: "Validated",
          },
        ]}
        activeProposal="p1"
        onSelect={() => {}}
        evidence={[
          {
            proposal_id: "p1",
            target: "description",
            stage: "validated",
            timestamp: "2026-04-11T00:00:00Z",
            rationale: null,
            confidence: null,
            original_text: null,
            proposed_text: null,
            validation: null,
            details: null,
            eval_set: [],
          },
        ]}
        viewerProposalId="p1"
        showViewer
      />,
    );

    expect(html).toContain("Evidence Rail p1");
    expect(html).toContain("Evidence Viewer p1");
  });

  it("renders the empty state when the viewer is disabled", () => {
    const html = renderToStaticMarkup(
      <SkillReportEvidenceSection
        evolution={[]}
        activeProposal={null}
        onSelect={() => {}}
        evidence={[]}
        viewerProposalId=""
        showViewer={false}
        emptyState={<div>No shared evidence yet</div>}
      />,
    );

    expect(html).toContain("No shared evidence yet");
  });

  it("renders the shared invocations wrapper", () => {
    const html = renderToStaticMarkup(
      <SkillReportInvocationsSection
        invocations={[
          {
            timestamp: "2026-04-11T00:00:00Z",
            session_id: "sess-1",
            triggered: true,
            query: "test query",
            invocation_mode: "implicit",
            confidence: 0.7,
            tool_name: null,
            agent_type: "main",
          },
        ]}
        sessionMetadata={[
          {
            session_id: "sess-1",
            agent_cli: "codex",
          },
        ]}
        callout={<div>Operational invocations only</div>}
      />,
    );

    expect(html).toContain("Operational invocations only");
    expect(html).toContain("Invocations 1 / sessions 1");
  });

  it("renders prompt evidence ahead of the shared evidence viewer", () => {
    const html = renderToStaticMarkup(
      <SkillReportEvidenceTabContent
        examples={{
          good: [
            {
              timestamp: "2026-04-12T00:00:00Z",
              session_id: "sess-1",
              query_text: "good query",
              triggered: true,
              confidence: 0.91,
              invocation_mode: "explicit",
              prompt_kind: null,
              source: "codex",
              platform: "codex",
              workspace_path: null,
              query_origin: "matched_prompt",
              is_system_like: false,
              observation_kind: "canonical",
            },
          ],
          missed: [],
          noisy: [],
        }}
        evolution={[]}
        activeProposal={null}
        onSelect={() => {}}
        evidence={[]}
        viewerProposalId=""
        showViewer={false}
        emptyState={<div>No shared evidence yet</div>}
      />,
    );

    expect(html).toContain("Prompt Evidence / good 1 / missed 0 / noisy 0");
    expect(html).toContain("No shared evidence yet");
  });

  it("renders the data-quality panel when metrics are available", () => {
    const html = renderToStaticMarkup(
      <SkillReportDataQualityTabContent
        evidenceQuality={{
          prompt_link_rate: 0.85,
          inline_query_rate: 0.6,
          user_prompt_rate: 0.7,
          meta_prompt_rate: 0.05,
          internal_prompt_rate: 0.03,
          no_prompt_rate: 0.22,
          system_like_rate: 0.04,
          invocation_mode_coverage: 1,
          confidence_coverage: 0.9,
          source_coverage: 1,
          scope_coverage: 0.95,
        }}
        dataHygiene={{
          naming_variants: [],
          source_breakdown: [],
          prompt_kind_breakdown: [],
          observation_breakdown: [],
          raw_checks: 42,
          operational_checks: 40,
          internal_prompt_rows: 1,
          internal_prompt_rate: 0.02,
          legacy_rows: 1,
          legacy_rate: 0.02,
          repaired_rows: 0,
          repaired_rate: 0,
        }}
      />,
    );

    expect(html).toContain("Data Quality / prompt 0.85 / rows 42");
  });

  it("renders the empty data-quality state when metrics are unavailable", () => {
    const html = renderToStaticMarkup(<SkillReportDataQualityTabContent />);

    expect(html).toContain("Detailed data-quality metrics are not available for this skill yet.");
  });
});
