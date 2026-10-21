const base = new URL(process.argv[2] ?? "http://invalid");
const samples = Number(process.argv[3] ?? 100);
const skillName = process.argv[4] ?? "selftune";
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
  !Number.isSafeInteger(samples) ||
  samples < 100 ||
  samples > 1000
) {
  throw new Error(
    "Usage: bun scripts/benchmark-dashboard-http.ts <loopback-base-url> [samples:100..1000] [skill-name]",
  );
}
const measure = async (path: string) => {
  const start = performance.now();
  const response = await fetch(new URL(path, base));
  const bytes = (await response.arrayBuffer()).byteLength;
  if (!response.ok)
    throw new Error(`Benchmark route ${path.split("?")[0]} returned ${response.status}`);
  return { ms: performance.now() - start, bytes };
};
const summarize = (name: string, timings: number[], bytes: number) => {
  timings.sort((a, b) => a - b);
  const at = (fraction: number) =>
    Math.round((timings[Math.ceil(timings.length * fraction) - 1] ?? 0) * 100) / 100;
  console.log(
    JSON.stringify({
      name,
      samples: timings.length,
      p50Ms: at(0.5),
      p95Ms: at(0.95),
      maxMs: at(1),
      bytes,
    }),
  );
};
async function measureWithHealth(name: string, path: string) {
  let workDone = false;
  const pending = Promise.allSettled([measure(path)]).finally(() => {
    workDone = true;
  });
  const underLoad: number[] = [];
  let overlapping = 0;
  let healthBytes = 0;
  for (let index = 0; index < samples; index++) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (!workDone) overlapping++;
    const health = await measure("/api/health");
    underLoad.push(health.ms);
    healthBytes = health.bytes;
  }
  const [report] = await pending;
  if (!report || report.status === "rejected")
    throw new Error("Background report benchmark failed");
  summarize(`health-during-${name}`, underLoad, healthBytes);
  console.log(JSON.stringify({ name, ...report.value, healthSamplesWhilePending: overlapping }));
}
for (const [name, path] of [
  ["health", "/api/health"],
  ["shell", "/api/v2/shell"],
  ["analytics", "/api/v2/analytics"],
  ["library-page", "/api/v2/library?view=index&limit=50"],
  ["library-search", "/api/v2/library?view=index&limit=50&search=codex"],
] as const) {
  const timings = [];
  let bytes = 0;
  if (name === "shell" || name === "analytics") await measureWithHealth(`${name}-first`, path);
  else console.log(JSON.stringify({ name: `${name}-first`, ...(await measure(path)) }));
  for (let index = 0; index < samples; index++) {
    const sample = await measure(path);
    timings.push(sample.ms);
    bytes = sample.bytes;
  }
  summarize(name, timings, bytes);
}
await measureWithHealth("overview", "/api/v2/overview");
await measureWithHealth("skill-report", `/api/v2/skills/${encodeURIComponent(skillName)}`);
