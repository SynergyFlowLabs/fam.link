"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { layoutTree, NODE_W, NODE_H, type LayoutResult } from "@/lib/layout/engine";
import { displayName, lifeLine, type CanvasLink, type CanvasPerson, type CanvasUnion } from "@/lib/canvas-types";
import { setFocusPersonAction } from "@/actions/persons";
import { QuickAddModal, type Relation } from "./quick-add-modal";

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
}

const MIN_W = 360;

export function TreeCanvas({
  treeId,
  treeName,
  persons,
  unions,
  links,
  focusPersonId,
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

  // Pan (background drag)
  const dragRef = useRef<{ px: number; py: number; view: View } | null>(null);
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-node]")) return;
    dragRef.current = { px: e.clientX, py: e.clientY, view };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    const el = svgRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const sx = d.view.w / rect.width;
    const sy = d.view.w * aspect;
    setView({
      ...d.view,
      x: d.view.x - (e.clientX - d.px) * sx,
      y: d.view.y - (e.clientY - d.py) * sy,
    });
  };
  const endDrag = () => {
    dragRef.current = null;
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
        </div>
        <div className="flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={() => zoom(1 / 1.25)}
            aria-label="Zoom in"
            className="h-8 w-8 rounded-lg border border-line text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            aria-label="Zoom out"
            className="h-8 w-8 rounded-lg border border-line text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
          >
            −
          </button>
          <button
            type="button"
            onClick={fit}
            className="h-8 rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
          >
            Fit
          </button>
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
    <g stroke="var(--color-ink-soft)" strokeWidth={1.5} fill="none" opacity={0.5}>
      {unions.map((u) => {
        const a = nodeById.get(u.partnerAId);
        const b = u.partnerBId ? nodeById.get(u.partnerBId) : null;
        if (!a || !b) return null;
        const left = a.x <= b.x ? a : b;
        const right = a.x <= b.x ? b : a;
        if (Math.abs(a.y - b.y) < 1) {
          return (
            <line
              key={`c-${u.id}`}
              x1={left.x + NODE_W / 2}
              y1={left.y}
              x2={right.x - NODE_W / 2}
              y2={right.y}
            />
          );
        }
        // spouses in different rows (pedigree collapse edge cases)
        return (
          <path
            key={`c-${u.id}`}
            d={`M ${left.x + NODE_W / 2} ${left.y} C ${left.x + NODE_W / 2 + 60} ${left.y}, ${right.x - NODE_W / 2 - 60} ${right.y}, ${right.x - NODE_W / 2} ${right.y}`}
          />
        );
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
          sy = a.y + 8;
        } else if (a || b) {
          const p = (a ?? b) as { x: number; y: number };
          sx = p.x;
          sy = p.y + NODE_H / 2 + 2;
        } else {
          return null;
        }
        const ty = child.y - NODE_H / 2;
        const dy = ty - sy;
        return (
          <path
            key={`p-${l.unionId}-${l.childId}`}
            d={`M ${sx} ${sy} C ${sx} ${sy + dy * 0.5}, ${child.x} ${ty - dy * 0.5}, ${child.x} ${ty}`}
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
  onHover,
  onQuickAdd,
}: {
  treeId: string;
  person: CanvasPerson;
  x: number;
  y: number;
  isFocus: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onQuickAdd: (relation: Relation) => void;
}) {
  const [focusPending, startFocusTransition] = useTransition();
  const name = displayName(person);
  const isUnknown = name === "Unknown";
  const dates = lifeLine(person);
  const left = x - NODE_W / 2;
  const top = y - NODE_H / 2;

  const pills: { label: string; relation: Relation; dx: number }[] = [
    { label: "+ father", relation: "father", dx: -132 },
    { label: "+ mother", relation: "mother", dx: -66 },
    { label: "+ spouse", relation: "spouse", dx: 0 },
    { label: "+ child", relation: "child", dx: 66 },
  ];

  return (
    <g
      data-node
      transform={`translate(${left}, ${top})`}
      onMouseEnter={() => onHover(person.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* hover hit area larger than the card */}
      <rect x={-10} y={-34} width={NODE_W + 20} height={NODE_H + 68} fill="transparent" />
      <a href={`/app/trees/${treeId}/person/${person.id}`}>
        <rect
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
          fill={isUnknown ? "var(--color-ink-soft)" : person.living ? "var(--color-ink)" : "var(--color-rosewood)"}
          fontStyle={isUnknown ? "italic" : undefined}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isUnknown ? "Unknown" : name}
        </text>
        <text x={NODE_W / 2} y={48} textAnchor="middle" fontSize={10.5} fill="var(--color-ink-soft)" opacity={0.85}>
          {dates}
        </text>
        {person.memoryCount > 0 && (
          <text x={NODE_W - 12} y={22} textAnchor="end" fontSize={11} fill="var(--color-gold)">
            ✻ {person.memoryCount}
          </text>
        )}
      </a>

      {hovered && (
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
