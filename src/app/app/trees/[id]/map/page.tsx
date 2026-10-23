import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { parentChild, personEvents, persons, placeGeocodes, trees, unions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { MapClient } from "@/components/map/MapClient";
import { classifyBranches } from "@/lib/timeline";
import { buildMapPaths, mapDecades, type MapEventRow } from "@/lib/map-view";
import { collectPlaceKeys, normalizePlaceKey, type GeocodeLike } from "@/lib/places";

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: treeId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const access = await getTreeAccess(treeId, user.id);
  if (!access) notFound();

  const treeRows = await db.select().from(trees).where(eq(trees.id, treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const allPersonRows = await db.select().from(persons).where(eq(persons.treeId, treeId));
  const allUnionRows = await db.select().from(unions).where(eq(unions.treeId, treeId));
  const allLinkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, treeId));

  // Branch-scoped membership: same filtering as the canvas/timeline pages
  const scopeId = (access as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let personRows = allPersonRows;
  let unionRows: { id: string; partnerAId: string; partnerBId: string | null }[] = allUnionRows;
  let linkRows: { unionId: string; childId: string }[] = allLinkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, allPersonRows, allUnionRows, allLinkRows);
    if (!branchIds || branchIds.size === 0) {
      personRows = [];
      unionRows = [];
      linkRows = [];
    } else {
      personRows = allPersonRows.filter((p) => branchIds.has(p.id));
      unionRows = filterUnionsByBranch(allUnionRows, branchIds);
      linkRows = filterLinksByBranch(allLinkRows, branchIds, unionRows);
    }
  }

  const personIdSet = new Set(personRows.map((p) => p.id));
  const eventRows: MapEventRow[] = personRows.length
    ? (await db
        .select()
        .from(personEvents)
        .innerJoin(persons, eq(personEvents.personId, persons.id))
        .where(eq(persons.treeId, treeId)))
        .map((r) => r.person_events)
        .filter((e) => personIdSet.has(e.personId))
        .map((e) => ({ personId: e.personId, kind: e.kind, placeText: e.placeText, dateText: e.dateText, createdAt: e.createdAt }))
    : [];

  // Geocode cache lookup for every distinct place in the visible set
  const placeTexts = [
    ...personRows.flatMap((p) => [p.birthPlace, p.deathPlace]),
    ...eventRows.map((e) => e.placeText),
  ];
  const keys = [...collectPlaceKeys(placeTexts)];
  const geoRows = keys.length
    ? await db.select().from(placeGeocodes).where(inArray(placeGeocodes.placeKey, keys))
    : [];
  const geocodeByKey = new Map<string, GeocodeLike & { displayName: string | null }>(
    geoRows.map((g) => [g.placeKey, { lat: g.lat, lng: g.lng, displayName: g.displayName }]),
  );

  const { paternal, maternal } = classifyBranches(
    personRows.map((p) => ({ id: p.id, gender: p.gender })),
    unionRows,
    linkRows,
    tree.focusPersonId ?? personRows[0]?.id ?? "",
  );

  const paths = buildMapPaths(personRows, eventRows, geocodeByKey, { paternal, maternal });
  const decades = mapDecades(paths);

  const originalByKey = new Map<string, string>();
  for (const t of placeTexts) {
    const trimmed = t?.trim();
    if (!trimmed) continue;
    const k = normalizePlaceKey(trimmed);
    if (k && !originalByKey.has(k)) originalByKey.set(k, trimmed);
  }
  const unmappedKeys = keys.filter((k) => !geocodeByKey.has(k));
  const unmappedSample = unmappedKeys.map((k) => originalByKey.get(k) ?? k).slice(0, 8);

  return (
    <MapClient
      treeId={treeId}
      treeName={tree.name}
      paths={paths}
      decades={decades}
      totalPlaces={keys.length}
      mappedPlaces={keys.length - unmappedKeys.length}
      unmappedSample={unmappedSample}
      canEdit={canEdit(access.role)}
      backHref={`/app/trees/${treeId}`}
    />
  );
}
