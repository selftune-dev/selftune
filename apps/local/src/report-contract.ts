import * as Schema from "effect/Schema";
import { preservingJsonDecoder } from "@selftune/runtime/utils/preserving-schema";
import { LibrarySnapshot } from "@selftune/control-plane";
import {
  InsightsResponseSchema,
  PortfolioAuditResultSchema,
  SkillIntelligenceReportSchema,
} from "@selftune/runtime/dashboard-contract/report-schemas";

export const DashboardReportNameSchema = Schema.Literals([
  "portfolio-audit",
  "skill-intelligence",
  "insights",
  "library",
  "overview",
  "skill-report",
  "shell",
  "analytics",
]);
export type DashboardReportName = typeof DashboardReportNameSchema.Type;
export type CachedDashboardReportName = Exclude<
  DashboardReportName,
  "overview" | "skill-report" | "shell" | "analytics"
>;

export const ReportComputeStoragePathsSchema = Schema.Struct({
  configRoot: Schema.NonEmptyString,
  localDatabasePath: Schema.NonEmptyString,
  localAnalyticsPath: Schema.NonEmptyString,
});
export type ReportComputeStoragePaths = typeof ReportComputeStoragePathsSchema.Type;

export const ReportComputeOptionsSchema = Schema.Struct({
  configRoot: Schema.optionalKey(Schema.String),
  searchDirs: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  quarantineRoot: Schema.optionalKey(Schema.String),
  storagePaths: Schema.optionalKey(ReportComputeStoragePathsSchema),
  overview: Schema.optionalKey(Schema.Struct({ version: Schema.String, search: Schema.String })),
  shell: Schema.optionalKey(Schema.Struct({ version: Schema.String })),
  skillReport: Schema.optionalKey(
    Schema.Struct({ skillName: Schema.String, search: Schema.String }),
  ),
});
export type ReportComputeOptions = typeof ReportComputeOptionsSchema.Type;

export const ResolvedReportComputeOptionsSchema = Schema.Struct({
  ...ReportComputeOptionsSchema.fields,
  storagePaths: ReportComputeStoragePathsSchema,
});
export type ResolvedReportComputeOptions = typeof ResolvedReportComputeOptionsSchema.Type;

export const ReportWorkerArgumentsSchema = Schema.Tuple([
  DashboardReportNameSchema,
  Schema.String,
  Schema.NonEmptyString,
]);

const SerializedReportResponse = Schema.Struct({
  status: Schema.Number.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 })),
  body: Schema.String,
});
export const reportPayloadSchemas = {
  "portfolio-audit": PortfolioAuditResultSchema,
  "skill-intelligence": SkillIntelligenceReportSchema,
  insights: InsightsResponseSchema,
  library: LibrarySnapshot,
  overview: SerializedReportResponse,
  "skill-report": SerializedReportResponse,
  shell: SerializedReportResponse,
  analytics: SerializedReportResponse,
};
export type DashboardReportPayloads = {
  [Name in DashboardReportName]: (typeof reportPayloadSchemas)[Name]["Type"];
};

const reportDecoder = preservingJsonDecoder;

type DashboardReportDecoders = {
  [Name in DashboardReportName]: (text: string) => DashboardReportPayloads[Name];
};
const reportDecoders: DashboardReportDecoders = {
  "portfolio-audit": reportDecoder(reportPayloadSchemas["portfolio-audit"]),
  "skill-intelligence": reportDecoder(reportPayloadSchemas["skill-intelligence"]),
  insights: reportDecoder(reportPayloadSchemas.insights),
  library: reportDecoder(reportPayloadSchemas.library),
  overview: reportDecoder(reportPayloadSchemas.overview),
  "skill-report": reportDecoder(reportPayloadSchemas["skill-report"]),
  shell: reportDecoder(reportPayloadSchemas.shell),
  analytics: reportDecoder(reportPayloadSchemas.analytics),
};

export function decodeReportOutput<Name extends DashboardReportName>(
  report: Name,
  text: string,
): DashboardReportPayloads[Name] {
  return reportDecoders[report](text);
}

export class ReportComputeError extends Schema.TaggedError<ReportComputeError>()(
  "ReportComputeError",
  {
    report: DashboardReportNameSchema,
    message: Schema.String,
    exitCode: Schema.optionalKey(Schema.Number),
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  static fromCause(report: DashboardReportName, cause: unknown) {
    return cause instanceof ReportComputeError
      ? cause
      : new ReportComputeError({
          report,
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        });
  }
}
