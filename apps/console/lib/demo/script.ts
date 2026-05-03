export type HighlightTarget =
  | "map"
  | "theatre-prioritizer"
  | "theatre-allocator"
  | "theatre-justifier"
  | "theatre-escalator"
  | "plan"
  | "chat"
  | "cost"
  | "tape"
  | "none";

export type DemoStep = {
  at_ms: number;
  duration_ms: number;
  title: string;
  body: string;
  highlight: HighlightTarget;
  action?: { kind: "ask_nlip"; question: string };
};

export const DEMO_SCRIPT: DemoStep[] = [
  {
    at_ms: 0,
    duration_ms: 4000,
    title: "📡 SENSORS LIVE",
    body: "Synthetic airspace tracks streaming at 10 Hz from the fusion engine. Watch the map fill up.",
    highlight: "map",
  },
  {
    at_ms: 4000,
    duration_ms: 4000,
    title: "🎯 THREAT PRIORITIZER (AG2 + Gemini 2.5 Flash)",
    body: "First AG2 agent ranks every track by risk score so the most dangerous UAVs are addressed first.",
    highlight: "theatre-prioritizer",
  },
  {
    at_ms: 8000,
    duration_ms: 5000,
    title: "🛠 INTERCEPTOR ALLOCATOR + DAYTONA",
    body: "Allocator simulates intercept trajectories in a Daytona sandbox (or local-fallback) and assigns the best interceptor to each target.",
    highlight: "theatre-allocator",
  },
  {
    at_ms: 13000,
    duration_ms: 5000,
    title: "📰 JUSTIFIER + TAVILY",
    body: "Justifier pulls live counter-drone news headlines from Tavily and attaches snapshot, policy, and news citations to every assignment.",
    highlight: "theatre-justifier",
  },
  {
    at_ms: 18000,
    duration_ms: 4000,
    title: "⚖️ ESCALATION OFFICER",
    body: "Validates against policy. If a track's confidence is below 0.7 or 10+ tracks converge on the asset, escalates to a human.",
    highlight: "theatre-escalator",
  },
  {
    at_ms: 22000,
    duration_ms: 5000,
    title: "✅ RESPONSE PLAN",
    body: "Final plan rendered with full audit trail. Every assignment cites the data that justified it.",
    highlight: "plan",
  },
  {
    at_ms: 27000,
    duration_ms: 8000,
    title: "💬 ASK THE WATCH COMMANDER (NLIP / ECMA-430)",
    body: "Operator chats with the system in natural language over the Ecma-standard NLIP protocol.",
    highlight: "chat",
    action: {
      kind: "ask_nlip",
      question: "Why was T-001 assigned to interceptor i-002, and is escalation needed?",
    },
  },
  {
    at_ms: 35000,
    duration_ms: 5000,
    title: "📈 COST-CURVE FLIP",
    body: "Defender cost stays flat while attacker cost scales linearly with swarm size. This is the software-defined defense thesis.",
    highlight: "cost",
  },
  {
    at_ms: 40000,
    duration_ms: 5000,
    title: "✓ DEMO COMPLETE",
    body: "Pipeline keeps running. Click START DEMO to replay.",
    highlight: "none",
  },
];
