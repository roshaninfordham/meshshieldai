"use client";
import { useState, useRef, useEffect } from "react";
import { useMeshStore, pushNlipMsg, setNlipBusy } from "@/lib/store";

type NlipClient = { ask: (s: string) => Promise<string>; close: () => void };
const CITATION = /\[(snapshot\.(?:[^\[\]]+|\[\d+\])+|clause:[^\]]+|plan-\w+)\]/g;

const renderWithCitations = (text: string) => {
  const parts: (string | { c: string })[] = []; let last = 0; let m: RegExpExecArray | null;
  while ((m = CITATION.exec(text))) {
    parts.push(text.slice(last, m.index));
    parts.push({ c: m[0] });
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts.map((p, i) => typeof p === "string"
    ? <span key={i}>{p}</span>
    : <span key={i}
            className="inline-block rounded-full bg-accent/15 text-accent px-2 py-[2px] mx-0.5 font-mono text-[11px] cursor-pointer hover:bg-accent/25 transition-colors"
            title={`Citation: ${p.c}`}>{p.c}</span>);
};

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

export function NlipChat({ client }: { client: NlipClient }) {
  const [input, setInput] = useState("");
  const msgs  = useMeshStore((s) => s.nlipMsgs);
  const busy  = useMeshStore((s) => s.nlipBusy);
  const hlClass = usePanelHighlight("chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, busy]);

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

  const suggestions = [
    "Summarize current threats.",
    "Why was T-13 not assigned?",
    "Which interceptor is on T-001?",
  ];

  return (
    <div className={`flex flex-col rounded-xl ring-1 ring-white/10 p-3 h-[360px] transition-shadow duration-300 ${hlClass}`}
         style={{ background: "#0d1320" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono font-bold" style={{ color: "#5cf2c0" }}>
          📡 WATCH COMMANDER · NLIP/WS
        </span>
        {busy && (
          <span className="text-[11px] font-mono animate-pulse" style={{ color: "#fcb045" }}>
            streaming…
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1"
           style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(92,242,192,0.2) transparent" }}>
        {msgs.length === 0 && (
          <div className="text-center text-sm font-mono pt-4" style={{ color: "#7c869b" }}>
            Ask the Watch Commander about the current threat picture…
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-base leading-relaxed ${
            m.role === "you"
              ? "ml-4"
              : "mr-4"
          }`} style={{
            background: m.role === "you" ? "rgba(255,255,255,0.06)" : "rgba(92,242,192,0.07)",
            border: m.role === "you" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(92,242,192,0.15)",
          }}>
            <span className="font-mono font-bold text-[10px] block mb-1"
                  style={{ color: m.role === "you" ? "#7c869b" : "#5cf2c0" }}>
              {m.role === "you" ? "YOU" : "WATCH COMMANDER"}
            </span>
            <span style={{ color: m.role === "you" ? "#e2e8f0" : "#b8f5e0" }}>
              {renderWithCitations(m.text)}
            </span>
          </div>
        ))}
        {busy && (
          <div className="mr-4 rounded-lg px-3 py-2 text-sm font-mono animate-pulse"
               style={{ background: "rgba(92,242,192,0.07)", border: "1px solid rgba(92,242,192,0.15)",
                        color: "#5cf2c0" }}>
            <span className="text-[10px] font-bold block mb-1">WATCH COMMANDER</span>
            Analyzing… (streaming)
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      <div className="flex flex-wrap gap-1 my-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => setInput(s)}
            className="text-[10px] px-2 py-1 rounded font-mono transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "#7c869b", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.color = "#7c869b")}
          >{s}</button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask Watch Commander…"
          className="flex-1 rounded px-3 py-2 text-base font-mono"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#e2e8f0",
            outline: "none",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "rgba(92,242,192,0.4)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
        />
        <button onClick={send}
          disabled={busy}
          className="rounded px-4 py-2 text-sm font-mono font-bold disabled:opacity-50 transition-opacity"
          style={{ background: "#5cf2c0", color: "#0b0f17" }}>
          Send
        </button>
      </div>
    </div>
  );
}
