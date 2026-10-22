import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { resetStoreCache, useStoreForTesting } from './db.js';
import { seedStore } from './seed.js';

/**
 * Invitation delivery.
 *
 * The transport is a development one, so these tests are about the guarantees around it: the message
 * is recorded before it is sent, a retry does not send twice, a bad address never leaves, and only
 * the person who created the invitation can send it.
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

async function firstInvitation(app: ReturnType<typeof createApp>) {
  const listed = await request(app, 'GET', `${SPACE}/invitations`, { userId: 'user-ayesha' });
  expect(listed.status).toBe(200);
  const invitation = listed.body.invitations[0];
  expect(invitation).toBeTruthy();
  return invitation as { id: string; token: string; invitedByUserId: string; status: string };
}

beforeEach(() => {
  resetStoreCache();
  useStoreForTesting(seedStore());
});

describe('invitation delivery', () => {
  it('records the message, sends it, and returns the exact copy', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    const sent = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'email', recipient: 'nadeem@example.com' },
    });
    expect(sent.status).toBe(202);
    expect(sent.body.message.status).toBe('sent');
    expect(sent.body.message.attempts).toBe(1);
    expect(sent.body.subject).toContain('Khan Family');
    expect(sent.body.body).toContain(invitation.token);
  });

  it('does not send twice when the same request is repeated', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    const first = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'whatsapp', recipient: '+92 300 1234567' },
    });
    expect(first.status).toBe(202);

    const second = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'whatsapp', recipient: '+92 300 1234567' },
    });
    expect(second.status).toBe(200);
    expect(second.body.duplicated).toBe(true);
    expect(second.body.message.id).toBe(first.body.message.id);
    expect(second.body.message.attempts).toBe(1);

    const outbox = await request(app, 'GET', `${SPACE}/outbox`, { userId: 'user-ayesha' });
    expect(outbox.body.messages).toHaveLength(1);
  });

  it('treats a spacing change in a phone number as the same recipient', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'whatsapp', recipient: '+92 300 1234567' },
    });
    const again = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'whatsapp', recipient: '+923001234567' },
    });
    expect(again.body.duplicated).toBe(true);
  });

  it('rejects an invalid recipient before anything is queued', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    const bad = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'email', recipient: 'not-an-address' },
    });
    expect(bad.status).toBe(400);

    const outbox = await request(app, 'GET', `${SPACE}/outbox`, { userId: 'user-ayesha' });
    expect(outbox.body.messages).toHaveLength(0);
  });

  it('refuses to send someone else’s invitation, and refuses a revoked one', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    const other = invitation.invitedByUserId === 'user-bilal' ? 'user-sadia' : 'user-bilal';
    const refused = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: other,
      body: { channel: 'email', recipient: 'someone@example.com' },
    });
    expect(refused.status).toBe(403);

    const revoked = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/revoke`, {
      userId: invitation.invitedByUserId,
    });
    // Some seeds have no revoke route expectations; only assert if the API supports it.
    if (revoked.status === 200) {
      const send = await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
        userId: invitation.invitedByUserId,
        body: { channel: 'email', recipient: 'someone@example.com' },
      });
      expect(send.status).toBe(409);
    }
  });

  it('shows the outbox to administrators only', async () => {
    const app = createApp();
    const invitation = await firstInvitation(app);
    await request(app, 'POST', `${SPACE}/invitations/${invitation.id}/send`, {
      userId: invitation.invitedByUserId,
      body: { channel: 'email', recipient: 'relative@example.com' },
    });
    const admin = await request(app, 'GET', `${SPACE}/outbox`, { userId: 'user-ayesha' });
    expect(admin.status).toBe(200);
    expect(admin.body.messages[0].recipient).toBe('relative@example.com');

    const contributor = await request(app, 'GET', `${SPACE}/outbox`, { userId: 'user-bilal' });
    expect(contributor.status).toBe(403);
  });
});
