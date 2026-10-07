/**
 * SearchPanel — check a list of names against every register on this
 * computer. Each answer says which registers were read, as of which date,
 * and which offices were NOT (a country with no register is never "clear").
 */
import { useRef, useEffect, useState } from 'react';
import type { Key } from '../i18n/strings';
import type { Host } from '../lib/host';
import { RECORD_URL, classFacets, dataDay, filterHits, formatDay, parseNames, statusWord, verdictOf, type Hit, type HitFilter, type NameResult, type SearchAnswer, type Verdict } from '../lib/register';
import { S, T as TL } from './styles';
import { StatePill, type TileState } from './OfficeTile';

/** One office as the search sees it: will it be read, and as of when. */
export interface Coverage { id: string; code: string; name: string; state: TileState; date: string | null }

type Tr = (k: Key, v?: Record<string, string | number>) => string;
const SHOWN = 5;
const OFFICE: Record<string, Key> = { ipau: 'office.ipau', cipo: 'office.cipo', inpi: 'office.inpi', prv: 'office.prv', uspto: 'office.uspto' };
const VERDICT_PILL: Record<Verdict, keyof typeof TL> = { taken: 'pillFix', close: 'pillActive', clear: 'pillDone', unknown: 'pill' };

/** The names field and the answers. `ready` is false while no register is on this computer. */
export function SearchPanel({ host, t, lang, ready, coverage, onGoRegisters }: { host: Host; t: Tr; lang: string; ready: boolean; coverage: Coverage[]; onGoRegisters: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const names = parseNames(text);

  const run = async () => {
    setBusy(true); setError(null);
    try { const a = await host.search(names); if (alive.current) setAnswer(a); } catch (err) {
      console.error('[mnemo-marks] search failed', err);
      if (alive.current) setError(t('err.other', { why: err instanceof Error ? err.message : String(err) }));
    } finally { if (alive.current) setBusy(false); }
  };
  const open = (url: string) => { host.openExternal(url).catch((err) => console.error('[mnemo-marks] openExternal failed', err)); };
  const office = (id: string) => (OFFICE[id] ? t(OFFICE[id]!) : id);

  return (
    <section style={S.card} aria-label={t('search.title')}>
      <h2 style={{ ...S.h2, fontSize: 18 }}>{t('search.title')}</h2>
      <p style={{ ...S.p, ...S.muted }}>{t('search.lead')}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-testid="coverage">
        <span style={S.small}>{t('search.coverage')}</span>
        {coverage.map((c) => (
          <span key={c.id} style={{ ...TL.sizeChip, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: c.date ? 1 : 0.55 }} title={c.name}>
            <span style={TL.flag}>{c.code}</span>
            {c.date ? <StatePill state={c.state} t={t} /> : <span style={{ color: 'var(--text-muted)' }}>{t('search.notCovered')}</span>}
            {c.date && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{c.date}</span>}
          </span>
        ))}
      </div>
      {!ready && (
        <div style={{ ...TL.confirmBar, background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-panel))', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>
          <span style={{ fontSize: 13 }}>{t('search.noneYet')}</span>
          <button style={S.button} onClick={onGoRegisters}>{t('search.goRegisters')}</button>
        </div>
      )}
      <textarea
        style={{ ...S.input, minHeight: 110, resize: 'vertical', fontFamily: 'inherit', fontSize: 15, padding: '10px 12px', borderRadius: 10 }}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button style={S.button} disabled={!ready || busy || names.length === 0} onClick={() => void run()}>
          {t(busy ? 'search.running' : 'search.go', { n: names.length })}
        </button>
      </div>
      {error && <div style={S.error} role="alert">{error}</div>}
      {answer && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="status">
          <div style={S.small}>
            {answer.registers.length > 0 && t('search.read', { list: answer.registers.map((r) => t('search.readOne', { office: office(r.registry), date: formatDay(dataDay(r), lang) })).join(', ') })}
            {answer.missing.length > 0 && <> {t('search.missing', { list: answer.missing.map(office).join(', ') })}</>}
          </div>
          {answer.registers.length > 0 && <Summary answer={answer} t={t} office={office} />}
          {answer.failed.map((f) => <div key={f.registry} style={S.error}>{t('search.failed', { office: office(f.registry), why: f.error })}</div>)}
          {answer.registers.flatMap((reg) => reg.results.map((r) => (
            <NameCard key={`${reg.registry}:${r.name}`} r={r} office={office(reg.registry)} t={t} onOpen={open} registry={reg.registry} />
          )))}
          <div style={S.small}>{t('search.notAdvice')}</div>
        </div>
      )}
    </section>
  );
}

