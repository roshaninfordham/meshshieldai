import { DEMO_SCRIPT } from "./script";
import { resetForDemo, setDemoStep, endDemo, pushNlipMsg, setNlipBusy } from "@/lib/store";

const FUSION_HTTP = process.env.NEXT_PUBLIC_FUSION_HTTP_URL ?? "http://localhost:8001";
const AGENT_HTTP  = process.env.NEXT_PUBLIC_AGENT_HTTP_URL  ?? "http://localhost:8002";

let _nlipAsk: ((q: string) => Promise<string>) | null = null;

/** Register the NLIP client so the demo controller can fire scripted questions. */
export function registerNlipAsk(ask: (q: string) => Promise<string>): void {
  _nlipAsk = ask;
}

let _running = false;
const _timers: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  for (const t of _timers.splice(0)) clearTimeout(t);
}

export function isDemoRunning(): boolean {
  return _running;
}

export async function startDemo(): Promise<void> {
  if (_running) return;
  _running = true;
  clearTimers();

  // 1. Reset backends
  try {
    await Promise.all([
      fetch(`${FUSION_HTTP}/scenario/reset`, { method: "POST" }),
      fetch(`${AGENT_HTTP}/demo/reset`,      { method: "POST" }),
    ]);
  } catch (_e) {
    // Continue even if network fails — demo still narrates
  }

  // 2. Reset Zustand store
  resetForDemo();

  // 3. Schedule narration steps
  const lastStep = DEMO_SCRIPT[DEMO_SCRIPT.length - 1];
  const demoEnd = lastStep.at_ms + lastStep.duration_ms;

  for (const step of DEMO_SCRIPT) {
    const t = setTimeout(() => {
      setDemoStep(step);

      // Fire NLIP action if present
      if (step.action?.kind === "ask_nlip" && _nlipAsk) {
        const question = step.action.question;
        pushNlipMsg({ role: "you", text: question });
        setNlipBusy(true);
        _nlipAsk(question)
          .then((answer) => {
            pushNlipMsg({ role: "wc", text: answer });
          })
          .catch(() => {
            pushNlipMsg({ role: "wc", text: "(No response — pipeline may still be warming up.)" });
          })
          .finally(() => {
            setNlipBusy(false);
          });
      }
    }, step.at_ms);
    _timers.push(t);
  }

  // 4. End the demo after the last step expires
  const endT = setTimeout(() => {
    _running = false;
    endDemo();
  }, demoEnd);
  _timers.push(endT);
}

export function stopDemo(): void {
  _running = false;
  clearTimers();
  endDemo();
}
