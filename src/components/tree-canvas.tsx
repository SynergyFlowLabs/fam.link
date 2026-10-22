"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { layoutTree, NODE_W, NODE_H, type LayoutResult } from "@/lib/layout/engine";
import { coupleEdgeD, parentChildEdgeD } from "@/lib/layout/edges";
import {
  displayName,
  lifeLine,
  REDACTED_NAME,
  type CanvasLink,
  type CanvasPerson,
  type CanvasUnion,
} from "@/lib/canvas-types";
import { setFocusPersonAction } from "@/actions/persons";
import { QuickAddModal, type Relation } from "./quick-add-modal";

/** Clamp a view rectangle so it always overlaps the content bounds —
 *  panning can never push the tree entirely out of sight. */
function clampViewTo(
  x: number,
  y: number,
  w: number,
  aspect: number,
  b: { minX: number; minY: number; maxX: number; maxY: number } | null,
): View {
  if (!b) return { x, y, w };
  const pad = 480;
  const h = w * aspect;
  return {
    x: Math.min(Math.max(x, b.minX - pad - w), b.maxX + pad),
    y: Math.min(Math.max(y, b.minY - pad - h), b.maxY + pad),
    w,
  };
}

interface View {
  x: number;
  y: number;
  w: number;
}

interface Props {
  treeId: string;
  treeName: string;
  persons: CanvasPerson[];
  unions: CanvasUnion[];
  links: CanvasLink[];
  focusPersonId: string;
  /** Public share view: no links, no quick-add, no exports. */
  readOnly?: boolean;
  /** Shown under the title on a share view (e.g. privacy note). */
  shareNote?: string | null;
  /** Extra header controls (owner view: Share menu). */
  headerExtra?: React.ReactNode;
}

const MIN_W = 360;

