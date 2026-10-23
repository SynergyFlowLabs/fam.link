"use client";

import { useCallback, useRef } from "react";

/**
 * Canvas minimap (issue #30, P2.5) — a small overview of the whole tree with
 * the current viewport outlined; click or drag anywhere to jump/pan. Pure
 * presentational: the canvas passes bounds, node positions, viewport and an
 * onPan callback (world coordinates). Rendered conditionally by TreeCanvas
 * (hidden for small trees and mobile widths).
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Props {
  bounds: Bounds;
  /** Current viewport in world coordinates. */
  view: { x: number; y: number; w: number; h: number };
  nodes: { id: string; x: number; y: number }[];
  focusId: string | null;
  /** Pan so the viewport centres on this world point. */
  onPan: (worldX: number, worldY: number) => void;
}

const W = 168;
const H = 112;
const PAD = 8;

export function CanvasMinimap({ bounds, view, nodes, focusId, onPan }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const contentW = Math.max(bounds.maxX - bounds.minX, 1);
  const contentH = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min((W - PAD * 2) / contentW, (H - PAD * 2) / contentH);
  const offX = (W - contentW * scale) / 2;
  const offY = (H - contentH * scale) / 2;

  const toWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = svgRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const lx = ((clientX - rect.left) / rect.width) * W;
      const ly = ((clientY - rect.top) / rect.height) * H;
      return {
        x: (lx - offX) / scale + bounds.minX,
        y: (ly - offY) / scale + bounds.minY,
      };
    },
    [bounds.minX, bounds.minY, offX, offY, scale],
  );

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const p = toWorld(e.clientX, e.clientY);
      if (p) onPan(p.x, p.y);
    },
    [toWorld, onPan],
  );

  // Keyboard: arrows nudge the viewport a step (10% of content) — the
  // minimap itself is focusable so panning never needs a pointer.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      const stepX = contentW * 0.1;
      const stepY = contentH * 0.1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -stepX;
      else if (e.key === "ArrowRight") dx = stepX;
      else if (e.key === "ArrowUp") dy = -stepY;
      else if (e.key === "ArrowDown") dy = stepY;
      else return;
      e.preventDefault();
      onPan(view.x + view.w / 2 + dx, view.y + view.h / 2 + dy);
    },
    [contentW, contentH, onPan, view.x, view.y, view.w, view.h],
  );

  const vpX = offX + (view.x - bounds.minX) * scale;
  const vpY = offY + (view.y - bounds.minY) * scale;

  return (
    <svg
      ref={svgRef}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="application"
      aria-label="Canvas minimap — click or drag to move around the tree"
      tabIndex={0}
      className="block cursor-pointer rounded-xl border border-line bg-card/95 shadow-float outline-none focus-visible:ring-2 focus-visible:ring-evergreen"
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) handlePointer(e);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
      onKeyDown={onKeyDown}
    >
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={11} fill="var(--color-card)" stroke="var(--color-line)" />
      {nodes.map((n) => (
        <circle
          key={n.id}
          cx={offX + (n.x - bounds.minX) * scale}
          cy={offY + (n.y - bounds.minY) * scale}
          r={n.id === focusId ? 3 : 1.7}
          fill={n.id === focusId ? "var(--color-gold)" : "var(--color-evergreen)"}
          opacity={n.id === focusId ? 1 : 0.75}
        />
      ))}
      <rect
        x={vpX}
        y={vpY}
        width={Math.max(view.w * scale, 3)}
        height={Math.max(view.h * scale, 3)}
        rx={2}
        fill="var(--color-evergreen)"
        fillOpacity={0.08}
        stroke="var(--color-evergreen)"
        strokeWidth={1.4}
      />
    </svg>
  );
}
