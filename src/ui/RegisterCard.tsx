/**
 * RegisterCard — one office's register on this computer (doc 135 §7.3-7.4):
 * read the size from the office, download on a gesture, follow it, update.
 * Australia and Canada: no account and no key, both publish openly. The
 * office's own words (title, lead, source, staleness) come by key prefix.
 */
import { useEffect, useRef, useState } from 'react';
import type { Key } from '../i18n/strings';
import type { Host } from '../lib/host';
import { formatBytes } from '../lib/onboarding';
import { dataDay, formatDay, fraction, freshness, type MirrorPlan, type RegisterState } from '../lib/register';
import { S, T as TL } from './styles';
import { Stop } from './Timeline';
import { ConfirmRemove, StatePill, TrashIcon, type RemoveControl } from './OfficeTile';

type Tr = (k: Key, v?: Record<string, string | number>) => string;
/** How often a running download is polled; nothing is polled while idle. */
const POLL_MS = 1_000;

/** An office's register card. `onState` keeps the office list in step. */
export function RegisterCard({ registry, words, host, t, lang, onState, epoch = 0, remove }: { registry: 'ipau' | 'cipo' | 'inpi' | 'prv'; words: 'au' | 'ca' | 'fr' | 'se'; host: Host; t: Tr; lang: string; onState: (s: RegisterState) => void; /** Bumped when the register changed elsewhere (deleted from its tile): read it again. */ epoch?: number; /** The same two-step delete as the tile's. */ remove?: RemoveControl }) {
  const REGISTRY = registry;
  const w = (k: string) => t(`${words}.${k}` as Key);
  const [state, setState] = useState<RegisterState | null>(null);
  const [plan, setPlan] = useState<MirrorPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  const apply = (s: RegisterState) => { if (!alive.current) return; setState(s); onStateRef.current(s); };
  const fail = (err: unknown) => { if (alive.current) setError(t('err.other', { why: err instanceof Error ? err.message : String(err) })); };

  useEffect(() => {
    host.mirrorStatus(REGISTRY).then(apply).catch((err) => { console.error('[mnemo-marks] mirrorStatus failed', err); fail(err); });
  }, [host, epoch]);

  const running = !!state && state.phase !== 'idle';
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      host.mirrorStatus(REGISTRY).then(apply).catch((err) => console.error('[mnemo-marks] mirrorStatus poll failed', err));
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running, host]);

  const readSize = async () => {
    setBusy(true); setError(null);
    try { const p = await host.mirrorPlan(REGISTRY); if (alive.current) setPlan(p); } catch (err) { console.error('[mnemo-marks] mirrorPlan failed', err); fail(err); } finally { if (alive.current) setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError(null);
    try { apply(await host.mirrorDownload(REGISTRY)); setPlan(null); } catch (err) { console.error('[mnemo-marks] mirrorDownload failed', err); fail(err); } finally { if (alive.current) setBusy(false); }
  };
  const cancel = () => { host.mirrorCancel(REGISTRY).catch((err) => { console.error('[mnemo-marks] mirrorCancel failed', err); fail(err); }); };

  const installed = state?.installed ?? null;
  const f = state ? fraction(state) : null;
  const fresh = freshness(installed, Date.now());
  const date = (day: string) => formatDay(day, lang);
  const step1: 'todo' | 'done' | 'running' | 'fix' = running ? 'running' : installed ? 'done' : state?.error && state.error !== 'CANCELLED' ? 'fix' : 'todo';
  const pill1 = t(step1 === 'running' ? 'step.running' : step1 === 'done' ? 'step.done' : step1 === 'fix' ? 'step.fix' : 'step.now');

  return (
    <section style={S.card} aria-label={w('title')}>
      <h2 style={S.h2}>{w('title')}</h2>
      <p style={{ ...S.p, ...S.muted }}>{w('lead')}</p>
      <ol style={TL.list}>
        <Stop id={`${registry}-download`} n={1} status={step1} active={!installed || running} last={false}
          title={t('reg.download.title')} text={w('download.text')} pill={pill1}>
          {state?.phase === 'planning' && <div style={S.small}>{t('reg.planning')}</div>}
          {state?.phase === 'downloading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={TL.bar} role="progressbar" aria-valuenow={f === null ? undefined : Math.round(f * 100)}>
                <div style={{ ...TL.barFill, width: f === null ? '0%' : `${(f * 100).toFixed(1)}%` }} />
              </div>
              <div style={S.small}>{t('reg.progress', { done: formatBytes(state.done, lang), total: formatBytes(state.total, lang) })}</div>
            </div>
          )}
          {state?.phase === 'indexing' && <div style={S.small}>{t('reg.indexing')}</div>}
          {running && <button style={S.ghost} onClick={cancel}>{t('reg.cancel')}</button>}
          {!running && !plan && (
            <button style={installed ? S.ghost : S.button} disabled={busy} onClick={() => void readSize()}>
              {t(busy ? 'reg.reading' : installed ? 'reg.update' : 'reg.prepare')}
            </button>
          )}
          {!running && plan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={S.small}>{t(plan.archiveBytes ? 'reg.planArchive' : 'reg.plan', { bytes: formatBytes(plan.bytes, lang), archive: formatBytes(plan.archiveBytes, lang), date: plan.dataDate ? date(plan.dataDate) : '—' })}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={S.button} disabled={busy} onClick={() => void download()}>{t('reg.go', { bytes: formatBytes(plan.bytes, lang) })}</button>
                <button style={S.ghost} onClick={() => setPlan(null)}>{t('reg.notNow')}</button>
              </div>
            </div>
          )}
          {state?.error === 'CANCELLED' && <div style={S.small}>{t('reg.cancelled')}</div>}
          {state?.error && state.error !== 'CANCELLED' && <div style={S.error}>{t('reg.failed', { why: state.error })}</div>}
          {state?.unreadable && <div style={S.error}>{t('reg.unreadable', { why: state.unreadable })}</div>}
        </Stop>
        <Stop id={`${registry}-ready`} n={2} status={installed ? 'done' : 'todo'} active={!!installed && !running} last
          title={t('reg.ready.title')} text={installed ? t('reg.ready.text', {
            date: date(dataDay(installed)),
            // An unreadable count is a dash, never 0 over a real register.
            marks: typeof installed.counts?.marks === 'number' ? installed.counts.marks.toLocaleString(lang) : '—',
            size: formatBytes(installed.sizeBytes, lang),
          }) : t('reg.ready.none')} pill={t(installed ? 'step.done' : 'step.todo')}>
          {installed && fresh.level !== 'none' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <StatePill state={fresh.level} t={t} />
              <span style={S.small}>{fresh.days === 0 ? t('tile.downloadedToday') : t('tile.downloadedAgo', { n: fresh.days })}</span>
            </div>
          )}
          {remove && !remove.armed && (
            <button style={{ ...S.ghost, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }} onClick={remove.onPress}>
              <TrashIcon size={13} /> {t('storage.removeTitle', { size: remove.size })}
            </button>
          )}
          {remove?.armed && <ConfirmRemove remove={remove} t={t} />}
        </Stop>
      </ol>
      {error && <div style={S.error} role="alert">{error}</div>}
      {(registry === 'cipo' || registry === 'inpi') && (installed?.dataDate || plan?.dataDate) && <div style={S.small}>{t(registry === 'cipo' ? 'ca.stale' : 'fr.stale', { date: date(installed?.dataDate ?? plan!.dataDate!) })}</div>}
      {registry === 'inpi' && plan && <div style={S.small}>{t('fr.compressed')}</div>}
      <div style={S.small}>{w('source')}</div>
    </section>
  );
}
