import { describe, expect, it } from 'vitest';
import { neighboursOf, nextNodeId, relationTo } from './navigate.js';

const edges = [
  { fromPersonId: 'dad', toPersonId: 'me', kind: 'biological-parent' },
  { fromPersonId: 'me', toPersonId: 'kid', kind: 'biological-parent' },
  { fromPersonId: 'me', toPersonId: 'wife', kind: 'spouse' },
  { fromPersonId: 'dad', toPersonId: 'mum', kind: 'spouse' },
];

const ordered = ['dad', 'mum', 'me', 'wife', 'kid'];

describe('keyboard navigation', () => {
  it('reads the direction of a parent edge correctly from either end', () => {
    expect(relationTo(edges, 'me', 'dad')).toBe('parent');
    expect(relationTo(edges, 'dad', 'me')).toBe('child');
    expect(relationTo(edges, 'me', 'wife')).toBe('partner');
    expect(relationTo(edges, 'me', 'nobody')).toBeUndefined();
  });

  it('moves up to a parent and down to a child', () => {
    expect(nextNodeId({ edges, ordered, fromId: 'me', direction: 'up' })).toBe('dad');
    expect(nextNodeId({ edges, ordered, fromId: 'me', direction: 'down' })).toBe('kid');
    expect(nextNodeId({ edges, ordered, fromId: 'dad', direction: 'up' })).toBeUndefined();
  });

  it('moves sideways between partners before falling back to reading order', () => {
    expect(nextNodeId({ edges, ordered, fromId: 'me', direction: 'right' })).toBe('wife');
    // No partner to the left, so the key walks the row instead of doing nothing.
    expect(nextNodeId({ edges, ordered, fromId: 'me', direction: 'left' })).toBe('mum');
  });

  it('falls back to reading order for people with no partner', () => {
    expect(nextNodeId({ edges, ordered, fromId: 'kid', direction: 'left' })).toBe('wife');
  });

  it('never moves to a card that is not on screen', () => {
    const present = new Set(['me', 'kid']);
    expect(neighboursOf(edges, 'me', present).map((entry) => entry.id).sort()).toEqual(['kid']);
    expect(nextNodeId({ edges, ordered: ['me', 'kid'], fromId: 'me', direction: 'up', present })).toBeUndefined();
  });
});
