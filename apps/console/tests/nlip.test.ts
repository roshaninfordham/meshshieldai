import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNlipClient } from "@/lib/nlip/client";

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  url: string; onopen: (() => void) | null = null; onmessage: ((e: any) => void) | null = null; onclose: (() => void) | null = null;
  readyState = 0;
  constructor(url: string) { this.url = url; FakeWebSocket.last = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send(_: string) {}
  close() { this.onclose?.(); }
}

beforeEach(() => { (globalThis as any).WebSocket = FakeWebSocket as any; });

describe("nlip client", () => {
  it("send returns the next text reply", async () => {
    const client = createNlipClient("ws://x/nlip");
    const p = client.ask("Why was T-13 ignored?");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ format: "text", subformat: "english", content: "T-13 conf=0.43" }) });
    expect(await p).toContain("T-13");
    client.close();
  });
});
