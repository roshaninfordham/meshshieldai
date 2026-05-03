"use client";
import { useState } from "react";
import { useMeshStore, pushNlipMsg, setNlipBusy } from "@/lib/store";

type NlipClient = { ask: (s: string) => Promise<string>; close: () => void };
const CITATION = /\[(snapshot\.(?:[^\[\]]+|\[\d+\])+|clause:[^\]]+|plan-\w+)\]/g;

const renderWithCitations = (text: string) => {
  const parts: (string | { c: string })[] = []; let last = 0; let m: RegExpExecArray | null;
  while ((m = CITATION.exec(text))) { parts.push(text.slice(last, m.index)); parts.push({ c: m[0] }); last = m.index + m[0].length; }
  parts.push(text.slice(last));
  return parts.map((p, i) => typeof p === "string"
    ? <span key={i}>{p}</span>
    : <span key={i} className="inline-block rounded bg-accent/15 text-accent px-1.5 py-[1px] mx-0.5 font-mono text-[11px]">{p.c}</span>);
};

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

export function NlipChat({ client }: { client: NlipClient }) {
  const [input, setInput] = useState("");
  const msgs = useMeshStore((s) => s.nlipMsgs);
  const busy = useMeshStore((s) => s.nlipBusy);
  const hlClass = usePanelHighlight("chat");

  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    pushNlipMsg({ role: "you", text: q });
    setInput("");
    setNlipBusy(true);
    try {
      const a = await client.ask(q);
      pushNlipMsg({ role: "wc", text: a });
    } finally {
      setNlipBusy(false);
    }
  };

  const suggestions = ["Summarize current threats.", "Why was T-13 not assigned?", "Which interceptor is on T-001?"];
  return (
    <div className={`flex flex-col rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 h-[260px] transition-shadow duration-300 ${hlClass}`}>
      <div className="text-xs text-muted">WATCH COMMANDER · NLIP/WS</div>
      <div className="flex-1 overflow-y-auto my-2 space-y-2 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "you" ? "text-white" : "text-accent"}>
            <span className="text-muted text-[10px] mr-2">{m.role === "you" ? "YOU" : "WC"}</span>
            {renderWithCitations(m.text)}
          </div>
        ))}
        {busy && <div className="text-muted text-xs">…</div>}
      </div>
      <div className="flex gap-1 mb-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => setInput(s)}
            className="text-[10px] px-2 py-1 rounded bg-white/5 text-muted hover:text-white">{s}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask Watch Commander…"
          className="flex-1 bg-bg ring-1 ring-white/10 rounded px-3 py-1.5 text-sm" />
        <button onClick={send} className="rounded bg-accent text-bg px-3 py-1.5 text-sm font-semibold disabled:opacity-50" disabled={busy}>Send</button>
      </div>
    </div>
  );
}
