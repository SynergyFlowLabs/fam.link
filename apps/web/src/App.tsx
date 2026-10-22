import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  ApiError,
  displayName,
  storedPersona,
  type DuplicateCandidate,
  type PersonView,
  type SessionResponse,
} from './api.js';
import { NotificationBell } from './components/NotificationBell.js';
import { Dialog, Field, Notice } from './components/ui.js';
import { useAsync, useRoute } from './hooks.js';
import { useLocale } from './i18n.js';
import { ActivityView } from './views/ActivityView.js';
import { CalculatorView } from './views/CalculatorView.js';
import { InvitationsView } from './views/InvitationsView.js';
import { InviteView } from './views/InviteView.js';
import { Onboarding } from './views/Onboarding.js';
import { PeopleView } from './views/PeopleView.js';
import { PrivacyView } from './views/PrivacyView.js';
import { ProfilePanel, TreeView } from './views/TreeView.js';

/**
 * App shell: session, family space, and a hash router.
 *
 * The client is deliberately thin. Every permission and privacy decision it renders was already
 * made by the API; when the client hides something, it is a courtesy, not the control.
 */

/** The member the demo opens as. Documented in the README; the account menu switches at any time. */
const DEMO_DEFAULT_PERSONA = 'user-ayesha';

export default function App() {
  const route = useRoute();
  const { locale, setLocale, t } = useLocale();
  const session = useAsync(() => api.session(), []);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>(undefined);
  const [addRelativeTo, setAddRelativeTo] = useState<string | null | undefined>(undefined);
  const [onboarding, setOnboarding] = useState<{ spaceId: string; personId: string } | null>(null);
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);

  const memberships = session.data?.memberships ?? [];
  const membership = useMemo(
    () => memberships.find((entry) => entry.spaceId === spaceId) ?? memberships[0],
    [memberships, spaceId],
  );

  useEffect(() => {
    if (membership && membership.spaceId !== spaceId) setSpaceId(membership.spaceId);
  }, [membership, spaceId]);

  useEffect(() => {
    if (membership?.personId && !focusId) setFocusId(membership.personId);
  }, [membership, focusId]);

  const signIn = useCallback(
    async (userId: string) => {
      await api.signIn(userId);
      session.reload();
    },
    // `session.reload` is stable; depending on the object would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * The app opens straight into the family space.
   *
   * There used to be a "continue as…" persona list, which was a poor front door for a demo and, in
   * an embedded preview, a broken one: the session cookie was dropped as third-party, so the picker
   * simply re-rendered. The default identity is now chosen for you, remembered across reloads, and
   * still switchable from the top bar.
   */
  const personas = session.data?.personas ?? [];
  const defaultPersonaId = useMemo(() => {
    // Open as the administrator, who can see the whole space; the account menu switches from there.
    const administrator = personas.find((persona) => persona.id === DEMO_DEFAULT_PERSONA);
    const anyClaimed = personas.find((persona) => persona.claimed.length > 0);
    return (administrator ?? anyClaimed ?? personas[0])?.id;
  }, [personas]);

  const autoSignInTried = useRef(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    if (session.loading || !session.data) return;
    if (session.data.user || signedOut || autoSignInTried.current) return;

    const wanted = storedPersona() ?? defaultPersonaId;
    if (!wanted) return;
    autoSignInTried.current = true;

    api
      .signIn(wanted)
      .then(() => session.reload())
      .catch(async (cause: unknown) => {
        // A remembered persona can disappear (an account is deleted). Fall back once, then explain.
        if (wanted !== defaultPersonaId && defaultPersonaId) {
          try {
            await api.signIn(defaultPersonaId);
            session.reload();
            return;
          } catch {
            // fall through to the message below
          }
        }
        setSignInError(cause instanceof Error ? cause.message : 'Could not open the demo family.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data, session.loading, signedOut, defaultPersonaId]);

  const signOut = useCallback(async () => {
    await api.signOut();
    setSignedOut(true);
    session.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (session.loading && !session.data) {
    return <div className="invite muted">Opening Fam Link…</div>;
  }

  if (route.path[0] === 'invite' && route.path[1]) {
    return (
      <InviteView
        token={route.path[1]}
        onDone={(nextSpaceId) => {
          setSpaceId(nextSpaceId);
          route.navigate('tree');
          session.reload();
        }}
      />
    );
  }

  if (!session.data?.user) {
    if (signedOut) {
      return (
        <div className="invite">
          <div className="invite__card">
            <div className="invite__eyebrow">Fam Link · private family network</div>
            <p className="invite__quote">You are signed out.</p>
            <p className="invite__who">
              This demo has no sign-in of its own — opening the app signs you in as a member of the sample family.
              You can switch to another member from the account menu once you are in.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                autoSignInTried.current = false;
                setSignInError(null);
                setSignedOut(false);
              }}
            >
              Open the app
            </button>
          </div>
        </div>
      );
    }

    if (signInError) {
      return (
        <div className="invite">
          <div className="invite__card">
            <div className="invite__eyebrow">Fam Link</div>
            <p className="invite__quote">The demo family could not be opened.</p>
            <p className="invite__who">{signInError}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                autoSignInTried.current = false;
                setSignInError(null);
                setSignedOut(false);
                session.reload();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    // Either the first fetch is still running, or an automatic sign-in is in flight.
    return <div className="invite muted">Opening Fam Link…</div>;
  }

  const activeSpaceId = membership?.spaceId ?? spaceId ?? '';
  const canManage = membership?.role === 'admin';
  const page = route.path[0] ?? 'tree';

  if (!activeSpaceId) {
    return (
      <div className="invite">
        <div className="invite__card">
          <div className="invite__eyebrow">Fam Link</div>
          <p className="invite__quote">You are not part of a family space yet.</p>
          <p className="invite__who">
            Ask a relative for an invitation link. Families are private: nobody is discoverable, and nobody is added
            without an invitation.
          </p>
          <div className="row__actions" style={{ marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn" onClick={() => void signOut()}>
              Switch account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <div className="brand">
          <span className="brand__name">{t('app.name', 'Fam Link')}</span>
          <span className="brand__mark">{t('app.private', 'private')}</span>
        </div>
        {[
          ['tree', `nav.tree`, 'Tree'],
          ['people', `nav.people`, 'People'],
          ['calculator', `nav.calculator`, 'Relationship'],
          ['invitations', `nav.invitations`, 'Invitations'],
          ['activity', `nav.activity`, 'Activity'],
          ['privacy', `nav.privacy`, 'Privacy'],
        ].map(([key, label, fallback]) => (
          <a
            key={key}
            className="nav-link"
            href={`#/${key}`}
            aria-current={page === key ? 'page' : undefined}
          >
            {t(label!, fallback)}
          </a>
        ))}
        <div className="rail__foot">
          <p style={{ margin: '0 0 8px' }}>{membership?.space?.name ?? 'Family space'}</p>
          <p style={{ margin: 0 }}>{t('shell.privateNotice')}</p>
        </div>
      </nav>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar__title">
            <h1>{membership?.space?.name ?? 'Family space'}</h1>
            <span className="topbar__meta">
              {membership?.role === 'admin' ? t('shell.admin', 'Family administrator') : t('shell.contributor', 'Contributor')} ·{' '}
              {session.data.user.name}
            </span>
          </div>
          <div className="topbar__actions">
            <label className="visually-hidden" htmlFor="persona-switch">
              Demo account
            </label>
            <select
              id="persona-switch"
              value={session.data.user.id}
              onChange={(event) => signIn(event.target.value)}
              title="Demo: sign in as another family member to see their view"
            >
              {session.data.personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name}
                </option>
              ))}
            </select>
            <label className="visually-hidden" htmlFor="locale-switch">
              Language
            </label>
            <select
              id="locale-switch"
              value={locale}
              onChange={(event) => setLocale(event.target.value === 'ur' ? 'ur' : 'en')}
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
            <NotificationBell spaceId={activeSpaceId} onNavigate={(next) => route.navigate(next === 'proposals' ? 'activity' : next)} />
            <button type="button" className="btn btn--quiet" onClick={() => setNewSpaceOpen(true)}>
              {t('shell.newFamily', 'New family')}
            </button>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                void signOut();
                route.navigate('tree');
              }}
            >
              {t('shell.signOut', 'Sign out')}
            </button>
          </div>
        </header>

        <main className="main">
          {page === 'tree' ? (
            <TreeView
              spaceId={activeSpaceId}
              focusId={focusId}
              selectedPersonId={selectedPersonId}
              onFocus={(personId) => setFocusId(personId)}
              onSelect={(personId) => setSelectedPersonId(personId)}
              onAddRelative={(personId) => setAddRelativeTo(personId ?? null)}
            />
          ) : null}

          {page === 'people' ? (
            <PeopleView
              spaceId={activeSpaceId}
              canManage={canManage}
              onSelect={(personId) => setSelectedPersonId(personId)}
              onFocus={(personId) => {
                setFocusId(personId);
                route.navigate('tree');
              }}
            />
          ) : null}

          {page === 'calculator' ? (
            <CalculatorView spaceId={activeSpaceId} viewerPersonId={membership?.personId} />
          ) : null}

          {page === 'invitations' ? <InvitationsView spaceId={activeSpaceId} /> : null}

          {page === 'activity' ? <ActivityView spaceId={activeSpaceId} /> : null}

          {page === 'privacy' ? (
            <PrivacyView
              spaceId={activeSpaceId}
              personId={membership?.personId}
              onSignOut={() => void signOut()}
            />
          ) : null}

          {selectedPersonId && page === 'people' ? (
            <div style={{ marginTop: 'var(--sp-4)' }}>
              <ProfilePanel
                spaceId={activeSpaceId}
                personId={selectedPersonId}
                onFocus={(personId) => {
                  setFocusId(personId);
                  route.navigate('tree');
                }}
                onSelect={(personId) => setSelectedPersonId(personId)}
                onAddRelative={(personId) => setAddRelativeTo(personId ?? null)}
              />
            </div>
          ) : null}
        </main>
      </div>

      {newSpaceOpen ? (
        <NewSpaceDialog
          onClose={() => setNewSpaceOpen(false)}
          onCreated={(spaceId, personId) => {
            setNewSpaceOpen(false);
            setSpaceId(spaceId);
            setFocusId(personId);
            setOnboarding({ spaceId, personId });
            session.reload();
          }}
        />
      ) : null}

      {onboarding ? (
        <Onboarding
          spaceId={onboarding.spaceId}
          personId={onboarding.personId}
          onClose={() => {
            setOnboarding(null);
            session.reload();
          }}
          onFinished={() => {
            setOnboarding(null);
            session.reload();
            route.navigate('tree');
          }}
        />
      ) : null}

      {addRelativeTo !== undefined ? (
        <AddRelativeDialog
          spaceId={activeSpaceId}
          anchorId={addRelativeTo ?? undefined}
          onClose={() => setAddRelativeTo(undefined)}
          onCreated={(personId) => {
            setAddRelativeTo(undefined);
            setSelectedPersonId(personId);
          }}
        />
      ) : null}
    </div>
  );
}

function NewSpaceDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (spaceId: string, personId: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const created = await api.createSpace(name.trim());
      onCreated(created.space.id, created.personId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the family space.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Start a family tree"
      onClose={onClose}
      actions={
        <button type="button" className="btn btn--primary" disabled={busy || !name.trim()} onClick={() => void create()}>
          {busy ? 'Creating…' : 'Create family space'}
        </button>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        A family space is private by default: no public page, no discovery, no search engine. You will be able to invite
        relatives immediately.
      </p>
      <Field label="Family name" hint="For example: Khan Family">
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="Khan Family" />
      </Field>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Dialog>
  );
}

type RelationChoice = 'parent' | 'child' | 'spouse' | 'sibling' | 'none';

function AddRelativeDialog({
  spaceId,
  anchorId,
  onClose,
  onCreated,
}: {
  spaceId: string;
  anchorId?: string;
  onClose: () => void;
  onCreated: (personId: string) => void;
}) {
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [gender, setGender] = useState<PersonView['gender']>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [relation, setRelation] = useState<RelationChoice>(anchorId ? 'child' : 'none');
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (confirmDuplicate = false) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createPerson(spaceId, {
        givenName: name,
        familyName: familyName || undefined,
        gender,
        ...(birthYear.trim() ? { birthDate: { value: birthYear.trim(), precision: 'year' } } : {}),
        ...(relation === 'child' && anchorId ? { parentId: anchorId } : {}),
        ...(relation === 'parent' && anchorId ? { childId: anchorId } : {}),
        ...(relation === 'spouse' && anchorId ? { partnerId: anchorId } : {}),
        ...(relation === 'sibling' && anchorId ? { siblingOfId: anchorId } : {}),
        confirmDuplicate,
      } as Record<string, unknown>);
      onCreated(created.person.id);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        const payload = cause.payload as { duplicates?: DuplicateCandidate[] };
        setDuplicates(payload.duplicates ?? []);
      } else {
        setError(cause instanceof Error ? cause.message : 'Could not add this person.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Add a relative"
      onClose={onClose}
      actions={
        <button type="button" className="btn btn--primary" disabled={busy || !name.trim()} onClick={() => submit(false)}>
          {busy ? 'Adding…' : 'Add person'}
        </button>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Adding name and relationship is enough. Everything else can be filled in later — by them, if they claim the
        profile.
      </p>

      <Field label="Given name">
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <Field label="Family name" hint="Optional">
        <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Gender" hint="Only used to phrase relationships correctly">
          <select value={gender} onChange={(event) => setGender(event.target.value as PersonView['gender'])}>
            <option value="unknown">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Birth year" hint="A year is enough — partial dates are supported">
          <input
            value={birthYear}
            onChange={(event) => setBirthYear(event.target.value)}
            inputMode="numeric"
            placeholder="1985"
          />
        </Field>
      </div>
      <Field label="Relationship">
        <select value={relation} onChange={(event) => setRelation(event.target.value as RelationChoice)}>
          {anchorId ? (
            <>
              <option value="child">Child of the selected person</option>
              <option value="parent">Parent of the selected person</option>
              <option value="spouse">Spouse or partner of the selected person</option>
            </>
          ) : null}
          {anchorId ? <option value="sibling">Sibling of the selected person</option> : null}
          <option value="none">Not connected yet</option>
        </select>
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {duplicates && duplicates.length > 0 ? (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <Notice tone="info">
            This may already be in the family. A duplicate here becomes a fork in the tree later, so check first.
          </Notice>
          <div className="list" style={{ marginTop: 'var(--sp-3)' }}>
            {duplicates.map((candidate) => {
              const person = candidate.person;
              return (
                <div key={candidate.candidate.id} className="row">
                  <div className="row__main">
                    <div className="row__title" style={{ fontSize: 'var(--step-0)' }}>
                      {displayName(person)}
                    </div>
                    <div className="row__sub">
                      {[candidate.person.relationshipToViewer, ...candidate.signals.map((signal) => signal.detail)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => onCreated(person.id)}
                  >
                    This is them
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--quiet small" style={{ marginTop: 8 }} onClick={() => submit(true)}>
            None of these — add a new person
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
