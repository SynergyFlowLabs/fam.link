import type { ReactNode } from 'react';
import { initials } from '../tree/layout.js';

export function Avatar({
  name,
  gender,
  size = 34,
}: {
  name: string;
  gender?: 'female' | 'male' | 'other' | 'unknown';
  size?: number;
}) {
  const className = `node__avatar${gender === 'female' ? ' node__avatar--female' : ''}`;
  return (
    <span className={className} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'lac' | 'brass' | 'muted';
}) {
  const suffix = tone === 'default' ? '' : ` chip--${tone}`;
  return <span className={`chip${suffix}`}>{children}</span>;
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'ok' | 'danger';
}) {
  const suffix = tone === 'info' ? '' : ` notice--${tone}`;
  return <div className={`notice${suffix}`}>{children}</div>;
}

export function Dialog({
  title,
  children,
  onClose,
  actions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        <div className="dialog__actions">
          {actions}
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-7)' }}>
      <h3 style={{ fontSize: 'var(--step-1)', marginBottom: 8 }}>{title}</h3>
      <p className="muted small" style={{ margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
