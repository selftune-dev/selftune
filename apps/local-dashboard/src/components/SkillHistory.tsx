import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@selftune/ui/primitives";
import { schemaRequest } from "../dashboard-http";
import { useSSEConnected } from "../lib/reactivity";

const Revision = Schema.Struct({
  package_path: Schema.String,
  revision: Schema.Number,
  content_hash: Schema.String,
  captured_at: Schema.String,
  reason: Schema.String,
  restored_from: Schema.NullOr(Schema.Number),
});
const History = Schema.Struct({ revisions: Schema.Array(Revision) });
const Diff = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      change: Schema.String,
      before: Schema.NullOr(Schema.String),
      after: Schema.NullOr(Schema.String),
      beforeMode: Schema.NullOr(Schema.Number),
      afterMode: Schema.NullOr(Schema.Number),
    }),
  ),
});

export function SkillHistory({ skillPath }: { skillPath: string }) {
  const client = useQueryClient();
  const sseConnected = useSSEConnected();
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreHash, setRestoreHash] = useState<string | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const endpoint = `/api/v2/skill-history?path=${encodeURIComponent(skillPath)}`;
  const history = useQuery({
    queryKey: ["skill-history", skillPath, before],
    queryFn: ({ signal }) =>
      schemaRequest(`${endpoint}${before ? `&before=${before}` : ""}`, History, undefined, signal),
    staleTime: 10_000,
    refetchInterval: sseConnected ? false : 5_000,
  });
  const diff = useQuery({
    queryKey: ["skill-history-diff", skillPath, selected],
    enabled: selected !== null,
    queryFn: () => schemaRequest(`${endpoint}&revision=${selected}`, Diff),
  });
  const latest = history.data?.revisions[0];
  const restore = useMutation({
    mutationFn: () => {
      if (!latest || !selected || before || !restoreHash)
        throw new Error("Return to latest history before restoring.");
      return schemaRequest(
        "/api/v2/skill-history",
        Revision,
        JSON.stringify({
          path: latest.package_path,
          revision: selected,
          expectedHash: restoreHash,
        }),
      );
    },
    onSuccess: () => {
      setSelected(null);
      setConfirmRestore(false);
      void client.invalidateQueries({ queryKey: ["skill-history"] });
      void client.invalidateQueries({ queryKey: ["library"] });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local revision history</CardTitle>
        <CardDescription>
          Automatic snapshots while SelfTune is running. Revision numbers are local; team releases
          stay explicit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.isPending && <p>Loading history…</p>}
        {history.error && <p role="alert">{history.error.message}</p>}
        {history.data?.revisions.length === 0 && <p>No revisions recorded yet.</p>}
        <div className="flex flex-wrap gap-2">
          {history.data?.revisions.map((entry) => (
            <Button
              key={entry.revision}
              variant={selected === entry.revision ? "secondary" : "outline"}
              onClick={() => {
                setSelected(entry.revision);
                setConfirmRestore(false);
              }}
            >
              Revision {entry.revision} · {new Date(entry.captured_at).toLocaleString()}
              {entry.restored_from ? ` · restored from ${entry.restored_from}` : ""}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {before && (
            <Button
              variant="ghost"
              onClick={() => {
                setBefore(null);
                setSelected(null);
              }}
            >
              Latest revisions
            </Button>
          )}
          {history.data?.revisions.length === 50 && (
            <Button
              variant="ghost"
              onClick={() => {
                setBefore(history.data?.revisions.at(-1)?.revision ?? null);
                setSelected(null);
              }}
            >
              Older revisions
            </Button>
          )}
        </div>
        {diff.isFetching && selected !== null && <p>Loading changes…</p>}
        {diff.error && <p role="alert">{diff.error.message}</p>}
        {selected !== null &&
          diff.data?.files.map((file) => (
            <details key={file.path} open={file.path === "SKILL.md"}>
              <summary>
                {file.path} · {file.change}
              </summary>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: "Before", value: file.before },
                  { label: "After", value: file.after },
                ].map((side) => (
                  <div key={side.label}>
                    <p className="text-sm font-medium">{side.label}</p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border p-3 text-xs">
                      {side.value ?? "File absent or binary"}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          ))}
        {selected !== null && latest && selected !== latest.revision && !before && (
          <div className="space-y-2">
            {confirmRestore ? (
              <>
                <p>
                  Restore revision {selected}? Current files will be preserved in history. This
                  replaces the installed skill folder.
                </p>
                <Button disabled={restore.isPending} onClick={() => restore.mutate()}>
                  {restore.isPending ? "Restoring…" : "Confirm restore"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRestore(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setRestoreHash(latest.content_hash);
                  setConfirmRestore(true);
                }}
              >
                Restore revision {selected}
              </Button>
            )}
          </div>
        )}
        {restore.error && <p role="alert">{restore.error.message}</p>}
      </CardContent>
    </Card>
  );
}
