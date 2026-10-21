import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildPortfolioAudit } from "@selftune/runtime/skill-portfolio";

const [, , mode, , , outputPath] = process.argv;
if (!outputPath) throw new Error("Expected report output path");
mkdirSync(dirname(outputPath), { recursive: true });
switch (mode) {
  case "counted-shell": {
    const path = join(dirname(outputPath), "counter");
    const count = (existsSync(path) ? Number(readFileSync(path, "utf8")) : 0) + 1;
    writeFileSync(path, String(count));
    writeFileSync(outputPath, JSON.stringify({ status: 200, body: JSON.stringify({ count }) }));
    break;
  }
  case "exit":
    process.stderr.write("x".repeat(2048));
    process.exit(7);
    break;
  case "timeout":
    writeFileSync(outputPath, "unfinished");
    await Bun.sleep(15_000);
    break;
  case "uncooperative":
    process.on("SIGTERM", () => {});
    writeFileSync(join(dirname(outputPath), "worker.pid"), String(process.pid));
    writeFileSync(outputPath, "unfinished");
    await Bun.sleep(15_000);
    break;
  case "invalid-json":
    writeFileSync(outputPath, "{");
    break;
  case "invalid-report":
    writeFileSync(outputPath, JSON.stringify({ installed_count: 99 }));
    break;
  case "valid":
    writeFileSync(outputPath, JSON.stringify(buildPortfolioAudit([], [], [])));
    break;
  default:
    throw new Error("Unknown worker fixture mode");
}
