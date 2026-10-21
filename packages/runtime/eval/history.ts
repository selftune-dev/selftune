import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { EvaluationHistory } from "@selftune/control-plane/domain/evaluation-report";
import { SELFTUNE_CONFIG_DIR } from "../constants.js";
import { summarizeEvalReport } from "./report.js";

export const MAX_EVALUATION_BYTES = 2 * 1024 * 1024;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const bucket = (skill: string, root: string) => join(root, "evaluation-history", digest(skill));
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(EvaluationHistory));

export function readEvaluationHistory(
  skill: string,
  root = SELFTUNE_CONFIG_DIR,
): EvaluationHistory {
  const directory = bucket(skill, root);
  if (!existsSync(directory)) return [];
  if (lstatSync(directory).isSymbolicLink())
    throw new Error("Evaluation history cannot be a symlink");
  const files = readdirSync(directory);
  if (files.length > 1000)
    throw new Error("Evaluation history exceeds 1,000 records; archive older runs first");
  return files
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .map((name) => {
      const path = join(directory, name);
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.size > MAX_EVALUATION_BYTES)
        throw new Error("Invalid evaluation history record");
      return { path, modified: stat.mtimeMs };
    })
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 20)
    .flatMap(({ path }) => decode(readFileSync(path, "utf8")));
}

export function saveEvaluationReport(skill: string, raw: string, root = SELFTUNE_CONFIG_DIR) {
  if (!skill.trim() || skill.length > 256) throw new Error("A skill name is required");
  if (Buffer.byteLength(raw) > MAX_EVALUATION_BYTES) throw new Error("Report exceeds 2 MiB");
  const result = summarizeEvalReport(raw);
  const id = digest(raw);
  const directory = bucket(skill, root);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink())
    throw new Error("Evaluation history cannot be a symlink");
  const path = join(directory, `${id}.json`);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify([{ id, importedAt: new Date().toISOString(), result }]), {
      mode: 0o600,
      flag: "wx",
    });
  }
  return readEvaluationHistory(skill, root);
}
