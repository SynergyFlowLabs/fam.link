/**
 * Branch scope helper — computes which persons/unions/links belong to a
 * branch rooted at a given person.
 * Null scope = tree-wide (no filtering).
 *
 * Invariant: scoped views never leak out-of-branch persons via structure
 * or search; living redaction still applies separately.
 */

export interface ScopePerson { id: string; }
export interface ScopeUnion { id: string; partnerAId: string; partnerBId: string | null; }
export interface ScopeLink { unionId: string; childId: string; }

export function getBranchPersonIds(
  scopePersonId: string | null | undefined,
  persons: { id: string }[],
  unions: ScopeUnion[],
  links: ScopeLink[],
): Set<string> | null {
  if (!scopePersonId) return null;
  const personIds = new Set(persons.map((p) => p.id));
  if (!personIds.has(scopePersonId)) return new Set(); // unknown root → empty, caller 404s

  // Build parent/child maps
  const childrenByUnion = new Map<string, string[]>();
  const parentUnionsByChild = new Map<string, string[]>();
  const unionsByPerson = new Map<string, string[]>();
  for (const u of unions) {
    for (const p of [u.partnerAId, u.partnerBId]) {
      if (!p) continue;
      const arr = unionsByPerson.get(p) ?? [];
      arr.push(u.id);
      unionsByPerson.set(p, arr);
    }
  }
  for (const l of links) {
    const arr = childrenByUnion.get(l.unionId) ?? [];
    if (!arr.includes(l.childId)) arr.push(l.childId);
    childrenByUnion.set(l.unionId, arr);
    const pu = parentUnionsByChild.get(l.childId) ?? [];
    if (!pu.includes(l.unionId)) pu.push(l.unionId);
    parentUnionsByChild.set(l.childId, pu);
  }

  const unionById = new Map(unions.map((u) => [u.id, u]));

  // ancestors: walk up
  const ancestors = new Set<string>([scopePersonId]);
  let q: string[] = [scopePersonId];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    for (const uid of parentUnionsByChild.get(cur) ?? []) {
      const u = unionById.get(uid);
      if (!u) continue;
      for (const parent of [u.partnerAId, u.partnerBId]) {
        if (parent && !ancestors.has(parent)) {
          ancestors.add(parent);
          q.push(parent);
        }
      }
    }
  }

  // descendants: walk down
  const descendants = new Set<string>([scopePersonId]);
  q = [scopePersonId];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    for (const uid of unionsByPerson.get(cur) ?? []) {
      for (const child of childrenByUnion.get(uid) ?? []) {
        if (!descendants.has(child)) {
          descendants.add(child);
          q.push(child);
        }
      }
    }
  }

  const core = new Set<string>([...ancestors, ...descendants]);

  // spouses of core persons (one hop, no further ancestors of spouses)
  const branch = new Set<string>(core);
  for (const pid of core) {
    for (const uid of unionsByPerson.get(pid) ?? []) {
      const u = unionById.get(uid);
      if (!u) continue;
      for (const spouse of [u.partnerAId, u.partnerBId]) {
        if (spouse && spouse !== pid) branch.add(spouse);
      }
    }
  }

  return branch;
}

export function filterByBranch<T extends { id: string }>(items: T[], branchIds: Set<string> | null): T[] {
  if (!branchIds) return items;
  return items.filter((it) => branchIds.has(it.id));
}

export function filterUnionsByBranch(unions: ScopeUnion[], branchIds: Set<string> | null): ScopeUnion[] {
  if (!branchIds) return unions;
  // Keep union if at least one partner in branch (so spouse link stays visible)
  return unions.filter((u) => branchIds.has(u.partnerAId) || (u.partnerBId && branchIds.has(u.partnerBId)));
}

export function filterLinksByBranch(links: ScopeLink[], branchIds: Set<string> | null, unions: ScopeUnion[]): ScopeLink[] {
  if (!branchIds) return links;
  const unionsInBranch = new Set(filterUnionsByBranch(unions, branchIds).map((u) => u.id));
  return links.filter((l) => unionsInBranch.has(l.unionId) && branchIds.has(l.childId));
}

export function branchStats(branchIds: Set<string> | null, total: number): string {
  if (!branchIds) return `${total} people`;
  return `${branchIds.size} / ${total} people in branch`;
}
