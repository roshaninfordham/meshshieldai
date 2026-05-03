"use client";
import { useMeshStore } from "@/lib/store";
export function PlanPanel() {
  const plan = useMeshStore((s) => s.plan) as any;
  if (!plan) return <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-4 text-muted text-sm">No plan yet — waiting for first agent tick…</div>;
  return (
    <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-4">
      <div className="flex justify-between items-baseline">
        <div className="text-xs text-muted">RESPONSE PLAN · {plan.plan_id}</div>
        {plan.escalation?.required && <div className="text-danger text-xs">ESCALATION REQUIRED</div>}
      </div>
      <table className="w-full text-sm mt-2">
        <thead className="text-muted text-xs">
          <tr><th className="text-left">Target</th><th className="text-left">Interceptor</th><th className="text-left">Mode</th><th>Pri</th><th className="text-left">Justification</th></tr>
        </thead>
        <tbody>
          {plan.assignments.map((a: any, i: number) => (
            <tr key={i} className="border-t border-white/5">
              <td className="py-1 font-mono">{a.target_id}</td>
              <td className="font-mono">{a.interceptor_id}</td>
              <td className="font-mono text-accent">{a.mode}</td>
              <td className="text-center">{a.priority}</td>
              <td className="text-[11px] text-white/70">
                {[...a.justification.snapshot_refs, ...a.justification.tavily_refs, ...a.justification.policy_refs].join("  ·  ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
