"use client";
export function Header({ scenario }: { scenario: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-panel">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight">MeshShield AI</span>
        <span className="text-muted text-xs">▸ Scenario: {scenario}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-md bg-accent/15 text-accent px-2 py-1 font-mono">⚡ Powered by AG2</span>
        <span className="rounded-md bg-white/5 text-muted px-2 py-1 font-mono">via OpenRouter · Gemini 2.5</span>
      </div>
    </header>
  );
}
