import { useState } from 'react';
import { api, displayName, type Invitation, type PersonView } from '../api.js';
import { Avatar, Chip, Empty, Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

/**
 * Invitations are the growth loop, so the copy carries the relationship ("Ahmed added you as his
 * maternal uncle") rather than a product pitch.
 */
export function InvitationsView({ spaceId }: { spaceId: string }) {
  const invitations = useAsync(() => api.invitations(spaceId), [spaceId]);
  const people = useAsync(() => api.people(spaceId), [spaceId]);
  const [personId, setPersonId] = useState('');
  const [channel, setChannel] = useState<'link' | 'email' | 'whatsapp'>('whatsapp');
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyone: PersonView[] = [...(people.data?.living ?? []), ...(people.data?.deceased ?? [])];
  const unclaimed = everyone.filter((person) => !person.claimed);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createInvitation(spaceId, {
        ...(personId ? { personId } : {}),
        channel,
      });
      const token = created.invitation.token;
      setLastLink(`${window.location.origin}/#/invite/${token}`);
      invitations.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack">
      <div className="section-title">
        <h2>Invitations</h2>
        <span className="hint">One relationship, one reason to join</span>
      </div>

      <div className="card">
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Invite a relative to claim their profile</h3>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="invite-person">Which profile?</label>
            <select id="invite-person" value={personId} onChange={(event) => setPersonId(event.target.value)}>
              <option value="">Share a general link to the family space</option>
              {unclaimed.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
            <span className="hint">
              Inviting an existing profile is how the family avoids creating the same person twice.
            </span>
          </div>
          <div className="field">
            <label htmlFor="invite-channel">Channel</label>
            <select
              id="invite-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value as 'link' | 'email' | 'whatsapp')}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="link">Private link</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <div className="row__actions" style={{ marginTop: 'var(--sp-2)' }}>
          <button type="button" className="btn btn--primary" onClick={create} disabled={busy}>
            {busy ? 'Creating…' : 'Create invitation'}
          </button>
          {lastLink ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await navigator.clipboard?.writeText(lastLink);
                }}
              >
                Copy link
              </button>
              <a
                className="btn"
                href={`https://wa.me/?text=${encodeURIComponent(`I added you to our family tree. Claim your profile and help complete your branch: ${lastLink}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Share on WhatsApp
              </a>
            </>
          ) : null}
        </div>

        {lastLink ? (
          <p className="hint" style={{ marginTop: 'var(--sp-2)', wordBreak: 'break-all' }}>
            {lastLink} — the preview shows only first names and the relationship, never dates or contact details.
          </p>
        ) : null}
      </div>

      <div className="list">
        {(invitations.data?.invitations ?? []).map((invitation: Invitation) => (
          <div key={invitation.id} className="row">
            <div className="row__main" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
              {invitation.person ? (
                <Avatar name={displayName(invitation.person)} gender={invitation.person.gender} />
              ) : null}
              <div>
                <div className="row__title">
                  {invitation.person ? displayName(invitation.person) : 'Open family link'}
                </div>
                <div className="row__sub">
                  {[invitation.relationshipLabel, invitation.channel, invitation.invitedBy?.name ? `invited by ${invitation.invitedBy.name}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
            <div className="row__actions">
              <Chip tone={invitation.status === 'accepted' ? 'default' : invitation.status === 'revoked' ? 'lac' : 'brass'}>
                {invitation.status}
              </Chip>
              <a className="btn small" href={`#/invite/${invitation.token}`}>
                Open preview
              </a>
              {invitation.status !== 'accepted' && invitation.status !== 'revoked' ? (
                <button
                  type="button"
                  className="btn small"
                  onClick={async () => {
                    await api.revokeInvitation(spaceId, invitation.id);
                    invitations.reload();
                  }}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {(invitations.data?.invitations.length ?? 0) === 0 ? (
        <Empty title="No invitations yet">Invite the relative who knows the branch you cannot fill in yourself.</Empty>
      ) : null}
    </div>
  );
}
