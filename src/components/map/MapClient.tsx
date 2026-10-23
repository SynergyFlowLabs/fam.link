"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type * as LType from "leaflet";
import "leaflet/dist/leaflet.css";
import { decadeStart } from "@/lib/places";

export interface MapStop {
  lat: number;
  lng: number;
  kind: string;
  label: string;
  placeText: string;
  displayName: string | null;
  dateText: string | null;
  year: number | null;
}

export interface MapPath {
  personId: string;
  personName: string;
  branch: "paternal" | "maternal" | "other";
  stops: MapStop[];
}

interface Props {
  treeId: string;
  treeName: string;
  paths: MapPath[];
  decades: string[];
  totalPlaces: number;
  mappedPlaces: number;
  unmappedSample: string[];
  canEdit: boolean;
  readOnly?: boolean;
  shareNote?: string | null;
  backHref: string;
}

const BRANCH_COLORS: Record<MapPath["branch"], string> = {
  paternal: "#2f5d50",
  maternal: "#b98a2f",
  other: "#8a9a95",
};

export function MapClient({
  treeId,
  treeName,
  paths,
  decades,
  totalPlaces,
  mappedPlaces,
  unmappedSample,
  canEdit,
  shareNote,
  backHref,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [branchFilter, setBranchFilter] = useState<Set<string>>(new Set());
  const [personFilter, setPersonFilter] = useState("");
  const [fromDecade, setFromDecade] = useState("");
  const [toDecade, setToDecade] = useState("");
  const [geoState, setGeoState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null });

  const filtered = useMemo(() => {
    const from = fromDecade ? decadeStart(fromDecade) : null;
    const to = toDecade ? (decadeStart(toDecade) ?? 0) + 9 : null;
    return paths
      .filter((p) => (branchFilter.size === 0 ? true : branchFilter.has(p.branch)))
      .filter((p) => (personFilter ? p.personId === personFilter : true))
      .map((p) => ({
        ...p,
        stops: p.stops.filter((s) => {
          if (from == null && to == null) return true;
          if (s.year == null) return false;
          if (from != null && s.year < from) return false;
          if (to != null && s.year > to) return false;
          return true;
        }),
      }))
      .filter((p) => p.stops.length > 0);
  }, [paths, branchFilter, personFilter, fromDecade, toDecade]);

  const pinCount = useMemo(() => new Set(filtered.flatMap((p) => p.stops.map((s) => `${s.lat},${s.lng}`))).size, [filtered]);

  // Mount leaflet lazily — tiles and the library load only on this view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default ?? (await import("leaflet"));
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L as typeof LType;
      const map = L.map(containerRef.current, {
        center: [30, 70],
        zoom: 4,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw pins + migration paths whenever filters or readiness change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];
    for (const path of filtered) {
      const color = BRANCH_COLORS[path.branch];
      const latlngs: [number, number][] = path.stops.map((s) => [s.lat, s.lng]);
      latlngs.forEach((ll) => bounds.push(ll));
      if (latlngs.length >= 2) {
        L.polyline(latlngs, {
          color: "#96574f",
          weight: 2,
          opacity: 0.75,
          dashArray: "6 6",
        }).addTo(layer);
      }
      path.stops.forEach((s, i) => {
        const marker = L.circleMarker([s.lat, s.lng], {
          radius: 6,
          color,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 0.9,
        });
        const when = s.dateText ? ` · ${s.dateText}` : "";
        marker.bindPopup(
          `<strong>${escapeHtml(path.personName)}</strong><br/>${escapeHtml(s.label)}: ${escapeHtml(s.placeText)}${escapeHtml(when)}<br/><span style="color:#666">${escapeHtml(s.displayName ?? "")}</span>`,
        );
        marker.addTo(layer);
        if (i === 0) {
          // birth / first stop gets a solid fill
          marker.setStyle({ fillColor: color });
        }
      });
    }
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }
  }, [filtered, mapReady]);

  async function runGeocode() {
    setGeoState({ busy: true, msg: null });
    try {
      const { geocodeTreePlacesAction } = await import("@/actions/geocode");
      const fd = new FormData();
      fd.set("treeId", treeId);
      const res = await geocodeTreePlacesAction(fd);
      setGeoState({
        busy: false,
        msg: res.ok ? res.message ?? "Done." : res.error ?? "Couldn't reach the geocoder — try again later.",
      });
      if (res.ok) router.refresh();
    } catch {
      setGeoState({ busy: false, msg: "Couldn't reach the geocoder — places stay unmapped, nothing broke." });
    }
  }

  const peopleOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of paths) seen.set(p.personId, p.personName);
    return [...seen.entries()];
  }, [paths]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2.5">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">{treeName} — Map</h1>
          <p className="text-xs text-ink-soft">
            {mappedPlaces} of {totalPlaces} place{totalPlaces === 1 ? "" : "s"} mapped · {pinCount} pin{pinCount === 1 ? "" : "s"} · {filtered.length} migration path{filtered.length === 1 ? "" : "s"}
            {shareNote ? ` · ${shareNote}` : ""}
          </p>
          {geoState.msg && <p className="text-[11px] text-evergreen-deep">{geoState.msg}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && unmappedSample.length > 0 && (
            <button
              type="button"
              onClick={runGeocode}
              disabled={geoState.busy}
              className="flex h-8 items-center rounded-lg border border-evergreen/40 bg-evergreen-mist px-2.5 text-xs font-medium text-evergreen-deep transition-colors hover:bg-evergreen hover:text-paper disabled:opacity-60"
            >
              {geoState.busy ? "Mapping…" : `Map places (${unmappedSample.length} unmapped)`}
            </button>
          )}
          <a href={backHref} className="flex h-8 items-center rounded-lg border border-line bg-card px-2.5 text-xs text-ink-soft hover:border-evergreen hover:text-evergreen">
            Back to tree
          </a>
        </div>
      </div>

      {/* Filter bar — same design language as canvas/timeline */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
        <div className="flex items-center gap-1">
          {(["paternal", "maternal", "other"] as const).map((br) => {
            const active = branchFilter.has(br);
            return (
              <button
                key={br}
                type="button"
                onClick={() =>
                  setBranchFilter((prev) => {
                    const n = new Set(prev);
                    if (n.has(br)) n.delete(br);
                    else n.add(br);
                    return n;
                  })
                }
                className={`h-8 rounded-lg border px-3 text-xs capitalize ${active ? "border-evergreen bg-evergreen-mist text-evergreen-deep" : "border-line bg-card text-ink-soft hover:border-evergreen hover:text-evergreen"}`}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: BRANCH_COLORS[br] }} aria-hidden />
                {br}
              </button>
            );
          })}
        </div>
        <select
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="h-8 min-w-32 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
          aria-label="Filter by person"
        >
          <option value="">All people</option>
          {peopleOptions.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-xs text-ink-soft">
          <span>From</span>
          <select
            value={fromDecade}
            onChange={(e) => setFromDecade(e.target.value)}
            className="h-8 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
            aria-label="From decade"
          >
            <option value="">start</option>
            {decades.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <span>to</span>
          <select
            value={toDecade}
            onChange={(e) => setToDecade(e.target.value)}
            className="h-8 rounded-lg border border-line bg-card px-2 text-xs text-ink focus:border-evergreen focus:outline-none"
            aria-label="To decade"
          >
            <option value="">now</option>
            {decades.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {(branchFilter.size > 0 || personFilter || fromDecade || toDecade) && (
          <button
            type="button"
            onClick={() => { setBranchFilter(new Set()); setPersonFilter(""); setFromDecade(""); setToDecade(""); }}
            className="text-xs text-ink-soft hover:text-evergreen"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" aria-label="Family place map" role="application" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/60 text-sm text-ink-soft">Loading map…</div>
        )}
        {mapReady && filtered.length === 0 && paths.length === 0 && (
          <div className="absolute inset-x-0 bottom-6 mx-auto max-w-md rounded-2xl border border-dashed border-line bg-card/95 p-5 text-center shadow-float">
            {mappedPlaces === 0 ? (
              <>
                <p className="text-sm font-medium text-ink">No places mapped yet</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Places stay free-form text — when one matches a real location, it earns a pin and migration lines connect birth → moves → death.
                  {canEdit && unmappedSample.length > 0 ? ` Try mapping: ${unmappedSample.slice(0, 3).join(", ")}.` : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">No pins match those filters</p>
                <p className="mt-1 text-xs text-ink-soft">Try clearing the branch or decade filters.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
