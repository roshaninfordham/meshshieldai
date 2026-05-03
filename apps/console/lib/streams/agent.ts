import { applyAgentEvent } from "@/lib/store";

export function connectAgentStream(url: string): () => void {
  let ws: WebSocket | null = null;
  let stopped = false; let backoff = 500;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { backoff = 500; };
    ws.onmessage = (ev) => { try { applyAgentEvent(JSON.parse(ev.data)); } catch {} };
    ws.onclose = () => { if (!stopped) setTimeout(open, backoff = Math.min(backoff * 2, 5000)); };
  };
  open();
  return () => { stopped = true; ws?.close(); };
}
