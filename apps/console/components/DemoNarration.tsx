"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/store";

export function DemoNarration() {
  const currentStep = useMeshStore((s) => s.demo.currentStep);
  const [progress, setProgress] = useState(0);

  // Drive a smooth progress bar for the current step
  useEffect(() => {
    if (!currentStep) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const start = performance.now();
    const dur = currentStep.duration_ms;
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - start;
      setProgress(Math.min(elapsed / dur, 1));
      if (elapsed < dur) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentStep]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none">
      <AnimatePresence mode="wait">
        {currentStep && (
          <motion.div
            key={currentStep.at_ms}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="rounded-2xl bg-gray-900/95 ring-1 ring-white/10 shadow-2xl p-5 backdrop-blur-md"
          >
            <div className="font-bold text-white text-base mb-1">{currentStep.title}</div>
            <div className="text-sm text-white/70 leading-relaxed">{currentStep.body}</div>
            {/* Progress bar */}
            <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-none"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
