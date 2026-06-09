"use client";

import { useEffect, useRef, useState } from "react";

export interface CanvasSize {
  width: number;
  height: number;
}

export function useCanvasSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
