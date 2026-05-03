"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/store";
export function EscalationBanner() {
  const plan = useMeshStore((s) => s.plan) as any;
  const required = plan?.escalation?.required;
  return (
    <AnimatePresence>
      {required && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
          className="bg-danger/15 text-danger border border-danger/40 rounded-md px-3 py-2 text-sm">
          ESCALATION REQUIRED · {plan!.escalation.reasons.join(" · ")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
