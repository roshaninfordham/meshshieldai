// AUTO-GENERATED FROM packages/protocol/schemas — do not edit

export interface ResponsePlan {
  v: 1;
  plan_id: string;
  snapshot_id: string;
  ts: number;
  assignments: {
    target_id: string;
    interceptor_id: string;
    mode: "kinetic" | "rf_jam" | "spoof" | "monitor";
    priority: number;
    justification: {
      snapshot_refs: string[];
      tavily_refs: string[];
      policy_refs: string[];
    };
  }[];
  escalation: {
    required: boolean;
    reasons: string[];
  };
}
