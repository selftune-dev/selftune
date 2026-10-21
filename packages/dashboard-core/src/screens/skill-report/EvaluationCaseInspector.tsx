import type { EvaluationSummary } from "@selftune/control-plane/domain/evaluation-report";
import {
  Badge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Separator,
} from "@selftune/ui/primitives";
type Case = EvaluationSummary["cases"][number];
export const percent = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;
export const change = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${Math.round(value * 100)} pp`;
export const caseStatus = (entry: Case, threshold: number) =>
  entry.incomplete ? "Incomplete" : entry.score >= threshold ? "Passed" : "Below threshold";
const arms: readonly ("with" | "baseline")[] = ["with", "baseline"];
export function EvaluationCaseInspector({
  entry,
  threshold,
  onClose,
}: {
  entry: Case | undefined;
  threshold: number;
  onClose(): void;
}) {
  return (
    <Sheet
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="pr-12">
          <SheetTitle>{entry?.name ?? "Case evidence"}</SheetTitle>
          <SheetDescription>Prompt and recorded assertion evidence</SheetDescription>
        </SheetHeader>
        {entry && (
          <div className="flex flex-col gap-6 px-6 pb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={
                  caseStatus(entry, threshold) === "Below threshold" ? "destructive" : "secondary"
                }
              >
                {caseStatus(entry, threshold)}
              </Badge>
              <span>Threshold {percent(threshold)}</span>
              <span>Change {change(entry.incomplete ? null : entry.delta)}</span>
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="font-medium">Prompt</h3>
              <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-4">
                {entry.prompt ?? "Prompt was not included in this report."}
              </p>
            </section>
            {entry.errors.map((message) => (
              <p role="alert" key={message} className="text-destructive">
                {message}
              </p>
            ))}
            <Separator />
            <div className="grid min-w-0 gap-6 sm:grid-cols-2">
              {arms.map((arm) => (
                <section key={arm} className="flex min-w-0 flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{arm === "with" ? "With skill" : "Baseline"}</h3>
                    <span className="tabular-nums">
                      {percent(
                        entry.incomplete ? null : arm === "with" ? entry.score : entry.baseline,
                      )}
                    </span>
                  </div>
                  {entry.assertions
                    .filter((assertion) => assertion.arm === arm)
                    .map((assertion, index) => (
                      <div
                        key={`${assertion.name}-${index}`}
                        className="flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={assertion.passed ? "secondary" : "destructive"}>
                            {assertion.passed ? "Pass" : "Fail"}
                          </Badge>
                          {!assertion.scored && <Badge variant="outline">Not scored</Badge>}
                        </div>
                        <p className="break-words font-medium">{assertion.name}</p>
                        <p className="whitespace-pre-wrap break-words text-muted-foreground">
                          {assertion.evidence}
                        </p>
                      </div>
                    ))}
                  {!entry.assertions.some((assertion) => assertion.arm === arm) && (
                    <p className="text-muted-foreground">
                      No assertion evidence recorded for this arm.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
