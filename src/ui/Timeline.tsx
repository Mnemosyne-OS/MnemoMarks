/**
 * Timeline — the onboarding drawn as a vertical line of numbered stops.
 * A stop says its state in a pill that never wraps; the stop the human is
 * on is lit, the ones after it are dimmed, the ones done carry a check.
 */
import type { ReactNode } from 'react';
import type { StepStatus } from '../lib/onboarding';
import { T as TL } from './styles';

/** One stop of the timeline. */
export function Stop({ n, status, active, last, title, text, pill, children, id }: {
  n: number;
  status: StepStatus;
  active: boolean;
  last: boolean;
  title: string;
  text: string;
  pill: string;
  children?: ReactNode;
  id: string;
}) {
  const done = status === 'done';
  const fix = status === 'fix';
  const node = done ? TL.nodeDone : fix ? TL.nodeFix : active ? TL.nodeActive : TL.node;
  const pillStyle = done ? TL.pillDone : fix ? TL.pillFix : active ? TL.pillActive : TL.pill;
  return (
    <li style={{ ...TL.stop, opacity: done || active || fix ? 1 : 0.62 }} data-step={id} data-status={status}>
      <div style={TL.rail}>
        <div style={node} aria-hidden="true">{done ? '✓' : fix ? '!' : n}</div>
        {!last && <div style={{ ...TL.line, ...(done ? TL.lineDone : {}) }} />}
      </div>
      <div style={{ ...TL.body, ...(active ? TL.bodyActive : {}) }}>
        <div style={TL.head}>
          <span style={TL.stopTitle}>{title}</span>
          <span style={pillStyle}>{pill}</span>
        </div>
        <div style={TL.text}>{text}</div>
        {children && <div style={TL.actions}>{children}</div>}
      </div>
    </li>
  );
}

/** A link shown as what it is: the address, clickable, plus a button (the main action only on the current stop). */
export function OutLink({ label, url, onOpen, primary }: { label: string; url: string; onOpen: (url: string) => void; primary: boolean }) {
  return (
    <div style={TL.linkRow}>
      <button style={primary ? TL.linkButton : TL.linkGhost} onClick={() => onOpen(url)}>{label} ↗</button>
      <button style={TL.url} onClick={() => onOpen(url)} title={url}>{url.replace(/^https:\/\//, '')}</button>
    </div>
  );
}
