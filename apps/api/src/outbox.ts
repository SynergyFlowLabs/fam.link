import { nextId, nowIso, type OutboxMessage, type Store } from './db.js';

/**
 * Invitation delivery.
 *
 * There is no mail provider or WhatsApp Business account wired up in this build, and pretending
 * otherwise would be the worst kind of fake: a member taps "send" and the relative never hears
 * anything, while the UI says "sent". So delivery is split honestly:
 *
 * - **The outbox is real.** A message is recorded before any attempt, keyed idempotently by
 *   invitation + channel + recipient, with attempt count and last error.
 * - **The transport is a development one.** It writes to the server log and returns success, which is
 *   enough to exercise the whole flow and to test retries. Swapping in SMTP or the WhatsApp Cloud API
 *   means implementing `Transport` and passing it here; nothing else changes.
 *
 * The invitation link itself is also available to copy, so a member can always deliver it themselves.
 */

export interface DeliveryMessage {
  readonly invitationId: string;
  readonly spaceId: string;
  readonly channel: 'email' | 'whatsapp';
  readonly recipient: string;
  readonly subject: string;
  readonly body: string;
  readonly idempotencyKey: string;
}

export interface Transport {
  readonly name: string;
  send(message: DeliveryMessage): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** The only transport in this build. It records what would be sent, and says so in the log. */
export const devTransport: Transport = {
  name: 'dev-log',
  async send(message) {
    // Deliberately not silent: an operator reading the log can see exactly what a relative would get.
    console.info(`[outbox] ${message.channel} to ${message.recipient}: ${message.subject}`);
    return { ok: true };
  },
};

/**
 * One human, one recipient. "+92 300 1234567" and "+923001234567" are the same phone number, and a
 * retry must not produce a second message because the sender typed the spacing differently.
 */
export function normalizeRecipient(recipient: string): string {
  const trimmed = recipient.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  const digits = trimmed.replace(/[^0-9+]/g, '');
  return digits.startsWith('+') ? `+${digits.slice(1).replace(/\+/g, '')}` : digits.replace(/\+/g, '');
}

export function idempotencyKeyFor(invitationId: string, channel: string, recipient: string): string {
  return `${invitationId}::${channel}::${normalizeRecipient(recipient)}`;
}

export function findExisting(store: Store, idempotencyKey: string): OutboxMessage | undefined {
  return store.outbox.find((message) => message.idempotencyKey === idempotencyKey);
}

export function enqueue(
  store: Store,
  input: Omit<DeliveryMessage, 'idempotencyKey'> & { idempotencyKey?: string },
): { message: OutboxMessage; duplicated: boolean } {
  const key = input.idempotencyKey ?? idempotencyKeyFor(input.invitationId, input.channel, input.recipient);
  const existing = findExisting(store, key);
  if (existing) return { message: existing, duplicated: true };

  const message: OutboxMessage = {
    id: nextId(store, 'msg'),
    spaceId: input.spaceId,
    invitationId: input.invitationId,
    channel: input.channel,
    recipient: normalizeRecipient(input.recipient),
    subject: input.subject,
    body: input.body,
    status: 'queued',
    attempts: 0,
    idempotencyKey: key,
    createdAt: nowIso(),
  };
  store.outbox.push(message);
  return { message, duplicated: false };
}

/** Attempt delivery for one message. Retries are allowed while status is queued or failed. */
export async function deliver(
  store: Store,
  message: OutboxMessage,
  transport: Transport = devTransport,
): Promise<OutboxMessage> {
  const target = store.outbox.find((candidate) => candidate.id === message.id);
  if (!target) return message;
  if (target.status === 'sent') return target;

  (target as unknown as { attempts: number }).attempts += 1;
  const result = await transport.send({
    invitationId: target.invitationId,
    spaceId: target.spaceId,
    channel: target.channel,
    recipient: target.recipient,
    subject: target.subject,
    body: target.body,
    idempotencyKey: target.idempotencyKey,
  });

  if (result.ok) {
    (target as unknown as { status: string }).status = 'sent';
    (target as unknown as { sentAt: string }).sentAt = nowIso();
    (target as unknown as { lastError?: string }).lastError = undefined;
  } else {
    (target as unknown as { status: string }).status = 'failed';
    (target as unknown as { lastError: string }).lastError = result.error;
  }
  return target;
}

export function invitationCopy(input: {
  spaceName: string;
  inviterName: string;
  personName?: string;
  relationshipLabel?: string;
  link: string;
}): { subject: string; body: string } {
  // The stored label describes the invitee's relationship to the *inviter* ("maternal uncle"), so
  // the sentence has to be written from the inviter's side or it reads as nonsense.
  const about =
    input.personName && input.relationshipLabel
      ? ` and described you as their ${input.relationshipLabel}`
      : '';
  return {
    subject: `${input.inviterName} added you to ${input.spaceName}`,
    body: [
      `${input.inviterName} added you to the ${input.spaceName} tree${about}.`,
      '',
      'Claim your profile, correct anything that is wrong, and choose who can see which fields:',
      input.link,
      '',
      'If this was not meant for you, ignore this message — the link expires on its own.',
    ].join('\n'),
  };
}
