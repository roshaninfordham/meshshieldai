// AUTO-GENERATED FROM packages/protocol/schemas — do not edit

export interface AgentEvent {
  kind:
    | "stage_started"
    | "stage_finished"
    | "stage_failed"
    | "tool_call_started"
    | "tool_call_finished"
    | "agent_message"
    | "plan_ready"
    | "escalation_raised";
  ts: number;
  agent?: "prioritizer" | "allocator" | "justifier" | "escalator" | "watch_commander";
  tool?: string;
  args?: {};
  result_summary?: string;
  ms?: number;
  preview?: string;
  full_id?: string;
  tokens?: number;
  output_summary?: string;
  plan_id?: string;
  /**
   * Full ResponsePlan body, present on plan_ready events so the console can render without a separate fetch.
   */
  plan?: {};
  reason?: string;
  error?: string;
}
