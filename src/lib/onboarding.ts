/**
 * onboarding — what each step of connecting a trademark office says, decided
 * from what the HOST reports (doc 135 §7). Pure, so the screen only draws.
 *
 * The rule the steps follow: a step a human does outside the app (create an
 * account, ask for a key) cannot be seen from here, so it is never ticked on
 * a click of "done". It is ticked when the office ITSELF accepts the key,
 * which proves every step before it at once. Until then it is "to do", and a
 * refused key sends the human back to the exact step that fixes it.
 */

/** Mirrors `RegistryKeyState` in the host (main/marks/registryKeyStore.ts). Never the key. */
export interface KeyState {
  registry: string;
  present: boolean;
  savedAt: number | null;
  seal: 'sealed' | 'plaintext' | 'unknown' | 'unavailable';
  unreadable: boolean;
}

export interface OdpFile { name: string; bytes: number | null; date: string | null }
export interface Listing { product: string; files: number; bytes: number | null; bytesPartial: boolean; newest: OdpFile | null }
export type ProductResult = { state: 'ok'; listing: Listing; shape?: string[] } | { state: 'missing'; status: number };

/** Mirrors `VerifyResult` in the host (main/marks/usptoOdp.ts). */
export type Verify =
  | { state: 'ok'; at: number; products: Partial<Record<'daily', ProductResult>>; catalog: { id: string; title: string | null }[] | null }
  | { state: 'refused'; at: number; status: number }
  | { state: 'unreachable'; at: number; why: string }
  | { state: 'unexpected'; at: number; status: number; sample: string };

export type StepStatus = 'todo' | 'done' | 'fix' | 'running';
export interface Steps { account: StepStatus; key: StepStatus; paste: StepStatus; check: StepStatus }

/** The four steps of connecting the USPTO, from the host's facts. */
export function stepsOf(key: KeyState | null, verify: Verify | null, checking: boolean): Steps {
  const accepted = verify?.state === 'ok';
  const refused = verify?.state === 'refused';
  return {
    account: accepted ? 'done' : 'todo',
    // A refused key is almost always a key copied wrong or revoked: step 2 fixes it.
    key: accepted ? 'done' : refused ? 'fix' : 'todo',
    paste: key?.present ? 'done' : key?.unreadable ? 'fix' : 'todo',
    check: checking ? 'running' : accepted ? 'done' : verify && !accepted ? 'fix' : 'todo',
  };
}

/**
 * Bytes as a human reads them, in DECIMAL units (1 MB = 1 000 000 B) like the
 * offices, the permission sentence and the doc: one size, one number.
 * `null` stays a dash, never 0.
 */
export function formatBytes(bytes: number | null, lang = 'en'): string {
  if (bytes === null) return '—';
  // French writes octets: Mo, Go ("MB" reads as English on a French screen).
  const fr = lang.split('-')[0] === 'fr';
  if (bytes < 1000) return `${bytes} ${fr ? 'o' : 'B'}`;
  const units = fr ? ['Ko', 'Mo', 'Go', 'To'] : ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1000;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  // French also writes the decimal comma: 1,2 Go.
  const n = v >= 10 ? String(Math.round(v)) : v.toFixed(1);
  return `${fr ? n.replace('.', ',') : n} ${units[i]}`;
}
