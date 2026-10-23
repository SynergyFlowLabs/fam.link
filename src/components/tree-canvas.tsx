"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  layoutTree,
  NODE_W,
  NODE_H,
  PADDING,
  ROW_GAP,
  type LayoutResult,
} from "@/lib/layout/engine";
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
  /**
   * Content-editing affordances (quick-add pills, re-root button). Defaults
   * to !readOnly — pass false for viewer/commenter members.
   */
  canEdit?: boolean;
  /** Export menu (defaults to !readOnly — every member can export). */
  showExport?: boolean;
  /** Shown under the title on a share view (e.g. privacy note). */
  shareNote?: string | null;
  /** Small note under the title for invited members (e.g. their role). */
  memberNote?: string | null;
  /** Extra header controls (owner view: Share + Members). */
  headerExtra?: React.ReactNode;
  /** Editor-and-up: link to the GEDCOM import review screen. */
  importHref?: string | null;
  /**
   * Base path for person-card links. Defaults to /app/trees/{treeId};
   * public explore views pass /explore/{treeId}. Redacted (living) cards
   * never link — their person pages are private.
   */
  personHrefBase?: string | null;
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
  canEdit,
  showExport,
  shareNote = null,
  memberNote = null,
  headerExtra = null,
  importHref = null,
  personHrefBase = null,
}: Props) {
  const editable = canEdit ?? !readOnly;
  const exportsOn = showExport ?? !readOnly;
  const layout: LayoutResult = useMemo(
    () =>
      layoutTree({
        persons: persons.map((p) => ({
          id: p.id,
          birthHint: p.birthDateText,
        })),
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
  const personBase = personHrefBase ?? `/app/trees/${treeId}`;
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

  /** Open on the focus person at a readable zoom — not the whole wide
   *  canvas. The row of the focus stays centre-stage; ancestors and
   *  descendants flow away from it. */
  const focusView = useCallback(
    (lo: LayoutResult): View =>
      clampViewTo(
        lo.focusX - Math.min(Math.max(lo.width, MIN_W), 1500) / 2,
        lo.focusY - (Math.min(Math.max(lo.width, MIN_W), 1500) * 0.6) / 2,
        Math.min(Math.max(lo.width, MIN_W), 1500),
        0.6,
        contentBounds,
      ),
    [contentBounds],
  );
  const [view, setView] = useState<View>(() => focusView(layout));
  // Reset the view when the layout changes (new people added) — the
  // React-approved "adjust state during render" pattern.
  const [prevLayout, setPrevLayout] = useState(layout);
  if (prevLayout !== layout) {
    setPrevLayout(layout);
    setView(focusView(layout));
  }
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modal, setModal] = useState<{ anchorId: string; relation: Relation } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [aspect, setAspect] = useState(0.6);

  const clampView = useCallback(
    (x: number, y: number, w: number): View =>
      clampViewTo(x, y, w, aspect, contentBounds),
    [aspect, contentBounds],
  );

  /** Search result → pan the view so the person sits centre-stage. */
  const locatePerson = useCallback(
    (id: string) => {
      const node = layout.nodes.find((n) => n.id === id);
      if (!node) return;
      const h = view.w * aspect;
      setView(clampView(node.x - view.w / 2, node.y - h / 2, view.w));
      setHighlightId(id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 2200);
    },
    [layout.nodes, view.w, aspect, clampView],
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

  /** Fit: the whole tree in view, both dimensions, with breathing room. */
  const fit = useCallback(() => {
    if (!contentBounds) {
      setView({ x: 0, y: 0, w: MIN_W });
      return;
    }
    const pad = 60;
    const wContent = contentBounds.maxX - contentBounds.minX + pad * 2;
    const hContent = contentBounds.maxY - contentBounds.minY + pad * 2;
    const w = Math.min(
      Math.max(wContent, hContent / aspect, MIN_W),
      Math.max(layout.width, layout.height / aspect) * 1.25,
    );
    const h = w * aspect;
    setView(
      clampView(
        (contentBounds.minX + contentBounds.maxX) / 2 - w / 2,
        (contentBounds.minY + contentBounds.maxY) / 2 - h / 2,
        w,
      ),
    );
  }, [aspect, clampView, contentBounds, layout.width, layout.height]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

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
  // Zebra bands keep wide rows readable: one stripe per generation, labels
  // on the left rail (skipped for single-generation trees).
  const genRows = useMemo(() => {
    if (generations < 2 || !contentBounds) return [];
    const minGen = Math.min(...layout.nodes.map((n) => n.generation));
    return [...new Set(layout.nodes.map((n) => n.generation))]
      .sort((a, b) => a - b)
      .map((g) => {
        const bandTop =
          PADDING + NODE_H / 2 + (g - minGen) * ROW_GAP - ROW_GAP / 2;
        return { g, bandTop };
      });
  }, [generations, contentBounds, layout.nodes]);
  const genLabel = (g: number): string => {
    if (g === 0) return "Focus";
    if (g === 1) return "Children";
    if (g === 2) return "Grandchildren";
    if (g > 2) return `Gen +${g}`;
    if (g === -1) return "Parents";
    if (g === -2) return "Grandparents";
    if (g === -3) return "Great- grandparents";
    return `Gen ${g}`;
  };
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
          {memberNote && (
            <p className="text-[11px] leading-snug text-evergreen">{memberNote}</p>
          )}
          {shareNote && (
            <p className="text-[11px] leading-snug text-ink-soft/80">{shareNote}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {persons.length > 5 && (
            <TreeSearch persons={persons} onLocate={locatePerson} />
          )}
          {headerExtra}
          {editable && importHref && (
            <a
              href={importHref}
              className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
            >
              Import
            </a>
          )}
          {exportsOn && (
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
          {genRows.map(({ g, bandTop }) => (
            <g key={g}>
              <rect
                x={contentBounds ? contentBounds.minX - 190 : 0}
                y={bandTop}
                width={
                  contentBounds
                    ? contentBounds.maxX - contentBounds.minX + 250
                    : 0
                }
                height={ROW_GAP}
                fill="var(--color-evergreen)"
                opacity={g % 2 === 0 ? 0.05 : 0.02}
              />
              {contentBounds && (
                <text
                  x={contentBounds.minX - 24}
                  y={bandTop + ROW_GAP / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-ink-soft/70"
                  style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em" }}
                >
                  {genLabel(g)}
                </text>
              )}
            </g>
          ))}
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
                flash={highlightId === n.id}
                linked={!readOnly && p.redacted !== true}
                personHref={`${personBase}/person/${p.id}`}
                canEdit={editable}
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

/** Find-someone search: type a name, jump to the person. */
function TreeSearch({
  persons,
  onLocate,
}: {
  persons: CanvasPerson[];
  onLocate: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle === "") return [];
    return persons
      .filter((p) => !p.redacted)
      .filter((p) => displayName(p).toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, persons]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Find someone…"
        aria-label="Find someone in this tree"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // let the result button's click land before the dropdown closes
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            inputRef.current?.blur();
          } else if (e.key === "Enter" && results.length > 0) {
            onLocate(results[0].id);
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-8 w-32 rounded-lg border border-line bg-paper px-2.5 text-xs text-ink placeholder:text-ink-soft/60 focus:border-evergreen focus:outline-none sm:w-44"
      />
      {open && results.length > 0 && (
        <div className="shadow-float absolute right-0 top-9 z-40 w-60 rounded-xl border border-line bg-card p-1.5">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              // keep focus off the button until clicked, so blur timing is ours
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onLocate(p.id);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-evergreen-mist"
            >
              <span className="block truncate text-xs font-medium text-ink">
                {displayName(p)}
              </span>
              <span className="block truncate text-[10px] text-ink-soft">
                {lifeLine(p)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonNode({
  treeId,
  person,
  x,
  y,
  isFocus,
  hovered,
  flash = false,
  linked = true,
  personHref = null,
  canEdit = true,
  onHover,
  onQuickAdd,
}: {
  treeId: string;
  person: CanvasPerson;
  x: number;
  y: number;
  isFocus: boolean;
  hovered: boolean;
  /** Briefly ring this person (search "found them" moment). */
  flash?: boolean;
  /** Card is a link to the person page (share views: false). */
  linked?: boolean;
  /** Where the card links (set when linked). */
  personHref?: string | null;
  /** Quick-add pills + re-root button (owner/editor only). */
  canEdit?: boolean;
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

  // Quick-add pills sit in a compact 2×2 grid directly above the card,
  // within its width — the cursor can always reach them without leaving
  // the hover region (the old single row stuck out ~100 units past the
  // hit area and vanished mid-travel).
  const pills: { label: string; relation: Relation; x: number; y: number }[] = [
    { label: "+ father", relation: "father", x: 8, y: -52 },
    { label: "+ mother", relation: "mother", x: 88, y: -52 },
    { label: "+ spouse", relation: "spouse", x: 8, y: -26 },
    { label: "+ child", relation: "child", x: 88, y: -26 },
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
      {/* Resting hit area: the card plus a small margin — narrow enough
          never to steal hover from a neighbouring card (couple gap is 24). */}
      <rect x={-12} y={-20} width={NODE_W + 24} height={NODE_H + 48} fill="transparent" />
      {/* While hovered, an invisible halo bridges the card and everything
          that appeared because of the hover (pills above, center button
          below), so moving toward a control never drops the hover. It
          renders before the card so card clicks still land on the link. */}
      {hovered && canEdit && (
        <rect
          x={-16}
          y={-58}
          width={NODE_W + 32}
          height={NODE_H + 106}
          fill="transparent"
        />
      )}
      {linked && personHref ? (
        <a href={personHref}>{card}</a>
      ) : (
        <g>{card}</g>
      )}

      {flash && (
        <rect
          className="node-flash"
          x={-7}
          y={-7}
          width={NODE_W + 14}
          height={NODE_H + 14}
          rx={19}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={3}
        />
      )}

      {hovered && canEdit && (
        <g>
          {pills.map((pill) => (
            <g
              key={pill.relation}
              role="button"
              tabIndex={0}
              aria-label={`Add ${pill.relation} to ${name}`}
              transform={`translate(${pill.x}, ${pill.y})`}
              className="q-pill cursor-pointer"
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
              <rect width={76} height={24} rx={12} />
              <text x={38} y={15.5} textAnchor="middle" fontSize={10.5} fontWeight={500}>
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
