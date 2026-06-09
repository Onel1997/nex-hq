"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo } from "react";
import type { TransmissionEvent } from "@/lib/facility/types";

interface TransmissionPacketProps {
  transmission: TransmissionEvent | null;
  path: string;
}

export const TransmissionPacket = memo(function TransmissionPacket({
  transmission,
  path,
}: TransmissionPacketProps) {
  return (
    <AnimatePresence>
      {transmission ? (
        <g key={transmission.id}>
          <motion.circle
            r={4}
            fill="oklch(0.82 0.12 85)"
            filter="url(#synapse-glow-strong)"
            style={{ offsetPath: `path('${path}')`, offsetRotate: "0deg" }}
            initial={{ offsetDistance: "0%", opacity: 0, scale: 0.5 }}
            animate={{
              offsetDistance: "100%",
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1, 0.6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
          />
          <motion.foreignObject
            style={{ offsetPath: `path('${path}')`, offsetRotate: "0deg" }}
            width={120}
            height={24}
            initial={{ offsetDistance: "0%", opacity: 0 }}
            animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
          >
            <div className="facility-transmission-label">
              {transmission.label}
            </div>
          </motion.foreignObject>
        </g>
      ) : null}
    </AnimatePresence>
  );
});
