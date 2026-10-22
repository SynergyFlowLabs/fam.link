import { useState } from 'react';
import { api } from '../api.js';
import { Dialog, Field, Notice } from '../components/ui.js';

/**
 * Onboarding (F-2.6). Never an empty canvas: a short sequence of questions, each skippable, ending
 * with an invitation to the relative most likely to complete the branch.
 *
 * Two minutes of questions should produce a family structure the person recognises — that is the
 * activation bar in the PRD, not "account created".
 */

type Step = 'name' | 'parents' | 'siblings' | 'partner' | 'children' | 'invite' | 'done';

const STEP_ORDER: Step[] = ['name', 'parents', 'siblings', 'partner', 'children', 'invite', 'done'];

const COPY: Record<Step, { title: string; question: string; hint: string }> = {
  name: {
    title: 'Start with you',
    question: 'What is your name?',
    hint: 'This becomes your own profile. You can hide any field later, per relative.',
  },
  parents: {
    title: 'Your parents',
    question: 'Who are your parents?',
    hint: 'Add one or both. If you only know a name, that is enough.',
  },
  siblings: {
    title: 'Your siblings',
    question: 'Do you have brothers or sisters?',
    hint: 'They will share the parents you just added.',
  },
  partner: {
    title: 'Your partner',
    question: 'Do you have a spouse or partner?',
    hint: 'Marriages, former marriages and partnerships are all supported.',
  },
  children: {
    title: 'Your children',
    question: 'Do you have children?',
    hint: 'Profiles for minors stay private to the immediate family by default.',
  },
  invite: {
    title: 'Complete the branch',
    question: 'Who can help complete this branch?',
    hint: 'The invitation names the relationship, which is why relatives answer it.',
  },
  done: {
    title: 'That is a family',
    question: 'Your tree has a shape now.',
    hint: 'Add more relatives whenever you like. Every change is recorded with who made it.',
  },
};

export function Onboarding({
  spaceId,
  personId,
  onClose,
  onFinished,
}: {
  spaceId: string;
  personId: string;
  onClose: () => void;
  onFinished: () => void;
}) {
  const [step, setStep] = useState<Step>('name');
  const [fullName, setFullName] = useState('');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const advance = () => {
    const index = STEP_ORDER.indexOf(step);
    setStep(STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]!);
    setFirst('');
    setSecond('');
    setError(null);
  };

  const addPeople = async (create: (name: string) => Promise<void>, names: string[]) => {
    const entries = names.map((name) => name.trim()).filter(Boolean);
    if (entries.length === 0) {
      advance();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const name of entries) await create(name);
      setAddedCount((count) => count + entries.length);
      advance();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add that person.');
    } finally {
      setBusy(false);
    }
  };

  const split = (name: string): { givenName: string; familyName?: string } => {
    const [given, ...rest] = name.trim().split(/\s+/);
    return { givenName: given ?? name, ...(rest.length > 0 ? { familyName: rest.join(' ') } : {}) };
  };

  const body = () => {
    switch (step) {
      case 'name':
        return (
          <>
            <Field label="Your name">
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus placeholder="Bilal Khan" />
            </Field>
          </>
        );
      case 'parents':
        return (
          <>
            <Field label="Parent 1" hint="A name is enough; dates come later">
              <input value={first} onChange={(event) => setFirst(event.target.value)} autoFocus placeholder="Ahmed Khan" />
            </Field>
            <Field label="Parent 2" hint="Optional">
              <input value={second} onChange={(event) => setSecond(event.target.value)} placeholder="Zainab Khan" />
            </Field>
          </>
        );
      case 'siblings':
        return (
          <>
            <Field label="Sisters or brothers" hint="Separate several names with commas">
              <input value={first} onChange={(event) => setFirst(event.target.value)} autoFocus placeholder="Sana, Humza" />
            </Field>
          </>
        );
      case 'partner':
        return (
          <Field label="Spouse or partner" hint="Optional">
            <input value={first} onChange={(event) => setFirst(event.target.value)} autoFocus placeholder="Hina Raza" />
          </Field>
        );
      case 'children':
        return (
          <Field label="Children" hint="Separate several names with commas">
            <input value={first} onChange={(event) => setFirst(event.target.value)} autoFocus placeholder="Hamza, Zoya" />
          </Field>
        );
      case 'invite':
        return (
          <Field label="Relative’s name or email" hint="We create a private link you can send yourself">
            <input value={first} onChange={(event) => setFirst(event.target.value)} autoFocus placeholder="Nadeem" />
          </Field>
        );
      case 'done':
        return (
          <div className="panel-stack">
            <p className="small" style={{ margin: 0 }}>
              You added yourself{addedCount > 0 ? ` and ${addedCount} ${addedCount === 1 ? 'relative' : 'relatives'}` : ''}.
              The tree is now a structure you can recognise — which is the point of onboarding.
            </p>
            {inviteLink ? (
              <Notice tone="ok">
                Invitation ready: <span style={{ wordBreak: 'break-all' }}>{inviteLink}</span>
              </Notice>
            ) : null}
          </div>
        );
    }
    return null;
  };

  const next = async () => {
    if (step === 'name') {
      setBusy(true);
      try {
        await api.updatePerson(spaceId, personId, split(fullName));
        advance();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your name.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === 'parents') {
      await addPeople(async (name) => {
        await api.createPerson(spaceId, { ...split(name), childId: personId, confirmDuplicate: true });
      }, [first, second]);
      return;
    }

    if (step === 'siblings') {
      const names = first.split(',').map((name) => name.trim()).filter(Boolean);
      await addPeople(async (name) => {
        await api.createPerson(spaceId, { ...split(name), siblingOfId: personId, confirmDuplicate: true });
      }, names);
      return;
    }

    if (step === 'partner') {
      await addPeople(async (name) => {
        await api.createPerson(spaceId, { ...split(name), partnerId: personId, confirmDuplicate: true });
      }, [first]);
      return;
    }

    if (step === 'children') {
      const names = first.split(',').map((name) => name.trim()).filter(Boolean);
      await addPeople(async (name) => {
        await api.createPerson(spaceId, { ...split(name), parentId: personId, confirmDuplicate: true });
      }, names);
      return;
    }

    if (step === 'invite') {
      setBusy(true);
      try {
        const created = await api.createInvitation(spaceId, { channel: 'whatsapp' });
        setInviteLink(`${window.location.origin}/#/invite/${created.invitation.token}`);
        advance();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not create an invitation.');
      } finally {
        setBusy(false);
      }
      return;
    }

    onFinished();
  };

  const copy = COPY[step];
  const index = STEP_ORDER.indexOf(step);

  return (
    <Dialog
      title={copy.title}
      onClose={onClose}
      actions={
        <>
          {step !== 'done' ? (
            <button type="button" className="btn btn--quiet" onClick={advance} disabled={busy}>
              Skip
            </button>
          ) : null}
          <button type="button" className="btn btn--primary" onClick={() => void next()} disabled={busy}>
            {step === 'done' ? 'Open my tree' : busy ? 'Saving…' : 'Continue'}
          </button>
        </>
      }
    >
      <p className="hint" style={{ marginTop: 0 }}>
        Step {Math.min(index + 1, 6)} of 6
      </p>
      <h3 style={{ fontSize: 'var(--step-1)', marginBottom: 4 }}>{copy.question}</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        {copy.hint}
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {body()}
    </Dialog>
  );
}
