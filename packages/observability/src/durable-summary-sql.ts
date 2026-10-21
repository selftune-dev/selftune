/** Compact analytical facts, not transcript copies. Legacy detail remains readable. */
export const durableSummaryMigration: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS observability_summary_receipts (
    batch_id VARCHAR PRIMARY KEY, source_revision VARCHAR NOT NULL,
    normalizer_version VARCHAR NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS observability_span_summaries (
    trace_id VARCHAR NOT NULL, span_id VARCHAR NOT NULL, batch_id VARCHAR NOT NULL,
    source_id VARCHAR NOT NULL, trace_boundary VARCHAR NOT NULL,
    capture_mode VARCHAR NOT NULL, source_authority VARCHAR NOT NULL,
    evidence_quality VARCHAR, model VARCHAR, duration_ms BIGINT NOT NULL,
    input_tokens BIGINT NOT NULL, output_tokens BIGINT NOT NULL,
    error_count BIGINT NOT NULL, tool_call_count BIGINT NOT NULL,
    PRIMARY KEY (trace_id, span_id)
  )`,
  `CREATE TABLE IF NOT EXISTS observability_metric_contributions (
    batch_id VARCHAR NOT NULL, trace_id VARCHAR NOT NULL, metric_name VARCHAR NOT NULL,
    metric_id VARCHAR NOT NULL, source_id VARCHAR NOT NULL, observed_at TIMESTAMP NOT NULL,
    value DOUBLE NOT NULL, unit VARCHAR NOT NULL, temporality VARCHAR NOT NULL,
    evidence_quality VARCHAR NOT NULL, source_reference VARCHAR NOT NULL,
    PRIMARY KEY (batch_id, trace_id, metric_name)
  )`,
  `CREATE VIEW IF NOT EXISTS observability_discovery_spans AS
    SELECT trace_id, span_id, batch_id, source_id, trace_boundary, capture_mode,
      source_authority, evidence_quality, model, duration_ms
    FROM observability_span_summaries
    UNION ALL
    SELECT trace_id, span_id, batch_id, source_id, trace_boundary, capture_mode,
      source_authority, evidence_quality, model, duration_ms
    FROM observability_spans AS span
    WHERE NOT EXISTS (SELECT 1 FROM observability_summary_receipts AS receipt
      WHERE receipt.batch_id = span.batch_id)`,
  `CREATE VIEW IF NOT EXISTS observability_discovery_metrics AS
    SELECT trace_id, span_id, 'input_tokens' AS metric_name, input_tokens AS value FROM observability_span_summaries
    UNION ALL SELECT trace_id, span_id, 'output_tokens', output_tokens FROM observability_span_summaries
    UNION ALL SELECT trace_id, span_id, 'error_count', error_count FROM observability_span_summaries
    UNION ALL SELECT trace_id, span_id, 'tool_call_count', tool_call_count FROM observability_span_summaries
    UNION ALL SELECT trace_id, span_id, metric_name, value FROM observability_metrics AS metric
    WHERE NOT EXISTS (SELECT 1 FROM observability_summary_receipts AS receipt
      WHERE receipt.batch_id = metric.batch_id)`,
  `CREATE VIEW IF NOT EXISTS observability_retained_metric_candidates AS
    SELECT batch_id, trace_id, metric_name, metric_id, source_id, observed_at,
      value, unit, temporality, evidence_quality, source_reference
    FROM observability_metric_contributions
    UNION ALL
    SELECT batch_id, trace_id, metric_name, metric_id, source_id, observed_at,
      value, unit, temporality, evidence_quality, source_reference
    FROM observability_historical_metric_points AS point
    WHERE NOT EXISTS (SELECT 1 FROM observability_summary_receipts AS receipt
      WHERE receipt.batch_id = point.batch_id)`,
  "INSERT OR IGNORE INTO observability_schema_migrations (version) VALUES (10)",
];

/** Called inside ingestion's transaction, restricted to its bounded batch. */
export const retainBatchSummaries: ReadonlyArray<string> = [
  `INSERT INTO observability_span_summaries
    SELECT span.trace_id, span.span_id, span.batch_id, span.source_id,
      span.trace_boundary, span.capture_mode, span.source_authority,
      span.evidence_quality, span.model, span.duration_ms,
      CAST(COALESCE(MAX(CASE WHEN metric.metric_name = 'input_tokens' THEN metric.value END), 0) AS BIGINT),
      CAST(COALESCE(MAX(CASE WHEN metric.metric_name = 'output_tokens' THEN metric.value END), 0) AS BIGINT),
      CAST(COALESCE(MAX(CASE WHEN metric.metric_name = 'error_count' THEN metric.value END), 0) AS BIGINT),
      CAST(COALESCE(MAX(CASE WHEN metric.metric_name = 'tool_call_count' THEN metric.value END), 0) AS BIGINT)
    FROM observability_spans AS span
    LEFT JOIN observability_metrics AS metric
      ON metric.trace_id = span.trace_id AND metric.span_id = span.span_id
    WHERE span.batch_id = $batch_id
    GROUP BY ALL`,
  `INSERT INTO observability_metric_contributions
    SELECT batch_id, trace_id, metric_name, metric_id, source_id, observed_at,
      value, unit, temporality, evidence_quality, source_reference
    FROM observability_historical_metric_points WHERE batch_id = $batch_id
    QUALIFY ROW_NUMBER() OVER (PARTITION BY trace_id, metric_name
      ORDER BY observed_at DESC, metric_id DESC) = 1`,
  `INSERT INTO observability_summary_receipts
    SELECT batch_id, source_revision, normalizer_version FROM observability_ingested_batches
    WHERE batch_id = $batch_id`,
];

export const sourceReconstructionMigration: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS observability_source_reconstruction (
    batch_id VARCHAR PRIMARY KEY, source_revision VARCHAR NOT NULL,
    normalizer_version VARCHAR NOT NULL, content_sha256 VARCHAR NOT NULL,
    descriptor_json VARCHAR NOT NULL,
    detail_state VARCHAR NOT NULL CHECK (detail_state IN ('resident', 'evicted', 'expired'))
  )`,
  `CREATE TABLE IF NOT EXISTS observability_source_evidence_pins (
    pin_id VARCHAR PRIMARY KEY, batch_id VARCHAR NOT NULL, source_revision VARCHAR NOT NULL,
    normalizer_version VARCHAR NOT NULL, content_sha256 VARCHAR NOT NULL, descriptor_json VARCHAR NOT NULL
  )`,
  "INSERT OR IGNORE INTO observability_schema_migrations (version) VALUES (11)",
];

/** No policy or corpus backfill: identities become qualified during bounded imports. */
export const sourceIdentityMigration: ReadonlyArray<string> = [
  `CREATE TABLE IF NOT EXISTS observability_batch_sources (
    batch_id VARCHAR NOT NULL, source_key VARCHAR NOT NULL,
    PRIMARY KEY (batch_id, source_key)
  )`,
  `CREATE TABLE IF NOT EXISTS observability_expired_sources (
    source_key VARCHAR PRIMARY KEY
  )`,
  "INSERT OR IGNORE INTO observability_schema_migrations (version) VALUES (12)",
];
