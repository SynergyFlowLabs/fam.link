import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * Safety flows.
 *
 * Two things have to be true for a safety feature to be honest: reporting must reach someone who can
 * act, and separation must actually remove the person from other members' view while keeping the
 * structure intact for everyone below them.
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

describe('reports', () => {
  it('reaches the administrators who can act on it', async () => {
    const app = createApp();
    const filed = await request(app, 'POST', `${SPACE}/reports`, {
      userId: 'user-bilal',
      body: { personId: 'person-zoya', reason: 'This photo should not be here.' },
    });
    expect(filed.status).toBe(201);

    const queue = await request(app, 'GET', `${SPACE}/reports`, { userId: 'user-ayesha' });
    expect(queue.status).toBe(200);
    expect(queue.body.reports[0].reason).toBe('This photo should not be here.');
    expect(queue.body.reports[0].reportedBy).toBe('Bilal Khan');

    // A contributor cannot read the queue, and does see their own report surface to admins only.
    const refused = await request(app, 'GET', `${SPACE}/reports`, { userId: 'user-bilal' });
    expect(refused.status).toBe(403);

    const adminFeed = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(adminFeed.body.notifications.some((entry: { kind: string }) => entry.kind === 'report')).toBe(true);

    const contributorFeed = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-bilal' });
    expect(contributorFeed.body.notifications.some((entry: { kind: string }) => entry.kind === 'report')).toBe(false);
  });

  it('can be resolved once, with the outcome recorded', async () => {
    const app = createApp();
    await request(app, 'POST', `${SPACE}/reports`, {
      userId: 'user-bilal',
      body: { personId: 'person-zoya', reason: 'Wrong photo.' },
    });
    const queue = await request(app, 'GET', `${SPACE}/reports`, { userId: 'user-ayesha' });
    const reportId = queue.body.reports[0].id;

    const resolved = await request(app, 'POST', `${SPACE}/reports/${reportId}/resolve`, {
      userId: 'user-ayesha',
      body: { outcome: 'resolved', note: 'Photo removed.' },
    });
    expect(resolved.status).toBe(200);

    const after = await request(app, 'GET', `${SPACE}/reports`, { userId: 'user-ayesha' });
    expect(after.body.reports[0].status).toBe('resolved');
    expect(after.body.reports[0].resolutionNote).toBe('Photo removed.');

    const feed = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(feed.body.notifications.some((entry: { kind: string }) => entry.kind === 'report')).toBe(false);

    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-ayesha' });
    expect(activity.body.activity.some((entry: { kind: string }) => entry.kind === 'report.resolved')).toBe(true);
  });
});

describe('separation', () => {
  it('hides the person from other members but keeps the structure for administrators', async () => {
    const app = createApp();
    const separated = await request(app, 'POST', `${SPACE}/people/person-sara/separate`, {
      userId: 'user-sadia',
    });
    expect(separated.status).toBe(200);

    const otherView = await request(app, 'GET', `${SPACE}/tree?focus=person-noor&up=2&down=2`, { userId: 'user-bilal' });
    expect((otherView.body.nodes as Array<{ id: string }>).some((node) => node.id === 'person-sara')).toBe(false);

    const adminView = await request(app, 'GET', `${SPACE}/tree?focus=person-noor&up=2&down=2`, { userId: 'user-ayesha' });
    expect((adminView.body.nodes as Array<{ id: string }>).some((node) => node.id === 'person-sara')).toBe(true);

    const activity = await request(app, 'GET', `${SPACE}/activity`, { userId: 'user-ayesha' });
    expect(activity.body.activity.some((entry: { kind: string }) => entry.kind === 'person.separated')).toBe(true);

    const again = await request(app, 'POST', `${SPACE}/people/person-sara/separate`, { userId: 'user-sadia' });
    expect(again.status).toBe(409);
  });

  it('refuses separation on someone else’s profile', async () => {
    const app = createApp();
    const refused = await request(app, 'POST', `${SPACE}/people/person-sara/separate`, { userId: 'user-bilal' });
    expect(refused.status).toBe(403);
  });

  it('lets an administrator restore the profile, after which members see it again', async () => {
    const app = createApp();
    await request(app, 'POST', `${SPACE}/people/person-sara/separate`, { userId: 'user-sadia' });

    const refused = await request(app, 'POST', `${SPACE}/people/person-sara/restore`, { userId: 'user-bilal' });
    expect(refused.status).toBe(403);

    const restored = await request(app, 'POST', `${SPACE}/people/person-sara/restore`, { userId: 'user-ayesha' });
    expect(restored.status).toBe(200);

    const view = await request(app, 'GET', `${SPACE}/tree?focus=person-noor&up=2&down=2`, { userId: 'user-bilal' });
    expect((view.body.nodes as Array<{ id: string }>).some((node) => node.id === 'person-sara')).toBe(true);
  });
});
