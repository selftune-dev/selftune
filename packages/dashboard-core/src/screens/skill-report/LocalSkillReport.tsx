import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@selftune/ui/primitives";
import {
  HarnessLabel,
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@selftune/ui/components";
import { timeAgo } from "@selftune/ui/lib";
import {
  useOptionalDashboardHost,
  type DashboardLibraryContribution,
  type DashboardLibraryActions,
} from "../../host";
import type { LibrarySkillModel } from "../../models";
import { LibraryConnections } from "../skills/LibraryConnections";
import { ContextSavings } from "../skills/ContextSavings";
import { OnDemandSkillsReview } from "../skills/OnDemandSkillsReview";

export interface LocalSkillReportProps {
  name: string;
  backLink: ReactNode;
  checks: number;
  sessions: number;
  workspaces?: number;
  lastSeen?: string | null;
  initialTab?: "overview" | "history";
  activity(skill?: LibrarySkillModel): ReactNode;
  files: ReactNode;
  history: ReactNode;
  testing: ReactNode;
  diagnostics: ReactNode;
}

function UnavailablePackage() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Installation not found</EmptyTitle>
        <EmptyDescription>
          Usage history is still available. Return to Skills to check the package’s current
          location.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ReportLayout({
  report,
  skill,
  actions,
  refresh,
  inventoryMessage,
}: {
  report: LocalSkillReportProps;
  skill?: LibrarySkillModel;
  actions?: DashboardLibraryActions;
  refresh?: () => void | Promise<void>;
  inventoryMessage?: string;
}) {
  const [tab, setTab] = useState<string>(report.initialTab ?? "overview");
  const description = skill?.contextEntries?.find((entry) => entry.metadata?.description)?.metadata
    ?.description;
  const locations = (skill?.locations ?? []).filter((location) =>
    skill?.lifecycle === "library"
      ? location.sourceKind === "cached"
      : location.sourceKind === "installed",
  );
  locations.sort((a, b) => Number(Boolean(b.connection)) - Number(Boolean(a.connection)));
  const canMoveOnDemand =
    skill?.lifecycle === "active" &&
    Boolean(
      skill.onDemandSources?.length ||
      skill.onDemandSource?.contentHash ||
      skill.archiveRecommendation?.contentHash,
    );
  return (
    <div className="@container/main flex flex-1 flex-col gap-5 p-4 lg:p-6">
      <header className="flex flex-col gap-3">
        {report.backLink}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-2xl font-semibold">{report.name}</h1>
          {skill && (
            <Badge variant="secondary">
              {skill.lifecycle === "library" ? "On demand" : skill.status}
            </Badge>
          )}
          <div className="ml-auto">
            <Button variant="outline" onClick={() => setTab("files")}>
              View files
            </Button>
          </div>
        </div>
        {description &&
          (description.includes(". ") ? (
            <details className="max-w-3xl text-sm text-muted-foreground">
              <summary className="cursor-pointer">{description.split(/(?<=\.)\s/)[0]}</summary>
              <p className="mt-2 leading-relaxed">{description}</p>
            </details>
          ) : (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ))}
        {skill && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{skill.sources.map((source) => source.label).join(" · ")}</span>
            <LibraryConnections skill={skill} />
          </div>
        )}
        {inventoryMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {inventoryMessage}
          </p>
        )}
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="installations">Installations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 lg:grid-cols-4">
            {[
              ["Recorded checks", report.checks.toLocaleString()],
              ["Sessions", report.sessions.toLocaleString()],
              ["Workspaces", report.workspaces?.toLocaleString() ?? "Unknown"],
              ["Last recorded use", report.lastSeen ? timeAgo(report.lastSeen) : "Not recorded"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">{report.activity(skill)}</div>
            <aside className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Where it is available</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {locations.slice(0, 4).map((location) => (
                    <div key={location.id}>
                      <HarnessLabel
                        name={location.connection ?? "Local package"}
                        icon={location.connectionIcon}
                        variant="inline"
                      />
                      <p className="truncate text-xs text-muted-foreground" title={location.path}>
                        {location.label} · {location.path.split("/").slice(-3).join("/")}
                      </p>
                    </div>
                  ))}
                  {locations.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      {locations.length - 4} more locations
                    </p>
                  )}
                  {!locations.length && (
                    <p className="text-sm text-muted-foreground">
                      No installation details available.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => setTab("installations")}>
                    Manage installations
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Package</CardTitle>
                  <CardDescription>Inspect the instructions and supporting files.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => setTab("files")}>
                    Browse files
                  </Button>
                </CardContent>
              </Card>
              {canMoveOnDemand && (
                <Card>
                  <CardHeader>
                    <CardTitle>Only need it occasionally?</CardTitle>
                    <CardDescription>
                      Preview on-demand use and context estimates for each harness.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => setTab("installations")}>
                      Preview on-demand use
                    </Button>
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Diagnostics and data sources
            </summary>
            <div className="mt-4">{report.diagnostics}</div>
          </details>
        </TabsContent>
        <TabsContent value="files">{report.files}</TabsContent>
        <TabsContent
          value="installations"
          className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"
        >
          {skill ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Where this skill loads</CardTitle>
                  <CardDescription>
                    Installed locations reported by this Mac. Library copies remain available for
                    on-demand use.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2">Harness</th>
                          <th className="p-2">Location</th>
                          <th className="p-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {locations.map((location) => (
                          <tr key={location.id} className="border-b">
                            <td className="p-2">
                              <HarnessLabel
                                name={location.connection ?? "Local package"}
                                icon={location.connectionIcon}
                                variant="inline"
                              />
                            </td>
                            <td className="p-2">
                              <p>{location.label}</p>
                              <p className="max-w-lg break-all text-xs text-muted-foreground">
                                {location.path}
                              </p>
                            </td>
                            <td className="p-2">{location.sourceKind ?? "Unknown"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Context and on-demand use</CardTitle>
                  <CardDescription>
                    Estimates apply to new sessions, not existing conversations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ContextSavings skills={[skill]} />
                  {canMoveOnDemand && actions && refresh && (
                    <OnDemandSkillsReview skills={[skill]} actions={actions} refresh={refresh} />
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <UnavailablePackage />
          )}
        </TabsContent>
        <TabsContent value="history" className="flex flex-col gap-5">
          {report.history}
        </TabsContent>
        <TabsContent value="testing" className="flex flex-col gap-5">
          {report.testing}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportWithLibrary({
  report,
  library,
}: {
  report: LocalSkillReportProps;
  library: Extract<DashboardLibraryContribution, { access: "available" }>;
}) {
  const inventory = library.useInventory();
  const actions = library.useActions();
  const skill = inventory.data?.skills.find((item) => item.name === report.name);
  return (
    <ReportLayout
      report={report}
      skill={skill}
      actions={actions}
      refresh={inventory.refresh}
      inventoryMessage={
        inventory.error ?? (inventory.isLoading ? "Loading installation details…" : undefined)
      }
    />
  );
}

export function LocalSkillReport(report: LocalSkillReportProps) {
  const host = useOptionalDashboardHost();
  const library = host?.modules.skills.library;
  return library?.access === "available" ? (
    <ReportWithLibrary report={report} library={library} />
  ) : (
    <ReportLayout report={report} />
  );
}
