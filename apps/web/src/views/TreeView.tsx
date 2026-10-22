import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  displayName,
  lifeSpan,
  type PersonView,
  type ProfileResponse,
  type TreeResponse,
} from '../api.js';
import { Avatar, Chip, Notice } from '../components/ui.js';
import { useAsync } from '../hooks.js';
import { CARD_HEIGHT, CARD_WIDTH, layoutTree } from '../tree/layout.js';

/**
 * The tree view is the product's front door. It renders only the focus window the API sends and
 * draws relationships from the same graph the calculator uses — no parallel model in the client.
 */

interface TreeViewProps {
  spaceId: string;
  focusId?: string;
  selectedPersonId?: string;
  onFocus: (personId: string) => void;
  onSelect: (personId: string) => void;
  onAddRelative: (personId?: string) => void;
}

export function TreeView({ spaceId, focusId, selectedPersonId, onFocus, onSelect, onAddRelative }: TreeViewProps) {
  const [depth, setDepth] = useState({ up: 2, down: 2 });
  const tree = useAsync<TreeResponse>(
    () => api.tree(spaceId, focusId, depth.up, depth.down),
    [spaceId, focusId, depth.up, depth.down],
  );

  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [outline, setOutline] = useState(false);
  const dragging = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((current) => {
        const next = Math.min(1.8, Math.max(0.45, current.scale - event.deltaY * 0.0012));
        const ratio = next / current.scale;
        return { scale: next, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!tree.data) return;
    // Centre the focus card in the canvas when the window changes.
    const layout = layoutTree(tree.data.nodes, tree.data.edges, tree.data.focusId);
    const focus = layout.nodes.get(tree.data.focusId);
    const element = canvas.current;
    if (!focus || !element) return;
    setView({
      scale: 1,
      x: element.clientWidth / 2 - (focus.x + CARD_WIDTH / 2),
      y: element.clientHeight / 2 - (focus.y + CARD_HEIGHT / 2),
    });
  }, [tree.data]);

  const layout = useMemo(
    () => (tree.data ? layoutTree(tree.data.nodes, tree.data.edges, tree.data.focusId) : null),
    [tree.data],
  );

  if (tree.loading && !tree.data) return <div className="card muted">Opening the family tree…</div>;
  if (tree.error) return <Notice tone="danger">{tree.error}</Notice>;
  if (!tree.data || !layout) return null;

  const focusPerson = tree.data.nodes.find((node) => node.id === tree.data!.focusId);
  const selected = tree.data.nodes.find((node) => node.id === selectedPersonId) ?? focusPerson;
  const people = new Map(tree.data.nodes.map((node) => [node.id, node]));

  return (
    <div className="tree-layout">
      <div>
        <div className="section-title">
          <h2>{focusPerson ? `${displayName(focusPerson)}’s branch` : 'Family tree'}</h2>
          <div className="row__actions">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setDepth((current) => ({ ...current, up: Math.max(1, current.up - 1) }))}
              aria-label="Show fewer generations above"
            >
              − ancestors
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setDepth((current) => ({ ...current, up: Math.min(4, current.up + 1) }))}
              aria-label="Show more generations above"
            >
              + ancestors
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setDepth((current) => ({ ...current, down: Math.min(4, current.down + 1) }))}
              aria-label="Show more generations below"
            >
              + descendants
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              aria-pressed={outline}
              onClick={() => setOutline((value) => !value)}
            >
              {outline ? 'Show chart' : 'Show outline'}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => onAddRelative()}>
              Add a relative
            </button>
          </div>
        </div>

        {outline ? (
          <TreeOutline
            nodes={tree.data.nodes}
            edges={tree.data.edges}
            focusId={tree.data.focusId}
            onSelect={onSelect}
            onFocus={onFocus}
          />
        ) : (
        <div
          className="tree-canvas"
          ref={canvas}
          onPointerDown={(event) => {
            dragging.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y };
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragging.current) return;
            setView((current) => ({
              ...current,
              x: dragging.current!.originX + (event.clientX - dragging.current!.x),
              y: dragging.current!.originY + (event.clientY - dragging.current!.y),
            }));
          }}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onPointerLeave={() => {
            dragging.current = null;
          }}
        >
          <div
            className="tree-stage"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              width: layout.width,
              height: layout.height,
            }}
          >
            <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
              {layout.connectors.map((connector) =>
                connector.kind === 'partner' ? (
                  <line
                    key={connector.id}
                    x1={connector.x1}
                    y1={connector.y1}
                    x2={connector.x2}
                    y2={connector.y2}
                    stroke={connector.relationshipKind === 'former-spouse' ? 'var(--line-strong)' : 'var(--lac)'}
                    strokeWidth={2}
                    strokeDasharray={connector.relationshipKind === 'former-spouse' ? '4 4' : undefined}
                  />
                ) : (
                  <path
                    key={connector.id}
                    d={parentPath(connector)}
                    fill="none"
                    stroke={connector.relationshipKind === 'biological-parent' ? 'var(--ink-soft)' : 'var(--brass)'}
                    strokeWidth={1.5}
                    strokeDasharray={connector.relationshipKind === 'biological-parent' ? undefined : '5 4'}
                  />
                ),
              )}
            </svg>

            {[...layout.nodes.values()].map((positioned) => {
              const person = people.get(positioned.id);
              if (!person) return null;
              return (
                <button
                  type="button"
                  key={positioned.id}
                  className={`node${person.id === tree.data!.focusId ? ' node--focus' : ''}${
                    person.livingStatus === 'deceased' ? ' node--deceased' : ''
                  }`}
                  style={{ left: positioned.x, top: positioned.y }}
                  onClick={() => onSelect(person.id)}
                  onDoubleClick={() => onFocus(person.id)}
                  aria-label={`${displayName(person)}, ${person.relationshipToViewer ?? 'relative'}. Select for details.`}
                >
                  <Avatar name={displayName(person)} gender={person.gender} />
                  <span>
                    <span className="node__name">{displayName(person)}</span>
                    <span className="node__meta">
                      {lifeSpan(person) || (person.livingStatus === 'living' ? 'living' : 'dates unknown')}
                    </span>
                    {person.relationshipToViewer ? <span className="node__rel">{person.relationshipToViewer}</span> : null}
                  </span>
                  {person.isMinor ? <span className="node__badge">minor</span> : null}
                  {person.claimed ? null : <span className="visually-hidden">Unclaimed profile</span>}
                </button>
              );
            })}
          </div>

          <div className="tree-toolbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom in"
              onClick={() => setView((current) => ({ ...current, scale: Math.min(1.8, current.scale + 0.15) }))}
            >
              +
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Zoom out"
              onClick={() => setView((current) => ({ ...current, scale: Math.max(0.45, current.scale - 0.15) }))}
            >
              −
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Reset view"
              onClick={() => {
                const element = canvas.current;
                const focusPosition = layout.nodes.get(tree.data!.focusId);
                if (!element || !focusPosition) return;
                setView({
                  scale: 1,
                  x: element.clientWidth / 2 - (focusPosition.x + CARD_WIDTH / 2),
                  y: element.clientHeight / 2 - (focusPosition.y + CARD_HEIGHT / 2),
                });
              }}
            >
              ⤢
            </button>
          </div>

          <div className="tree-legend">
            {layout.generations} generations · {tree.data.nodes.length} people
            {tree.data.hiddenCount > 0 ? ` · ${tree.data.hiddenCount} outside this view` : ''}
          </div>
        </div>
        )}
      </div>

      {selected ? (
        <ProfilePanel
          spaceId={spaceId}
          personId={selected.id}
          onFocus={onFocus}
          onSelect={onSelect}
          onAddRelative={onAddRelative}
        />
      ) : null}
    </div>
  );
}

