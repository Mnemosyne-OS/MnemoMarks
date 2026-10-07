/**
 * styles — the cartridge's inline styles, on the host's design tokens only
 * (rule 12: `var(--…)`, never a hard colour). Kept out of the .tsx files so
 * each of those exports a component and nothing else (Fast Refresh).
 */
import type { CSSProperties } from 'react';

/** Inline styles of the cartridge, on the host's CSS variables. */
export const S: Record<string, CSSProperties> = {
  page: { height: '100%', overflow: 'auto', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-void)', color: 'var(--text-primary)' },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 20, fontWeight: 600 },
  h2: { fontSize: 15, fontWeight: 600, margin: 0 },
  p: { margin: 0, lineHeight: 1.5 },
  muted: { color: 'var(--text-muted)' },
  small: { color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 },
  error: { color: 'var(--danger, var(--accent))', fontSize: 13 },
  card: { background: 'linear-gradient(160deg, color-mix(in srgb, var(--text-primary) 4%, transparent), color-mix(in srgb, var(--text-primary) 1%, transparent)), var(--bg-panel)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent), 0 10px 30px color-mix(in srgb, var(--bg-void) 55%, transparent)' },
  button: { alignSelf: 'flex-start', background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 78%, var(--text-primary) 22%), var(--accent))', color: 'var(--text-on-accent, var(--bg-void))', border: '1px solid color-mix(in srgb, var(--text-primary) 22%, transparent)', borderRadius: 10, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text-primary) 35%, transparent), 0 4px 14px color-mix(in srgb, var(--accent) 30%, transparent)' },
  ghost: { background: 'linear-gradient(180deg, color-mix(in srgb, var(--text-primary) 10%, transparent), color-mix(in srgb, var(--text-primary) 3%, transparent))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: 'var(--text-primary)', border: '1px solid color-mix(in srgb, var(--text-primary) 16%, transparent)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text-primary) 14%, transparent)' },
  icon: { background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', color: 'var(--text-muted)', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)', borderRadius: 9, padding: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0 },
  iconOn: { color: 'var(--accent)', borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)', boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 35%, transparent)' },
  link: { background: 'transparent', color: 'var(--accent)', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' },
  input: { background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '7px 9px' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 },
  tile: { background: 'linear-gradient(165deg, color-mix(in srgb, var(--text-primary) 7%, transparent), color-mix(in srgb, var(--text-primary) 1%, transparent) 60%), var(--bg-panel)', border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)', borderRadius: 16, padding: 16, boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent), 0 12px 28px color-mix(in srgb, var(--bg-void) 60%, transparent)', transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' },
  tileName: { fontSize: 16, fontWeight: 600 },
  licence: { background: 'var(--bg-void)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  select: { background: 'var(--bg-void)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 8px' },
  footer: { marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 },
};

const accentMix = (p: number) => `color-mix(in srgb, var(--accent) ${p}%, transparent)`;
const textMix = (p: number) => `color-mix(in srgb, var(--text-primary) ${p}%, transparent)`;
const pillBase: CSSProperties = { whiteSpace: 'nowrap', flexShrink: 0, fontSize: 11, fontWeight: 600, letterSpacing: '.02em', padding: '3px 10px', borderRadius: 999, border: `1px solid ${textMix(14)}`, color: 'var(--text-muted)', background: textMix(4) };
const nodeBase: CSSProperties = { width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, border: `1px solid ${textMix(18)}`, color: 'var(--text-muted)', background: 'var(--bg-panel)' };

/** The onboarding timeline (ui/Timeline.tsx). */
export const T: Record<string, CSSProperties> = {
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  stop: { display: 'flex', gap: 14, transition: 'opacity .2s ease' },
  rail: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30, flexShrink: 0 },
  line: { width: 2, flex: 1, minHeight: 18, margin: '4px 0', borderRadius: 2, background: textMix(12) },
  lineDone: { background: `linear-gradient(180deg, var(--accent), ${accentMix(35)})` },
  node: nodeBase,
  nodeActive: { ...nodeBase, color: 'var(--accent)', borderColor: 'var(--accent)', background: accentMix(14), boxShadow: `0 0 0 4px ${accentMix(12)}, 0 0 18px ${accentMix(35)}` },
  nodeDone: { ...nodeBase, color: 'var(--text-on-accent, var(--bg-void))', borderColor: 'var(--accent)', background: 'var(--accent)' },
  nodeFix: { ...nodeBase, color: 'var(--danger, var(--accent))', borderColor: 'var(--danger, var(--accent))', background: 'color-mix(in srgb, var(--danger, var(--accent)) 14%, transparent)' },
  body: { flex: 1, minWidth: 0, padding: '4px 14px 18px', marginBottom: 6, borderRadius: 12, border: '1px solid transparent' },
  bodyActive: { padding: '12px 14px 14px', background: `linear-gradient(160deg, ${accentMix(7)}, transparent 70%)`, border: `1px solid ${accentMix(28)}`, boxShadow: `inset 0 1px 0 ${textMix(8)}` },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stopTitle: { fontSize: 15, fontWeight: 600 },
  text: { marginTop: 4, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 },
  actions: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 },
  pill: pillBase,
  pillActive: { ...pillBase, color: 'var(--accent)', borderColor: accentMix(45), background: accentMix(12) },
  pillDone: { ...pillBase, color: 'var(--accent)', borderColor: accentMix(35), background: accentMix(8) },
  pillFix: { ...pillBase, color: 'var(--danger, var(--accent))', borderColor: 'color-mix(in srgb, var(--danger, var(--accent)) 45%, transparent)' },
  linkRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  linkButton: { background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 78%, var(--text-primary) 22%), var(--accent))', color: 'var(--text-on-accent, var(--bg-void))', border: `1px solid ${textMix(22)}`, borderRadius: 10, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, boxShadow: `inset 0 1px 0 ${textMix(35)}, 0 4px 14px ${accentMix(30)}` },
  linkGhost: { background: textMix(5), color: 'var(--text-primary)', border: `1px solid ${textMix(16)}`, borderRadius: 10, padding: '6px 14px', cursor: 'pointer' },
  url: { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3 },
  office: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, background: textMix(3), border: `1px solid ${textMix(9)}` },
  // A code badge, not a flag emoji: Windows draws regional flags as two bare letters.
  officeButton: { width: '100%', cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit', textAlign: 'left' },
  officeOn: { borderColor: accentMix(45), background: accentMix(8), boxShadow: `0 0 0 1px ${accentMix(25)}` },
  bar: { height: 8, borderRadius: 999, background: textMix(8), overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${accentMix(70)}, var(--accent))`, transition: 'width .4s ease' },
  tile: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box', background: `linear-gradient(165deg, ${textMix(7)}, ${textMix(1)} 60%), var(--bg-panel)`, border: `1px solid ${textMix(12)}`, boxShadow: `inset 0 1px 0 ${textMix(10)}, 0 10px 24px color-mix(in srgb, var(--bg-void) 55%, transparent)`, transition: 'transform .15s ease, border-color .15s ease, box-shadow .15s ease' },
  tileOn: { borderColor: accentMix(55), boxShadow: `0 0 0 1px ${accentMix(35)}, 0 10px 28px ${accentMix(18)}`, background: `linear-gradient(165deg, ${accentMix(12)}, ${textMix(1)} 65%), var(--bg-panel)` },
  tabs: { display: 'inline-flex', alignSelf: 'flex-start', gap: 4, padding: 4, borderRadius: 12, background: textMix(5), border: `1px solid ${textMix(10)}` },
  tab: { padding: '7px 16px', borderRadius: 9, cursor: 'pointer', color: 'var(--text-muted)', background: 'transparent', border: '1px solid transparent', fontWeight: 600, fontSize: 13 },
  tabOn: { color: 'var(--text-primary)', background: `linear-gradient(180deg, ${accentMix(22)}, ${accentMix(10)})`, borderColor: accentMix(40), boxShadow: `inset 0 1px 0 ${textMix(12)}` },
  chip: { fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', color: 'var(--text-muted)', background: textMix(5), border: `1px solid ${textMix(14)}`, whiteSpace: 'nowrap' },
  chipOn: { color: 'var(--text-primary)', background: accentMix(18), borderColor: accentMix(50) },
  verdictFlat: { fontSize: 12, fontWeight: 700, letterSpacing: '.02em', color: 'var(--accent)', whiteSpace: 'nowrap' },
  summary: { borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' },
  summaryHead: { textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: `1px solid ${textMix(12)}`, whiteSpace: 'nowrap' },
  summaryCell: { padding: '6px 10px', borderBottom: `1px solid ${textMix(6)}`, whiteSpace: 'nowrap' },
  trash: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', background: textMix(5), border: `1px solid ${textMix(14)}`, transition: 'color .15s ease, background .15s ease, border-color .15s ease' },
  trashArmed: { color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 55%, transparent)', background: 'color-mix(in srgb, var(--danger) 14%, transparent)' },
  tileDanger: { borderColor: 'color-mix(in srgb, var(--danger) 45%, transparent)' },
  sizeChip: { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: 'var(--text-primary)', background: textMix(7), border: `1px solid ${textMix(14)}`, whiteSpace: 'nowrap' },
  confirmBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 12, color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--danger) 10%, var(--bg-panel))', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)' },
  dangerButton: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 9, cursor: 'pointer', color: 'var(--text-on-accent, var(--bg-void))', background: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 70%, var(--text-primary) 30%)', boxShadow: '0 4px 14px color-mix(in srgb, var(--danger) 30%, transparent)' },
  cancelButton: { fontSize: 12, padding: '5px 11px', borderRadius: 9, cursor: 'pointer', color: 'var(--text-primary)', background: 'transparent', border: `1px solid ${textMix(18)}` },
  disk: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 16, background: `linear-gradient(150deg, ${accentMix(14)}, ${textMix(2)} 70%), var(--bg-panel)`, border: `1px solid ${accentMix(30)}`, boxShadow: `inset 0 1px 0 ${textMix(10)}, 0 10px 26px ${accentMix(12)}` },
  diskBar: { display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: textMix(8) },
  removeButton: { position: 'absolute', right: 10, bottom: 10, fontSize: 11, padding: '3px 9px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', border: `1px solid ${textMix(14)}` },
  removeArmed: { color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 55%, transparent)', background: 'color-mix(in srgb, var(--danger) 12%, transparent)', fontWeight: 600 },
  storage: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 12, background: textMix(4), border: `1px solid ${textMix(10)}` },
  flag: { fontSize: 10, fontWeight: 700, letterSpacing: '.08em', padding: '3px 6px', marginRight: 10, borderRadius: 6, color: 'var(--accent)', border: `1px solid ${accentMix(40)}`, background: accentMix(10) },
};
