import { describe, expect, it } from 'vitest';
import { hiddenByCollapse, hiddenCounts } from './collapse.js';

const edges = [
  { fromPersonId: 'ahmed', toPersonId: 'bilal', kind: 'biological-parent' },
  { fromPersonId: 'zainab', toPersonId: 'bilal', kind: 'biological-parent' },
  { fromPersonId: 'ahmed', toPersonId: 'sana', kind: 'biological-parent' },
  { fromPersonId: 'bilal', toPersonId: 'zoya', kind: 'adoptive-parent' },
  { fromPersonId: 'bilal', toPersonId: 'hamza', kind: 'biological-parent' },
  { fromPersonId: 'ahmed', toPersonId: 'zainab', kind: 'spouse' },
];

describe('branch collapse', () => {
  it('hides a branch when nothing is collapsed', () => {
    expect(hiddenByCollapse(edges, new Set()).size).toBe(0);
  });

  it('hides children and their descendants, but keeps the collapsed person', () => {
    const hidden = hiddenByCollapse(edges, new Set(['ahmed']));
    expect([...hidden].sort()).toEqual(['bilal', 'hamza', 'sana', 'zoya']);
    expect(hidden.has('ahmed')).toBe(false);
  });

  it('does not hide a partner of the collapsed person', () => {
    // Zainab is a spouse, not a descendant: folding Ahmed's branch must not remove her card.
    expect(hiddenByCollapse(edges, new Set(['ahmed'])).has('zainab')).toBe(false);
  });

  it('hides nothing for a person with no children', () => {
    expect(hiddenByCollapse(edges, new Set(['zoya'])).size).toBe(0);
  });

  it('combines several collapsed branches without resurrecting either one', () => {
    const hidden = hiddenByCollapse(edges, new Set(['ahmed', 'bilal']));
    // Folding Ahmed hides Bilal's whole card; Bilal being folded too changes nothing, because there
    // is no longer a card to reopen from. Folding a child does not resurrect it inside a folded branch.
    expect([...hidden].sort()).toEqual(['bilal', 'hamza', 'sana', 'zoya']);
  });

  it('counts what each node would fold away, for the badge', () => {
    const counts = hiddenCounts(edges, ['ahmed', 'bilal', 'zoya']);
    expect(counts.get('ahmed')).toBe(4);
    expect(counts.get('bilal')).toBe(2);
    expect(counts.get('zoya')).toBe(0);
  });
});
