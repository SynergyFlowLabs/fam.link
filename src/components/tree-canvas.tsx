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
import { layoutWithKind, LAYOUT_KINDS, LAYOUT_LABEL, type LayoutKind } from "@/lib/layout/strategies";
import { coupleEdgeD, parentChildEdgeD } from "@/lib/layout/edges";
import {
  displayName,
  lifeLine,
  REDACTED_NAME,
  type CanvasLink,
  type CanvasPerson,
  type CanvasUnion,
} from "@/lib/canvas-types";
import { labelColorFor } from "@/lib/labels";
import { breadcrumbNames, describeRelationship, findRelationshipPath, searchPersons, type SearchHit } from "@/lib/search";
import { relationLabel, relationStrokeProps } from "@/lib/layout/edges";
import type { RelationKind } from "@/lib/canvas-types";
import { setFocusPersonAction } from "@/actions/persons";
import { buildCollapseGraph, getDescendantBranchIds, branchCount, getVisibleIds, isInViewport, collapsedAncestorsOf } from "@/lib/collapse-store";
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
  /** Labels defined in this tree (for filtering). */
  labelDefs?: { id: string; name: string; color: string | null }[];
  /** Custom field defs in this tree (for filtering). */
  fieldDefs?: { id: string; name: string; kind: "text"|"number"|"date"|"select"; optionsJson: string | null }[];
}

