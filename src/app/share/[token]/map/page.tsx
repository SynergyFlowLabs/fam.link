import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { parentChild, personEvents, persons, placeGeocodes, trees, unions } from "@/db/schema";
import { getShareLinkByToken } from "@/lib/share";
import { MapClient } from "@/components/map/MapClient";
import { classifyBranches } from "@/lib/timeline";
import { buildMapPaths, mapDecades, type MapEventRow } from "@/lib/map-view";
import { collectPlaceKeys, type GeocodeLike } from "@/lib/places";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) return { title: "Shared map" };
  const rows = await db.select({ name: trees.name }).from(trees).where(eq(trees.id, link.treeId)).limit(1);
  return { title: `${rows[0]?.name ?? "Shared tree"} — Map`, robots: { index: false, follow: false } };
}

/**
 * Public read-only map for a share link — same capability token as the
 * canvas. Privacy: living relatives contribute NO pins and NO paths at all
 * (their places never leave the server). Scoped links see their branch only;
 * revoked or unknown tokens 404.
 */
export default async function SharedMapPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);
  if (!link) notFound();
  const treeRows = await db.select().from(trees).where(eq(trees.id, link.treeId)).limit(1);
  const tree = treeRows[0];
  if (!tree) notFound();

  const allPersonRows = await db.select().from(persons).where(eq(persons.treeId, link.treeId));
  const allUnionRows = await db.select().from(unions).where(eq(unions.treeId, link.treeId));
  const allLinkRows = await db
    .select({ unionId: parentChild.unionId, childId: parentChild.childId })
    .from(parentChild)
    .innerJoin(unions, eq(parentChild.unionId, unions.id))
    .where(eq(unions.treeId, link.treeId));

  const scopeId = (link as unknown as { scopePersonId?: string | null }).scopePersonId ?? null;
  let personRows = allPersonRows;
  let unionRows: { id: string; partnerAId: string; partnerBId: string | null }[] = allUnionRows;
  let linkRows: { unionId: string; childId: string }[] = allLinkRows;
  if (scopeId) {
    const { getBranchPersonIds, filterUnionsByBranch, filterLinksByBranch } = await import("@/lib/branch-scope");
    const branchIds = getBranchPersonIds(scopeId, allPersonRows, allUnionRows, allLinkRows);
    if (!branchIds || branchIds.size === 0) notFound();
    personRows = allPersonRows.filter((p) => branchIds.has(p.id));
    unionRows = filterUnionsByBranch(allUnionRows, branchIds);
    linkRows = filterLinksByBranch(allLinkRows, branchIds, unionRows);
  }

  // Living redaction first: living persons contribute nothing to the map.
  const visiblePersons = personRows.filter((p) => !p.living);
  const visibleIdSet = new Set(visiblePersons.map((p) => p.id));

  const eventRows: MapEventRow[] = visiblePersons.length
    ? (await db
        .select()
        .from(personEvents)
        .innerJoin(persons, eq(personEvents.personId, persons.id))
        .where(eq(persons.treeId, link.treeId)))
        .map((r) => r.person_events)
        .filter((e) => visibleIdSet.has(e.personId))
        .map((e) => ({ personId: e.personId, kind: e.kind, placeText: e.placeText, dateText: e.dateText, createdAt: e.createdAt }))
    : [];

  const placeTexts = [
    ...visiblePersons.flatMap((p) => [p.birthPlace, p.deathPlace]),
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

  const paths = buildMapPaths(visiblePersons, eventRows, geocodeByKey, { paternal, maternal });
  const decades = mapDecades(paths);

  const shareBranchNote = scopeId
    ? "Shared branch view — living relatives kept private."
    : "Shared read-only view — living relatives are kept private.";

  return (
    <MapClient
      treeId={link.treeId}
      treeName={tree.name}
      paths={paths}
      decades={decades}
      totalPlaces={keys.length}
      mappedPlaces={keys.filter((k) => geocodeByKey.has(k)).length}
      unmappedSample={[]}
      canEdit={false}
      readOnly
      shareNote={shareBranchNote}
      backHref={`/share/${token}`}
    />
  );
}
