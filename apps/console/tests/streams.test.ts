import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectSnapshotStream } from "@/lib/streams/snapshot";
import { connectAgentStream } from "@/lib/streams/agent";
import { useMeshStore } from "@/lib/store";

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  url: string; onmessage: ((e: any) => void) | null = null; onclose: (() => void) | null = null; onopen: (() => void) | null = null;
  readyState = 0; constructor(url: string) { this.url = url; FakeWebSocket.last = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send() {} close() { this.onclose?.(); }
}

beforeEach(() => { (globalThis as any).WebSocket = FakeWebSocket as any; useMeshStore.setState((useMeshStore as any).getInitialState()); });

describe("streams", () => {
  it("snapshot stream applies messages to the store", async () => {
    const stop = connectSnapshotStream("ws://x/snapshot");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ v:1, snapshot_id:"s-1", ts:1, tracks:[{id:"t-1",origin:"real",pos_3d:[0,0,0],vel:[0,0,0],conf:0.9}] }) });
    expect(useMeshStore.getState().tracks.length).toBe(1);
    stop();
  });

  it("agent stream applies events to the store", async () => {
    const stop = connectAgentStream("ws://x/events");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ kind: "stage_started", agent: "prioritizer", ts: 1 }) });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("thinking");
    stop();
  });
});