/**
 * Accessible fallback for the chart (F-3.6): the same relationships as a navigable outline.
 * The chart is not the only way to use the tree — it is one view of it.
 */
function TreeOutline({
  nodes,
  edges,
  focusId,
  onSelect,
  onFocus,
}: {
  nodes: PersonView[];
  edges: Array<{ id: string; fromPersonId: string; toPersonId: string; kind: string }>;
  focusId: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const people = new Map(nodes.map((node) => [node.id, node]));
  const parentsOf = (id: string) =>
    edges
      .filter((edge) => edge.toPersonId === id && (edge.kind.endsWith('parent') || edge.kind === 'guardian'))
      .map((edge) => people.get(edge.fromPersonId))
      .filter((person): person is PersonView => Boolean(person));
  const childrenOf = (id: string) =>
    edges
      .filter((edge) => edge.fromPersonId === id && (edge.kind.endsWith('parent') || edge.kind === 'guardian'))
      .map((edge) => people.get(edge.toPersonId))
      .filter((person): person is PersonView => Boolean(person));
  const partnersOf = (id: string) =>
    edges
      .filter((edge) => !edge.kind.endsWith('parent') && (edge.fromPersonId === id || edge.toPersonId === id))
      .map((edge) => people.get(edge.fromPersonId === id ? edge.toPersonId : edge.fromPersonId))
      .filter((person): person is PersonView => Boolean(person));

  const focus = people.get(focusId);
  if (!focus) return null;

  const Row = ({ person }: { person: PersonView }) => (
    <li>
      <button type="button" className="person-pill" onClick={() => onSelect(person.id)}>
        {displayName(person)}
      </button>
      <span className="hint"> {lifeSpan(person)}</span>{' '}
      <button type="button" className="btn btn--quiet small" onClick={() => onFocus(person.id)}>
        focus
      </button>
    </li>
  );

  return (
    <div className="card" style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
      <h3 style={{ fontSize: 'var(--step-1)', marginBottom: 'var(--sp-3)' }}>Family outline</h3>
      <div className="grid-2">
        <div>
          <h4 className="hint" style={{ margin: '0 0 6px' }}>
            Parents
          </h4>
          <ul className="timeline">
            {parentsOf(focus.id).map((person) => (
              <Row key={person.id} person={person} />
            ))}
          </ul>
          <h4 className="hint" style={{ margin: 'var(--sp-3) 0 6px' }}>
            Focus
          </h4>
          <ul className="timeline">
            <Row person={focus} />
          </ul>
          <h4 className="hint" style={{ margin: 'var(--sp-3) 0 6px' }}>
            Partners
          </h4>
          <ul className="timeline">
            {partnersOf(focus.id).map((person) => (
              <Row key={person.id} person={person} />
            ))}
          </ul>
        </div>
        <div>
          <h4 className="hint" style={{ margin: '0 0 6px' }}>
            Children
          </h4>
          <ul className="timeline">
            {childrenOf(focus.id).map((person) => (
              <Row key={person.id} person={person} />
            ))}
          </ul>
          <p className="hint" style={{ marginTop: 'var(--sp-3)' }}>
            This outline covers the same people as the chart, in text. Use it with a keyboard or a screen reader.
          </p>
        </div>
      </div>
    </div>
  );
}

function parentPath(connector: { x1: number; y1: number; x2: number; y2: number }): string {
  const midY = connector.y1 + Math.min(34, Math.abs(connector.y2 - connector.y1) / 2);
  return `M ${connector.x1} ${connector.y1} L ${connector.x1} ${midY} L ${connector.x2} ${midY} L ${connector.x2} ${connector.y2}`;
}

interface ProfilePanelProps {
  spaceId: string;
  personId: string;
  onFocus: (personId: string) => void;
  onSelect: (personId: string) => void;
  onAddRelative: (personId?: string) => void;
}

export function ProfilePanel({ spaceId, personId, onFocus, onSelect, onAddRelative }: ProfilePanelProps) {
  const profile = useAsync<ProfileResponse>(() => api.person(spaceId, personId), [spaceId, personId]);
  const [message, setMessage] = useState<{ tone: 'ok' | 'info' | 'danger'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ biography: '', birthPlace: '', givenName: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setMessage(null);
  }, [personId]);

  if (profile.loading && !profile.data) return <div className="panel card muted">Opening profile…</div>;
  if (profile.error) return <Notice tone="danger">{profile.error}</Notice>;
  if (!profile.data) return null;

  const { person, relationship, relatives, proposals, activity, permissions } = profile.data;

  const save = async () => {
    setBusy(true);
    try {
      const response = await api.updatePerson(spaceId, personId, {
        ...(draft.biography !== (person.biography ?? '') ? { biography: draft.biography } : {}),
        ...(draft.birthPlace !== (person.birthPlace ?? '') ? { birthPlace: draft.birthPlace } : {}),
        ...(draft.givenName !== person.givenName ? { givenName: draft.givenName } : {}),
      });
      const applied = Object.keys(response.applied);
      const proposed = response.proposed.map((proposal) => proposal.field);
      setEditing(false);
      profile.reload();
      setMessage({
        tone: proposed.length > 0 ? 'info' : 'ok',
        text:
          proposed.length > 0
            ? `Saved ${applied.length > 0 ? `${applied.join(', ')} and ` : ''}sent ${proposed.join(', ')} for approval.`
            : `Updated ${applied.join(', ') || 'profile'}.`,
      });
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="panel" aria-label={`Profile of ${displayName(person)}`}>
      <div className="panel__head">
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <Avatar name={displayName(person)} gender={person.gender} size={48} />
          <div>
            <div className="panel__name">{displayName(person)}</div>
            <div className="panel__sub">
              {[lifeSpan(person), person.birthPlace].filter(Boolean).join(' · ') || 'Dates and places not recorded'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {relationship ? <Chip>{relationship.term}</Chip> : <Chip tone="muted">you</Chip>}
          {person.claimed ? <Chip tone="brass">claimed</Chip> : <Chip tone="muted">unclaimed</Chip>}
          {person.isMinor ? <Chip tone="lac">minor</Chip> : null}
          {person.livingStatus === 'deceased' ? <Chip tone="muted">deceased</Chip> : null}
        </div>
      </div>

      <div className="panel__body">
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

        {relationship && relationship.termId !== 'self' ? (
          <div>
            <div className="section-title">
              <h3 style={{ fontSize: 'var(--step-0)' }}>How you are related</h3>
            </div>
            <p className="small" style={{ margin: 0 }}>
              {relationship.sentence}
            </p>
            {relationship.urduTerm ? (
              <p className="small muted" lang="ur" dir="rtl" style={{ margin: '6px 0 0' }}>
                {relationship.urduTerm}
              </p>
            ) : null}
            {relationship.alternatives.length > 0 ? (
              <p className="small muted" style={{ margin: '6px 0 0' }}>
                Also related: {relationship.alternatives.map((alternative) => alternative.term).join('; ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-0)' }}>Details</h3>
            {permissions.canEditDirectly ? (
              <button
                type="button"
                className="btn btn--quiet small"
                onClick={() => {
                  setDraft({
                    biography: person.biography ?? '',
                    birthPlace: person.birthPlace ?? '',
                    givenName: person.givenName,
                  });
                  setEditing((value) => !value);
                }}
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            ) : null}
          </div>

          {editing ? (
            <div>
              <div className="field">
                <label htmlFor="edit-name">Given name</label>
                <input
                  id="edit-name"
                  value={draft.givenName}
                  onChange={(event) => setDraft({ ...draft, givenName: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-place">Birth place</label>
                <input
                  id="edit-place"
                  value={draft.birthPlace}
                  onChange={(event) => setDraft({ ...draft, birthPlace: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="edit-bio">Biography</label>
                <textarea
                  id="edit-bio"
                  value={draft.biography}
                  onChange={(event) => setDraft({ ...draft, biography: event.target.value })}
                />
              </div>
              <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : (
            <dl className="kv">
              <dt>Born</dt>
              <dd>{person.birthDate ? `${person.birthDate.value.slice(0, 4)}${person.birthDate.precision === 'year' ? '' : ` (${person.birthDate.precision})`}` : 'Not recorded'}</dd>
              <dt>Place</dt>
              <dd>{person.birthPlace ?? 'Not recorded'}</dd>
              <dt>Living</dt>
              <dd>{person.livingStatus}</dd>
              {person.biography ? (
                <>
                  <dt>Life</dt>
                  <dd>{person.biography}</dd>
                </>
              ) : null}
            </dl>
          )}

          {person.hiddenFields.length > 0 ? (
            <p className="hint" style={{ marginTop: 'var(--sp-2)' }}>
              {person.hiddenFields.length} field{person.hiddenFields.length === 1 ? '' : 's'} hidden from you by this
              person’s privacy settings ({person.hiddenFields.join(', ')}).
            </p>
          ) : null}
        </div>

        <div>
          <div className="section-title">
            <h3 style={{ fontSize: 'var(--step-0)' }}>Close family</h3>
            <button type="button" className="btn btn--quiet small" onClick={() => onAddRelative(person.id)}>
              Add
            </button>
          </div>
          {(
            [
              ['Parents', relatives.parents],
              ['Partners', relatives.partners],
              ['Siblings', relatives.siblings],
              ['Children', relatives.children],
            ] as const
          ).map(([label, people]) =>
            people.length > 0 ? (
              <div key={label} style={{ marginBottom: 'var(--sp-2)' }}>
                <div className="hint">{label}</div>
                <div className="relatives">
                  {people.map((relative: PersonView) => (
                    <button
                      key={relative.id}
                      type="button"
                      className="person-pill"
                      onClick={() => onSelect(relative.id)}
                    >
                      {displayName(relative)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <button type="button" className="btn btn--quiet small" onClick={() => onFocus(person.id)}>
            Focus the tree here
          </button>
        </div>

        {proposals.length > 0 ? (
          <div>
            <div className="section-title">
              <h3 style={{ fontSize: 'var(--step-0)' }}>Open changes</h3>
            </div>
            <div className="list">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <div className="row__main">
                    <div className="row__title" style={{ fontSize: 'var(--step-0)' }}>
                      {proposal.field}
                    </div>
                    <div className="row__sub">{proposal.explanation}</div>
                    <div className="row__sub">
                      <Chip tone={proposal.status === 'proposed' ? 'brass' : 'muted'}>{proposal.status}</Chip>
                    </div>
                  </div>
                  {proposal.canDecide ? (
                    <div className="row__actions">
                      <button
                        type="button"
                        className="btn small"
                        onClick={async () => {
                          await api.decideProposal(spaceId, proposal.id, 'reject');
                          profile.reload();
                        }}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary small"
                        onClick={async () => {
                          await api.decideProposal(spaceId, proposal.id, 'accept');
                          profile.reload();
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activity.length > 0 ? (
          <div>
            <div className="section-title">
              <h3 style={{ fontSize: 'var(--step-0)' }}>History</h3>
            </div>
            <ul className="timeline">
              {activity.slice(0, 6).map((entry) => (
                <li key={entry.id}>
                  <span
                    className={`timeline__dot${
                      entry.kind === 'person.claimed' ? ' timeline__dot--claim' : entry.kind.includes('proposal') ? ' timeline__dot--change' : ''
                    }`}
                  />
                  <span>
                    {entry.summary}
                    <br />
                    <span className="muted small">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="row__actions">
          <button
            type="button"
            className="btn btn--quiet small"
            onClick={async () => {
              const reason = window.prompt('What should an administrator know about this profile?');
              if (!reason) return;
              try {
                await api.report(spaceId, personId, reason);
                setMessage({ tone: 'ok', text: 'Reported. An administrator will review it.' });
              } catch (error) {
                setMessage({ tone: 'danger', text: error instanceof Error ? error.message : 'Could not send the report.' });
              }
            }}
          >
            Report a problem
          </button>
          {permissions.canRequestSeparation ? (
          <button
            type="button"
            className="btn btn--danger small"
            onClick={async () => {
              if (!window.confirm('Separate this profile from the tree? The record will be hidden, not erased.')) return;
              await api.separate(spaceId, personId);
              setMessage({ tone: 'ok', text: 'Separation recorded. The record is hidden, not erased.' });
              profile.reload();
            }}
          >
              Request separation from this tree
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
