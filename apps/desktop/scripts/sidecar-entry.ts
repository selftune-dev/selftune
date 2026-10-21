import { INTERNAL_REPORT_WORKER_COMMAND } from "../../local/src/report-worker-command.js";

if (process.argv[2] === INTERNAL_REPORT_WORKER_COMMAND) {
  process.argv.splice(2, 1);
  await import("../../local/src/report-worker.js");
} else {
  await import("../../cli/src/main.js");
}
