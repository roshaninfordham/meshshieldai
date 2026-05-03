type Pending = { resolve: (s: string) => void; reject: (e: any) => void };

export function createNlipClient(url: string) {
  const queue: Pending[] = [];
  const sendQueue: string[] = [];
  let ready = false;
  let ws: WebSocket;

  const init = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      ready = true;
      for (const msg of sendQueue.splice(0)) ws.send(msg);
    };
    ws.onmessage = (ev) => {
      const next = queue.shift(); if (!next) return;
      try {
        const body = JSON.parse(ev.data);
        next.resolve(String(body.content ?? ""));
      } catch (e) { next.reject(e); }
    };
    ws.onclose = () => { ready = false; for (const p of queue.splice(0)) p.reject(new Error("closed")); };
  };
  init();

  return {
    ask(content: string): Promise<string> {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
        const msg = JSON.stringify({ format: "text", subformat: "english", content });
        if (ready) { ws.send(msg); } else { sendQueue.push(msg); }
      });
    },
    close() { ws.close(); }
  };
}
