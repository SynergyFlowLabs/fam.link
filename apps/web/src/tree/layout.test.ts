import { describe, expect, it } from 'vitest';
import { assignGenerations, layoutTree, initials } from './layout.js';

const nodes = [
  { id: 'grandfather' },
  { id: 'grandmother' },
  { id: 'father' },
  { id: 'mother' },
  { id: 'uncle' },
  { id: 'child' },
  { id: 'cousin' },
];

const edges = [
  { id: 'e1', fromPersonId: 'grandfather', toPersonId: 'grandmother', kind: 'spouse' },
  { id: 'e2', fromPersonId: 'grandfather', toPersonId: 'father', kind: 'biological-parent' },
  { id: 'e3', fromPersonId: 'grandmother', toPersonId: 'father', kind: 'biological-parent' },
  { id: 'e4', fromPersonId: 'grandfather', toPersonId: 'uncle', kind: 'biological-parent' },
  { id: 'e5', fromPersonId: 'father', toPersonId: 'mother', kind: 'spouse' },
  { id: 'e6', fromPersonId: 'father', toPersonId: 'child', kind: 'biological-parent' },
  { id: 'e7', fromPersonId: 'mother', toPersonId: 'child', kind: 'biological-parent' },
  { id: 'e8', fromPersonId: 'uncle', toPersonId: 'cousin', kind: 'biological-parent' },
];

describe('tree layout', () => {
  it('places parents above and children below the focus', () => {
    const generations = assignGenerations(nodes, edges, 'child');
    expect(generations.get('child')).toBe(0);
    expect(generations.get('father')).toBe(-1);
    expect(generations.get('grandfather')).toBe(-2);
    expect(generations.get('mother')).toBe(-1);
  });

  it('keeps partners on the same generation', () => {
    const generations = assignGenerations(nodes, edges, 'child');
    expect(generations.get('grandfather')).toBe(generations.get('grandmother'));
  });

  it('does not let branches overlap horizontally', () => {
    const layout = layoutTree(nodes, edges, 'child');
    const positions = [...layout.nodes.values()];
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i]!;
        const b = positions[j]!;
        if (a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x)).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for the same input', () => {
    const first = layoutTree(nodes, edges, 'child');
    const second = layoutTree(nodes, edges, 'child');
    expect([...first.nodes.entries()]).toEqual([...second.nodes.entries()]);
  });

  it('terminates when the graph contains a cycle', () => {
    const cyclicEdges = [
      ...edges,
      { id: 'e9', fromPersonId: 'child', toPersonId: 'grandfather', kind: 'biological-parent' },
      { id: 'e10', fromPersonId: 'cousin', toPersonId: 'mother', kind: 'spouse' },
    ];
    const layout = layoutTree(nodes, cyclicEdges, 'child');
    expect(layout.nodes.size).toBe(nodes.length);
    for (const node of layout.nodes.values()) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('produces initials without inventing a photo', () => {
    expect(initials('Bilal Khan')).toBe('BK');
    expect(initials('Fatima')).toBe('F');
  });
});
