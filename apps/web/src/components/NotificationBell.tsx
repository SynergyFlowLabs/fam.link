import { useEffect, useState } from 'react';
import { api, type Notification } from '../api.js';
import { useAsync } from '../hooks.js';

const KIND_LABEL: Record<string, string> = {
  'proposal.pending': 'needs a decision',
  'proposal.decided': 'decided',
  'invitation.opened': 'opened',
  'invitation.accepted': 'accepted',
  claim: 'claimed',
  duplicates: 'duplicates',
  member: 'member',
  separation: 'separation',
};

/**
 * In-product notification feed. Derived from state, so it can never disagree with the tree, and it
 * never mentions a person the recipient cannot see.
 */
export function NotificationBell({ spaceId, onNavigate }: { spaceId: string; onNavigate: (page: string) => void }) {
  const feed = useAsync(() => api.notifications(spaceId), [spaceId]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [spaceId]);

  const unread = feed.data?.unread ?? 0;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn--quiet"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={async () => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) {
            await api.markNotificationsSeen(spaceId);
            feed.reload();
          }
        }}
      >
        Notices{unread > 0 ? <span className="nav-link__count chip chip--lac">{unread}</span> : null}
      </button>

      {open ? (
        <div
          className="card"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, zIndex: 40, boxShadow: 'var(--shadow-md)' }}
          role="region"
          aria-label="Notifications"
        >
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-0)' }}>Notices</h3>
            <span className="hint">{feed.data?.notifications.length ?? 0}</span>
          </div>

          {(feed.data?.notifications.length ?? 0) === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              Nothing needs you right now. New relatives, claims, and proposed corrections appear here.
            </p>
          ) : null}

          <div className="list">
            {(feed.data?.notifications ?? []).map((notification: Notification) => (
              <button
                key={notification.id}
                type="button"
                className="row"
                style={{ textAlign: 'left', cursor: notification.action ? 'pointer' : 'default' }}
                onClick={() => {
                  if (notification.action) {
                    onNavigate(notification.action);
                    setOpen(false);
                  }
                }}
              >
                <span className="row__main">
                  <span className="row__subject">{notification.title}</span>
                  {notification.detail ? <span className="row__sub">{notification.detail}</span> : null}
                </span>
                <span className="chip chip--muted">{KIND_LABEL[notification.kind] ?? notification.kind}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
