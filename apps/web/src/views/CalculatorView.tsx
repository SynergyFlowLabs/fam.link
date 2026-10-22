import { useEffect, useState } from 'react';
import { api, displayName, type PersonView } from '../api.js';
import { Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';

/**
 * The relationship calculator is the feature families show each other at weddings, so the result
 * is the page: a sentence, the path in words, and the cultural term — not a form and a table.
 */
export function CalculatorView({ spaceId, viewerPersonId }: { spaceId: string; viewerPersonId?: string }) {
  const people = useAsync(() => api.people(spaceId), [spaceId]);
  const [fromId, setFromId] = useState(viewerPersonId ?? '');
  const [toId, setToId] = useState('');
  const [shareState, setShareState] = useState<string | null>(null);

  const everyone: PersonView[] = [...(people.data?.living ?? []), ...(people.data?.deceased ?? [])];

  useEffect(() => {
    if (!fromId && viewerPersonId) setFromId(viewerPersonId);
  }, [viewerPersonId, fromId]);

  const result = useAsync(
    () => (fromId && toId ? api.relationship(spaceId, fromId, toId) : Promise.resolve(null)),
    [spaceId, fromId, toId],
  );

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
    setShareState(null);
  };

  return (
    <div className="panel-stack">
      <div>
        <h2 style={{ fontSize: 'var(--step-3)' }}>How are we related?</h2>
        <p className="muted" style={{ marginTop: 6, maxWidth: '62ch' }}>
          Pick two people. Fam Link answers from the family graph — parentage, adoption, marriage and
          partnership — and shows the path it used, so the answer can be checked.
        </p>
      </div>

      <div className="calc">
        <div className="card">
          <div className="field">
            <label htmlFor="calc-from">First person</label>
            <select id="calc-from" value={fromId} onChange={(event) => setFromId(event.target.value)}>
              <option value="">Choose…</option>
              {everyone.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn--quiet small" onClick={swap}>
            ⇅ Swap
          </button>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="calc-to">Second person</label>
            <select id="calc-to" value={toId} onChange={(event) => setToId(event.target.value)}>
              <option value="">Choose…</option>
              {everyone.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
          </div>
          <span className="hint">Only people visible to you appear in this list.</span>
        </div>

        {people.error ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Notice tone="danger">{people.error}</Notice>
          </div>
        ) : null}

        {result.error ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <Notice tone="danger">{result.error}</Notice>
          </div>
        ) : null}

        {result.data ? (
          <div className="calc__result">
            <div className="calc__sentence">
              {result.data.sentence.split(result.data.term).map((part, index, all) => (
                <span key={index}>
                  {part}
                  {index < all.length - 1 ? <span className="calc__term">{result.data!.term}</span> : null}
                </span>
              ))}
            </div>

            <div className="calc__path">
              {result.data.description ? <span>{result.data.description}</span> : null}
              <span>basis: {result.data.basis}</span>
              {result.data.urduTerm ? (
                <span lang="ur" dir="rtl">
                  {result.data.urduTerm}
                </span>
              ) : null}
              {result.data.alternatives.map((alternative) => (
                <span key={alternative.term}>also: {alternative.term}</span>
              ))}
            </div>

            <div style={{ marginTop: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  // The share card is intentionally scrubbed: first names and the relationship only.
                  const text = `${result.data!.people.from.givenName} and ${result.data!.people.to.givenName} are ${result.data!.term}s: ${result.data!.sentence}`;
                  await navigator.clipboard?.writeText(text);
                  setShareState('Copied a shareable version. No dates or contact details are included.');
                }}
              >
                Copy to share
              </button>
              {shareState ? <span className="small" style={{ alignSelf: 'center' }}>{shareState}</span> : null}
            </div>
          </div>
        ) : (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <p style={{ margin: 0 }} className="muted small">
              Choose two people to see the relationship, the connection path, and the nearest common ancestor.
            </p>
          </div>
        )}
      </div>

      {result.data ? (
        <div className="card">
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-1)' }}>The path</h3>
            <span className="hint">{result.data.description || 'direct'}</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {result.data.people.from.givenName} → {result.data.description.replace(/^your /, '')} →{' '}
            {result.data.people.to.givenName}
          </p>
        </div>
      ) : null}
    </div>
  );
}
