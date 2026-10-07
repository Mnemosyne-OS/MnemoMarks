/**
 * UsptoSetup — connect the USPTO with the human's own key (doc 135 §7). The
 * key is sealed in main; this card only ever learns THAT one is stored, and
 * what the USPTO answered when the app showed it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from '../i18n/strings';
import { errorCode, USPTO_KEY_PAGE, type Host } from '../lib/host';
import { formatBytes, stepsOf, type KeyState, type StepStatus, type Verify } from '../lib/onboarding';
import { S, T as TL } from './styles';
import { OutLink, Stop } from './Timeline';

type Tr = (k: Key, v?: Record<string, string | number>) => string;

const REGISTRY = 'uspto';

const STEP_KEY: Record<StepStatus, Key> = { todo: 'step.todo', done: 'step.done', fix: 'step.fix', running: 'step.running' };

/** The USPTO card. `onConnected` tells the office list whether the USPTO accepted the key. */
export function UsptoSetup({ host, t, lang, onConnected }: { host: Host; t: Tr; lang: string; onConnected: (connected: boolean) => void }) {
  const [key, setKey] = useState<KeyState | null>(null);
  const [verify, setVerify] = useState<Verify | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgetArmed, setForgetArmed] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const say = useCallback((err: unknown) => {
    const code = errorCode(err);
    setError(code ? t(`err.${code}` as Key) : t('err.other', { why: err instanceof Error ? err.message : String(err) }));
  }, [t]);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const r = await host.verify(REGISTRY);
      if (alive.current) setVerify(r);
    } catch (err) {
      console.error('[mnemo-marks] verify failed', err);
      if (alive.current) say(err);
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [host, say]);

  // Read once per host. `say` changes with every render (`t` is rebuilt), so it
  // rides a ref: listing it would re-read the state on each render and put back
  // 'no key' over a key the human has just saved.
  const sayRef = useRef(say);
  sayRef.current = say;
  useEffect(() => {
    host.keyState(REGISTRY)
      .then((k) => { if (alive.current) setKey(k); })
      .catch((err) => { console.error('[mnemo-marks] keyState failed', err); if (alive.current) sayRef.current(err); });
  }, [host]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const k = await host.keySet(REGISTRY, draft);
      if (!alive.current) return;
      setKey(k);
      setDraft('');
      setVerify(null);
      await check();
    } catch (err) {
      console.error('[mnemo-marks] keySet failed', err);
      if (alive.current) say(err);
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const forget = async () => {
    if (!forgetArmed) { setForgetArmed(true); return; }
    setForgetArmed(false);
    try {
      const k = await host.keyClear(REGISTRY);
      if (!alive.current) return;
      setKey(k);
      setVerify(null);
    } catch (err) {
      console.error('[mnemo-marks] keyClear failed', err);
      if (alive.current) say(err);
    }
  };

  const steps = stepsOf(key, verify, checking);
  const date = (ms: number) => new Date(ms).toLocaleString(lang);
  const connected = verify?.state === 'ok';
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  useEffect(() => { onConnectedRef.current(connected); }, [connected]);
  const order = ['account', 'key', 'paste', 'check'] as const;
  // The stop the human is on: the first one not done (none once the office accepts the key).
  const current = order.find((s) => steps[s] !== 'done') ?? null;
  const pill = (s: (typeof order)[number]) => t(s === current && steps[s] === 'todo' ? 'step.now' : STEP_KEY[steps[s]]);
  const openUrl = (url: string) => {
    host.openExternal(url).catch((err) => { console.error('[mnemo-marks] openExternal failed', err); say(err); });
  };

  return (
      <section style={S.card} aria-label={t('us.title')}>
        <h2 style={S.h2}>{t('us.title')}</h2>
        <p style={{ ...S.p, ...S.muted }}>{t('us.lead')}</p>
        <ol style={TL.list}>
          <Stop id="account" n={1} status={steps.account} active={current === 'account'} last={false}
            title={t('step.account.title')} text={t('step.account.text')} pill={pill('account')}>
            <OutLink label={t('step.openAccount')} url={USPTO_KEY_PAGE} onOpen={openUrl} primary={current === 'account'} />
          </Stop>
          <Stop id="key" n={2} status={steps.key} active={current === 'key'} last={false}
            title={t('step.key.title')} text={t('step.key.text')} pill={pill('key')}>
            <OutLink label={t('step.openKey')} url={USPTO_KEY_PAGE} onOpen={openUrl} primary={current === 'key'} />
          </Stop>
          <Stop id="paste" n={3} status={steps.paste} active={current === 'paste'} last={false}
            title={t('step.paste.title')} text={t('step.paste.text')} pill={pill('paste')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                style={{ ...S.input, flex: 1, minWidth: 220, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('paste.placeholder')}
                aria-label={t('paste.placeholder')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && draft && !saving) void save(); }}
              />
              <button style={S.button} disabled={!draft || saving} onClick={() => void save()}>{t(saving ? 'paste.saving' : 'paste.save')}</button>
            </div>
            {key?.unreadable && <div style={S.error}>{t('key.unreadable')}</div>}
            {key?.present && (
              <div style={S.small}>
                {key.savedAt !== null && <span>{t('key.saved', { date: date(key.savedAt) })} </span>}
                <span>{t(key.seal === 'sealed' ? 'key.sealed' : key.seal === 'plaintext' ? 'key.plaintext' : 'key.sealUnknown')}</span>
              </div>
            )}
          </Stop>
          <Stop id="check" n={4} status={steps.check} active={current === 'check'} last
            title={t('step.check.title')} text={t('step.check.text')} pill={pill('check')}>
            {verify && <VerifyView verify={verify} t={t} date={date} lang={lang} />}
            {key?.present && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={S.ghost} disabled={checking} onClick={() => void check()}>{t(checking ? 'step.running' : 'key.check')}</button>
                <button style={S.ghost} onClick={() => void forget()}>{t(forgetArmed ? 'key.forgetConfirm' : 'key.forget')}</button>
              </div>
            )}
          </Stop>
        </ol>
        {error && <div style={S.error} role="alert">{error}</div>}
      </section>
  );
}

