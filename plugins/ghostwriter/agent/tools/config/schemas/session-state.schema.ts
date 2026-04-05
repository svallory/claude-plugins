/**
 * session-state.schema.ts
 *
 * Schema for tracking humanization session state.
 * Stored in .session-state.json within session folders.
 */

/**
 * AI signal evidence from detector.
 */
export interface DetectorSignal {
  /** Signal category (e.g., "vocabulary", "burstiness") */
  category: string;

  /** Specific rule that triggered (e.g., "ai_vocab_density") */
  rule: string;

  /** The measured value */
  value: number;

  /** The threshold that was exceeded */
  threshold: number;

  /** Direction of violation ("above" or "below") */
  direction: "above" | "below";

  /** Human-readable description of the signal */
  description: string;

  /** Severity level */
  severity: "critical" | "high" | "moderate" | "low";
}

/**
 * Detector result from a single round.
 */
export interface DetectorResult {
  /** Whether AI was detected */
  detected: boolean;

  /** Confidence score (0-1) */
  confidence: number;

  /** Classification label */
  classification: "ai" | "human" | "uncertain";

  /** Signals that triggered detection */
  signals: DetectorSignal[];

  /** Raw metrics from all tools */
  metrics: Record<string, unknown>;

  /** Human-readable summary */
  summary: string;

  /** Timestamp of detection */
  timestamp: string;
}

/**
 * Feedback generated for the Writer from detector signals.
 */
export interface WriterFeedback {
  /** Round this feedback was generated for */
  round: number;

  /** High priority issues that must be addressed */
  critical: string[];

  /** Medium priority issues */
  suggestions: string[];

  /** Patterns to avoid in future writing */
  patterns_to_avoid: string[];

  /** Specific word/phrase replacements suggested */
  replacements: Array<{
    original: string;
    suggestions: string[];
  }>;
}

/**
 * State for a single humanization round.
 */
export interface RoundState {
  /** Round number (1-indexed) */
  round: number;

  /** Input file used for this round */
  input_file: string;

  /** Output file generated (e.g., "v1.md") */
  output_file: string;

  /** Detector result for this round */
  detector_result: DetectorResult;

  /** Feedback generated for Writer (if continuing) */
  feedback?: WriterFeedback;

  /** Whether Writer was invoked for next round */
  writer_invoked: boolean;

  /** Timestamp when round started */
  started_at: string;

  /** Timestamp when round completed */
  completed_at: string;

  /** Duration in milliseconds */
  duration_ms: number;
}

/**
 * Session completion status.
 */
export type SessionStatus =
  | "pending"      // Session created but not started
  | "in_progress"  // Session currently running
  | "completed"    // Session finished successfully (text passed detection)
  | "max_rounds"   // Session stopped due to reaching max rounds
  | "failed"       // Session stopped due to error
  | "cancelled";   // Session manually cancelled

/**
 * Complete session state.
 * Stored in .session-state.json within session folders.
 */
export interface SessionState {
  /** Schema version for compatibility */
  version: "1.0";

  /** Session folder name */
  session_name: string;

  /** Session folder path (absolute) */
  session_path: string;

  /** Current status */
  status: SessionStatus;

  /** Current round number (0 if not started) */
  current_round: number;

  /** History of all rounds */
  rounds: RoundState[];

  /** Final output file (if completed) */
  final_output?: string;

  /** Error message (if failed) */
  error?: string;

  /** Session creation timestamp */
  created_at: string;

  /** Session last updated timestamp */
  updated_at: string;

  /** Total session duration in milliseconds */
  total_duration_ms: number;

  /** Summary of learnings from this session */
  learnings?: string[];
}

/**
 * Create initial session state.
 *
 * @param sessionName - Name of the session (folder name)
 * @param sessionPath - Absolute path to session folder
 * @returns Initial session state
 */
export function createInitialSessionState(
  sessionName: string,
  sessionPath: string
): SessionState {
  const now = new Date().toISOString();
  return {
    version: "1.0",
    session_name: sessionName,
    session_path: sessionPath,
    status: "pending",
    current_round: 0,
    rounds: [],
    created_at: now,
    updated_at: now,
    total_duration_ms: 0,
  };
}

/**
 * Check if session is in a terminal state.
 *
 * @param status - Session status to check
 * @returns True if session cannot continue
 */
export function isTerminalStatus(status: SessionStatus): boolean {
  return ["completed", "max_rounds", "failed", "cancelled"].includes(status);
}

/**
 * Get human-readable status description.
 *
 * @param status - Session status
 * @returns Human-readable description
 */
export function getStatusDescription(status: SessionStatus): string {
  switch (status) {
    case "pending":
      return "Session created, waiting to start";
    case "in_progress":
      return "Session running";
    case "completed":
      return "Session completed successfully - text passed AI detection";
    case "max_rounds":
      return "Session stopped - maximum rounds reached";
    case "failed":
      return "Session failed due to error";
    case "cancelled":
      return "Session was manually cancelled";
    default:
      return "Unknown status";
  }
}
