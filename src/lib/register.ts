/**
 * register — what the host says about an office's register on this computer
 * and about a search, and the few decisions the screen draws from it (pure).
 */

/** Mirrors `RegisterState` in the host (main/marks/registerMirror.ts). */
export interface RegisterState {
  registry: string;
  phase: 'idle' | 'planning' | 'downloading' | 'indexing';
  startedAt: number | null;
  done: number | null;
  total: number | null;
  error: string | null;
  installed: { asOf: string; dataDate: string | null; sourceLastModified: string | null; counts: Record<string, number> | null; sizeBytes: number | null } | null;
  unreadable: string | null;
}

export interface MirrorPlan { bytes: number; bytesPartial: boolean; archiveBytes: number | null; lastModified: string | null; dataDate: string | null }

/** Mirrors `Hit` / `NameResult` in the host (main/marks/marksStore.ts). */
export interface Hit {
  number: string;
  text: string;
  wordType: 'phrase' | 'image';
  status: string | null;
  live: boolean | null;
  filed: string | null;
  classes: string[];
  kinds: string[];
  /** Who holds the mark; empty when the office's data does not say (Australia, Canada). */
  owners: string[];
}
export interface NameResult {
  name: string;
  norm: string;
  skipped: 'TOO_SHORT' | null;
  exact: Hit[];
  within: Hit[];
  contains: Hit[];
  totals: { exact: number; within: number; contains: number };
}
export interface SearchAnswer {
  registers: { registry: string; asOf: string; dataDate: string | null; results: NameResult[] }[];
  /** Offices with no register on this computer: named, never read as "no mark". */
  missing: string[];
  failed: { registry: string; error: string }[];
}

/** The page of one mark on each office's own register (both checked 2026-10-05). */
export const RECORD_URL: Readonly<Record<string, string>> = {
  ipau: 'https://search.ipaustralia.gov.au/trademarks/search/view/',
  cipo: 'https://ised-isde.canada.ca/cipo/trademark-search/',
  // Verified in a browser on 2026-10-05 ("TIMELESS AND TIMELY (Marques) - Data INPI"); scripts get a bot check.
  inpi: 'https://data.inpi.fr/marques/FR',
  // Checked in a browser on 2026-10-05: #/trademark/1900-32166 opens that mark ("Registrerad").
  prv: 'https://search.prv.se/#/trademark/',
};

/**
 * The day a register's data is true for, falling back to when it was built.
 * 🎭 Data cannot be newer than the copy that holds it: a date after the build
 * day comes from a mistyped record (France showed 22/01/2028 on 2026-10-05)
 * and is never shown as the data's date.
 */
export function dataDay(r: { asOf: string; dataDate: string | null }): string {
  const built = r.asOf.slice(0, 10);
  return r.dataDate && r.dataDate <= built ? r.dataDate : built;
}

/** What the reader narrows a name's marks to: live ones only, and one Nice class. */
export interface HitFilter { liveOnly: boolean; nice: string | null }

/** The marks that pass the filter, in the order the host ranked them. */
export function filterHits(hits: Hit[], f: HitFilter): Hit[] {
  return hits.filter((h) => (!f.liveOnly || h.live === true) && (f.nice === null || h.classes.includes(f.nice)));
}

/** The Nice classes among these marks, most frequent first, each with how many marks carry it. */
export function classFacets(hits: Hit[]): { nice: string; n: number }[] {
  const n = new Map<string, number>();
  for (const h of hits) for (const c of new Set(h.classes)) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n.entries()].map(([nice, k]) => ({ nice, n: k })).sort((a, b) => b.n - a.n || Number(a.nice) - Number(b.nice));
}

/** The fraction of a download, or null when there is nothing measured to divide. */
export function fraction(s: RegisterState): number | null {
  if (s.done === null || !s.total) return null;
  return Math.min(1, s.done / s.total);
}

/** Names typed one per line (or separated by commas), trimmed, de-duplicated, in order. */
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/**
 * A name's verdict on one register, in one word:
 *  - `taken`: a live mark IS the name;
 *  - `close`: no live exact match, but a live mark is inside it or contains it;
 *  - `clear`: nothing live in this register (dead marks may still be listed);
 *  - `unknown`: a match whose status the register does not say.
 * 🎭 `clear` speaks for THIS register only, and is never legal clearance.
 */
export type Verdict = 'taken' | 'close' | 'clear' | 'unknown';
export function verdictOf(r: NameResult): Verdict {
  if (r.exact.some((h) => h.live === true)) return 'taken';
  if ([...r.within, ...r.contains].some((h) => h.live === true)) return 'close';
  if ([...r.exact, ...r.within, ...r.contains].some((h) => h.live === null)) return 'unknown';
  return 'clear';
}

/**
 * A data day (YYYY-MM-DD) as the reader's calendar writes it.
 * 🪤 `new Date('2025-01-28')` is midnight UTC, so west of Greenwich it printed
 * the day BEFORE (seen on Tony's screen, 2026-10-05: 27/01 for an extract of
 * 28/01). The day is a calendar day, not an instant: formatted in UTC.
 */
export function formatDay(day: string, lang: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : new Date(day);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(lang, { timeZone: 'UTC' }) : day;
}

/** What the registers take on this disk: how many are there, and their bytes (a floor when one does not say). */
export function diskUse(states: (RegisterState | null)[]): { count: number; bytes: number; partial: boolean } {
  const installed = states.map((s) => s?.installed).filter((i): i is NonNullable<RegisterState['installed']> => !!i);
  const known = installed.filter((i) => i.sizeBytes !== null);
  return { count: installed.length, bytes: known.reduce((n, i) => n + (i.sizeBytes as number), 0), partial: known.length < installed.length };
}

/** A local copy is "fresh" this many days after its download; Australia publishes weekly. */
export const FRESH_DAYS = 7;
/** Past this many days the copy is called old (red). */
export const OLD_DAYS = 30;

export type Freshness = { level: 'fresh' | 'stale' | 'old'; days: number } | { level: 'none'; days: null };

/**
 * How old this computer's copy is, from its DOWNLOAD (the office may have
 * published since): green under FRESH_DAYS, orange until OLD_DAYS, red after.
 * 🎭 A download date that cannot be read is never "fresh": it reads as old.
 */
export function freshness(installed: { asOf: string } | null, now: number): Freshness {
  if (!installed) return { level: 'none', days: null };
  const t = Date.parse(installed.asOf);
  if (!Number.isFinite(t)) return { level: 'old', days: OLD_DAYS };
  const days = Math.max(0, Math.floor((now - t) / 86_400_000));
  return { level: days < FRESH_DAYS ? 'fresh' : days < OLD_DAYS ? 'stale' : 'old', days };
}

/**
 * An office's status word in the reader's language. A word with no translation
 * is shown as the office wrote it, never as an empty or "undefined" label.
 */
export function statusWord(status: string | null, tr: (key: string) => string | undefined): string {
  if (!status) return '—';
  const key = `st.${status}`;
  const text = tr(key);
  return text && text !== key ? text : status;
}
