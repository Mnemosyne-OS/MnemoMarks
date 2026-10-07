/**
 * OfficeTile — one office as a tile: its code, its name, a coloured state
 * (green fresh, orange update advised, red old, grey not downloaded) and
 * the facts behind it. A press opens the office's steps beside the tiles.
 */
import type { Key } from '../i18n/strings';
import type { Freshness } from '../lib/register';
import { T as TL } from './styles';

type Tr = (k: Key, v?: Record<string, string | number>) => string;
export type TileState = Freshness['level'] | 'connected' | 'disconnected';

const DOT: Record<TileState, string> = {
  fresh: 'var(--success)', connected: 'var(--success)',
  stale: 'var(--warning)',
  old: 'var(--danger)',
  none: 'var(--text-muted)', disconnected: 'var(--text-muted)',
};
const LABEL: Record<TileState, Key> = {
  fresh: 'fresh.ok', stale: 'fresh.stale', old: 'fresh.old', none: 'fresh.none',
  connected: 'offices.connected', disconnected: 'offices.notConnected',
};

/** The coloured state pill, shared by the tile and the office's card. */
export function StatePill({ state, t }: { state: TileState; t: Tr }) {
  const color = DOT[state];
  return (
    <span style={{ ...TL.pill, color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'inline-flex', alignItems: 'center', gap: 6 }} data-state={state}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
      {t(LABEL[state])}
    </span>
  );
}

/** The delete control a tile carries when its office has a register on the disk. */
export interface RemoveControl {
  /** The register's size, as the human reads it ("474 MB"). */
  size: string;
  armed: boolean;
  onPress: () => void;
  onCancel: () => void;
  error: string | null;
}

/** A trash can, drawn: an emoji renders differently on every system. */
export function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
    </svg>
  );
}

/** The two-step delete, shared by the tile and the office's card: a press arms it, the red one deletes. */
export function ConfirmRemove({ remove, t }: { remove: RemoveControl; t: Tr }) {
  return (
    <div style={TL.confirmBar} role="group" aria-label={t('storage.confirmTitle')}>
      <span style={{ fontSize: 12 }}>{t('storage.confirmText', { size: remove.size })}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <button style={TL.cancelButton} onClick={remove.onCancel}>{t('storage.cancel')}</button>
        <button style={TL.dangerButton} onClick={remove.onPress}><TrashIcon size={13} /> {t('storage.confirm', { size: remove.size })}</button>
      </span>
    </div>
  );
}

/** One office tile; `remove` adds a trash can that asks before deleting. */
export function OfficeTile({ code, name, state, lines, selected, onSelect, t, remove }: {
  code: string; name: string; state: TileState; lines: string[]; selected: boolean; onSelect: () => void; t: Tr;
  remove?: RemoveControl;
}) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button className="mm-tile" style={{ ...TL.tile, ...(selected ? TL.tileOn : {}), ...(remove?.armed ? TL.tileDanger : {}) }} aria-pressed={selected} onClick={onSelect}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', paddingRight: remove ? 34 : 0, boxSizing: 'border-box' }}>
          <span style={TL.flag} aria-hidden="true">{code}</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
          {!remove && <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 16 }}>›</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <StatePill state={state} t={t} />
          {remove && <span style={TL.sizeChip}>{remove.size}</span>}
        </span>
        {lines.map((l) => <span key={l} style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.4 }}>{l}</span>)}
      </button>
      {remove && (
        <button className="mm-trash" style={{ ...TL.trash, ...(remove.armed ? TL.trashArmed : {}) }} onClick={remove.armed ? remove.onCancel : remove.onPress}
          title={t('storage.removeTitle', { size: remove.size })} aria-label={t('storage.removeTitle', { size: remove.size })} aria-expanded={remove.armed}>
          <TrashIcon />
        </button>
      )}
      {remove?.armed && <ConfirmRemove remove={remove} t={t} />}
      {remove?.error && <div style={{ color: 'var(--danger)', fontSize: 12 }} role="alert">{remove.error}</div>}
    </div>
  );
}
