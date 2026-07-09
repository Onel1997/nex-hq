"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DepartmentHqNeuralConfig } from "./types";

interface DepartmentHqNeuralNetworkProps {
  config: DepartmentHqNeuralConfig;
  className?: string;
}

interface ActivePacket {
  id: string;
  linkId: string;
  progress: number;
}

export function DepartmentHqNeuralNetwork({
  config,
  className,
}: DepartmentHqNeuralNetworkProps) {
  const [activeLinks, setActiveLinks] = useState<Set<string>>(new Set());
  const [packets, setPackets] = useState<ActivePacket[]>([]);

  const nodeMap = useMemo(
    () => new Map(config.nodes.map((node) => [node.id, node])),
    [config.nodes],
  );

  useEffect(() => {
    const pulseLinks = () => {
      const link = config.links[Math.floor(Math.random() * config.links.length)];
      if (!link) return;

      setActiveLinks((current) => new Set(current).add(link.id));
      setPackets((current) => [
        ...current,
        { id: `${link.id}-${Date.now()}`, linkId: link.id, progress: 0 },
      ]);

      setTimeout(() => {
        setActiveLinks((current) => {
          const next = new Set(current);
          next.delete(link.id);
          return next;
        });
      }, 2400);
    };

    pulseLinks();
    const timer = setInterval(pulseLinks, 1800 + Math.random() * 1200);
    return () => clearInterval(timer);
  }, [config.links]);

  useEffect(() => {
    const frame = setInterval(() => {
      setPackets((current) =>
        current
          .map((packet) => ({ ...packet, progress: packet.progress + 0.04 }))
          .filter((packet) => packet.progress <= 1),
      );
    }, 48);
    return () => clearInterval(frame);
  }, []);

  return (
    <div className={cn("dhq-neural-stage", className)}>
      <div className="dhq-neural-vignette" aria-hidden />
      <div className="dhq-neural-ring dhq-neural-ring-outer" aria-hidden />
      <div className="dhq-neural-ring dhq-neural-ring-inner" aria-hidden />

      <svg
        className="dhq-neural-svg"
        viewBox="0 0 520 420"
        role="img"
        aria-label="Storefront neural network"
      >
        <defs>
          <linearGradient id="dhq-link-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(124 255 122 / 0.05)" />
            <stop offset="50%" stopColor="rgb(124 255 122 / 0.55)" />
            <stop offset="100%" stopColor="rgb(56 189 248 / 0.35)" />
          </linearGradient>
          <filter id="dhq-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {config.links.map((link) => {
          const from = nodeMap.get(link.from);
          const to = nodeMap.get(link.to);
          if (!from || !to) return null;

          const active = activeLinks.has(link.id) || link.active;
          return (
            <g key={link.id}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={cn("dhq-neural-link", active && "dhq-neural-link-active")}
              />
              {active ? (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="dhq-neural-link-energy"
                  filter="url(#dhq-glow)"
                />
              ) : null}
            </g>
          );
        })}

        {packets.map((packet) => {
          const link = config.links.find((item) => item.id === packet.linkId);
          if (!link) return null;
          const from = nodeMap.get(link.from);
          const to = nodeMap.get(link.to);
          if (!from || !to) return null;

          const x = from.x + (to.x - from.x) * packet.progress;
          const y = from.y + (to.y - from.y) * packet.progress;

          return (
            <circle
              key={packet.id}
              cx={x}
              cy={y}
              r={3.5}
              className="dhq-neural-packet"
            />
          );
        })}
      </svg>

      {config.nodes.map((node) => {
        const Icon = node.icon;
        return (
          <div
            key={node.id}
            className={cn("dhq-neural-node", node.active && "dhq-neural-node-active")}
            style={{
              left: `${(node.x / 520) * 100}%`,
              top: `${(node.y / 420) * 100}%`,
            }}
          >
            <span className="dhq-neural-node-halo" aria-hidden />
            <span className="dhq-neural-node-core">
              {Icon ? <Icon className="size-4" /> : null}
            </span>
            <span className="dhq-neural-node-label">{node.label}</span>
          </div>
        );
      })}

      {config.centerLabel ? (
        <div className="dhq-neural-center">
          <span className="dhq-neural-center-pulse" aria-hidden />
          <span>{config.centerLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
