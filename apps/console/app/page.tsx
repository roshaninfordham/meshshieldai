"use client";
import { useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { AirspaceCanvas } from "@/components/AirspaceCanvas";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { StackSidebar } from "@/components/StackSidebar";
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
    <main className="overflow-x-hidden" style={{ background: "#0b0f17", minHeight: "100vh" }}>
      <DemoController client={nlip} />
      <DemoNarration />
      <Header scenario={process.env.NEXT_PUBLIC_SCENARIO ?? "data-center-swarm-attack"} />

      <div className="p-3 flex flex-col gap-3">
        <EscalationBanner />

        {/* Main body: 9/3 column split */}
        <div className="grid grid-cols-12 gap-3">
          {/* Left+Center: map + theatre */}
          <div className="col-span-12 lg:col-span-9 flex flex-col gap-3 min-h-0">
            <AirspaceCanvas />
            <ActivityTheatre />
          </div>

          {/* Right column: stack sidebar + chat + plan */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0 lg:sticky lg:top-3 lg:self-start" style={{ maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <StackSidebar />
            <NlipChat client={nlip} />
            <PlanPanel />
          </div>
        </div>

        {/* Bottom: cost curve + event tape */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 lg:col-span-6">
            <CostCurveOverlay />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <EventTape />
          </div>
        </div>
      </div>
    </main>
  );
}
