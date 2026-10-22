import { useState } from 'react';
import { api, type InvitePreview } from '../api.js';
import { Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

/**
 * The public invitation page. It must earn the click with the relationship itself, and must not
 * leak anything beyond first names.
 */
export function InviteView({ token, onDone }: { token: string; onDone: (spaceId: string) => void }) {
  const preview = useAsync<InvitePreview>(() => api.invitePreview(token), [token]);
  const session = useAsync(() => api.session(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async (userId: string) => {
    setBusy(true);
    try {
      const result = await api.acceptInvite(token, userId);
      setMessage('Claimed. You now own this profile — correct anything that is wrong.');
      window.setTimeout(() => onDone(result.spaceId), 600);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not accept this invitation.');
    } finally {
      setBusy(false);
    }
  };

  if (preview.error) {
    return (
      <div className="invite">
        <div className="invite__card">
          <Notice tone="danger">{preview.error}</Notice>
          <p className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
            Ask the relative who invited you for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  if (!preview.data) {
    return (
      <div className="invite">
        <div className="invite__card muted">Opening invitation…</div>
      </div>
    );
  }

  const { invitation, space, inviter, person } = preview.data;
  const relative = invitation.relationshipLabel ?? 'relative';

  return (
    <div className="invite">
      <div className="invite__card">
        <div className="invite__eyebrow">
          {inviter?.name ?? 'A relative'} · {space?.name ?? 'family tree'}
        </div>
        <p className="invite__quote">
          {inviter?.name?.split(' ')[0] ?? 'Someone'} added you as {person ? person.givenName : 'yourself'}’s{' '}
          <em>{relative}</em> in the {space?.name ?? 'family'} tree.
        </p>
        <p className="invite__who">
          Claim your profile to correct your own details and complete your branch. Everything stays private to the
          family — nothing here is public.
        </p>

        {message ? <Notice tone="ok">{message}</Notice> : null}

        <div style={{ marginTop: 'var(--sp-5)' }}>
          <div className="hint" style={{ marginBottom: 6 }}>
            This demo signs you in as one of the family’s existing accounts:
          </div>
          <div className="list">
            {(session.data?.personas ?? []).slice(0, 4).map((persona) => (
              <div key={persona.id} className="row">
                <div className="row__main">
                  <div className="row__title" style={{ fontSize: 'var(--step-0)' }}>
                    {persona.name}
                  </div>
                  <div className="row__sub">{persona.email}</div>
                </div>
                <button
                  type="button"
                  className="btn btn--primary small"
                  disabled={busy}
                  onClick={() => accept(persona.id)}
                >
                  Claim as {persona.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="row__actions" style={{ marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="btn btn--quiet small"
            onClick={async () => {
              await api.declineInvite(token);
              setMessage('Declined. You will not be invited to this space again automatically.');
            }}
          >
            This is not me
          </button>
          <span className="hint">Link expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
