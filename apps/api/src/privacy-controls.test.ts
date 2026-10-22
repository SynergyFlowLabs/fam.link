import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

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

describe('field-level visibility controls', () => {
  it('lets a person tighten their own field and shows the effect to relatives', async () => {
    const app = createApp();
    const changed = await request(app, 'PATCH', `${SPACE}/people/person-bilal/visibility`, {
      userId: 'user-bilal',
      body: { field: 'birthPlace', scope: 'selected' },
    });
    expect(changed.status).toBe(200);

    // Sadia is a cousin, not one of the selected relatives, so the place disappears for her.
    const profile = await request(app, 'GET', `${SPACE}/people/person-bilal`, { userId: 'user-sadia' });
    expect(profile.body.person.birthPlace).toBeUndefined();
    expect(profile.body.person.hiddenFields).toContain('birthPlace');
  });

  it('reads the stored scope back to the owner and to nobody else', async () => {
    const app = createApp();
    const before = await request(app, 'GET', `${SPACE}/people/person-bilal`, { userId: 'user-bilal' });
    // The default for a living person's birth date is immediate family; the owner must see that.
    expect(before.body.person.visibility.birthDate).toBe('immediate-family');
    expect(before.body.person.canEditVisibility).toBe(true);

    const changed = await request(app, 'PATCH', `${SPACE}/people/person-bilal/visibility`, {
      userId: 'user-bilal',
      body: { field: 'birthDate', scope: 'private' },
    });
    expect(changed.status).toBe(200);

    const after = await request(app, 'GET', `${SPACE}/people/person-bilal`, { userId: 'user-bilal' });
    expect(after.body.person.visibility.birthDate).toBe('private');

    // A relative sees the effect but never the configuration.
    const relative = await request(app, 'GET', `${SPACE}/people/person-bilal`, { userId: 'user-sadia' });
    expect(relative.body.person.visibility).toBeUndefined();
    expect(relative.body.person.canEditVisibility).toBeUndefined();
  });

  it('refuses to let an administrator change a living person’s visibility', async () => {
    const response = await request(createApp(), 'PATCH', `${SPACE}/people/person-bilal/visibility`, {
      userId: 'user-ayesha',
      body: { field: 'birthDate', scope: 'family-space' },
    });
    expect(response.status).toBe(403);
  });

  it('never allows a living person to be made public', async () => {
    const response = await request(createApp(), 'PATCH', `${SPACE}/people/person-sara/visibility`, {
      userId: 'user-sadia',
      body: { field: 'birthDate', scope: 'public' },
    });
    expect(response.status).toBe(422);
  });

  it('rejects an unknown scope rather than storing it', async () => {
    const response = await request(createApp(), 'PATCH', `${SPACE}/people/person-sara/visibility`, {
      userId: 'user-sadia',
      body: { field: 'birthDate', scope: 'everyone-on-the-internet' },
    });
    expect(response.status).toBe(400);
  });
});

describe('hidden branches', () => {
  it('removes an entire subtree from one member’s view without deleting it', async () => {
    const app = createApp();
    const hidden = await request(app, 'POST', `${SPACE}/hidden-branches`, {
      userId: 'user-sadia',
      body: { rootPersonId: 'person-hina' },
    });
    expect(hidden.status).toBe(201);

    const tree = await request(app, 'GET', `${SPACE}/tree?focus=person-bilal`, { userId: 'user-sadia' });
    expect(tree.body.nodes.map((node: { id: string }) => node.id)).not.toContain('person-hina');

    // The record still exists for the administrator.
    const adminTree = await request(app, 'GET', `${SPACE}/tree?focus=person-bilal`, { userId: 'user-ayesha' });
    expect(adminTree.body.nodes.map((node: { id: string }) => node.id)).toContain('person-hina');

    const branches = await request(app, 'GET', `${SPACE}/hidden-branches`, { userId: 'user-sadia' });
    expect(branches.body.branches[0].rootPersonId).toBe('person-hina');

    const restored = await request(app, 'DELETE', `${SPACE}/hidden-branches/person-hina`, { userId: 'user-sadia' });
    expect(restored.status).toBe(200);
    const after = await request(app, 'GET', `${SPACE}/tree?focus=person-bilal`, { userId: 'user-sadia' });
    expect(after.body.nodes.map((node: { id: string }) => node.id)).toContain('person-hina');
  });

  it('does not let a hidden person leak into a relationship answer', async () => {
    const app = createApp();
    await request(app, 'POST', `${SPACE}/hidden-branches`, {
      userId: 'user-sadia',
      body: { rootPersonId: 'person-ahmed' },
    });
    const answer = await request(app, 'GET', `${SPACE}/relationship?from=person-sara&to=person-humza`, {
      userId: 'user-sadia',
    });
    // Humza sits inside the hidden branch, so to Sadia he does not exist at all — the response is
    // indistinguishable from asking about someone who was never recorded.
    expect(answer.status).toBe(404);
    expect(JSON.stringify(answer.body)).not.toContain('Ahmed');
    expect(JSON.stringify(answer.body)).not.toContain('Humza');
  });
});

describe('account deletion', () => {
  it('removes the account and contact details but keeps the structural record', async () => {
    const app = createApp();
    const deleted = await request(app, 'DELETE', '/api/account', { userId: 'user-bilal' });
    expect(deleted.status).toBe(200);
    expect(deleted.body.removed.account).toBe(true);
    expect(deleted.body.retained.peopleProfiles).toBeGreaterThan(0);

    const session = await request(app, 'GET', '/api/session', { userId: 'user-bilal' });
    expect(session.body.user).toBeNull();
  });
});