export function TreeCanvas({
  treeId,
  treeName,
  persons,
  unions,
  links,
  focusPersonId,
  readOnly = false,
  shareNote = null,
  headerExtra = null,
}: Props) {
  const layout: LayoutResult = useMemo(
    () =>
      layoutTree({
        persons: persons.map((p) => ({ id: p.id })),
        unions,
        links,
        focusPersonId,
      }),
    [persons, unions, links, focusPersonId],
  );
  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );
  const nodeById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );
  const unionById = useMemo(
    () => new Map(unions.map((u) => [u.id, u])),
    [unions],
  );

  // Content bounds (with generous padding) for pan clamping: dragging can
  // never push the tree entirely out of sight — the canvas can't go blank.
  const contentBounds = useMemo(() => {
    if (layout.nodes.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of layout.nodes) {
      minX = Math.min(minX, n.x - NODE_W / 2);
      maxX = Math.max(maxX, n.x + NODE_W / 2);
      minY = Math.min(minY, n.y - NODE_H / 2);
      maxY = Math.max(maxY, n.y + NODE_H / 2);
    }
    return { minX, minY, maxX, maxY };
  }, [layout]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(() => ({
    x: 0,
    y: 0,
    w: Math.max(layout.width, MIN_W),
  }));
  // Reset the view when the layout changes (new people added) — the
  // React-approved "adjust state during render" pattern.
  const [prevLayout, setPrevLayout] = useState(layout);
  if (prevLayout !== layout) {
    setPrevLayout(layout);
    setView({ x: 0, y: 0, w: Math.max(layout.width, MIN_W) });
  }
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ anchorId: string; relation: Relation } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [aspect, setAspect] = useState(0.6);

  const clampView = useCallback(
    (x: number, y: number, w: number): View =>
      clampViewTo(x, y, w, aspect, contentBounds),
    [aspect, contentBounds],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setAspect(
        el.clientWidth > 0 ? el.clientHeight / el.clientWidth : 0.6,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    setView({ x: 0, y: 0, w: Math.max(layout.width, MIN_W) });
  }, [layout.width]);

  // Zoom (wheel, non-passive so we can preventDefault)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setView((v) => {
        const mx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
        const my =
          v.y + ((e.clientY - rect.top) / rect.height) * v.w * aspect;
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const w2 = Math.min(Math.max(v.w * factor, MIN_W), layout.width * 1.6);
        const scale = w2 / v.w;
        return { w: w2, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [aspect, layout.width]);

  // Pan (background drag), 1:1 with the pointer. The viewBox matches the
  // element's aspect exactly, so one scale (world units per screen pixel)
  // serves both axes. Panning is clamped to the content so a drag can never
  // leave the canvas blank.
  const dragRef = useRef<{ px: number; py: number; view: View } | null>(null);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    dragRef.current = { px: e.clientX, py: e.clientY, view };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const el = svgRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const scale = d.view.w / rect.width;
    setView(
      clampView(
        d.view.x - (e.clientX - d.px) * scale,
        d.view.y - (e.clientY - d.py) * scale,
        d.view.w,
      ),
    );
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const zoom = (factor: number) => {
    setView((v) => {
      const cx = v.x + v.w / 2;
      const cy = v.y + (v.w * aspect) / 2;
      const w2 = Math.min(Math.max(v.w * factor, MIN_W), layout.width * 1.6);
      const s = w2 / v.w;
      return { w: w2, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
    });
  };

  const generations =
    layout.nodes.length > 0
      ? Math.max(
          ...layout.nodes.map((n) => n.generation),
        ) -
        Math.min(...layout.nodes.map((n) => n.generation)) +
        1
      : 0;
  const totalMemories = persons.reduce((s, p) => s + p.memoryCount, 0);
  const focusPerson = personById.get(focusPersonId);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {readOnly && shareNote && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 bg-evergreen-deep px-4 py-1.5 text-center text-[11px] text-paper/85">
          <span>{shareNote}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold text-ink">
            {treeName}
          </h1>
          <p className="text-xs text-ink-soft">
            {persons.length} {persons.length === 1 ? "person" : "people"} ·{" "}
            {generations} {generations === 1 ? "generation" : "generations"}
            {totalMemories > 0 ? ` · ${totalMemories} memories` : ""}
            {focusPerson ? ` · centered on ${displayName(focusPerson)}` : ""}
          </p>
          {shareNote && (
            <p className="text-[11px] leading-snug text-ink-soft/80">{shareNote}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && headerExtra}
          {!readOnly && (
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen">
              Export
            </summary>
            <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-line bg-card p-2 shadow-lg">
              <a
                href={`/app/trees/${treeId}/export/gedcom`}
                className="block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-evergreen-mist"
              >
                GEDCOM (.ged)
                <span className="block text-xs text-ink-soft">
                  for other genealogy apps
                </span>
              </a>
              <a
                href={`/app/trees/${treeId}/export/json`}
                className="block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-evergreen-mist"
              >
                JSON (.json)
                <span className="block text-xs text-ink-soft">
                  everything, machine-readable
                </span>
              </a>
              <p className="px-3 pt-1.5 pb-1 text-[11px] leading-snug text-ink-soft">
                Yours forever — exports always work, for every tree, free.
              </p>
            </div>
          </details>
          )}
          <div className="flex items-center overflow-hidden rounded-full border border-line bg-card">
            <button
              type="button"
              onClick={() => zoom(1.25)}
              aria-label="Zoom out"
              className="h-8 w-9 text-sm text-ink-soft transition-colors hover:bg-evergreen-mist hover:text-evergreen"
            >
              −
            </button>
            <button
              type="button"
              onClick={fit}
              className="h-8 border-x border-line px-3 text-xs text-ink-soft transition-colors hover:bg-evergreen-mist hover:text-evergreen"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => zoom(1 / 1.25)}
              aria-label="Zoom in"
              className="h-8 w-9 text-sm text-ink-soft transition-colors hover:bg-evergreen-mist hover:text-evergreen"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none select-none"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.w * aspect}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          role="application"
          aria-label={`Family tree: ${treeName}`}
        >
          <defs>
            <pattern id="canvas-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.4" cy="1.4" r="1.4" fill="var(--color-line)" opacity="0.5" />
            </pattern>
          </defs>
          <rect
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.w * aspect}
            fill="url(#canvas-dots)"
          />
          <Edges
            unions={unions}
            links={links}
            nodeById={nodeById}
            unionById={unionById}
          />
          {layout.nodes.map((n) => {
            const p = personById.get(n.id);
            if (!p) return null;
            return (
              <PersonNode
                key={n.id}
                treeId={treeId}
                person={p}
                x={n.x}
                y={n.y}
                isFocus={n.id === focusPersonId}
                hovered={hoverId === n.id}
                readOnly={readOnly}
                onHover={setHoverId}
                onQuickAdd={(relation) => setModal({ anchorId: n.id, relation })}
              />
            );
          })}
        </svg>

        {modal && (
          <QuickAddModal
            treeId={treeId}
            anchorId={modal.anchorId}
            anchorName={displayName(personById.get(modal.anchorId) ?? { firstName: null, lastName: null })}
            relation={modal.relation}
            onClose={() => setModal(null)}
          />
        )}
      </div>
    </div>
  );
}

function Edges({
  unions,
  links,
  nodeById,
  unionById,
}: {
  unions: CanvasUnion[];
  links: CanvasLink[];
  nodeById: Map<string, { x: number; y: number }>;
  unionById: Map<string, CanvasUnion>;
}) {
  return (
    <g
      stroke="var(--color-ink-soft)"
      strokeWidth={1.5}
      fill="none"
      opacity={0.55}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {unions.map((u) => {
        const a = nodeById.get(u.partnerAId);
        const b = u.partnerBId ? nodeById.get(u.partnerBId) : null;
        if (!a || !b) return null;
        return <path key={`c-${u.id}`} d={coupleEdgeD(a, b, NODE_W)} />;
      })}
      {links.map((l) => {
        const u = unionById.get(l.unionId);
        const child = nodeById.get(l.childId);
        if (!u || !child) return null;
        const a = nodeById.get(u.partnerAId);
        const b = u.partnerBId ? nodeById.get(u.partnerBId) : null;
        let sx: number;
        let sy: number;
        if (a && b) {
          sx = (a.x + b.x) / 2;
          // drop straight off the marriage line — a clean T-junction
          sy = a.y + 1;
        } else if (a || b) {
          const single = (a ?? b) as { x: number; y: number };
          sx = single.x;
          sy = single.y + NODE_H / 2 + 3;
        } else {
          return null;
        }
        const ty = child.y - NODE_H / 2 - 1;
        return (
          <path
            key={`p-${l.unionId}-${l.childId}`}
            d={parentChildEdgeD(sx, sy, child.x, ty)}
          />
        );
      })}
    </g>
  );
}

