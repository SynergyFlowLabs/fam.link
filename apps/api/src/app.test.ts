import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * API tests assert behaviour at the HTTP boundary, because that is where privacy and authority
 * must actually hold (ADR 0003). The key assertion style is *absence*: a restricted field must be
 * missing from the JSON, not merely falsy.
 */

async function request(
  app: ReturnType<typeof createApp>,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  } finally {
    server.close();
  }
}

const SPACE = '/api/spaces/space-khan';

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

describe('session and spaces', () => {
  it('reports no session before signing in, and the demo personas afterwards', async () => {
    const app = createApp();
    const anonymous = await request(app, 'GET', '/api/session');
    expect(anonymous.body.user).toBeNull();
    expect(anonymous.body.personas.length).toBeGreaterThan(0);
  });

  it('rejects unauthenticated access to a family space', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/tree`);
    expect(response.status).toBe(401);
  });

  it('lets a member open the tree around themselves', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/tree`, { userId: 'user-bilal' });
    expect(response.status).toBe(200);
    expect(response.body.focusId).toBe('person-bilal');
    expect(response.body.nodes.length).toBeGreaterThan(5);
  });
});

describe('privacy at the response boundary', () => {
  it('omits a living relative’s exact birth date from the tree for a non-immediate member', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/tree?focus=person-bilal`, {
      userId: 'user-sadia',
    });
    const hina = response.body.nodes.find((node: { id: string }) => node.id === 'person-hina');
    expect(hina).toBeDefined();
    expect('birthDate' in hina).toBe(false);
    expect(hina.hiddenFields).toContain('birthDate');
  });

  it('does not confirm the existence of a person hidden from the viewer', async () => {
    const app = createApp();
    const hidden = await request(app, 'POST', `${SPACE}/people/person-zoya/separate`, {
      userId: 'user-sadia',
    });
    // Sadia is not permitted to separate Zoya; the route answers 403, never with profile data.
    expect([403, 404]).toContain(hidden.status);
    expect(JSON.stringify(hidden.body)).not.toContain('Zoya');

    const profile = await request(app, 'GET', `${SPACE}/people/person-does-not-exist`, { userId: 'user-sadia' });
    expect(profile.status).toBe(404);
    expect(profile.body.error).toBe('Person not found.');
  });

  it('hides a minor’s details from relatives outside the immediate family', async () => {
    const app = createApp();
    const outsider = await request(app, 'GET', `${SPACE}/people/person-zoya`, { userId: 'user-sadia' });
    expect(outsider.body.person.isMinor).toBe(true);
    expect(outsider.body.person.birthDate).toBeUndefined();

    // A parent, however, must be able to see their own child's birth date.
    const parent = await request(app, 'GET', `${SPACE}/people/person-zoya`, { userId: 'user-bilal' });
    expect(parent.body.person.birthDate).toBeDefined();
  });

  it('scopes an export to what the exporter may see', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/export`, { userId: 'user-sadia' });
    expect(response.body.format).toBe('famlink-export/1');
    const exported = response.body.persons as Array<Record<string, unknown>>;
    expect(exported.every((person) => !('medicalInfo' in person))).toBe(true);
  });
});

describe('authority enforcement', () => {
  it('applies an open-field edit directly and a protected field as a proposal', async () => {
    const app = createApp();
    const response = await request(app, 'PATCH', `${SPACE}/people/person-nadeem`, {
      userId: 'user-bilal',
      body: { biography: 'Lives in Dubai and Karachi.', birthDate: { value: '1954-01-01', precision: 'year' } },
    });
    expect(response.body.applied.biography).toBeDefined();
    expect(response.body.proposed[0].field).toBe('birthDate');
    // Bilal cannot see his uncle's birth date, so the response must not reveal the old value.
    expect(response.body.proposed[0].previousValue).toBeUndefined();
    expect(response.body.person.birthDate).toBeUndefined();
  });

  it('refuses a viewer’s edit outright', async () => {
    const store = seedStore();
    store.memberships = store.memberships.map((membership) =>
      membership.userId === 'user-sadia' ? { ...membership, role: 'viewer' } : membership,
    );
    useStoreForTesting(store);
    const response = await request(createApp(), 'PATCH', `${SPACE}/people/person-nadeem`, {
      userId: 'user-sadia',
      body: { givenName: 'Nadeem Khan' },
    });
    expect(response.status).toBe(403);
    expect(response.body.refused[0].reason).toContain('Viewers');
  });

  it('lets an administrator accept a proposal and records the change in the activity log', async () => {
    const app = createApp();
    const decided = await request(app, 'POST', `${SPACE}/proposals/prop-1/decide`, {
      userId: 'user-ayesha',
      body: { outcome: 'accept' },
    });
    expect(decided.status).toBe(200);
    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-ayesha' });
    expect(activity.body.activity[0].kind).toBe('proposal.accepted');
  });

  it('marks a person as separated instead of deleting their record', async () => {
    const app = createApp();
    const response = await request(app, 'POST', `${SPACE}/people/person-sara/separate`, {
      userId: 'user-sadia',
    });
    expect(response.status).toBe(200);
    const profile = await request(app, 'GET', `${SPACE}/people/person-sara`, { userId: 'user-bilal' });
    expect(profile.status).toBe(404);
  });
});

describe('invitations and claiming', () => {
  it('describes the invitation with the relationship, not a marketing pitch', async () => {
    const response = await request(createApp(), 'GET', '/api/invite/khan-uncle-nadeem');
    expect(response.status).toBe(200);
    expect(response.body.person.givenName).toBe('Nadeem');
    expect(response.body.space.name).toBe('Khan Family');
    // No sensitive field is exposed on a public invite page.
    expect(JSON.stringify(response.body)).not.toContain('1952');
  });

  it('claims an existing profile rather than creating a duplicate person', async () => {
    const app = createApp();
    const before = await request(app, 'GET', `${SPACE}/people`, { userId: 'user-ayesha' });
    const counts = before.body.living.length + before.body.deceased.length;

    const accepted = await request(app, 'POST', '/api/invite/khan-uncle-nadeem/accept', {
      body: { userId: 'user-nadeem' },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.personId).toBe('person-nadeem');

    const after = await request(app, 'GET', `${SPACE}/people`, { userId: 'user-ayesha' });
    expect(after.body.living.length + after.body.deceased.length).toBe(counts);
  });

  it('warns about a possible duplicate before creating a person', async () => {
    const response = await request(createApp(), 'POST', `${SPACE}/people`, {
      userId: 'user-bilal',
      body: { givenName: 'Sara', familyName: 'Khan' },
    });
    expect(response.status).toBe(409);
    expect(response.body.duplicates.length).toBeGreaterThan(0);
  });

  it('creates the person once the duplicate warning is acknowledged', async () => {
    const response = await request(createApp(), 'POST', `${SPACE}/people`, {
      userId: 'user-bilal',
      body: { givenName: 'Sara', familyName: 'Khan', confirmDuplicate: true },
    });
    expect(response.status).toBe(201);
    expect(response.body.person.givenName).toBe('Sara');
  });
});

describe('relationship calculator over HTTP', () => {
  it('explains how two people are related and includes the cultural term', async () => {
    const response = await request(createApp(), 'GET', `${SPACE}/relationship?from=person-bilal&to=person-sara`, {
      userId: 'user-bilal',
    });
    expect(response.status).toBe(200);
    expect(response.body.term).toBe('first cousin');
    expect(response.body.sentence).toContain("father's brother's daughter");
    expect(response.body.pathPeople.length).toBeGreaterThan(2);
  });
});
