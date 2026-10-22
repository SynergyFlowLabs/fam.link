import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * Demo identity without cookies.
 *
 * The app is demonstrated inside an embedded preview iframe, where `SameSite=Lax` cookies are treated
 * as third-party and dropped. The visible symptom was a persona list whose buttons did nothing: the
 * sign-in POST set a cookie that the next GET never received.
 *
 * These tests pin the replacement behaviour, and the switch that turns it off when real
 * authentication arrives.
 */

async function request(
  app: ReturnType<typeof createApp>,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { persona?: string; cookie?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.persona ? { 'x-famlink-persona': options.persona } : {}),
        ...(options.cookie ? { cookie: `famlink_session=${options.cookie}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } finally {
    server.close();
  }
}

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

afterEach(() => {
  delete process.env['FAMLINK_DEMO_IDENTITY'];
});

describe('demo identity header', () => {
  it('gives a session without any cookie, which is what the embedded preview needs', async () => {
    const app = createApp();
    const anonymous = await request(app, 'GET', '/api/session');
    expect(anonymous.body.user).toBeNull();

    const identified = await request(app, 'GET', '/api/session', { persona: 'user-ayesha' });
    expect(identified.body.user?.id).toBe('user-ayesha');
    expect(identified.body.memberships.length).toBeGreaterThan(0);
    expect(identified.body.memberships[0].spaceId).toBe('space-khan');
  });

  it('applies the same permissions as the cookie would', async () => {
    const app = createApp();
    const admin = await request(app, 'GET', '/api/spaces/space-khan/reports', { persona: 'user-ayesha' });
    expect(admin.status).toBe(200);

    const contributor = await request(app, 'GET', '/api/spaces/space-khan/reports', { persona: 'user-bilal' });
    expect(contributor.status).toBe(403);
  });

  it('can switch persona between requests, as the account menu does', async () => {
    const app = createApp();
    const first = await request(app, 'GET', '/api/session', { persona: 'user-bilal' });
    const second = await request(app, 'GET', '/api/session', { persona: 'user-sadia' });
    expect(first.body.user?.id).toBe('user-bilal');
    expect(second.body.user?.id).toBe('user-sadia');
    expect(first.body.memberships[0].personId).not.toBe(second.body.memberships[0].personId);
  });

  it('ignores an unknown persona rather than failing the request', async () => {
    const app = createApp();
    const response = await request(app, 'GET', '/api/session', { persona: 'user-nobody' });
    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });

  it('prefers a valid cookie when both are present', async () => {
    const app = createApp();
    const response = await request(app, 'GET', '/api/session', {
      persona: 'user-bilal',
      cookie: 'user-sadia',
    });
    expect(response.body.user?.id).toBe('user-sadia');
  });

  it('stops honouring the header when FAMLINK_DEMO_IDENTITY is off', async () => {
    process.env['FAMLINK_DEMO_IDENTITY'] = 'off';
    const app = createApp();
    const header = await request(app, 'GET', '/api/session', { persona: 'user-ayesha' });
    expect(header.body.user).toBeNull();

    // The cookie still works, so turning the demo switch off is not the same as breaking sign-in.
    const cookie = await request(app, 'GET', '/api/session', { cookie: 'user-ayesha' });
    expect(cookie.body.user?.id).toBe('user-ayesha');
  });

  it('signing in still returns the user so the client can confirm the switch', async () => {
    const app = createApp();
    const signedIn = await request(app, 'POST', '/api/session', {
      persona: 'user-nadeem',
      body: { userId: 'user-nadeem' },
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.user.id).toBe('user-nadeem');
  });
});
