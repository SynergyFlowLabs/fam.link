import { useState } from 'react';
import { api, displayName, type PersonView } from '../api.js';
import { Chip, Field, Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

/**
 * Privacy settings. Everything here is enforced by the API; this screen only expresses it.
 * The wording avoids reassuring abstraction: it says exactly who can see what, and what survives
 * account deletion.
 */

const CONFIGURABLE_FIELDS: Array<{ field: string; label: string; who: string }> = [
  { field: 'birthDate', label: 'Exact birth date', who: 'Hidden from most relatives by default' },
  { field: 'birthPlace', label: 'Birth place', who: 'Visible to the family by default' },
  { field: 'placesLived', label: 'Places lived', who: 'Visible to the family by default' },
  { field: 'biography', label: 'Biography', who: 'Visible to the family by default' },
  { field: 'photoUrl', label: 'Photograph', who: 'Immediate family by default' },
  { field: 'deathDate', label: 'Date of death', who: 'Family record' },
];

const SCOPES: Array<{ id: string; label: string }> = [
  { id: 'private', label: 'Only me' },
  { id: 'selected', label: 'Selected relatives' },
  { id: 'immediate-family', label: 'Immediate family' },
  { id: 'family-space', label: 'Entire family space' },
  { id: 'link', label: 'Anyone with my private link' },
];

export function PrivacyView({
  spaceId,
  personId,
  onSignOut,
}: {
  spaceId: string;
  personId?: string;
  onSignOut: () => void;
}) {
  const branches = useAsync(() => api.hiddenBranches(spaceId), [spaceId]);
  const preferences = useAsync(() => api.notificationPreferences(spaceId), [spaceId]);
  const reports = useAsync(
    () =>
      api.reports(spaceId).catch(() => ({ reports: [] as Awaited<ReturnType<typeof api.reports>>['reports'] })),
    [spaceId],
  );
  const people = useAsync(() => api.people(spaceId), [spaceId]);
  const profile = useAsync(() => (personId ? api.person(spaceId, personId) : Promise.resolve(null)), [spaceId, personId]);
  const person = profile.data?.person;
  const [message, setMessage] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [branchTarget, setBranchTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const everyone: PersonView[] = [...(people.data?.living ?? []), ...(people.data?.deceased ?? [])].filter(
    (candidate) => candidate.id !== person?.id,
  );

  const setScope = async (field: string, scope: string) => {
    if (!person) return;
    try {
      await api.setVisibility(spaceId, person.id, field, scope);
      profile.reload();
      setMessage({ tone: 'ok', text: `${field} is now visible to: ${SCOPES.find((s) => s.id === scope)?.label ?? scope}.` });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Could not change that setting.' });
    }
  };

  return (
    <div className="panel-stack">
      <div>
        <h2 style={{ fontSize: 'var(--step-2)' }}>Privacy</h2>
        <p className="muted" style={{ marginTop: 4, maxWidth: '64ch' }}>
          Relationships are emotionally sensitive, so access is granted rather than inherited. Being related does not
          give anyone the right to see your information.
        </p>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <section className="card">
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Who sees what on your profile</h3>
          <span className="hint">{person ? displayName(person) : 'no profile claimed'}</span>
        </div>

        {!person ? (
          <p className="small muted" style={{ margin: 0 }}>
            You have not claimed a profile in this family space, so there is nothing to configure yet. Claim your
            profile from an invitation to control your own fields.
          </p>
        ) : (
          <div className="list">
            {CONFIGURABLE_FIELDS.map((entry) => (
              <div className="row" key={entry.field}>
                <div className="row__main">
                  <div className="row__subject">{entry.label}</div>
                  <div className="row__sub">{entry.who}</div>
                </div>
                <select
                  aria-label={`Visibility for ${entry.label}`}
                  value={person.visibility?.[entry.field] ?? 'family-space'}
                  disabled={person.canEditVisibility === false}
                  onChange={(event) => void setScope(entry.field, event.target.value)}
                >
                  {SCOPES.map((scope) => (
                    <option key={scope.id} value={scope.id}>
                      {scope.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>
          Public visibility does not exist for living people. Contact details, addresses and personal documents stay
          with the owner and their custodian, whatever the scope says.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Hidden branches</h3>
          <span className="hint">Yours alone</span>
        </div>
        <p className="small muted">
          Hide a part of the family from your own view — a separation, or information you do not want to see. Nobody
          else’s view changes, and the records are not deleted.
        </p>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Hide this person and everyone below them">
            <select value={branchTarget} onChange={(event) => setBranchTarget(event.target.value)}>
              <option value="">Choose a person…</option>
              {everyone.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {displayName(candidate)}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn"
            disabled={!branchTarget || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.hideBranch(spaceId, branchTarget);
                setBranchTarget('');
                branches.reload();
                people.reload();
                setMessage({ tone: 'ok', text: 'Branch hidden from your view. Nothing was deleted.' });
              } catch (error) {
                setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Could not hide that branch.' });
              } finally {
                setBusy(false);
              }
            }}
          >
            Hide branch
          </button>
        </div>

        <div className="list" style={{ marginTop: 'var(--sp-3)' }}>
          {(branches.data?.branches ?? []).map((branch) => (
            <div key={branch.rootPersonId} className="row">
              <div className="row__main">
                <div className="row__subject">{branch.name}</div>
                <div className="row__sub">{branch.relationship ?? 'hidden from your view'}</div>
              </div>
              <div className="row__actions">
                <Chip tone="muted">hidden</Chip>
                <button
                  type="button"
                  className="btn small"
                  onClick={async () => {
                    await api.unhideBranch(spaceId, branch.rootPersonId);
                    branches.reload();
                    people.reload();
                  }}
                >
                  Show again
                </button>
              </div>
            </div>
          ))}
          {(branches.data?.branches.length ?? 0) === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              No hidden branches.
            </p>
          ) : null}
        </div>
      </section>

      {(reports.data?.reports.length ?? 0) > 0 ? (
        <section className="card">
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-1)' }}>Safety queue</h3>
            <span className="hint">Visible to administrators only</span>
          </div>
          <p className="small muted" style={{ margin: '0 0 var(--sp-3)' }}>
            Reports from members. Reporting is not a vote: one report reaches an administrator, and the outcome is
            recorded in the activity log.
          </p>
          <div className="list">
            {reports.data!.reports.map((report) => (
              <div className="row" key={report.id} style={{ alignItems: 'flex-start' }}>
                <div className="row__main">
                  <div className="row__subject">
                    {report.personName ?? 'A profile'}{' '}
                    <Chip tone={report.status === 'open' ? 'brass' : 'muted'}>{report.status}</Chip>
                  </div>
                  <div className="row__sub">“{report.reason}”</div>
                  <div className="hint">
                    Reported by {report.reportedBy} · {new Date(report.createdAt).toLocaleDateString()}
                    {report.resolutionNote ? ` · ${report.resolutionNote}` : ''}
                  </div>
                </div>
                {report.status === 'open' ? (
                  <div className="row__actions">
                    <button
                      type="button"
                      className="btn small"
                      onClick={async () => {
                        await api.resolveReport(spaceId, report.id, 'dismissed');
                        reports.reload();
                        setMessage({ tone: 'ok', text: 'Report dismissed, with the decision recorded.' });
                      }}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary small"
                      onClick={async () => {
                        await api.resolveReport(spaceId, report.id, 'resolved');
                        reports.reload();
                        setMessage({ tone: 'ok', text: 'Report marked resolved.' });
                      }}
                    >
                      Mark resolved
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>What reaches you</h3>
          <span className="hint">Only your own feed changes</span>
        </div>
        <p className="small muted" style={{ margin: '0 0 var(--sp-3)' }}>
          Choose what appears in your notifications. Nothing here changes what relatives see, and a safety notice
          cannot be switched off.
        </p>
        <div className="list">
          {(preferences.data?.categories ?? []).map((category) => (
            <div className="row" key={category.id}>
              <div className="row__main">
                <div className="row__subject">{category.label}</div>
                <div className="row__sub">{category.description}</div>
              </div>
              <div className="row__actions">
                {category.mutable ? (
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={category.enabled}
                      onChange={async (event) => {
                        try {
                          const result = await api.setNotificationPreference(spaceId, category.id, event.target.checked);
                          preferences.reload();
                          setMessage({
                            tone: 'ok',
                            text: `${category.label}: ${result.categories.find((entry) => entry.id === category.id)?.enabled ? 'on' : 'off'}.`,
                          });
                        } catch (error) {
                          setMessage({
                            tone: 'danger',
                            text: error instanceof Error ? error.message : 'Could not change that setting.',
                          });
                          preferences.reload();
                        }
                      }}
                    />
                    <span>{category.enabled ? 'On' : 'Off'}</span>
                  </label>
                ) : (
                  <Chip tone="brass">Always on</Chip>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Your data</h3>
        </div>
        <div className="row">
          <div className="row__main">
            <div className="row__subject">Export this family space</div>
            <div className="row__sub">
              An open JSON export, limited to the people and fields you are allowed to see.
            </div>
          </div>
          <a className="btn small" href={`/api/spaces/${spaceId}/export`} download>
            Download export
          </a>
        </div>

        <div className="row" style={{ marginTop: 'var(--sp-2)' }}>
          <div className="row__main">
            <div className="row__subject">Delete your account</div>
            <div className="row__sub">
              Your account and contact details are removed. Profiles you created stay in the tree, unclaimed — relatives
              rely on those relationships — and an administrator can remove a profile that should not exist.
            </div>
          </div>
          <button
            type="button"
            className="btn btn--danger small"
            onClick={async () => {
              if (!window.confirm('Delete your account? Contact details are removed; family relationships you recorded stay.')) {
                return;
              }
              try {
                const result = await api.deleteAccount();
                setMessage({
                  tone: 'ok',
                  text: `Account deleted. ${result.retained.peopleProfiles} profile(s) kept in the tree, unclaimed.`,
                });
                window.setTimeout(onSignOut, 900);
              } catch (error) {
                setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Could not delete the account.' });
              }
            }}
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}
