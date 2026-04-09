import { updateSignalConsumed } from "../localdb/direct-write.js";
import { getDb } from "../localdb/db.js";
import { queryImprovementSignals } from "../localdb/queries.js";
import type { ImprovementSignalRecord } from "../types.js";

export function readPendingSignals(
  reader?: () => ImprovementSignalRecord[],
): ImprovementSignalRecord[] {
  const read =
    reader ??
    (() => {
      const db = getDb();
      return queryImprovementSignals(db, false) as ImprovementSignalRecord[];
    });

  try {
    return read().filter((signal) => !signal.consumed);
  } catch {
    return [];
  }
}

export function groupSignalsBySkill(signals: ImprovementSignalRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const signal of signals) {
    if (signal.mentioned_skill) {
      const key = signal.mentioned_skill.toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return map;
}

export function markSignalsConsumed(signals: ImprovementSignalRecord[], runId: string): void {
  try {
    if (signals.length === 0) return;
    for (const signal of signals) {
      const ok = updateSignalConsumed(signal.session_id, signal.query, signal.signal_type, runId);
      if (!ok) {
        console.error(
          `[orchestrate] failed to mark signal consumed: session_id=${signal.session_id}, signal_type=${signal.signal_type}`,
        );
      }
    }
  } catch {
    // Silent on errors.
  }
}