const MIN_W = 360;
const COMPACT_W = 120;
const COMPACT_H = 52;
function layoutDims(compact: boolean) {
  return compact ? { NODE_W: COMPACT_W, NODE_H: COMPACT_H } : { NODE_W, NODE_H };
}

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
  labelDefs = [],
  fieldDefs = [],
}: Props) {
  const editable = canEdit ?? !readOnly;
  const exportsOn = showExport ?? !readOnly;
  const [layoutKind, setLayoutKind] = useState<LayoutKind>("hourglass");
  const [compact, setCompact] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [collapsedLoaded, setCollapsedLoaded] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const k = params.get("layout") as LayoutKind | null;
      if (k && (LAYOUT_KINDS as string[]).includes(k)) setLayoutKind(k);
      const c = params.get("compact");
      if (c === "1") setCompact(true);
      const saved = localStorage.getItem("famlink:layout");
      if (saved && (LAYOUT_KINDS as string[]).includes(saved) && !k) setLayoutKind(saved as LayoutKind);
      const savedC = localStorage.getItem("famlink:compact");
      if (savedC === "1" && !c) setCompact(true);
      const savedCollapsed = localStorage.getItem(`famlink:collapsed:${treeId}`);
      if (savedCollapsed) {
        try { const arr = JSON.parse(savedCollapsed); if (Array.isArray(arr)) setCollapsedIds(new Set(arr)); } catch {}
      }
    } catch {}
    setCollapsedLoaded(true);
  }, [treeId]);
  useEffect(() => {
    try {
      localStorage.setItem("famlink:layout", layoutKind);
      localStorage.setItem("famlink:compact", compact ? "1" : "0");
      const params = new URLSearchParams(window.location.search);
      params.set("layout", layoutKind);
      if (compact) params.set("compact", "1"); else params.delete("compact");
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    } catch {}
  }, [layoutKind, compact]);
  useEffect(() => {
    if (!collapsedLoaded) return;
    try { localStorage.setItem(`famlink:collapsed:${treeId}`, JSON.stringify([...collapsedIds])); } catch {}
  }, [collapsedIds, treeId, collapsedLoaded]);
  // Collapse: build graph from original (unfiltered) persons so branches include future hidden persons
  const collapseGraph = useMemo(() => buildCollapseGraph({ unions, links }), [unions, links]);
  const parentUnionsByChild = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      const list = m.get(l.childId) ?? [];
      if (!list.includes(l.unionId)) list.push(l.unionId);
      m.set(l.childId, list);
    }
    return m;
  }, [links]);
  const partnerOfForAncestors = useCallback((uid: string) => {
    const u = unions.find((x) => x.id === uid);
    if (!u) return [];
    return u.partnerBId ? [u.partnerAId, u.partnerBId] : [u.partnerAId];
  }, [unions]);

  const visibleIds = useMemo(() => getVisibleIds(persons.map((p) => p.id), collapsedIds, collapseGraph), [persons, collapsedIds, collapseGraph]);
  const visiblePersons = useMemo(() => persons.filter((p) => visibleIds.has(p.id)), [persons, visibleIds]);
  const visibleUnions = useMemo(() => unions.filter((u) => {
    const aVis = visibleIds.has(u.partnerAId);
    const bVis = u.partnerBId ? visibleIds.has(u.partnerBId) : true;
    // keep union if all its partners are visible (couple edge needs both)
    if (u.partnerBId) return aVis && bVis;
    return aVis;
  }), [unions, visibleIds]);
  const visibleLinks = useMemo(() => links.filter((l) => visibleIds.has(l.childId) && visibleUnions.some((u) => u.id === l.unionId)), [links, visibleIds, visibleUnions]);
  const visibleUnionIds = useMemo(() => new Set(visibleUnions.map((u) => u.id)), [visibleUnions]);

  const layout: LayoutResult = useMemo(
    () =>
      layoutWithKind(
        {
          persons: visiblePersons.map((p) => ({
            id: p.id,
            birthHint: p.birthDateText,
          })),
          unions: visibleUnions,
          links: visibleLinks,
          focusPersonId: visibleIds.has(focusPersonId) ? focusPersonId : (visiblePersons[0]?.id ?? focusPersonId),
        },
        layoutKind,
        compact,
      ),
    [visiblePersons, visibleUnions, visibleLinks, focusPersonId, visibleIds, layoutKind, compact],
  );
  const dims = layoutDims(compact);
  const personById = useMemo(
    () => new Map(persons.map((p) => [p.id, p])),
    [persons],
  );
  const visiblePersonById = useMemo(() => new Map(visiblePersons.map((p) => [p.id, p])), [visiblePersons]);
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
      minX = Math.min(minX, n.x - dims.NODE_W / 2);
      maxX = Math.max(maxX, n.x + dims.NODE_W / 2);
      minY = Math.min(minY, n.y - dims.NODE_H / 2);
      maxY = Math.max(maxY, n.y + dims.NODE_H / 2);
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
      // auto-expand collapsed ancestors if target is hidden
      if (!visibleIds.has(id)) {
        const ancestors = collapsedAncestorsOf(id, collapsedIds, parentUnionsByChild, partnerOfForAncestors);
        if (ancestors.length > 0) {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            for (const a of ancestors) next.delete(a);
            return next;
          });
          // will re-render with new visible set; locate after next frame
          setTimeout(() => {
            const node2 = layout.nodes.find((n) => n.id === id);
            if (node2) {
              const h2 = view.w * aspect;
              setView(clampView(node2.x - view.w / 2, node2.y - h2 / 2, view.w));
              setHighlightId(id);
              if (highlightTimer.current) clearTimeout(highlightTimer.current);
              highlightTimer.current = setTimeout(() => setHighlightId(null), 2200);
            }
          }, 80);
          return;
        }
      }
      const node = layout.nodes.find((n) => n.id === id);
      if (!node) return;
      const h = view.w * aspect;
      setView(clampView(node.x - view.w / 2, node.y - h / 2, view.w));
      setHighlightId(id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 2200);
    },
    [layout.nodes, view.w, aspect, clampView, visibleIds, collapsedIds, parentUnionsByChild, partnerOfForAncestors],
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
  const totalMemories = visiblePersons.reduce((s, p) => s + p.memoryCount, 0);
  const visibleCount = visiblePersons.length;
  const hiddenCount = persons.length - visibleCount;
  const focusPerson = personById.get(focusPersonId);

  const hasChildren = useCallback((id: string) => {
    for (const uid of collapseGraph.unionsByPerson.get(id) ?? []) {
      const kids = collapseGraph.childrenByUnion.get(uid) ?? [];
      if (kids.length > 0) return true;
    }
    return false;
  }, [collapseGraph]);
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapsedChips = useMemo(() => {
    const chips: { id: string; count: number; x: number; y: number }[] = [];
    for (const cid of collapsedIds) {
      if (!visibleIds.has(cid)) continue; // hidden by ancestor, don't show chip
      const node = layout.nodes.find((n) => n.id === cid);
      if (!node) continue;
      const cnt = branchCount(cid, collapseGraph);
      chips.push({ id: cid, count: cnt, x: node.x, y: node.y + dims.NODE_H / 2 + 16 });
    }
    return chips;
  }, [collapsedIds, visibleIds, layout.nodes, collapseGraph, dims]);

  // ----- filters (labels + custom fields) -----
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [fieldQuery, setFieldQuery] = useState<string>("");
  const [hiddenRelations, setHiddenRelations] = useState<Set<RelationKind>>(new Set());
  const toggleRelation = (k: RelationKind) => {
    setHiddenRelations((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // URL query persistence for faceted filters (shareable): ?label=&field=&q=
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const l = params.get("label");
      const f = params.get("field");
      const q = params.get("fq");
      if (l) setLabelFilter(l);
      if (f) setFieldFilter(f);
      if (q) setFieldQuery(q);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (labelFilter) params.set("label", labelFilter); else params.delete("label");
      if (fieldFilter) params.set("field", fieldFilter); else params.delete("field");
      if (fieldQuery) params.set("fq", fieldQuery); else params.delete("fq");
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    } catch {}
  }, [labelFilter, fieldFilter, fieldQuery]);

  const filteredCount = useMemo(() => {
    if (!labelFilter && !fieldFilter) return null;
    return persons.filter((p) => {
      if (labelFilter) {
        const has = (p.labels ?? []).some((l) => l.name.toLowerCase() === labelFilter.toLowerCase());
        // __unlabeled special
        if (labelFilter === "__unlabeled") {
          if ((p.labels ?? []).length !== 0) return false;
        } else if (!has) return false;
      }
      if (fieldFilter) {
        const vals = p.customFields ?? [];
        const fieldName = fieldDefs.find((f) => f.id === fieldFilter)?.name ?? fieldFilter;
        const wanted = fieldQuery.trim().toLowerCase();
        if (wanted) {
          const match = vals.some((v) => v.fieldName.toLowerCase() === fieldName.toLowerCase() && v.value.toLowerCase().includes(wanted));
          if (!match) return false;
        } else {
          const hasField = vals.some((v) => v.fieldId === fieldFilter || v.fieldName.toLowerCase() === fieldName.toLowerCase());
          if (!hasField) return false;
        }
      }
      return true;
    }).length;
  }, [persons, labelFilter, fieldFilter, fieldQuery, fieldDefs]);


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
            {visibleCount} {visibleCount === 1 ? "person" : "people"}{hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""} ·{" "}
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
          <LayoutSwitcher kind={layoutKind} onKind={setLayoutKind} compact={compact} onCompact={setCompact} />
          {collapsedIds.size > 0 && (
            <button type="button" onClick={expandAll} className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen">Expand all ({collapsedIds.size})</button>
          )}
          {persons.length > 5 && (
            <TreeSearch persons={persons} onLocate={locatePerson} />
          )}
          {persons.length > 2 && (
            <RelationshipFinder persons={persons} unions={unions} links={links} onHighlight={(ids) => {
              if (ids.length === 0) return;
              const id = ids[0];
              locatePerson(id);
              // briefly highlight the whole path via flash cycle
              let i = 0;
              const timer = setInterval(() => {
                if (i >= ids.length) { clearInterval(timer); return; }
                setHighlightId(ids[i]);
                i++;
              }, 500);
              setTimeout(() => clearInterval(timer), ids.length * 600 + 1000);
            }} />
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
          {(labelDefs.length > 0 || fieldDefs.length > 0) && (
            <CanvasFilter
              labelDefs={labelDefs}
              fieldDefs={fieldDefs}
              labelFilter={labelFilter}
              onLabelFilter={setLabelFilter}
              fieldFilter={fieldFilter}
              fieldQuery={fieldQuery}
              onFieldFilter={setFieldFilter}
              onFieldQuery={setFieldQuery}
              filteredCount={filteredCount}
              totalCount={persons.length}
            />
          )}
          <RelationLegend hidden={hiddenRelations} onToggle={toggleRelation} />
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
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "*" && hoverId) {
              // expand all siblings at same generation as hovered
              const hoverGen = layout.nodes.find((x) => x.id === hoverId)?.generation;
              if (hoverGen !== undefined) {
                const siblingsAtGen = layout.nodes.filter((x) => x.generation === hoverGen).map((x) => x.id);
                let changed = false;
                setCollapsedIds((prev) => {
                  const next = new Set(prev);
                  for (const sid of siblingsAtGen) {
                    if (next.has(sid)) { next.delete(sid); changed = true; }
                  }
                  return changed ? next : prev;
                });
              }
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
              const visibleOrder = layout.nodes.map((x) => x.id);
              const idx = hoverId ? visibleOrder.indexOf(hoverId) : -1;
              let nextIdx = idx;
              if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIdx = Math.min(visibleOrder.length - 1, idx + 1);
              if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIdx = Math.max(0, idx - 1);
              if (nextIdx !== idx && nextIdx >= 0) {
                e.preventDefault();
                const nid = visibleOrder[nextIdx];
                setHoverId(nid);
                locatePerson(nid);
              }
            }
          }}
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
            unions={visibleUnions}
            links={visibleLinks}
            nodeById={nodeById}
            unionById={unionById}
            hiddenRelations={hiddenRelations}
            nodeW={dims.NODE_W}
            nodeH={dims.NODE_H}
          />
          {/* Collapsed branch chips */}
          {collapsedChips.map((chip) => (
            <g key={`chip-${chip.id}`} transform={`translate(${chip.x}, ${chip.y})`} className="cursor-pointer" role="button" tabIndex={0} aria-expanded={false} aria-label={`Expand ${chip.count} hidden people under ${personById.get(chip.id)?.firstName ?? chip.id}`} onClick={() => toggleCollapse(chip.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCollapse(chip.id); } }}>
              <rect x={-46} y={-12} width={92} height={24} rx={12} fill="var(--color-evergreen-mist)" stroke="var(--color-evergreen)" strokeWidth={1} />
              <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-evergreen-deep)">{chip.count} hidden · expand</text>
            </g>
          ))}
          {layout.nodes.filter((n) => {
            if (visiblePersons.length < 500) return true;
            const h = view.w * aspect;
            const vp = { x: view.x, y: view.y, w: view.w, h };
            return isInViewport({ x: n.x, y: n.y }, vp, 300);
          }).map((n) => {
            const p = personById.get(n.id);
            if (!p) return null;
            const isFiltered =
              labelFilter || fieldFilter
                ? (() => {
                    if (labelFilter) {
                      if (labelFilter === "__unlabeled") {
                        if ((p.labels ?? []).length !== 0) return false;
                      } else {
                        const has = (p.labels ?? []).some((l) => l.name.toLowerCase() === labelFilter.toLowerCase());
                        if (!has) return false;
                      }
                    }
                    if (fieldFilter) {
                      const fieldName = fieldDefs.find((f) => f.id === fieldFilter)?.name ?? "";
                      const vals = p.customFields ?? [];
                      if (fieldQuery.trim()) {
                        const q = fieldQuery.trim().toLowerCase();
                        const match = vals.some((v) => (v.fieldId === fieldFilter || v.fieldName.toLowerCase() === fieldName.toLowerCase()) && v.value.toLowerCase().includes(q));
                        if (!match) return false;
                      } else {
                        const hasField = vals.some((v) => v.fieldId === fieldFilter || v.fieldName.toLowerCase() === fieldName.toLowerCase());
                        if (!hasField) return false;
                      }
                    }
                    return true;
                  })()
                : true;
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
                dimmed={!isFiltered}
                compact={compact}
                isList={layoutKind === "list"}
                hasChildren={hasChildren(n.id)}
                collapsed={collapsedIds.has(n.id)}
                onToggleCollapse={() => toggleCollapse(n.id)}
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

function LayoutSwitcher({ kind, onKind, compact, onCompact }: { kind: LayoutKind; onKind: (k: LayoutKind) => void; compact: boolean; onCompact: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1">
      <select value={kind} onChange={(e) => onKind(e.target.value as LayoutKind)} className="h-8 rounded-lg border border-line bg-paper px-2 text-xs text-ink focus:border-evergreen focus:outline-none" title="Layout" aria-label="Layout">
        {LAYOUT_KINDS.map((k) => (
          <option key={k} value={k}>{LAYOUT_LABEL[k]}</option>
        ))}
      </select>
      <button type="button" onClick={() => onCompact(!compact)} aria-pressed={compact} title={compact ? "Compact on" : "Compact off"} className={`h-8 rounded-lg border px-2 text-xs ${compact ? "border-evergreen bg-evergreen-mist text-evergreen-deep" : "border-line bg-paper text-ink-soft"}`}>Compact</button>
    </div>
  );
}

function RelationLegend({ hidden, onToggle }: { hidden: Set<RelationKind>; onToggle: (k: RelationKind) => void }) {
  const items: { kind: RelationKind; label: string; dash: string }[] = [
    { kind: "biological", label: "Biological", dash: "solid" },
    { kind: "adoptive", label: "Adopted", dash: "8 5" },
    { kind: "step", label: "Step", dash: "4 6" },
    { kind: "foster", label: "Foster", dash: "2 5" },
  ];
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen">Legend</summary>
      <div className="shadow-float absolute left-1/2 top-9 z-40 w-56 -translate-x-1/2 rounded-xl border border-line bg-card p-3">
        <p className="text-xs font-medium text-ink">Relationship lines</p>
        <ul className="mt-2 space-y-1.5">
          {items.map((it) => {
            const isHidden = hidden.has(it.kind);
            return (
              <li key={it.kind} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  <svg width={24} height={10} className="shrink-0"><line x1={0} y1={5} x2={24} y2={5} stroke="var(--color-ink-soft)" strokeWidth={1.5} strokeDasharray={it.dash === "solid" ? undefined : it.dash} /></svg>
                  {it.label}
                </span>
                <button type="button" onClick={() => onToggle(it.kind)} className={`rounded-full border px-2 py-0.5 text-[11px] ${isHidden ? "border-line bg-paper text-ink-soft" : "border-evergreen bg-evergreen-mist text-evergreen-deep"}`}>{isHidden ? "Hidden" : "Shown"}</button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">Dashed/dotted edges distinguish adoptive, step & foster ties. Toggle to dim them without moving the tree.</p>
      </div>
    </details>
  );
}

function Edges({
  unions,
  links,
  nodeById,
  unionById,
  hiddenRelations,
  nodeW = NODE_W,
  nodeH = NODE_H,
}: {
  unions: CanvasUnion[];
  links: CanvasLink[];
  nodeById: Map<string, { x: number; y: number }>;
  unionById: Map<string, CanvasUnion>;
  hiddenRelations?: Set<RelationKind>;
  nodeW?: number;
  nodeH?: number;
}) {
  return (
    <g
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {unions.map((u) => {
        const a = nodeById.get(u.partnerAId);
        const b = u.partnerBId ? nodeById.get(u.partnerBId) : null;
        if (!a || !b) return null;
        // Dim multi-spouse couples slightly? Already same style — keep solid for now.
        return <path key={`c-${u.id}`} d={coupleEdgeD(a, b, nodeW)} stroke="var(--color-ink-soft)" strokeWidth={1.5} opacity={0.55} />;
      })}
      {links.map((l) => {
        const u = unionById.get(l.unionId);
        const child = nodeById.get(l.childId);
        if (!u || !child) return null;
        const rel = (l as unknown as { relation?: RelationKind }).relation ?? "biological";
        const isHidden = hiddenRelations?.has(rel);
        const { strokeDasharray } = relationStrokeProps(rel);
        const a = nodeById.get(u.partnerAId);
        const b = u.partnerBId ? nodeById.get(u.partnerBId) : null;
        let sx: number;
        let sy: number;
        if (a && b) {
          sx = (a.x + b.x) / 2;
          sy = a.y + 1;
        } else if (a || b) {
          const single = (a ?? b) as { x: number; y: number };
          sx = single.x;
          sy = single.y + nodeH / 2 + 3;
        } else {
          return null;
        }
        const ty = child.y - nodeH / 2 - 1;
        const d = parentChildEdgeD(sx, sy, child.x, ty);
        const label = relationLabel(rel);
        return (
          <g key={`p-${l.unionId}-${l.childId}`} opacity={isHidden ? 0.15 : 0.62}>
            <path d={d} stroke="var(--color-ink-soft)" strokeWidth={1.5} strokeDasharray={strokeDasharray} aria-label={`${label} child link`} />
          </g>
        );
      })}
    </g>
  );
}

/** Find-someone search: type a name, jump to the person. */
function CanvasFilter({
  labelDefs,
  fieldDefs,
  labelFilter,
  onLabelFilter,
  fieldFilter,
  fieldQuery,
  onFieldFilter,
  onFieldQuery,
  filteredCount,
  totalCount,
}: {
  labelDefs: { id: string; name: string; color: string | null }[];
  fieldDefs: { id: string; name: string; kind: string; optionsJson: string | null }[];
  labelFilter: string | null;
  onLabelFilter: (v: string | null) => void;
  fieldFilter: string | null;
  fieldQuery: string;
  onFieldFilter: (v: string | null) => void;
  onFieldQuery: (v: string) => void;
  filteredCount: number | null;
  totalCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {labelDefs.length > 0 && (
        <select
          value={labelFilter ?? ""}
          onChange={(e) => onLabelFilter(e.target.value || null)}
          className="h-8 rounded-lg border border-line bg-paper px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
          title="Filter by label"
        >
          <option value="">All labels</option>
          <option value="__unlabeled">Unlabeled</option>
          {labelDefs.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      {fieldDefs.length > 0 && (
        <select
          value={fieldFilter ?? ""}
          onChange={(e) => onFieldFilter(e.target.value || null)}
          className="h-8 rounded-lg border border-line bg-paper px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
          title="Filter by field"
        >
          <option value="">All fields</option>
          {fieldDefs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.kind})
            </option>
          ))}
        </select>
      )}
      {fieldFilter && (
        <input
          type="text"
          value={fieldQuery}
          onChange={(e) => onFieldQuery(e.target.value)}
          placeholder="value contains…"
          className="h-8 w-24 rounded-lg border border-line bg-paper px-2 text-xs placeholder:text-ink-soft/50 focus:border-evergreen focus:outline-none"
        />
      )}
      {(labelFilter || fieldFilter) && (
        <span className="rounded-full bg-evergreen-mist px-2 py-1 text-[11px] font-medium text-evergreen-deep">
          {filteredCount} / {totalCount}
        </span>
      )}
      {(labelFilter || fieldFilter) && (
        <button
          type="button"
          onClick={() => {
            onLabelFilter(null);
            onFieldFilter(null);
            onFieldQuery("");
          }}
          className="text-xs text-ink-soft hover:text-evergreen"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function TreeSearch({
  persons,
  onLocate,
}: {
  persons: CanvasPerson[];
  onLocate: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 150);
    return () => clearTimeout(t);
  }, [q]);

  const hits: SearchHit[] = useMemo(() => {
    if (!debouncedQ.trim()) return [];
    // Map CanvasPerson -> SearchablePerson
    return searchPersons(
      debouncedQ,
      persons.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        alsoKnownAs: p.alsoKnownAs,
        birthPlace: p.birthPlace,
        deathPlace: p.deathPlace,
        birthDateText: p.birthDateText,
        deathDateText: p.deathDateText,
        labels: p.labels?.map((l) => ({ name: l.name })) ?? [],
        customFields: p.customFields?.map((c) => ({ fieldName: c.fieldName, value: c.value })) ?? [],
        // events not on canvas yet - could be added later
        redacted: p.redacted === true,
      })),
      { limit: 8 }
    );
  }, [debouncedQ, persons]);

  const hitPersons = useMemo(() => {
    const byId = new Map(persons.map((p) => [p.id, p]));
    return hits.map((h) => ({ hit: h, person: byId.get(h.id)! })).filter((x) => x.person);
  }, [hits, persons]);

  useEffect(() => setActive(0), [hits]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Find by name, place, label, field…"
        aria-label="Find someone in this tree"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            inputRef.current?.blur();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hitPersons.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hitPersons.length > 0) {
            const sel = hitPersons[active] ?? hitPersons[0];
            onLocate(sel.person.id);
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-8 w-36 rounded-lg border border-line bg-paper px-2.5 text-xs text-ink placeholder:text-ink-soft/60 focus:border-evergreen focus:outline-none sm:w-52"
      />
      {/* a11y result count */}
      <span role="status" aria-live="polite" className="sr-only">
        {hitPersons.length > 0 ? `${hitPersons.length} results for ${q}` : ""}
      </span>
      {open && hitPersons.length > 0 && (
        <div className="shadow-float absolute right-0 top-9 z-40 w-64 rounded-xl border border-line bg-card p-1.5">
          {hitPersons.map(({ hit, person }, idx) => (
            <button
              key={person.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onLocate(person.id);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left transition-colors ${idx === active ? "bg-evergreen-mist" : "hover:bg-evergreen-mist"}`}
            >
              <span className="block truncate text-xs font-medium text-ink">
                {displayName(person)}
              </span>
              <span className="block truncate text-[10px] text-ink-soft">
                {lifeLine(person)} {hit.matchedField ? `· matched ${hit.matchedField}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipFinder({
  persons,
  unions,
  links,
  onHighlight,
}: {
  persons: CanvasPerson[];
  unions: { id: string; partnerAId: string; partnerBId: string | null }[];
  links: { unionId: string; childId: string }[];
  onHighlight: (ids: string[]) => void;
}) {
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const path = useMemo(() => {
    if (!a || !b) return null;
    return findRelationshipPath(a, b, unions as never, links as never);
  }, [a, b, unions, links]);
  const description = useMemo(() => {
    if (!path || !a || !b) return null;
    const byId = new Map(persons.map((p) => [p.id, p as never]));
    return describeRelationship(a, b, path, byId as never);
  }, [path, a, b, persons]);
  const breadcrumb = useMemo(() => {
    if (!path) return null;
    const byId = new Map(persons.map((p) => [p.id, p as never]));
    return breadcrumbNames(path, byId as never);
  }, [path, persons]);

  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-lg border border-line px-2.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen">
        Relate
      </summary>
      <div className="shadow-float absolute left-1/2 top-9 z-40 w-80 -translate-x-1/2 rounded-xl border border-line bg-card p-3">
        <p className="text-xs font-medium text-ink">How are they related?</p>
        <p className="mt-0.5 text-[11px] text-ink-soft">Pick two people — we&apos;ll trace the shortest path.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="input h-8 text-xs">
            <option value="">Person A</option>
            {persons.filter((p) => !p.redacted).map((p) => (
              <option key={p.id} value={p.id}>{displayName(p)}</option>
            ))}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="input h-8 text-xs">
            <option value="">Person B</option>
            {persons.filter((p) => !p.redacted).map((p) => (
              <option key={p.id} value={p.id}>{displayName(p)}</option>
            ))}
          </select>
        </div>
        {path && (
          <div className="mt-3 rounded-lg bg-evergreen-mist/50 px-3 py-2">
            <p className="text-xs font-medium text-evergreen-deep">{description}</p>
            {breadcrumb && (
              <p className="mt-1 text-[11px] text-ink-soft">{breadcrumb.join(" › ")}</p>
            )}
            {path.ids.length > 0 && (
              <button type="button" onClick={() => onHighlight(path.ids)} className="mt-2 text-xs text-evergreen hover:underline">Highlight path on canvas</button>
            )}
          </div>
        )}
        {a && b && !path && <p className="mt-2 text-xs text-rosewood">No relationship found in this tree</p>}
      </div>
    </details>
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
  dimmed = false,
  compact = false,
  isList = false,
  hasChildren = false,
  collapsed = false,
  onToggleCollapse,
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
  dimmed?: boolean;
  compact?: boolean;
  isList?: boolean;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onHover: (id: string | null) => void;
  onQuickAdd: (relation: Relation) => void;
}) {
  const [focusPending, startFocusTransition] = useTransition();
  const dims = compact ? { W: COMPACT_W, H: COMPACT_H } : { W: NODE_W, H: NODE_H };
  const redacted = person.redacted === true;
  const name = redacted ? REDACTED_NAME : displayName(person);
  const isUnknown = !redacted && name === "Unknown";
  const dates = lifeLine(person);
  const left = x - dims.W / 2;
  const top = y - dims.H / 2;

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
        width={dims.W}
        height={dims.H}
        rx={14}
        fill={isUnknown ? "transparent" : "var(--color-card)"}
        stroke={isFocus ? "var(--color-evergreen)" : isUnknown ? "var(--color-ink-soft)" : "var(--color-line)"}
        strokeWidth={isFocus ? 2.5 : 1.5}
        strokeDasharray={isUnknown ? "5 5" : undefined}
      />
      <text
        x={dims.W / 2}
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
      <text x={dims.W / 2} y={48} textAnchor="middle" fontSize={10.5} fill="var(--color-ink-soft)" opacity={0.85}>
        {dates}
      </text>
      {person.memoryCount > 0 && (
        <text x={dims.W - 12} y={22} textAnchor="end" fontSize={11} fill="var(--color-gold)">
          ✻ {person.memoryCount}
        </text>
      )}
    </>
  );

  const labelDots = (person.labels ?? []).slice(0, 4);
  return (
    <g
      data-node
      transform={`translate(${left}, ${top})`}
      onMouseEnter={() => onHover(person.id)}
      onMouseLeave={() => onHover(null)}
      opacity={dimmed ? 0.18 : 1}
      tabIndex={isList ? 0 : undefined}
      role={isList ? "listitem" : undefined}
      onKeyDown={isList ? (e) => { if (e.key === "Enter" && linked && personHref) window.location.href = personHref; } : undefined}
      style={isList ? { outline: "none" } : undefined}
    >
      {/* Resting hit area: the card plus a small margin — narrow enough
          never to steal hover from a neighbouring card (couple gap is 24). */}
      <rect x={-12} y={-20} width={dims.W + 24} height={dims.H + 48} fill="transparent" />
      {/* While hovered, an invisible halo bridges the card and everything
          that appeared because of the hover (pills above, center button
          below), so moving toward a control never drops the hover. It
          renders before the card so card clicks still land on the link. */}
      {hovered && canEdit && (
        <rect
          x={-16}
          y={-58}
          width={dims.W + 32}
          height={dims.H + 106}
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
          width={dims.W + 14}
          height={dims.H + 14}
          rx={19}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={3}
        />
      )}
      {labelDots.length > 0 && (
        <g transform={`translate(${dims.W / 2 - (labelDots.length * 8) / 2}, ${dims.H + 4})`}>
          {labelDots.map((lb, i) => (
            <circle key={lb.id} cx={i * 8 + 4} cy={0} r={3.2} fill={labelColorFor(lb.name, lb.color)} stroke="white" strokeWidth={0.7} />
          ))}
        </g>
      )}
      {!dimmed && person.customFields && person.customFields.length > 0 && (
        <g transform={`translate(${dims.W - 8}, 6)`}>
          <circle r={4} fill="var(--color-gold)" opacity={0.9} />
          <text textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="white" fontWeight={700}>
            ·
          </text>
        </g>
      )}

      {hasChildren && (
        <g transform={`translate(${dims.W - 14}, -10)`} className="cursor-pointer" role="button" tabIndex={0} aria-expanded={!collapsed} aria-label={collapsed ? `Expand branch` : `Collapse branch` } onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCollapse?.(); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleCollapse?.(); } }}>
          <circle r={10} fill={collapsed ? "var(--color-evergreen)" : "var(--color-card)"} stroke="var(--color-evergreen)" strokeWidth={1.2} />
          <text x={0} y={3.5} textAnchor="middle" fontSize={12} fill={collapsed ? "white" : "var(--color-evergreen)"} fontWeight={600}>{collapsed ? "▸" : "▾"}</text>
        </g>
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
              transform={`translate(${dims.W / 2 - 45}, ${dims.H + 9})`}
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
