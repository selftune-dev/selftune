import {
  readEvaluationHistory,
  saveEvaluationReport,
  MAX_EVALUATION_BYTES,
} from "@selftune/runtime/eval/history";

export async function handleEvaluations(
  request: Request,
  url: URL,
  root?: string,
): Promise<Response> {
  const skill = url.searchParams.get("skill");
  if (!skill || skill.length > 256)
    return Response.json({ error: "A skill name is required" }, { status: 400 });
  try {
    if (request.method === "GET") return Response.json(readEvaluationHistory(skill, root));
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return Response.json({ error: "Use application/json" }, { status: 415 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Report JSON is required" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_EVALUATION_BYTES) {
          await reader.cancel();
          return Response.json({ error: "Report exceeds 2 MiB" }, { status: 413 });
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Response.json(saveEvaluationReport(skill, Buffer.concat(chunks).toString("utf8"), root));
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Unable to read evaluation" },
      { status: 400 },
    );
  }
}
