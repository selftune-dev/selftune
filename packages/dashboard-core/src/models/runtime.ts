export interface RuntimeHealthModel {
  workspaceRoot: string;
  gitSha: string;
  dbPath: string;
  processMode: string;
  watcherMode: "wal" | "jsonl" | "none";
}
