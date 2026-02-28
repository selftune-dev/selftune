/**
 * Shared interfaces for selftune telemetry, eval, and grading.
 */

// ---------------------------------------------------------------------------
// Log record types (written to ~/.claude/*.jsonl)
// ---------------------------------------------------------------------------

export interface QueryLogRecord {
  timestamp: string;
  session_id: string;
  query: string;
  source?: string;
}

export interface SkillUsageRecord {
  timestamp: string;
  session_id: string;
  skill_name: string;
  skill_path: string;
  query: string;
  triggered: boolean;
  source?: string;
}

export interface SessionTelemetryRecord {
  timestamp: string;
  session_id: string;
  cwd: string;
  transcript_path: string;
  tool_calls: Record<string, number>;
  total_tool_calls: number;
  bash_commands: string[];
  skills_triggered: string[];
  assistant_turns: number;
  errors_encountered: number;
  transcript_chars: number;
  last_user_query: string;
  source?: string;
  input_tokens?: number;
  output_tokens?: number;
  agent_summary?: string;
  rollout_path?: string;
}

// ---------------------------------------------------------------------------
// Transcript parsing
// ---------------------------------------------------------------------------

export interface TranscriptMetrics {
  tool_calls: Record<string, number>;
  total_tool_calls: number;
  bash_commands: string[];
  skills_triggered: string[];
  assistant_turns: number;
  errors_encountered: number;
  transcript_chars: number;
  last_user_query: string;
}

// ---------------------------------------------------------------------------
// Hook payloads (received via stdin from Claude Code)
// ---------------------------------------------------------------------------

export interface PromptSubmitPayload {
  user_prompt: string;
  session_id?: string;
}

export interface PostToolUsePayload {
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id?: string;
  transcript_path?: string;
}

export interface StopPayload {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
}

// ---------------------------------------------------------------------------
// Eval types
// ---------------------------------------------------------------------------

export type InvocationType = "explicit" | "implicit" | "contextual" | "negative";

export interface EvalEntry {
  query: string;
  should_trigger: boolean;
  invocation_type?: InvocationType;
}

// ---------------------------------------------------------------------------
// Grading types
// ---------------------------------------------------------------------------

export interface GradingExpectation {
  text: string;
  passed: boolean;
  evidence: string;
}

export interface GradingClaim {
  claim: string;
  type: "factual" | "process" | "quality";
  verified: boolean;
  evidence: string;
}

export interface GradingSummary {
  passed: number;
  failed: number;
  total: number;
  pass_rate: number;
}

/** Raw output from the LLM grader (before assembly into GradingResult). */
export interface GraderOutput {
  expectations: GradingExpectation[];
  summary: GradingSummary;
  claims: GradingClaim[];
  eval_feedback: EvalFeedback;
}

export interface EvalFeedback {
  suggestions: Array<{ assertion: string; reason: string }>;
  overall: string;
}

export interface GradingResult {
  session_id: string;
  skill_name: string;
  transcript_path: string;
  graded_at: string;
  expectations: GradingExpectation[];
  summary: GradingSummary;
  execution_metrics: ExecutionMetrics;
  claims: GradingClaim[];
  eval_feedback: EvalFeedback;
}

export interface ExecutionMetrics {
  tool_calls: Record<string, number>;
  total_tool_calls: number;
  total_steps: number;
  bash_commands_run: number;
  errors_encountered: number;
  skills_triggered: string[];
  transcript_chars: number;
}

// ---------------------------------------------------------------------------
// Health check types
// ---------------------------------------------------------------------------

export type HealthStatus = "pass" | "fail" | "warn";

export interface HealthCheck {
  name: string;
  path: string;
  status: HealthStatus;
  message: string;
}

export interface DoctorResult {
  command: string;
  timestamp: string;
  checks: HealthCheck[];
  summary: { pass: number; fail: number; warn: number; total: number };
  healthy: boolean;
}
