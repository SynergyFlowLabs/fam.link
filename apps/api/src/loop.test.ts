import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * The central product loop, as one test (PRD §6, MVP exit criteria §6).
 *
 *   invitation → claim → self-correction → second contributor → administrator decision
 *
 * If this sequence stops working, the product's reason to exist has stopped working, regardless of
 * how good the chart looks. Everything here is observed through the HTTP API only.
 */

async function request(
  app: ReturnType<typeof createApp>,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  options: { body?: unknown; userId?: string } = {},
): Promise<{ status: number; body: any }> {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.userId ? { cookie: `famlink_session=${options.userId}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } finally {
    server.close();
  }
}

const SPACE = '/api/spaces/space-khan';

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

describe('the central loop', () => {
  it('takes an unregistered uncle from invitation to self-owned profile without creating a duplicate', async () => {
    const app = createApp();

    const before = await request(app, 'GET', `${SPACE}/people`, { userId: 'user-ayesha' });
    const peopleBefore = before.body.living.length + before.body.deceased.length;

    // 1. A relative is invited to claim an existing, unregistered profile.
    const preview = await request(app, 'GET', '/api/invite/khan-uncle-nadeem');
    expect(preview.status).toBe(200);
    expect(preview.body.person.claimed).toBe(false);
    expect(preview.body.invitation.relationshipLabel).toBeTruthy();

    // 2. They accept, which claims the profile rather than inserting a new person.
    const accepted = await request(app, 'POST', '/api/invite/khan-uncle-nadeem/accept', {
      userId: 'user-nadeem',
      body: { userId: 'user-nadeem' },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.personId).toBe('person-nadeem');

    const after = await request(app, 'GET', `${SPACE}/people`, { userId: 'user-ayesha' });
    expect(after.body.living.length + after.body.deceased.length).toBe(peopleBefore);

    // 3. As the owner, they correct their own protected field directly.
    const corrected = await request(app, 'PATCH', `${SPACE}/people/person-nadeem`, {
      userId: 'user-nadeem',
      body: { birthDate: { value: '1954-01-01', precision: 'year' } },
    });
    expect(corrected.body.applied.birthDate).toBeDefined();
    expect(corrected.body.proposed).toHaveLength(0);

    // 4. A second relative's competing claim now needs the owner's approval.
    const proposed = await request(app, 'PATCH', `${SPACE}/people/person-nadeem`, {
      userId: 'user-bilal',
      body: { birthDate: { value: '1952-01-01', precision: 'year' }, explanation: 'Family register' },
    });
    expect(proposed.body.proposed[0].field).toBe('birthDate');

    const disputes = await request(app, 'GET', `${SPACE}/disputes`, { userId: 'user-ayesha' });
    const nadeemDispute = disputes.body.disputes.find(
      (group: { personId: string }) => group.personId === 'person-nadeem',
    );
    expect(nadeemDispute.proposedValues ?? nadeemDispute.disputed).toBeTruthy();

    // 5. The owner rejects the competing claim; their own value stands and both remain on record.
    const rejected = await request(app, 'POST', `${SPACE}/proposals/${proposed.body.proposed[0].id}/decide`, {
      userId: 'user-nadeem',
      body: { outcome: 'reject' },
    });
    expect(rejected.status).toBe(200);

    const profile = await request(app, 'GET', `${SPACE}/people/person-nadeem`, { userId: 'user-nadeem' });
    expect(profile.body.person.birthDate.value).toBe('1954-01-01');

    // 6. The whole sequence is attributable in the activity log.
    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-ayesha' });
    const kinds = activity.body.activity.map((entry: { kind: string }) => entry.kind);
    expect(kinds).toContain('person.claimed');
    expect(kinds).toContain('proposal.rejected');
    expect(kinds).toContain('person.updated');
  });

  it('lets a newly invited branch add relatives that the whole family can then see', async () => {
    const app = createApp();
    // Sadia claims the profile through the link, then adds her own side of the family.
    await request(app, 'POST', '/api/invite/khan-cousin-sadia/accept', {
      userId: 'user-seher',
      body: { userId: 'user-seher' },
    });

    const created = await request(app, 'POST', `${SPACE}/people`, {
      userId: 'user-seher',
      body: { givenName: 'Bilquis', familyName: 'Khan', parentId: 'person-imran', confirmDuplicate: true },
    });
    expect(created.status).toBe(201);

    const tree = await request(app, 'GET', `${SPACE}/tree?focus=person-sadia`, { userId: 'user-bilal' });
    const names = tree.body.nodes.map((node: { givenName: string }) => node.givenName);
    expect(names).toContain('Bilquis');

    const relation = await request(app, 'GET', `${SPACE}/relationship?from=person-bilal&to=person-sadia`, {
      userId: 'user-bilal',
    });
    expect(relation.body.termId).toBe('cousin');
  });
});
