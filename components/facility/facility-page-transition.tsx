"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

interface FacilityPageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function FacilityPageTransition({
  children,
  className,
}: FacilityPageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn("facility-page-transition", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
