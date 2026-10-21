import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";
import { Option, Schema } from "effect";

const ReadArguments = Schema.Struct({
  file_path: Schema.optionalKey(Schema.String),
  cmd: Schema.optionalKey(Schema.String),
  command: Schema.optionalKey(Schema.String),
});
const decodeArguments = Schema.decodeUnknownOption(Schema.fromJsonString(ReadArguments));

export interface SkillReadEvidence {
  skill_name: string;
  skill_path: string;
  call_id: string;
  output_sha256: string;
  output_chars: number;
  output_line: number;
  version_scope: "captured_tool_output";
}

/** Captures source evidence, not a claim that the complete package was read. */
export function createSkillReadEvidenceCollector() {
  const pending = new Map<string, string>();
  const reads: SkillReadEvidence[] = [];
  return {
    customCall(id: string | undefined, input: string | undefined) {
      if (!id || !input) return;
      const paths = new Set(input.match(/\/[^\s"'`\\<>;()]+\/SKILL\.md\b/g) ?? []);
      pending.delete(id);
      if (paths.size === 1) for (const path of paths) pending.set(id, path);
    },
    call(id: string | undefined, name: string | undefined, args: string | undefined) {
      if (!id || !args) return;
      pending.delete(id);
      const decoded = decodeArguments(args);
      if (Option.isNone(decoded)) return;
      const input = decoded.value;
      let path: string | undefined;
      if (name === "Read" || name === "read_file") path = input.file_path;
      else if (name === "exec_command" || name === "shell_command") {
        // Only a single cat operand establishes which file the output belongs to.
        const match = /^cat\s+(?:"([^"\n$`]+)"|'([^'\n]+)'|([^\s;&|<>$`]+))\s*$/.exec(
          input.cmd ?? input.command ?? "",
        );
        path = match?.[1] ?? match?.[2] ?? match?.[3];
      }
      if (path?.startsWith("/") && basename(path) === "SKILL.md") pending.set(id, path);
    },
    output(id: string | undefined, output: string | undefined, line: number) {
      if (!id) return;
      const path = pending.get(id);
      pending.delete(id);
      if (!path || !output || reads.length >= 256) return;
      reads.push({
        skill_name: basename(dirname(path)),
        skill_path: path,
        call_id: id,
        output_sha256: createHash("sha256").update(output).digest("hex"),
        output_chars: output.length,
        output_line: line,
        version_scope: "captured_tool_output",
      });
    },
    reads,
  };
}
