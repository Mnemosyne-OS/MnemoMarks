/**
 * App — MnemoMarks (doc 135 §7): one tile per trademark office, the chosen
 * office's steps beside the tiles, and a list of names checked against every
 * register on disk. An office with no register is named in every answer,
 * never counted as "no mark".
 */
import { useEffect, useState } from 'react';
import { useI18n } from './i18n/useI18n';
import { sdkHost, type Host } from './lib/host';
import { dataDay, diskUse, formatDay, freshness, type RegisterState } from './lib/register';
import { formatBytes } from './lib/onboarding';
import { S, T as TL } from './ui/styles';
import { OfficeTile, TrashIcon, type RemoveControl, type TileState } from './ui/OfficeTile';
import { RegisterCard } from './ui/RegisterCard';
import { SearchPanel, type Coverage } from './ui/SearchPanel';
import { UsptoSetup } from './ui/UsptoSetup';

type OfficeId = 'ipau' | 'cipo' | 'inpi' | 'prv' | 'uspto';

/** The MnemoMarks window. `host` is replaceable so a test can render it without the bridge. */
export default function App({ host = sdkHost }: { host?: Host }) {
  const { t, lang } = useI18n();
  const [office, setOffice] = useState<OfficeId>('ipau');
  const [tab, setTab] = useState<'search' | 'registers'>('search');
  const [au, setAu] = useState<RegisterState | null>(null);
  const [ca, setCa] = useState<RegisterState | null>(null);
  const [fr, setFr] = useState<RegisterState | null>(null);
  const [se, setSe] = useState<RegisterState | null>(null);
  const [usConnected, setUsConnected] = useState(false);
  const [epochs, setEpochs] = useState<Record<string, number>>({});
  const [armed, setArmed] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<Record<string, string>>({});
  const now = Date.now();
  const states: Record<string, RegisterState | null> = { ipau: au, cipo: ca, inpi: fr, prv: se };
  const disk = diskUse([au, ca, fr, se]);

  // An armed delete disarms itself: a second press minutes later is not a confirmation.
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(null), 6_000);
    return () => clearTimeout(id);
  }, [armed]);

  const remove = (registry: string) => {
    if (armed !== registry) { setArmed(registry); setRemoveError((e) => ({ ...e, [registry]: '' })); return; }
    setArmed(null);
    host.mirrorRemove(registry)
      .then(() => setEpochs((e) => ({ ...e, [registry]: (e[registry] ?? 0) + 1 })))
      .catch((err) => {
        console.error('[mnemo-marks] mirrorRemove failed', err);
        setRemoveError((e) => ({ ...e, [registry]: t('storage.failed', { why: err instanceof Error ? err.message : String(err) }) }));
      });
  };
  const removeFor = (registry: string): RemoveControl | undefined => {
    const inst = states[registry]?.installed;
    if (!inst || (states[registry]?.phase ?? 'idle') !== 'idle') return undefined;
    return {
      size: formatBytes(inst.sizeBytes, lang),
      armed: armed === registry,
      onPress: () => remove(registry),
      onCancel: () => setArmed(null),
      error: removeError[registry] || null,
    };
  };
  // One colour per office on the disk bar, from the shell's own tokens.
  const SEGMENT: Record<string, string> = { ipau: 'var(--accent)', cipo: 'var(--success)', inpi: 'var(--warning)', prv: 'var(--danger)' };
  const CODE: Record<string, string> = { ipau: 'AU', cipo: 'CA', inpi: 'FR', prv: 'SE' };
  const segments = Object.entries(states)
    .map(([id, s]) => ({ id, bytes: s?.installed?.sizeBytes ?? 0 }))
    .filter((x) => x.bytes > 0);

  const registerTile = (s: RegisterState | null): { state: TileState; lines: string[] } => {
    const inst = s?.installed ?? null;
    const running = !!s && s.phase !== 'idle';
    if (!inst) return { state: 'none', lines: [t(running ? 'tile.downloading' : 'offices.noRegister')] };
    const f = freshness(inst, now);
    const marks = typeof inst.counts?.marks === 'number' ? inst.counts.marks.toLocaleString(lang) : '—';
    return {
      state: f.level,
      lines: [
        t('tile.data', { marks, date: formatDay(dataDay(inst), lang) }),
        f.days === 0 ? t('tile.downloadedToday') : t('tile.downloadedAgo', { n: f.days ?? '—' }),
      ],
    };
  };

  const tiles: { id: OfficeId; code: string; name: string; state: TileState; lines: string[] }[] = [
    { id: 'ipau', code: 'AU', name: t('office.ipau'), ...registerTile(au) },
    { id: 'cipo', code: 'CA', name: t('office.cipo'), ...registerTile(ca) },
    { id: 'inpi', code: 'FR', name: t('office.inpi'), ...registerTile(fr) },
    { id: 'prv', code: 'SE', name: t('office.prv'), ...registerTile(se) },
    { id: 'uspto', code: 'US', name: t('office.uspto'), state: usConnected ? 'connected' : 'disconnected', lines: [t('tile.usKey')] },
  ];

  const coverage: Coverage[] = tiles.map((x) => {
    const inst = x.id === 'uspto' ? null : states[x.id]?.installed ?? null;
    return { id: x.id, code: x.code, name: x.name, state: x.state, date: inst ? formatDay(dataDay(inst), lang) : null };
  });
  const anyRegister = !!au?.installed || !!ca?.installed || !!fr?.installed || !!se?.installed;

  return (
    <div className="mm-page">
      <header style={S.header}>
        <div style={S.title}>MnemoMarks</div>
        <div className="mm-hide-short" style={S.muted}>{t('app.subtitle')}</div>
      </header>

      <div role="tablist" style={TL.tabs}>
        <button role="tab" aria-selected={tab === 'search'} style={{ ...TL.tab, ...(tab === 'search' ? TL.tabOn : {}) }} onClick={() => setTab('search')}>{t('tab.search')}</button>
        <button role="tab" aria-selected={tab === 'registers'} style={{ ...TL.tab, ...(tab === 'registers' ? TL.tabOn : {}) }} onClick={() => setTab('registers')}>
          {disk.count > 0 ? t('tab.registersSize', { size: (disk.partial ? '≥ ' : '') + formatBytes(disk.bytes, lang) }) : t('tab.registers')}
        </button>
      </div>

      <div className="mm-search" style={{ display: tab === 'search' ? undefined : 'none' }}>
        <SearchPanel host={host} t={t} lang={lang} ready={anyRegister} coverage={coverage} onGoRegisters={() => setTab('registers')} />
      </div>

      {/* Layout, scrolling and the short-window rules live in index.html: inline styles cannot hold media queries. */}
      {/* Registers stay mounted on the search tab: a download being followed must not be lost. */}
      <div className="mm-main" style={{ display: tab === 'registers' ? undefined : 'none' }}>
        <nav className="mm-tiles" aria-label={t('offices.title')}>
          <div style={TL.disk} data-testid="storage">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>{disk.count === 0 ? t('storage.none') : t('storage.total', { size: (disk.partial ? '≥ ' : '') + formatBytes(disk.bytes, lang) })}</span>
              <span style={S.small}>{t('storage.count', { n: disk.count })}</span>
            </div>
            {segments.length > 0 && (
              <>
                <div style={TL.diskBar} aria-hidden="true">
                  {segments.map((x) => <span key={x.id} style={{ width: `${(x.bytes / Math.max(1, disk.bytes)) * 100}%`, background: SEGMENT[x.id] }} />)}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
                  {segments.map((x) => (
                    <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: SEGMENT[x.id] }} />{CODE[x.id]} {formatBytes(x.bytes, lang)}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}><TrashIcon size={12} />{t('storage.hint')}</div>
              </>
            )}
          </div>
          <div style={{ ...S.small, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('offices.title')}</div>
          {tiles.map((x) => (
            <OfficeTile key={x.id} code={x.code} name={x.name} state={x.state} lines={x.lines}
              selected={office === x.id} onSelect={() => setOffice(x.id)} t={t} remove={x.id === 'uspto' ? undefined : removeFor(x.id)} />
          ))}
          <div className="mm-hide-short" style={S.small}>{t('tile.legend')}</div>
          <div className="mm-hide-short" style={S.small}>{t('offices.more')}</div>
        </nav>

        {/* Every card stays mounted: switching office must not lose a download being followed. */}
        <div className="mm-detail">
          <div style={{ display: office === 'ipau' ? 'contents' : 'none' }}>
            <RegisterCard registry="ipau" words="au" host={host} t={t} lang={lang} onState={setAu} epoch={epochs.ipau ?? 0} remove={removeFor('ipau')} />
          </div>
          <div style={{ display: office === 'cipo' ? 'contents' : 'none' }}>
            <RegisterCard registry="cipo" words="ca" host={host} t={t} lang={lang} onState={setCa} epoch={epochs.cipo ?? 0} remove={removeFor('cipo')} />
          </div>
          <div style={{ display: office === 'inpi' ? 'contents' : 'none' }}>
            <RegisterCard registry="inpi" words="fr" host={host} t={t} lang={lang} onState={setFr} epoch={epochs.inpi ?? 0} remove={removeFor('inpi')} />
          </div>
          <div style={{ display: office === 'prv' ? 'contents' : 'none' }}>
            <RegisterCard registry="prv" words="se" host={host} t={t} lang={lang} onState={setSe} epoch={epochs.prv ?? 0} remove={removeFor('prv')} />
          </div>
          <div style={{ display: office === 'uspto' ? 'contents' : 'none' }}>
            <UsptoSetup host={host} t={t} lang={lang} onConnected={setUsConnected} />
          </div>
        </div>
      </div>

      <footer className="mm-foot" style={S.footer}><div style={S.small}>{t('footer.source')}</div></footer>
    </div>
  );
}
