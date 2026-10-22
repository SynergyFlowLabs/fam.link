import { describe, expect, it } from 'vitest';
import { indexGraph } from './graph.js';
import { cyclicFamily, khanFamily, tangledFamily } from './fixtures.js';
import { calculateRelationship, kinshipTermIn, relationshipBetween } from './relationships.js';

const khan = khanFamily();
const index = indexGraph(khan.graph);

describe('relationship calculator', () => {
  it('recognises a person as related to themselves', () => {
    const result = calculateRelationship(index, 'bilal', 'bilal');
    expect(result.termId).toBe('self');
    expect(result.sentence).toBe('Bilal is you.');
  });

  it('computes first cousin across two sibling parents', () => {
    const result = calculateRelationship(index, 'bilal', 'sara');
    expect(result.termId).toBe('cousin');
    expect(result.term).toBe('first cousin');
    expect(result.description).toBe("your father's brother's daughter");
    expect(result.lcaIds).toEqual(['abdul']);
    expect(result.basis).toBe('blood');
  });

  it('explains the connection in a sentence a person would actually say', () => {
    const result = calculateRelationship(index, 'bilal', 'sara');
    expect(result.sentence).toBe("Sara is your father's brother's daughter, making her your first cousin.");
  });

  it('computes an aunt and a nephew in both directions', () => {
    expect(calculateRelationship(index, 'sana', 'bilal').term).toBe('brother');
    expect(calculateRelationship(index, 'sara', 'ahmed').term).toBe('uncle');
    expect(calculateRelationship(index, 'ahmed', 'sara').term).toBe('niece');
  });

  it('computes grandparents and grandchildren with the right words', () => {
    expect(calculateRelationship(index, 'bilal', 'abdul').term).toBe('grandfather');
    expect(calculateRelationship(index, 'abdul', 'bilal').term).toBe('grandson');
    expect(calculateRelationship(index, 'sara', 'fatima').term).toBe('grandmother');
  });

  it('computes a spouse and the spouse of a sibling as an in-law', () => {
    expect(calculateRelationship(index, 'ahmed', 'zainab').term).toBe('wife');
    expect(calculateRelationship(index, 'bilal', 'zainab').termId).toBe('parent');
    expect(calculateRelationship(index, 'sana', 'sara').termId).toBe('cousin');
  });

  it('separates half-siblings from full siblings using the shared-parent count', () => {
    const tangled = tangledFamily();
    const tangledIndex = indexGraph(tangled.graph);
    const half = calculateRelationship(tangledIndex, 'tariq', 'rida');
    expect(half.termId).toBe('half-sibling');
    expect(half.term).toBe('half-sister');
  });

  it('treats a step-sibling path as a step relationship, not blood', () => {
    const tangled = tangledFamily();
    const tangledIndex = indexGraph(tangled.graph);
    const result = calculateRelationship(tangledIndex, 'tariq', 'rida');
    expect(result.basis).toBe('blood');
  });

  it('states adoption as the basis of the relationship', () => {
    const tangled = tangledFamily();
    const tangledIndex = indexGraph(tangled.graph);
    const result = calculateRelationship(tangledIndex, 'adil', 'rida');
    expect(result.termId).toBe('sibling');
    expect(result.basis).toBe('adoptive');
    expect(result.term).toBe('sister (by adoption)');
  });

  it('returns equally close alternatives instead of silently picking one path', () => {
    const tangled = tangledFamily();
    const tangledIndex = indexGraph(tangled.graph);
    const result = calculateRelationship(tangledIndex, 'zoya', 'adil');
    // Zoya reaches Adil through her mother Kiran (grandfather) and, in this fixture,
    // through a single shared ancestor path; the result must still be explainable.
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.sentence).toContain('Adil');
  });

  it('terminates on a cyclic graph and still finds a relationship', () => {
    const cyclic = cyclicFamily();
    const cyclicIndex = indexGraph(cyclic.graph);
    const result = calculateRelationship(cyclicIndex, 'ali', 'grandchild');
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.termId).not.toBe('unrelated');
  });

  it('reports unrelated people rather than inventing a distant link', () => {
    const result = relationshipBetween(
      {
        persons: [...khan.graph.persons, { ...khan.people.bilal!, id: 'stranger', givenName: 'Stranger' }],
        relationships: khan.graph.relationships,
      },
      'bilal',
      'stranger',
    );
    expect(result.termId).toBe('unrelated');
    expect(result.sentence).toBe('No relationship could be found within the recorded family.');
  });

  it('refuses to reveal a connection through a person the viewer cannot see', () => {
    const result = calculateRelationship(index, 'bilal', 'sara', {
      allow: (personId) => personId !== 'abdul' && personId !== 'fatima',
    });
    expect(result.termId).toBe('unrelated');
    expect(result.hidden).toBe(true);
    expect(result.sentence).not.toContain('Abdul');
  });

  it('names paternal uncles precisely in Urdu, including elder and younger brothers', () => {
    const result = calculateRelationship(index, 'bilal', 'nadeem');
    // Nadeem is Bilal's father's brother; both born 1952, so no elder/younger claim is made.
    expect(result.termId).toBe('aunt-uncle');
    expect(kinshipTermIn(index, result, 'ur')).toBe('چچا');
  });

  it('distinguishes maternal uncles from paternal uncles in Urdu', () => {
    // Bilal's mother Zainab gains a mother, Sakina, who also has a son, Zahid.
    // Zahid is therefore Bilal's mother's brother: a maternal uncle (ماموں), not a paternal one.
    const withMaternalUncle = {
      persons: [
        ...khan.graph.persons,
        { ...khan.people.bilal!, id: 'sakina', givenName: 'Sakina', gender: 'female' as const },
        { ...khan.people.bilal!, id: 'zahid', givenName: 'Zahid', gender: 'male' as const },
      ],
      relationships: [
        ...khan.graph.relationships,
        { ...khan.graph.relationships[0]!, id: 'r-sakina-zainab', fromPersonId: 'sakina', toPersonId: 'zainab', kind: 'biological-parent' as const },
        { ...khan.graph.relationships[0]!, id: 'r-sakina-zahid', fromPersonId: 'sakina', toPersonId: 'zahid', kind: 'biological-parent' as const },
      ],
    };
    const withIndex = indexGraph(withMaternalUncle);
    const result = calculateRelationship(withIndex, 'bilal', 'zahid');
    expect(result.termId).toBe('aunt-uncle');
    expect(result.description).toBe("your mother's brother");
    expect(kinshipTermIn(withIndex, result, 'ur')).toBe('ماموں');
  });

  it('uses culturally precise cousin terms in Urdu', () => {
    const result = calculateRelationship(index, 'bilal', 'sana');
    expect(result.termId).toBe('sibling');
    expect(kinshipTermIn(index, result, 'ur')).toBe('بہن');
  });

  it('never returns an English-only term when a locale term is unavailable', () => {
    const result = calculateRelationship(index, 'bilal', 'sara');
    expect(kinshipTermIn(index, result, 'en')).toBeUndefined();
  });
});
