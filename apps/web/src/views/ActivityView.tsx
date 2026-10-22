import { useState } from 'react';
import { api, displayName, type ActivityEntry, type DisputeGroup } from '../api.js';
import { Chip, Empty, Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

const KIND_LABEL: Record<string, string> = {
  'person.created': 'added',
  'person.updated': 'edited',
  'person.claimed': 'claimed',
  'person.separated': 'separated',
  'relationship.created': 'linked',
  'relationship.removed': 'unlinked',
  'proposal.created': 'proposed',
  'proposal.accepted': 'approved',
  'proposal.rejected': 'declined',
  'invitation.created': 'invited',
  'invitation.accepted': 'joined',
  'invitation.revoked': 'revoked',
  'duplicate.merged': 'merged',
  'duplicate.merge.reverted': 'merge undone',
  'report.resolved': 'report reviewed',
  'person.restored': 'restored',
  'member.joined': 'joined',
};

export function ActivityView({ spaceId }: { spaceId: string }) {
  const activity = useAsync(() => api.activity(spaceId), [spaceId]);
  const disputes = useAsync(() => api.disputes(spaceId), [spaceId]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);

  if (activity.error) return <Notice tone="danger">{activity.error}</Notice>;

  return (
    <div className="panel-stack">
      <div className="section-title">
        <h2>Activity and disputes</h2>
        <span className="hint">Every accepted change, attributed and dated</span>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <section>
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Disputed values</h3>
          <span className="hint">Both claims are kept until a person decides</span>
        </div>

        {(disputes.data?.disputes.length ?? 0) === 0 ? (
          <div className="card">
            <p className="small" style={{ margin: 0 }}>
              Nothing is disputed. When two relatives assert different values for the same field, both are kept here
              instead of one silently overwriting the other.
            </p>
          </div>
        ) : null}

        <div className="list">
          {(disputes.data?.disputes ?? []).map((group: DisputeGroup) => (
            <div key={`${group.personId}-${group.field}`} className="card">
              <div className="section-title">
                <h3 style={{ fontSize: 'var(--step-0)' }}>
                  {displayName(group.person)} · {group.field}
                </h3>
                <Chip tone={group.disputed ? 'lac' : 'brass'}>{group.disputed ? 'disputed' : 'proposed'}</Chip>
              </div>
              <div className="list">
                {group.proposals.map((proposal) => (
                  <div key={proposal.id} className="row">
                    <div className="row__main">
                      <div className="row__subject">{formatClaim(proposal.proposedValue)}</div>
                      <div className="row__sub">
                        {proposal.proposedBy} · {proposal.explanation}
                      </div>
                    </div>
                    {group.canResolve ? (
                      <div className="row__actions">
                        <button
                          type="button"
                          className="btn small"
                          onClick={async () => {
                            await api.decideProposal(spaceId, proposal.id, 'reject');
                            disputes.reload();
                            activity.reload();
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary small"
                          onClick={async () => {
                            await api.decideProposal(spaceId, proposal.id, 'accept');
                            disputes.reload();
                            activity.reload();
                          }}
                        >
                          Accept this
                        </button>
                      </div>
                    ) : (
                      <span className="hint">The owner or an administrator decides</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Everything that changed</h3>
        </div>

        {(activity.data?.activity.length ?? 0) === 0 ? (
          <Empty title="Nothing recorded yet">Changes to your family appear here, with who made them.</Empty>
        ) : null}

        <div className="list">
          {(activity.data?.activity ?? []).map((entry: ActivityEntry) => (
            <div key={entry.id} className="row">
              <div className="row__main">
                <div className="row__subject">{entry.summary}</div>
                <div className="row__sub">
                  {new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <div className="row__actions">
                <Chip tone="muted">{KIND_LABEL[entry.kind] ?? entry.kind}</Chip>
                {entry.field && entry.before !== undefined && entry.kind === 'person.updated' ? (
                  <button
                    type="button"
                    className="btn small"
                    onClick={async () => {
                      try {
                        await api.revertActivity(spaceId, entry.id);
                        setMessage({ tone: 'ok', text: 'Reverted. The original change stays in the history.' });
                        activity.reload();
                      } catch (error) {
                        setMessage({
                          tone: 'danger',
                          text: error instanceof Error ? error.message : 'Could not revert that change.',
                        });
                      }
                    }}
                  >
                    Revert
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatClaim(value: unknown): string {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && 'value' in value) {
    const date = value as { value: unknown; precision?: string };
    const text = String(date.value);
    return date.precision === 'year' ? `${text.slice(0, 4)} (year only)` : text;
  }
  return JSON.stringify(value);
}
