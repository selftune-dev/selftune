import { useRef, useState } from "react";
import type { EvaluationHistory } from "@selftune/control-plane/domain/evaluation-report";
import {
  Badge,
  Button,
  Alert,
  AlertTitle,
  AlertDescription,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@selftune/ui/primitives";
import {
  HarnessLabel,
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  type HarnessIconSpec,
} from "@selftune/ui/components";
import { EvaluationCaseInspector, percent, change, caseStatus } from "./EvaluationCaseInspector";
type Props = {
  history: EvaluationHistory;
  harnesses: readonly { id: string; name: string; icon?: HarnessIconSpec | null }[];
  busy: boolean;
  error?: string;
  onImport(file: File): void;
};
const mean = (values: readonly (number | null)[]) =>
  values.length && values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / values.length
    : null;
export function SkillEvaluations({ history, harnesses, busy, error, onImport }: Props) {
  const [selected, setSelected] = useState<string>();
  const [page, setPage] = useState(0);
  const [inspection, setInspection] = useState<{ run: string; index: number } | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const active = history.find((run) => run.id === selected) ?? history[0];
  const result = active?.result;
  const harness = harnesses.find(
    (entry) =>
      entry.id === result?.harness || (result?.harness === "claude" && entry.id === "claude_code"),
  );
  const cases = result?.cases ?? [];
  const visiblePage = Math.min(page, Math.max(0, Math.ceil(cases.length / 20) - 1));
  const complete = cases.length > 0 && cases.every((entry) => !entry.incomplete);
  const inspected = inspection?.run === active?.id ? cases[inspection?.index ?? -1] : undefined;
  const runs = history.map((run) => ({
    value: run.id,
    label:
      new Date(run.result.recordedAt ?? run.importedAt).toLocaleString() +
      " · " +
      (run.result.harness ?? "Harness not recorded"),
  }));
  return (
    <section aria-label="Skill evaluations" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Evaluations</h2>
          {active && (
            <Select
              items={runs}
              value={active.id}
              onValueChange={(value) => {
                if (value) setSelected(value);
                setPage(0);
                setInspection(null);
              }}
            >
              <SelectTrigger aria-label="Evaluation run" className="max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {runs.map((run) => (
                    <SelectItem key={run.value} value={run.value}>
                      {run.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
        <input
          ref={upload}
          type="file"
          accept=".json,application/json"
          aria-label="Evaluation report file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
            event.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => upload.current?.click()}>
          {busy ? "Loading…" : "Import report"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load evaluation</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!result || !active ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{busy ? "Loading evaluations…" : "No evaluation runs yet"}</EmptyTitle>
            <EmptyDescription>
              Import a SelfTune benchmark or Claude plugin report. Results stay on this device.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <HarnessLabel
              name={harness?.name ?? result.harness ?? "Harness not recorded"}
              icon={harness?.icon}
              variant="inline"
            />
            <span>{result.model ?? "Model not recorded"}</span>
            <span>Threshold {percent(result.threshold)}</span>
            <Badge variant={result.exitCode === 1 ? "destructive" : "secondary"}>
              {result.exitCode === 2
                ? "Incomplete"
                : result.exitCode === 1
                  ? "Below threshold"
                  : "Passed"}
            </Badge>
          </div>
          <dl
            aria-label="Run summary"
            className="grid grid-cols-2 gap-5 rounded-lg border p-5 sm:grid-cols-4"
          >
            {[
              {
                label: "Cases passed",
                value:
                  cases.filter((entry) => caseStatus(entry, result.threshold) === "Passed").length +
                  " / " +
                  cases.length,
              },
              {
                label: "Mean with skill",
                value: percent(complete ? mean(cases.map((entry) => entry.score)) : null),
              },
              {
                label: "Mean baseline",
                value: percent(complete ? mean(cases.map((entry) => entry.baseline)) : null),
              },
              {
                label: "Mean change",
                value: change(complete ? mean(cases.map((entry) => entry.delta)) : null),
              },
            ].map((metric) => (
              <div key={metric.label} className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{metric.value}</dd>
              </div>
            ))}
          </dl>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>With skill</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.slice(visiblePage * 20, (visiblePage + 1) * 20).map((entry, index) => (
                <TableRow key={entry.name + "-" + (visiblePage * 20 + index)}>
                  <TableCell className="max-w-sm whitespace-normal">
                    <Button
                      variant="ghost"
                      className="h-auto max-w-full justify-start whitespace-normal text-left"
                      onClick={() =>
                        setInspection({ run: active.id, index: visiblePage * 20 + index })
                      }
                    >
                      {entry.name}
                    </Button>
                  </TableCell>
                  <TableCell>{percent(entry.incomplete ? null : entry.score)}</TableCell>
                  <TableCell>{percent(entry.incomplete ? null : entry.baseline)}</TableCell>
                  <TableCell>{change(entry.incomplete ? null : entry.delta)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        caseStatus(entry, result.threshold) === "Below threshold"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {caseStatus(entry, result.threshold)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {cases.length > 20 && (
            <nav aria-label="Evaluation cases" className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={visiblePage === 0}
                onClick={() => setPage(visiblePage - 1)}
              >
                Previous
              </Button>
              <span>
                {visiblePage * 20 + 1}–{Math.min((visiblePage + 1) * 20, cases.length)} of{" "}
                {cases.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={(visiblePage + 1) * 20 >= cases.length}
                onClick={() => setPage(visiblePage + 1)}
              >
                Next
              </Button>
            </nav>
          )}
          <p className="text-xs text-muted-foreground">
            Latest 20 runs · Compare only matching harness, model, cases, and grading rules.
          </p>
          <EvaluationCaseInspector
            entry={inspected}
            threshold={result.threshold}
            onClose={() => setInspection(null)}
          />
        </>
      )}
    </section>
  );
}
