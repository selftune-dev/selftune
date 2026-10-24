/** Reconcile only changed values for a revised batch's removed and incoming keys. */
export const reconcileRevisedMetricRollups: ReadonlyArray<string> = [
  `INSERT INTO observability_revised_metric_keys
   SELECT trace_id, metric_name FROM observability_historical_metric_rollup_staging`,
  `CREATE OR REPLACE TEMP TABLE observability_revised_metric_rollups AS
   SELECT trace_id, metric_name, metric_id, source_id, observed_at, value, unit,
     temporality, evidence_quality, source_reference
   FROM observability_retained_metric_candidates AS point
   WHERE EXISTS (SELECT 1 FROM observability_revised_metric_keys AS affected
     WHERE affected.trace_id = point.trace_id AND affected.metric_name = point.metric_name)
   QUALIFY ROW_NUMBER() OVER (
     PARTITION BY trace_id, metric_name ORDER BY observed_at DESC, metric_id DESC
   ) = 1`,
  `DELETE FROM observability_historical_metric_rollups AS rollup
   WHERE EXISTS (SELECT 1 FROM observability_revised_metric_keys AS affected
     WHERE affected.trace_id = rollup.trace_id AND affected.metric_name = rollup.metric_name)
   AND NOT EXISTS (SELECT 1 FROM observability_revised_metric_rollups AS latest
     WHERE latest.trace_id = rollup.trace_id AND latest.metric_name = rollup.metric_name
       AND latest.metric_id = rollup.metric_id AND latest.source_id = rollup.source_id
       AND latest.observed_at = rollup.observed_at AND latest.value = rollup.value
       AND latest.unit = rollup.unit AND latest.temporality = rollup.temporality
       AND latest.evidence_quality = rollup.evidence_quality
       AND latest.source_reference = rollup.source_reference)`,
  `INSERT INTO observability_historical_metric_rollups
   SELECT * FROM observability_revised_metric_rollups AS latest
   WHERE NOT EXISTS (SELECT 1 FROM observability_historical_metric_rollups AS current
     WHERE current.trace_id = latest.trace_id AND current.metric_name = latest.metric_name)`,
  "DROP TABLE observability_revised_metric_rollups",
  "DROP TABLE observability_revised_metric_keys",
];
