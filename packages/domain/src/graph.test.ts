import { describe, expect, it } from 'vitest';
import { indexGraph, ancestorIds, descendantIds, unionsFor, shortestPath, siblingIds, sharedParentIds } from './graph.js';
import { cyclicFamily, khanFamily, tangledFamily } from './fixtures.js';

const khan = khanFamily();
const index = indexGraph(khan.graph);

describe('family graph', () => {
  it('derives siblings from shared parents rather than storing them', () => {
    // Humza shares only Ahmed, so he is a half-sibling; Sana shares both parents.
    expect([...siblingIds(index, 'bilal')].sort()).toEqual(['humza', 'sana']);
    expect(sharedParentIds(index, 'bilal', 'sana')).toHaveLength(2);
    expect(sharedParentIds(index, 'bilal', 'humza')).toEqual(['ahmed']);
  });

  it('walks ancestors without revisiting nodes', () => {
    expect([...ancestorIds(index, 'bilal')].sort()).toEqual(['abdul', 'ahmed', 'fatima', 'zainab']);
  });

  it('walks descendants to any depth', () => {
    expect([...descendantIds(index, 'abdul')].sort()).toEqual(['ahmed', 'bilal', 'humza', 'nadeem', 'sana', 'sara']);
  });

  it('groups children under the union they belong to', () => {
    const unions = unionsFor(index, 'ahmed');
    const withZainab = unions.find((union) => union.partnerIds.includes('zainab'));
    const withFarah = unions.find((union) => union.partnerIds.includes('farah'));
    expect([...(withZainab?.childIds ?? [])].sort()).toEqual(['bilal', 'sana']);
    expect(withFarah?.childIds).toEqual(['humza']);
  });

  it('finds the shortest path between two people and includes both ends', () => {
    const path = shortestPath(index, 'bilal', 'sara')!;
    expect(path.map((hop) => hop.personId)).toEqual(['bilal', 'ahmed', 'abdul', 'nadeem', 'sara']);
  });

  it('terminates on a cyclic graph instead of looping forever', () => {
    const cyclic = cyclicFamily();
    const cyclicIndex = indexGraph(cyclic.graph);
    const ancestors = ancestorIds(cyclicIndex, 'ali');
    expect(ancestors.has('bushra')).toBe(true);
    expect(ancestors.size).toBeLessThan(10);
  });

  it('keeps half-siblings distinct from full siblings', () => {
    const tangled = tangledFamily();
    const tangledIndex = indexGraph(tangled.graph);
    expect([...siblingIds(tangledIndex, 'tariq')]).toEqual(['rida']);
  });
});
