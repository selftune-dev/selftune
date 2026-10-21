import { useState } from "react";
import { HarnessLabel } from "@selftune/ui/components";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@selftune/ui/primitives";
import { timeAgo } from "@selftune/ui/lib";
import {
  SkillReportInvocationsSection,
  type SkillReportInvocationsSectionProps,
} from "./SkillReportInvocationsSection";
import type { LibrarySkillModel } from "../../models";

export function SkillReportRecentActivity({
  invocations,
  sessionMetadata,
  locations,
  callout,
}: SkillReportInvocationsSectionProps & { locations?: LibrarySkillModel["locations"] }) {
  const [showDetails, setShowDetails] = useState(false);
  const sessions = new Map(sessionMetadata?.map((session) => [session.session_id, session]));
  const recent = invocations
    .toSorted((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""))
    .slice(0, 8);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Recorded routing and skill use on this device.</CardDescription>
        </div>
        {invocations.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Show summary" : "Inspect records"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showDetails ? (
          <SkillReportInvocationsSection
            invocations={invocations}
            sessionMetadata={sessionMetadata}
          />
        ) : recent.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Harness</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((invocation, index) => {
                const session = invocation.session_id
                  ? sessions.get(invocation.session_id)
                  : undefined;
                const harness = session?.agent_cli ?? session?.platform ?? "Unknown";
                const connection = locations?.find(
                  (location) => location.connection?.toLowerCase() === harness.toLowerCase(),
                );
                return (
                  <TableRow key={`${invocation.session_id}-${invocation.timestamp}-${index}`}>
                    <TableCell
                      className="text-muted-foreground"
                      title={invocation.timestamp ?? undefined}
                    >
                      {invocation.timestamp ? timeAgo(invocation.timestamp) : "Unknown"}
                    </TableCell>
                    <TableCell>
                      <HarnessLabel
                        name={connection?.connection ?? harness}
                        icon={connection?.connectionIcon}
                        variant="inline"
                      />
                    </TableCell>
                    <TableCell
                      className="max-w-48 truncate"
                      title={session?.workspace_path ?? undefined}
                    >
                      {session?.workspace_path?.split("/").findLast(Boolean) ?? "Not recorded"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {invocation.triggered ? "Skill used" : "Routing check"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet. Files and installations are available independently of usage
            history.
          </p>
        )}
        {callout}
      </CardContent>
    </Card>
  );
}
