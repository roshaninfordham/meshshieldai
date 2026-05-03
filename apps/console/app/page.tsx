"use client";
import { useEffect, useMemo } from "react";
import { Panel, Group as PanelGroup, Separator as ResizeHandle } from "react-resizable-panels";
import { Header } from "@/components/Header";
import { AirspaceCanvas } from "@/components/AirspaceCanvas";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { MissionControl } from "@/components/MissionControl";
import { StackSidebar } from "@/components/StackSidebar";
import { NlipChat } from "@/components/NlipChat";
import { PlanPanel } from "@/components/PlanPanel";
import { EventTape } from "@/components/EventTape";
import { CostCurveOverlay } from "@/components/CostCurveOverlay";
import { EscalationBanner } from "@/components/EscalationBanner";
import { DemoController } from "@/components/DemoController";
import { DemoNarration } from "@/components/DemoNarration";
import { WelcomeModal } from "@/components/WelcomeModal";
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
      <WelcomeModal />
      <DemoController client={nlip} />
      <DemoNarration />

      {/* Header (includes classification banner) */}
      <Header scenario={process.env.NEXT_PUBLIC_SCENARIO ?? "data-center-swarm-attack"} />

      <div className="p-3 flex flex-col gap-3">
        {/* Mission Control — full width strip */}
        <MissionControl />

        {/* Escalation Banner */}
        <EscalationBanner />

        {/* Main resizable body: left (airspace + theatre) | right (stack + chat + plan) */}
        <PanelGroup
          orientation="horizontal"
          style={{ display: "flex", minHeight: "700px" }}
        >
          {/* Left panel: airspace (top) + pipeline theatre (bottom) */}
          <Panel defaultSize={75} minSize={50}>
            {/* Inner vertical split: airspace / theatre */}
            <PanelGroup
              orientation="vertical"
              style={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              {/* Airspace panel */}
              <Panel defaultSize={60} minSize={35}>
                <div style={{ height: "100%", paddingRight: "6px", paddingBottom: "0" }}>
                  <AirspaceCanvas />
                </div>
              </Panel>

              {/* Vertical drag handle */}
              <ResizeHandle
                style={{
                  height: "6px",
                  cursor: "row-resize",
                  margin: "2px 6px 2px 0",
                  borderRadius: "3px",
                  flexShrink: 0,
                }}
                className="resize-handle-bar resize-handle-vertical"
              />

              {/* Activity theatre panel */}
              <Panel defaultSize={40} minSize={20}>
                <div style={{ height: "100%", paddingRight: "6px", paddingTop: "4px" }}>
                  <ActivityTheatre />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Horizontal drag handle */}
          <ResizeHandle
            style={{
              width: "6px",
              cursor: "col-resize",
              margin: "0 2px",
              borderRadius: "3px",
              flexShrink: 0,
            }}
            className="resize-handle-bar resize-handle-horizontal"
          />

          {/* Right panel: stack sidebar + chat + plan */}
          <Panel
            defaultSize={25}
            minSize={20}
            maxSize={45}
          >
            <div style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflowY: "auto",
              paddingLeft: "6px",
            }}>
              <StackSidebar />
              <NlipChat client={nlip} />
              <PlanPanel />
            </div>
          </Panel>
        </PanelGroup>

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

      {/* Global resize handle styles */}
      <style>{`
        .resize-handle-bar {
          background: rgba(92,242,192,0.08);
          border: 1px solid rgba(92,242,192,0.14);
          transition: background 0.18s, border-color 0.18s;
        }
        .resize-handle-bar:hover,
        .resize-handle-bar[data-active] {
          background: rgba(92,242,192,0.28) !important;
          border-color: rgba(92,242,192,0.55) !important;
        }
        [data-group] {
          outline: none;
        }
      `}</style>
    </main>
  );
}
