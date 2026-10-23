"use server";

/**
 * Best-effort geocoding (issue #29, P2.4).
 *
 * Collects the tree's distinct free-text places and asks Nominatim
 * (OpenStreetMap) for coordinates, caching successes in `place_geocodes`
 * keyed by the normalized place text. Hard rules:
 *  - never blocks or errors on a single failed lookup — the place simply
 *    stays unmapped ("Place not mapped" in the UI);
 *  - rate-limited (≥1.1s between requests, Nominatim usage policy) and
 *    capped per invocation so one click can't hammer the API;
 *  - coordinates are NEVER user-entered; this action is the only writer.
 */

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { personEvents, persons, placeGeocodes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTreeAccess } from "@/lib/access";
import { collectPlaceKeys } from "@/lib/places";
import type { ActionResult } from "@/lib/action-result";

/** Per-invocation cap — rerun for more; keeps us inside Nominatim policy. */
const MAX_LOOKUPS_PER_RUN = 12;
const REQUEST_DELAY_MS = 1100;
const REQUEST_TIMEOUT_MS = 5000;

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string | null;
}

async function fetchGeocode(placeText: string): Promise<GeoResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", placeText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim usage policy requires a identifying User-Agent
        "User-Agent": "fam.link/0.1 (family tree mapping; +https://fam.link)",
        Accept: "application/json",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
    const hit = rows[0];
    const lat = hit?.lat != null ? parseFloat(hit.lat) : NaN;
    const lng = hit?.lon != null ? parseFloat(hit.lon) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, displayName: hit?.display_name ?? null };
  } catch {
    // network error / timeout / parse — best-effort: stay unmapped
    return null;
  }
}

export async function geocodeTreePlacesAction(
  formData: FormData,
): Promise<ActionResult> {
  const treeId = String(formData.get("treeId") ?? "").trim();
  if (!treeId) return { ok: false, error: "Missing tree." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const access = await getTreeAccess(treeId, user.id);
  if (!access || (access.role !== "editor" && access.role !== "owner")) {
    return { ok: false, error: "Only editors and owners can map places." };
  }

  const personRows = await db
    .select({ birthPlace: persons.birthPlace, deathPlace: persons.deathPlace })
    .from(persons)
    .where(eq(persons.treeId, treeId));
  const eventRows = await db
    .select({ placeText: personEvents.placeText })
    .from(personEvents)
    .innerJoin(persons, eq(personEvents.personId, persons.id))
    .where(eq(persons.treeId, treeId));

  const texts = [
    ...personRows.flatMap((p) => [p.birthPlace, p.deathPlace]),
    ...eventRows.map((e) => e.placeText),
  ];
  const keys = collectPlaceKeys(texts);
  if (keys.size === 0) {
    return { ok: true, message: "No places to map yet — add birth, death, or event places first." };
  }

  // Which keys already have coordinates (cache hit)?
  const keyList = [...keys];
  const cached = keyList.length
    ? await db
        .select({ placeKey: placeGeocodes.placeKey })
        .from(placeGeocodes)
        .where(inArray(placeGeocodes.placeKey, keyList))
    : [];
  const cachedSet = new Set(cached.map((c) => c.placeKey));
  const pending = keyList.filter((k) => !cachedSet.has(k));

  if (pending.length === 0) {
    return { ok: true, message: `All ${keys.size} places are already mapped.` };
  }

  // Original text per key (for the geocoder query + display fallback)
  const textByKey = new Map<string, string>();
  for (const t of texts) {
    const trimmed = t?.trim();
    if (!trimmed) continue;
    const k = collectPlaceKeys([trimmed]).values().next().value;
    if (k && !textByKey.has(k)) textByKey.set(k, trimmed);
  }

  const batch = pending.slice(0, MAX_LOOKUPS_PER_RUN);
  let mapped = 0;
  let failed = 0;
  for (let i = 0; i < batch.length; i++) {
    const key = batch[i];
    const original = textByKey.get(key) ?? key;
    const geo = await fetchGeocode(original);
    if (geo) {
      await db
        .insert(placeGeocodes)
        .values({
          id: randomUUID(),
          placeKey: key,
          placeText: original,
          lat: geo.lat,
          lng: geo.lng,
          displayName: geo.displayName,
          source: "nominatim",
        })
        .onConflictDoNothing({ target: placeGeocodes.placeKey });
      mapped++;
    } else {
      failed++;
    }
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  const remaining = pending.length - batch.length;
  const parts = [`${mapped} place${mapped === 1 ? "" : "s"} mapped`];
  if (failed > 0) parts.push(`${failed} couldn't be matched — free text kept`);
  if (remaining > 0) parts.push(`${remaining} left — try again`);
  return { ok: true, message: parts.join(" · ") + "." };
}
