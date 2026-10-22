import { useEffect, useState } from 'react';
import { api, displayName, lifeSpan, type DuplicateCandidate, type PersonView } from '../api.js';
import { Avatar, Chip, Empty, Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

type MergeHistoryEntry = Awaited<ReturnType<typeof api.merges>>['merges'][number];

interface PeopleViewProps {
  spaceId: string;
  onSelect: (personId: string) => void;
  onFocus: (personId: string) => void;
  canManage: boolean;
}

export function PeopleView({ spaceId, onSelect, onFocus, canManage }: PeopleViewProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const people = useAsync(() => api.people(spaceId, debounced), [spaceId, debounced]);
  const duplicates = useAsync(() => api.duplicates(spaceId), [spaceId]);
  const health = useAsync(() => api.health(spaceId), [spaceId]);
  const merges = useAsync(() => (canManage ? api.merges(spaceId) : Promise.resolve({ merges: [] })), [spaceId, canManage]);

  const mergeHistory = merges.data?.merges ?? [];
  const results = people.data?.results ?? [];
  const living = people.data?.living ?? [];
  const deceased = people.data?.deceased ?? [];

  return (
    <div className="panel-stack">
      <div className="section-title">
        <h2>People</h2>
        <span className="hint">{living.length + deceased.length} in your view</span>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="people-search">Search by any name, spelling, or script</label>
        <input
          id="people-search"
          type="search"
          value={query}
          placeholder="Bilal, Billo, بلال…"
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="hint">Search is limited to the people you are allowed to see.</span>
      </div>

      {people.error ? <Notice tone="danger">{people.error}</Notice> : null}

      {debounced ? (
        <div className="list">
          {results.length === 0 ? (
            <Empty title="No match in your visible family">
              Try another spelling, a nickname, or a name in Urdu script.
            </Empty>
          ) : (
            results.map((person) => (
              <PersonRow key={person.id} person={person} onSelect={onSelect} onFocus={onFocus} subtitle={person.matchedOn ? `matched “${person.matchedOn}”` : undefined} />
            ))
          )}
        </div>
      ) : (
        <>
          <div>
            <div className="section-title">
              <h3 style={{ fontSize: 'var(--step-1)' }}>Living</h3>
              <span className="hint">Private by default</span>
            </div>
            <div className="list">
              {living.map((person) => (
                <PersonRow key={person.id} person={person} onSelect={onSelect} onFocus={onFocus} subtitle={lifeSpan(person)} />
              ))}
            </div>
          </div>

          {deceased.length > 0 ? (
            <div>
              <div className="section-title">
                <h3 style={{ fontSize: 'var(--step-1)' }}>Remembered</h3>
                <span className="hint">{deceased.length} people</span>
              </div>
              <div className="list">
                {deceased.map((person) => (
                  <PersonRow key={person.id} person={person} onSelect={onSelect} onFocus={onFocus} subtitle={lifeSpan(person)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {health.data && health.data.findings.length > 0 ? (
        <section className="card">
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-1)' }}>Tree health</h3>
            <span className="hint">
              {health.data.linkedToSomeone} of {health.data.peopleCount} people are connected
            </span>
          </div>
          <div className="list">
            {health.data.findings.map((finding) => (
              <div className="row" key={finding.id} style={{ alignItems: 'flex-start' }}>
                <div className="row__main">
                  <div className="row__subject">
                    {finding.title} <Chip tone={finding.severity === 'blocking' ? 'lac' : 'muted'}>{finding.people.length}</Chip>
                  </div>
                  <div className="row__sub">{finding.detail}</div>
                  <div className="hint">{finding.people.map((person) => person.name).join(' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div>
        <div className="section-title">
          <h3 style={{ fontSize: 'var(--step-1)' }}>Possible duplicates</h3>
          <span className="hint">Relationship overlap weighs more than a name match</span>
        </div>
        {duplicates.loading && !duplicates.data ? <div className="card muted">Checking for duplicates…</div> : null}
        {duplicates.data && duplicates.data.candidates.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0 }} className="small">
              No duplicate candidates in your visible family. That is the outcome we want: the tree stays one tree.
            </p>
          </div>
        ) : null}
        <div className="list">
          {(duplicates.data?.candidates ?? []).map((candidate) => (
            <DuplicateRow
              key={candidate.key}
              candidate={candidate}
              canManage={canManage}
              onResolved={() => {
                duplicates.reload();
                merges.reload();
              }}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      {mergeHistory.length > 0 ? (
        <div>
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-1)' }}>Merge history</h3>
            <span className="hint">Every merge can be undone once</span>
          </div>
          <div className="list">
            {mergeHistory.map((merge) => (
              <MergeRow key={merge.id} spaceId={spaceId} merge={merge} canManage={canManage} onDone={merges.reload} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MergeRow({
  spaceId,
  merge,
  canManage,
  onDone,
}: {
  spaceId: string;
  merge: MergeHistoryEntry;
  canManage: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const undo = async () => {
    setBusy(true);
    try {
      const result = await api.revertMerge(spaceId, merge.id);
      setMessage(result.note ?? 'Merge undone. Both records are back.');
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not undo that merge.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row">
      <div className="row__main">
        <div className="row__subject">
          {merge.survivorName ?? 'record'} absorbed {merge.absorbedName ?? 'a duplicate'}
        </div>
        <div className="row__sub">
          {merge.mergedBy ? `${merge.mergedBy}, ` : ''}
          {new Date(merge.mergedAt).toLocaleString()}
          {merge.revertedAt ? ` · undone ${new Date(merge.revertedAt).toLocaleString()}` : ''}
        </div>
        {message ? <div className="hint">{message}</div> : null}
      </div>
      {canManage && !merge.revertedAt ? (
        <div className="row__actions">
          <button type="button" className="btn small" disabled={busy} onClick={() => void undo()}>
            Undo merge
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PersonRow({
  person,
  subtitle,
  onSelect,
  onFocus,
}: {
  person: PersonView;
  subtitle?: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  return (
    <div className="row">
      <div className="row__main" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
        <Avatar name={displayName(person)} gender={person.gender} />
        <div>
          <div className="row__title">{displayName(person)}</div>
          <div className="row__sub">{[subtitle, person.relationshipToViewer].filter(Boolean).join(' · ') || 'relationship not yet recorded'}</div>
        </div>
      </div>
      <div className="row__actions">
        {person.claimed ? <Chip tone="brass">claimed</Chip> : <Chip tone="muted">unclaimed</Chip>}
        <button type="button" className="btn small" onClick={() => onSelect(person.id)}>
          Profile
        </button>
        <button type="button" className="btn btn--quiet small" onClick={() => onFocus(person.id)}>
          In tree
        </button>
      </div>
    </div>
  );
}

function DuplicateRow({
  candidate,
  canManage,
  onResolved,
  onSelect,
}: {
  candidate: DuplicateCandidate;
  canManage: boolean;
  onResolved: () => void;
  onSelect: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (action: 'merge' | 'dismiss') => {
    setBusy(true);
    try {
      if (action === 'merge') {
        await api.merge(candidate.person.spaceId, candidate.person.id, candidate.candidate.id);
        setMessage('Merged. The absorbed record and its links are recoverable.');
      } else {
        await api.dismissDuplicate(candidate.person.spaceId, candidate.person.id, candidate.candidate.id);
        setMessage('Dismissed permanently.');
      }
      onResolved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not resolve.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="row__main">
        <div className="row__title">
          {displayName(candidate.person)} and {displayName(candidate.candidate)}
        </div>
        <div className="row__sub">
          {candidate.signals.map((signal) => signal.detail).join(' · ')} — confidence {Math.round(candidate.score * 100)}%
        </div>
        {message ? <div className="hint">{message}</div> : null}
      </div>
      <div className="row__actions">
        <button type="button" className="btn small" onClick={() => onSelect(candidate.person.id)}>
          Review
        </button>
        {canManage ? (
          <>
            <button type="button" className="btn small" disabled={busy} onClick={() => act('dismiss')}>
              Not a duplicate
            </button>
            <button type="button" className="btn btn--primary small" disabled={busy} onClick={() => act('merge')}>
              Merge
            </button>
          </>
        ) : (
          <span className="hint">An administrator resolves duplicates</span>
        )}
      </div>
    </div>
  );
}
