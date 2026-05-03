"use client";
import { useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Map3D } from "@/components/Map3D";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { NlipChat } from "@/components/NlipChat";
import { PlanPanel } from "@/components/PlanPanel";
import { EventTape } from "@/components/EventTape";
import { CostCurveOverlay } from "@/components/CostCurveOverlay";
import { EscalationBanner } from "@/components/EscalationBanner";
import { DemoController } from "@/components/DemoController";
import { DemoNarration } from "@/components/DemoNarration";
import { connectSnapshotStream } from "@/lib/streams/snapshot";
import { connectAgentStream } from "@/lib/streams/agent";
import { createNlipClient } from "@/lib/nlip/client";

export default function Page() {
  useEffect(() => {
    const stops = [
      connectSnapshotStream((process.env.NEXT_PUBLIC_FUSION_WS_URL ?? "ws://localhost:8001") + "/snapshot"),
      connectAgentStream(process.env.NEXT_PUBLIC_AGENT_EVENTS_WS_URL ?? "ws://localhost:8002/events"),
    ];
    return () => stops.forEach((s) => s());
  }, []);
  const nlip = useMemo(() => createNlipClient(process.env.NEXT_PUBLIC_AGENT_NLIP_WS_URL ?? "ws://localhost:8002/nlip"), []);
  return (
    <main className="min-h-screen flex flex-col">
      <DemoController client={nlip} />
      <DemoNarration />
      <Header scenario={process.env.NEXT_PUBLIC_SCENARIO ?? "data-center-swarm-attack"} />
      <div className="p-4 flex flex-col gap-3">
        <EscalationBanner />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <Map3D />
            <ActivityTheatre />
          </div>
          <div className="flex flex-col gap-3">
            <NlipChat client={nlip} />
            <PlanPanel />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CostCurveOverlay />
          <EventTape />
        </div>
      </div>
    </main>
  );
}
