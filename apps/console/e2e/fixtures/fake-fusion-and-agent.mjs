import { WebSocketServer } from "ws";
import http from "node:http";

const fusionPort = 8001;
const agentPort  = 8002;

const fusionHttp = http.createServer((_, res) => res.end("ok"));
const fusionWss  = new WebSocketServer({ server: fusionHttp, path: "/snapshot" });
fusionWss.on("connection", (ws) => {
  let i = 0;
  const id = setInterval(() => {
    i++;
    ws.send(JSON.stringify({ v:1, snapshot_id: `snap-${i}`, ts: Date.now()/1000,
      tracks: [{ id:"t-1", origin:"real", pos_3d:[100-i,0,30], vel:[-1,0,0], conf:0.92, nearest_asset_m: 100 - i }]}));
  }, 100);
  ws.on("close", () => clearInterval(id));
});
fusionHttp.listen(fusionPort);

const agentHttp = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/nlip/chat") {
    let buf = ""; req.on("data", (c) => buf += c);
    req.on("end", () => { res.setHeader("content-type","application/json"); res.end(JSON.stringify({format:"text",subformat:"english",content:"OK summary."})); });
  } else { res.end("ok"); }
});
const eventsWss = new WebSocketServer({ server: agentHttp, path: "/events" });
const nlipWss   = new WebSocketServer({ server: agentHttp, path: "/nlip" });
eventsWss.on("connection", (ws) => {
  let tick = 0;
  const id = setInterval(() => {
    tick++;
    const ts = Date.now()/1000;
    const seq = [
      { kind:"stage_started",  agent:"prioritizer", ts },
      { kind:"stage_finished", agent:"prioritizer", output_summary:"top: t-1", ms:140, ts },
      { kind:"stage_started",  agent:"allocator",   ts },
      { kind:"tool_call_started",  agent:"allocator", tool:"simulate_intercept_path", args:{}, ts },
      { kind:"tool_call_finished", agent:"allocator", tool:"simulate_intercept_path", result_summary:"miss=3m", ms:42, ts },
      { kind:"stage_finished", agent:"allocator",   output_summary:"i-002 → t-1", ms:230, ts },
      { kind:"stage_started",  agent:"justifier",   ts },
      { kind:"stage_finished", agent:"justifier",   output_summary:"refs:3", ms:180, ts },
      { kind:"stage_started",  agent:"escalator",   ts },
      { kind:"stage_finished", agent:"escalator",   output_summary:"no escalation", ms:90, ts },
      { kind:"plan_ready", plan_id:`plan-${tick}`, ts,
        plan: { v:1, plan_id:`plan-${tick}`, snapshot_id:`snap-${tick}`, ts,
                assignments:[{ target_id:"t-1", interceptor_id:"i-002", mode:"kinetic", priority:1,
                  justification:{ snapshot_refs:["tracks[0].pos_3d","tracks[0].nearest_asset_m"],
                                   tavily_refs:[], policy_refs:["clause:proximity_under_50m"] }}],
                escalation:{ required:false, reasons:[] } } },
    ];
    seq.forEach((ev, k) => setTimeout(() => ws.send(JSON.stringify(ev)), k * 100));
  }, 2000);
  ws.on("close", () => clearInterval(id));
});
nlipWss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const body = JSON.parse(msg.toString());
    ws.send(JSON.stringify({format:"text", subformat:"english",
      content: `(stub) you said: ${body.content} [snapshot.tracks[0].pos_3d] [clause:auto_action_min_conf]`}));
  });
});
agentHttp.listen(agentPort, () => console.log("fake agent on", agentPort));
console.log("fake fusion on", fusionPort);
