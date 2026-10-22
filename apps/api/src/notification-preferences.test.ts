import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * Notification preferences.
 *
 * The feed is derived from state (ADR 0004), so "muting" cannot mean "stop writing rows" — it means
 * filtering at read time for that member only. The interesting cases are therefore: does a mute
 * affect anyone else, and can a member mute the notifications that exist to protect them.
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

describe('notification preferences', () => {
  it('defaults every category to on', async () => {
    const app = createApp();
    const listed = await request(app, 'GET', `${SPACE}/notifications/preferences`, { userId: 'user-ayesha' });
    expect(listed.status).toBe(200);
    expect(listed.body.categories.every((category: { enabled: boolean }) => category.enabled)).toBe(true);
    expect(listed.body.categories.map((category: { id: string }) => category.id)).toContain('proposals');
  });

  it('stops showing a muted category without touching anyone else’s feed', async () => {
    const app = createApp();
    const before = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(before.body.notifications.some((entry: { kind: string }) => entry.kind === 'claim')).toBe(true);

    const muted = await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'claims', enabled: false },
    });
    expect(muted.status).toBe(200);

    const after = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(after.body.notifications.some((entry: { kind: string }) => entry.kind === 'claim')).toBe(false);
    // A different category is unaffected: muting one thing is not muting the feed.
    expect(after.body.notifications.some((entry: { kind: string }) => entry.kind.startsWith('proposal'))).toBe(true);

    const other = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-sadia' });
    expect(other.body.notifications.some((entry: { kind: string }) => entry.kind === 'claim')).toBe(true);
  });

  it('can be switched back on', async () => {
    const app = createApp();
    await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'claims', enabled: false },
    });
    const restored = await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'claims', enabled: true },
    });
    expect(restored.status).toBe(200);
    const categories = restored.body.categories as Array<{ id: string; enabled: boolean }>;
    expect(categories.find((category) => category.id === 'claims')?.enabled).toBe(true);

    const feed = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(feed.body.notifications.some((entry: { kind: string }) => entry.kind === 'claim')).toBe(true);
  });

  it('refuses to mute safety notifications', async () => {
    const app = createApp();
    const refused = await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'safety', enabled: false },
    });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatch(/cannot be switched off/i);

    const listed = await request(app, 'GET', `${SPACE}/notifications/preferences`, { userId: 'user-ayesha' });
    expect(listed.body.categories.find((category: { id: string }) => category.id === 'safety').mutable).toBe(false);
    expect(listed.body.categories.find((category: { id: string }) => category.id === 'safety').enabled).toBe(true);
  });

  it('rejects an unknown category or a non-boolean value', async () => {
    const app = createApp();
    const unknown = await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'everything', enabled: false },
    });
    expect(unknown.status).toBe(400);

    const badValue = await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'claims', enabled: 'no' },
    });
    expect(badValue.status).toBe(400);
  });

  it('keeps the unread count consistent with what the member can actually see', async () => {
    const app = createApp();
    const before = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(before.body.unread).toBeGreaterThan(0);

    await request(app, 'PATCH', `${SPACE}/notifications/preferences`, {
      userId: 'user-ayesha',
      body: { category: 'claims', enabled: false },
    });
    await request(app, 'POST', `${SPACE}/notifications/seen`, { userId: 'user-ayesha', body: {} });

    const after = await request(app, 'GET', `${SPACE}/notifications`, { userId: 'user-ayesha' });
    expect(after.body.unread).toBe(0);
  });
});
