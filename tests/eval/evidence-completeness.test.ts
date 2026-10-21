import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  openSync,
  closeSync,
  ftruncateSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { _setTestDb, openDb } from "@selftune/local-store";
import {
  SourceReconstruction,
  sourceDigest,
  MAX_RECONSTRUCTION_BYTES,
} from "@selftune/observability/source-reconstruction";
import {
  inspectEvidenceCompleteness,
  type EvidenceInspectionRequest,
} from "@selftune/runtime/testing-readiness/evidence-completeness";
import { writeCanonicalEvalSet } from "@selftune/runtime/testing-readiness/artifacts";
import { saveEvaluationReport } from "@selftune/runtime/eval/history";
import { assembleResult } from "@selftune/runtime/grading/grade-session";

let directory: string;
let previousConfig: string | undefined;
const marker = "PRIVATE_CANARY_DO_NOT_PRINT";
const sourceText = `${marker} original transcript`;
// SAFETY-UNKNOWN: Fixture serialization deliberately includes malformed records to exercise the production decoder.
const artifact = (name: string, contents: unknown) => {
  const path = join(directory, name);
  writeFileSync(path, JSON.stringify(contents));
  return path;
};
const inspect = (input: typeof EvidenceInspectionRequest.Type) =>
  Effect.runPromise(inspectEvidenceCompleteness(input));

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "selftune-evidence-inspection-"));
  previousConfig = process.env.SELFTUNE_CONFIG_DIR;
  process.env.SELFTUNE_CONFIG_DIR = directory;
  _setTestDb(openDb(":memory:"));
});
afterEach(() => {
  _setTestDb(null);
  if (previousConfig === undefined) delete process.env.SELFTUNE_CONFIG_DIR;
  else process.env.SELFTUNE_CONFIG_DIR = previousConfig;
  rmSync(directory, { recursive: true });
});

function sourceArtifacts() {
  const source = join(directory, "original.jsonl");
  writeFileSync(source, sourceText);
  const grade = artifact(
    "grade.json",
    assembleResult(
      {
        expectations: [{ text: marker, passed: true, evidence: marker }],
      },
      null,
      "fixture-session",
      "fixture-skill",
      source,
    ),
  );
  const recipe = artifact(
    "recipe.json",
    SourceReconstruction.make({
      snapshot: {
        parser: "codex-rollout/v1",
        path: source,
        sha256: sourceDigest(Buffer.from(sourceText)),
        task_sha256: sourceDigest(Buffer.from("fixture task")),
        bytes: Buffer.byteLength(sourceText),
        skill_names: [],
        workspace_skills: [],
      },
      bindings: [],
    }),
  );
  return { source, grade, recipe };
}

test("actual saved grade, routing eval and history formats produce counts-only qualification, not eviction permission", async () => {
  const { source, grade, recipe } = sourceArtifacts();
  const evals = writeCanonicalEvalSet("fixture", [
    { query: marker, should_trigger: true },
    { query: "unrelated fixture", should_trigger: false },
  ]);
  const raw = JSON.stringify({
    skill_name: "fixture",
    baseline: "old_skill",
    cases: [{ id: 1, with_skill_pass_rate: 1, baseline_pass_rate: 0, prompt: marker }],
  });
  const history = saveEvaluationReport("fixture", raw, directory);
  const historyPath = join(
    directory,
    "evaluation-history",
    sourceDigest(Buffer.from("fixture")),
    `${history[0].id}.json`,
  );
  const unknown = artifact("unknown.json", { secret: marker });
  const paths = [source, grade, recipe, evals, historyPath, unknown];
  const before = paths.map((path) => sourceDigest(readFileSync(path)));
  const report = await inspect({
    artifacts: [
      { kind: "grade", path: grade },
      { kind: "source_recipe", path: recipe },
      { kind: "routing_evals", path: evals },
      { kind: "evaluation_history", path: historyPath },
      { kind: "grade", path: unknown },
      { kind: "grade", path: join(directory, "missing.json") },
    ],
    authorized_sources: [source],
  });
  expect(report.counts).toEqual({
    self_contained: 1,
    source_dependent: 3,
    missing: 1,
    unsupported: 1,
  });
  expect(report.reasons.grade_original_unverified).toBe(1);
  expect(report.reasons.recipe_original_verified).toBe(1);
  expect(report.reasons.evaluation_summary_only).toBe(1);
  expect(report).toMatchObject({
    decision: "keep_all_sources",
    replay_qualified: 0,
    eviction_eligible: 0,
  });
  expect(Object.values(report.reasons).reduce((total, value) => total + value, 0)).toBe(6);
  expect(JSON.stringify(report)).not.toContain(marker);
  expect(JSON.stringify(report)).not.toContain(directory);
  expect(paths.map((path) => sourceDigest(readFileSync(path)))).toEqual(before);
});