/** What the USPTO answered, in words, with its own listing when it accepted the key. */
function VerifyView({ verify, t, date, lang }: { verify: Verify; t: Tr; date: (ms: number) => string; lang: string }) {
  const at = <div style={S.small}>{t('verify.at', { date: date(verify.at) })}</div>;
  if (verify.state === 'refused') return <div style={S.error} role="status">{t('verify.refused', { status: verify.status })}{at}</div>;
  if (verify.state === 'unreachable') return <div style={S.error} role="status">{t('verify.unreachable', { why: verify.why })}{at}</div>;
  if (verify.state === 'unexpected') return <div style={S.error} role="status">{t('verify.unexpected', { status: verify.status, sample: verify.sample || '—' })}{at}</div>;
  const total = (bytes: number | null, partial: boolean) => (partial ? t('list.partial', { bytes: formatBytes(bytes, lang) }) : formatBytes(bytes, lang));
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color: 'var(--accent)' }}>{t('verify.ok')}</div>
      {(['daily'] as const).map((which) => {
        const p = verify.products[which];
        if (!p) return null;
        if (p.state === 'missing') return <div key={which} style={S.small}>{t('list.missing', { status: p.status })}</div>;
        if (p.listing.files === 0) return <div key={which} style={S.small}>{t('list.empty', { shape: (p.shape ?? []).join(', ') || '—' })}</div>;
        const l = p.listing;
        return <div key={which} style={S.small}>{t('list.daily', { files: l.files, bytes: total(l.bytes, l.bytesPartial), newest: l.newest?.date ?? l.newest?.name ?? '—', newestBytes: formatBytes(l.newest?.bytes ?? null, lang) })}</div>;
      })}
      <div style={S.small}>{verify.catalog === null
        ? t('list.catalogFailed')
        : t('list.catalog', { n: verify.catalog.length, ids: verify.catalog.map((p) => (p.title ? `${p.id} (${p.title})` : p.id)).join(' · ') || '—' })}</div>
      <div style={S.small}>{t('list.next')}</div>
      {at}
    </div>
  );
}