/** The anchor id of one name's card in one register, so the summary can jump to it. */
const cardId = (registry: string, name: string) => `mm-card-${registry}-${encodeURIComponent(name)}`;

/** Every name × every register read, one verdict per cell; a cell scrolls to its card. */
function Summary({ answer, t, office }: { answer: SearchAnswer; t: Tr; office: (id: string) => string }) {
  const names = [...new Set(answer.registers.flatMap((reg) => reg.results.map((r) => r.name)))];
  return (
    <div style={{ overflowX: 'auto' }} data-testid="summary">
      <table style={TL.summary}>
        <thead>
          <tr>
            <th style={TL.summaryHead}>{t('summary.title')}</th>
            {answer.registers.map((reg) => <th key={reg.registry} style={TL.summaryHead}>{office(reg.registry)}</th>)}
          </tr>
        </thead>
        <tbody>
          {names.map((name) => (
            <tr key={name}>
              <td style={{ ...TL.summaryCell, fontWeight: 600 }}>{name}</td>
              {answer.registers.map((reg) => {
                const r = reg.results.find((x) => x.name === name);
                if (!r || r.skipped) return <td key={reg.registry} style={TL.summaryCell}><span style={S.small}>{t('search.tooShort')}</span></td>;
                const v = verdictOf(r);
                return (
                  <td key={reg.registry} style={TL.summaryCell}>
                    <button className="mm-verdict" style={{ ...TL[VERDICT_PILL[v]], cursor: 'pointer' }} data-verdict={v}
                      title={t('summary.jump', { name, office: office(reg.registry) })}
                      onClick={() => document.getElementById(cardId(reg.registry, name))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      {t(`verdict.${v}` as Key)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One name's answer in one register: a verdict, filters, then the marks behind it. */
function NameCard({ r, office, t, onOpen, registry }: { r: NameResult; office: string; t: Tr; onOpen: (url: string) => void; registry: string }) {
  const [filter, setFilter] = useState<HitFilter>({ liveOnly: false, nice: null });
  if (r.skipped) return <div style={TL.office}><span>{r.name}</span><span style={S.small}>{t('search.tooShort')}</span></div>;
  const v = verdictOf(r);
  const all = [...r.exact, ...r.within, ...r.contains];
  const facets = classFacets(all);
  const cut = (['exact', 'within', 'contains'] as const).some((b) => r[b].length < r.totals[b]);
  const filtered = filter.liveOnly || filter.nice !== null;
  return (
    <div id={cardId(registry, r.name)} style={{ ...TL.office, flexDirection: 'column', alignItems: 'stretch', gap: 10, scrollMarginTop: 8 }} data-name={r.name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{r.name} <span style={S.small}>· {office}</span></span>
        {/* A verdict here is a word, not a control: drawn flat so it never reads as a button. */}
        <span style={TL.verdictFlat} data-verdict={v}>{t(`verdict.${v}` as Key)}</span>
      </div>
      {all.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} role="group">
          <button style={{ ...TL.chip, ...(filter.liveOnly ? TL.chipOn : {}) }} aria-pressed={filter.liveOnly} onClick={() => setFilter({ ...filter, liveOnly: !filter.liveOnly })}>
            {t('filter.liveOnly')}
          </button>
          {facets.length > 1 && (
            <>
              <span style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
              <button style={{ ...TL.chip, ...(filter.nice === null ? TL.chipOn : {}) }} aria-pressed={filter.nice === null} onClick={() => setFilter({ ...filter, nice: null })}>
                {t('filter.allClasses')}
              </button>
              {facets.slice(0, 12).map((c) => (
                <button key={c.nice} style={{ ...TL.chip, ...(filter.nice === c.nice ? TL.chipOn : {}) }} aria-pressed={filter.nice === c.nice}
                  title={t('filter.classTitle', { nice: c.nice, n: c.n })} onClick={() => setFilter({ ...filter, nice: filter.nice === c.nice ? null : c.nice })}>
                  {c.nice} <span style={{ opacity: 0.6, fontWeight: 400 }}>{c.n}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {filtered && cut && <div style={S.small}>{t('bucket.filterCut', { loaded: all.length, total: r.totals.exact + r.totals.within + r.totals.contains })}</div>}
      {(['exact', 'within', 'contains'] as const).map((b) => r.totals[b] > 0 && (
        <Bucket key={b} label={t(`bucket.${b}` as Key, { n: r.totals[b] })} hits={filterHits(r[b], filter)} loaded={r[b].length} total={r.totals[b]} filtered={filtered}
          t={t} onOpen={onOpen} registry={registry} />
      ))}
    </div>
  );
}

/** One bucket as a table: the first rows, and a button that shows the rest of what was loaded. */
function Bucket({ label, hits, loaded, total, filtered, t, onOpen, registry }: {
  label: string; hits: Hit[]; loaded: number; total: number; filtered: boolean; t: Tr; onOpen: (url: string) => void; registry: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? hits : hits.slice(0, SHOWN);
  const rest = hits.length - shown.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ ...S.small, fontWeight: 600, color: 'var(--text-primary)', opacity: 0.85 }}>
        {label}{filtered && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {t('bucket.filtered', { shown: hits.length })}</span>}
      </div>
      {shown.length > 0 && (
        <div role="table">
          <div className="mm-hit mm-hit-head" role="row">
            <span>{t('col.number')}</span><span>{t('col.mark')}</span><span>{t('col.status')}</span><span>{t('col.classes')}</span><span>{t('col.owner')}</span>
          </div>
          {shown.map((h) => <HitRow key={h.number} h={h} t={t} onOpen={onOpen} registry={registry} />)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {rest > 0 && <button style={TL.chip} onClick={() => setOpen(true)}>{t('bucket.showMore', { n: rest })}</button>}
        {open && hits.length > SHOWN && <button style={TL.chip} onClick={() => setOpen(false)}>{t('bucket.showLess')}</button>}
        {/* 🎭 The host sends at most a few dozen marks per bucket: the rest is named, never implied. */}
        {(open || rest === 0) && loaded < total && <span style={S.small}>{t('bucket.cut', { loaded, total })}</span>}
      </div>
    </div>
  );
}

/** One mark as a table row; the whole row opens the mark on the office's own register. */
function HitRow({ h, t, onOpen, registry }: { h: Hit; t: Tr; onOpen: (url: string) => void; registry: string }) {
  const status = h.live === true ? 'hit.live' : h.live === false ? 'hit.dead' : 'hit.unknown';
  const url = RECORD_URL[registry] ? RECORD_URL[registry] + encodeURIComponent(h.number) : null;
  const cells = (
    <>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, color: url ? 'var(--accent)' : 'var(--text-muted)' }}>
        {h.number}{url && <span aria-hidden="true"> ↗</span>}
      </span>
      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</span>
        {h.wordType === 'image' && <span style={{ ...TL.pill, padding: '1px 7px', fontSize: 10 }}>{t('hit.inLogo')}</span>}
      </span>
      <span><span style={{ ...(h.live ? TL.pillFix : TL.pill), padding: '2px 8px' }}>{t(status as Key, { status: statusWord(h.status, (k) => t(k as Key)) })}</span></span>
      <span style={{ color: 'var(--text-muted)' }}>{h.classes.join(', ') || '—'}</span>
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.owners.join(' ; ')}>
        {h.owners.length > 0 ? h.owners.slice(0, 2).join(' ; ') + (h.owners.length > 2 ? ' …' : '') : '—'}
      </span>
    </>
  );
  const style = { opacity: h.live === false ? 0.6 : 1 };
  return url
    ? <button className="mm-hit mm-hit-link" role="row" style={style} title={t('hit.open', { number: h.number })} onClick={() => onOpen(url)}>{cells}</button>
    : <div className="mm-hit" role="row" style={style}>{cells}</div>;
}