test("changed and missing originals never qualify a grade or recipe as self-contained", async () => {
  const { source, grade, recipe } = sourceArtifacts();
  const input = {
    artifacts: [
      { kind: "grade", path: grade },
      { kind: "source_recipe", path: recipe },
    ],
    authorized_sources: [source],
  } satisfies typeof EvidenceInspectionRequest.Type;
  writeFileSync(source, sourceText.replace("original", "modified"));
  const changed = await inspect(input);
  expect(changed.reasons.source_changed).toBe(1);
  // A path-only grade has no historical digest. Existence cannot establish identity.
  expect(changed.reasons.grade_original_unverified).toBe(1);
  expect(changed.counts.self_contained).toBe(0);
  rmSync(source);
  const missing = await inspect(input);
  expect(missing.reasons.source_missing).toBe(2);
  expect(missing.eviction_eligible).toBe(0);
});

test("embedded source paths are not read unless explicitly authorized", async () => {
  const { source, grade, recipe } = sourceArtifacts();
  rmSync(source);
  const report = await inspect({
    artifacts: [
      { kind: "grade", path: grade },
      { kind: "source_recipe", path: recipe },
    ],
    authorized_sources: [],
  });
  expect(report.reasons.source_not_authorized).toBe(2);
  expect(report.reasons.source_missing).toBe(0);
});

test("empty, extended and oversized routing datasets fail closed", async () => {
  const empty = artifact("empty.json", []);
  const blank = artifact("blank.json", [{ query: " ", should_trigger: true }]);
  const extended = artifact("extended.json", [
    { query: marker, should_trigger: true, files: ["unverified"] },
  ]);
  const excessive = artifact(
    "excessive.json",
    Array.from({ length: 257 }, () => ({ query: marker, should_trigger: true })),
  );
  const report = await inspect({
    artifacts: [empty, blank, extended, excessive].map((path) => ({ kind: "routing_evals", path })),
    authorized_sources: [],
  });
  expect(report.counts).toEqual({
    self_contained: 0,
    source_dependent: 0,
    missing: 2,
    unsupported: 2,
  });
});

test("unsafe files and byte limits are unavailable, not successful empty inspections", async () => {
  const { source, grade } = sourceArtifacts();
  const link = join(directory, "link.json");
  symlinkSync(grade, link);
  const oversize = join(directory, "large.json");
  const fd = openSync(oversize, "w");
  try {
    ftruncateSync(fd, MAX_RECONSTRUCTION_BYTES + 1);
  } finally {
    closeSync(fd);
  }
  const report = await inspect({
    artifacts: [link, oversize, directory].map((path) => ({ kind: "grade", path })),
    authorized_sources: [source],
  });
  expect(report.reasons.artifact_unavailable).toBe(2);
  expect(report.reasons.artifact_over_budget).toBe(1);
  expect(report.counts.self_contained).toBe(0);
});

test("invalid and excessive requests fail before inspection without leaking inputs", async () => {
  for (const input of [
    { artifacts: [], authorized_sources: [] },
    { artifacts: [{ kind: "grade", path: marker }], authorized_sources: [] },
    {
      artifacts: Array.from({ length: 17 }, (_, index) => ({
        kind: "grade",
        path: join(directory, `${index}.json`),
      })),
      authorized_sources: [],
    },
    {
      artifacts: [
        { kind: "grade", path: directory },
        { kind: "grade", path: directory },
      ],
      authorized_sources: [],
    },
  ]) {
    await expect(Effect.runPromise(inspectEvidenceCompleteness(input))).rejects.toMatchObject({
      _tag: "EvidenceInspectionFailure",
      message: expect.not.stringContaining(marker),
    });
  }
});

test("maintenance command emits only the report and redacts malformed input errors", async () => {
  const path = writeCanonicalEvalSet("frozen", [{ query: marker, should_trigger: true }]);
  const manifest = artifact("manifest.json", {
    artifacts: [{ kind: "routing_evals", path }],
    authorized_sources: [],
  });
  const run = (input: string) =>
    Bun.spawnSync([
      process.execPath,
      resolve(import.meta.dir, "../../scripts/inspect-evidence-artifacts.ts"),
      input,
    ]);
  const result = run(manifest);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())).toMatchObject({
    counts: { self_contained: 1 },
    eviction_eligible: 0,
  });
  expect(`${result.stdout}${result.stderr}`).not.toContain(marker);
  expect(`${result.stdout}${result.stderr}`).not.toContain(directory);
  writeFileSync(manifest, marker);
  const invalid = run(manifest);
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stdout.toString()).toBe("");
  expect(invalid.stderr.toString()).not.toContain(marker);
  expect(invalid.stderr.toString()).not.toContain(directory);
});