function PersonNode({
  treeId,
  person,
  x,
  y,
  isFocus,
  hovered,
  readOnly = false,
  onHover,
  onQuickAdd,
}: {
  treeId: string;
  person: CanvasPerson;
  x: number;
  y: number;
  isFocus: boolean;
  hovered: boolean;
  readOnly?: boolean;
  onHover: (id: string | null) => void;
  onQuickAdd: (relation: Relation) => void;
}) {
  const [focusPending, startFocusTransition] = useTransition();
  const redacted = person.redacted === true;
  const name = redacted ? REDACTED_NAME : displayName(person);
  const isUnknown = !redacted && name === "Unknown";
  const dates = lifeLine(person);
  const left = x - NODE_W / 2;
  const top = y - NODE_H / 2;

  const pills: { label: string; relation: Relation; dx: number }[] = [
    { label: "+ father", relation: "father", dx: -132 },
    { label: "+ mother", relation: "mother", dx: -66 },
    { label: "+ spouse", relation: "spouse", dx: 0 },
    { label: "+ child", relation: "child", dx: 66 },
  ];

  const card = (
    <>
      <rect
        className="tnode-card"
        width={NODE_W}
        height={NODE_H}
        rx={14}
        fill={isUnknown ? "transparent" : "var(--color-card)"}
        stroke={isFocus ? "var(--color-evergreen)" : isUnknown ? "var(--color-ink-soft)" : "var(--color-line)"}
        strokeWidth={isFocus ? 2.5 : 1.5}
        strokeDasharray={isUnknown ? "5 5" : undefined}
      />
      <text
        x={NODE_W / 2}
        y={30}
        textAnchor="middle"
        fontSize={15}
        fontWeight={500}
        fill={
          isUnknown || redacted
            ? "var(--color-ink-soft)"
            : person.living
              ? "var(--color-ink)"
              : "var(--color-rosewood)"
        }
        fontStyle={isUnknown || redacted ? "italic" : undefined}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {name}
      </text>
      <text x={NODE_W / 2} y={48} textAnchor="middle" fontSize={10.5} fill="var(--color-ink-soft)" opacity={0.85}>
        {dates}
      </text>
      {person.memoryCount > 0 && (
        <text x={NODE_W - 12} y={22} textAnchor="end" fontSize={11} fill="var(--color-gold)">
          ✻ {person.memoryCount}
        </text>
      )}
    </>
  );

  return (
    <g
      data-node
      transform={`translate(${left}, ${top})`}
      onMouseEnter={() => onHover(person.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* hover hit area larger than the card */}
      <rect x={-10} y={-34} width={NODE_W + 20} height={NODE_H + 68} fill="transparent" />
      {readOnly ? (
        <g>{card}</g>
      ) : (
        <a href={`/app/trees/${treeId}/person/${person.id}`}>{card}</a>
      )}

      {hovered && !readOnly && (
        <g>
          {pills.map((pill) => (
            <g
              key={pill.relation}
              role="button"
              tabIndex={0}
              aria-label={`Add ${pill.relation} to ${name}`}
              transform={`translate(${NODE_W / 2 + pill.dx - 30}, -30)`}
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickAdd(pill.relation);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onQuickAdd(pill.relation);
                }
              }}
            >
              <rect
                width={60}
                height={21}
                rx={10.5}
                fill="var(--color-evergreen)"
                stroke="none"
              />
              <text
                x={30}
                y={14.5}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-paper)"
              >
                {pill.label}
              </text>
            </g>
          ))}
          {!isFocus && (
            <g
              role="button"
              tabIndex={0}
              aria-label={`Center the tree on ${name}`}
              transform={`translate(${NODE_W / 2 - 45}, ${NODE_H + 9})`}
              className="cursor-pointer"
              opacity={focusPending ? 0.5 : 1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const fd = new FormData();
                fd.set("treeId", treeId);
                fd.set("personId", person.id);
                startFocusTransition(async () => {
                  await setFocusPersonAction(fd);
                });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const fd = new FormData();
                  fd.set("treeId", treeId);
                  fd.set("personId", person.id);
                  startFocusTransition(async () => {
                    await setFocusPersonAction(fd);
                  });
                }
              }}
            >
              <rect
                width={90}
                height={21}
                rx={10.5}
                fill="none"
                stroke="var(--color-evergreen)"
                strokeWidth={1.2}
              />
              <text
                x={45}
                y={14.5}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-evergreen)"
              >
                ◈ center tree here
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
