import { api } from '../api.js';
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
  'member.joined': 'joined',
};

export function ActivityView({ spaceId }: { spaceId: string }) {
  const activity = useAsync(() => api.activity(spaceId), [spaceId]);
  if (activity.error) return <Notice tone="danger">{activity.error}</Notice>;

  return (
    <div className="panel-stack">
      <div className="section-title">
        <h2>Activity</h2>
        <span className="hint">Every accepted change, attributed and dated</span>
      </div>

      {(activity.data?.activity.length ?? 0) === 0 ? (
        <Empty title="Nothing recorded yet">Changes to your family appear here, with who made them.</Empty>
      ) : null}

      <div className="list">
        {(activity.data?.activity ?? []).map((entry) => (
          <div key={entry.id} className="row">
            <div className="row__main">
              <div className="row__subject">{entry.summary}</div>
              <div className="row__sub">
                {new Date(entry.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
            <Chip tone="muted">{KIND_LABEL[entry.kind] ?? entry.kind}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}
