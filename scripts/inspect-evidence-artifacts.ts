import { Effect } from "effect";
import { readBoundedSource } from "@selftune/observability/source-reconstruction";
import { inspectEvidenceCompleteness } from "@selftune/runtime/testing-readiness/evidence-completeness";

const [path, ...extra] = process.argv.slice(2);
if (!path || extra.length > 0) {
  process.stderr.write(
    "Usage: bun scripts/inspect-evidence-artifacts.ts /explicit/inspection-manifest.json\n",
  );
  process.exitCode = 2;
} else {
  try {
    const manifest = await readBoundedSource(path);
    if (manifest.state !== "available") throw new Error("Unavailable manifest");
    const input: unknown = JSON.parse(manifest.bytes.toString("utf8"));
    const report = await Effect.runPromise(inspectEvidenceCompleteness(input));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    process.stderr.write(
      "Evidence inspection unavailable or request invalid. Nothing was changed; no source, payload or path was included in this error.\n",
    );
    process.exitCode = 1;
  }
}
