import { parseRolloutTextAsync } from "@selftune/harness-codex/ingestors/codex-rollout";
import { buildLocalTelemetryBatchFromRollout } from "@selftune/harness-codex/ingestors/codex-trace-projection";
import type { SourceTaskRequest } from "@selftune/observability/duckdb-store";
import {
  CODEX_RECONSTRUCTION_PARSER,
  readBoundedSource,
  sourceDigest,
} from "@selftune/observability/source-reconstruction";
import { NORMALIZER_VERSION } from "@selftune/runtime/normalization";

/** Replays only captured parser inputs, never today's installed skill inventory. */
export const reconstructSourceTask: SourceTaskRequest["replay"] = async (input) => {
  const snapshot = input.reconstruction.snapshot;
  if (
    input.normalizer_version !== NORMALIZER_VERSION ||
    snapshot.parser !== CODEX_RECONSTRUCTION_PARSER
  )
    return { state: "unavailable", reason: "normalizer_changed" };
  const source = await readBoundedSource(snapshot.path);
  if (source.state === "unavailable") return source;
  if (source.bytes.length !== snapshot.bytes || sourceDigest(source.bytes) !== snapshot.sha256)
    return { state: "unavailable", reason: "source_changed" };
  const parsed = await parseRolloutTextAsync(
    snapshot.path,
    source.bytes.toString("utf8"),
    new Set(snapshot.skill_names),
    (cwd) =>
      new Set(snapshot.workspace_skills.find((workspace) => workspace.cwd === cwd)?.names ?? []),
    input.signal,
  );
  if (!parsed) return { state: "unavailable", reason: "projection_changed" };
  const telemetry = buildLocalTelemetryBatchFromRollout(parsed);
  if (!telemetry) return { state: "unavailable", reason: "projection_changed" };
  const { log_skill_links, ...sourceBatch } = telemetry;
  if (log_skill_links !== undefined) return { state: "unavailable", reason: "projection_changed" };
  const links = [];
  for (const link of telemetry.links ?? []) {
    const binding = input.reconstruction.bindings.find(
      (item) => item.skill_invocation_id === link.skill_invocation_id,
    );
    if (!binding) return { state: "unavailable", reason: "projection_changed" };
    links.push({ ...link, skill_name: binding.skill_name });
  }
  return {
    state: "reconstructed",
    task: parsed.query,
    batch: {
      ...sourceBatch,
      links,
      source_revision: input.source_revision,
      normalizer_version: input.normalizer_version,
    },
  };
};
