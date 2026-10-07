/**
 * host — the four doors MnemoMarks uses, behind one interface so the screen
 * can be rendered in a test with nothing on the other side of the bridge.
 */
import { MnemoCartridgeSDK } from '../sdk/mnemo-sdk';
import type { KeyState, Verify } from './onboarding';
import type { MirrorPlan, RegisterState, SearchAnswer } from './register';

// Must match "name" in mnemo-plugin.json.
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-marks');

/** A local IPC: the house default (rule 9). */
const HOST_TIMEOUT_MS = 15_000;
/** Reading an archive's directory: a HEAD and four small ranges, 15 s in main. */
const PLAN_TIMEOUT_MS = 25_000;
/** One pass over ~2.3 M rows of words per register, 120 s in main. */
const SEARCH_TIMEOUT_MS = 130_000;
/** Two calls to the USPTO at 20 s each in main, plus the bridge. */
const VERIFY_TIMEOUT_MS = 50_000;

/** The USPTO page where a signed-in account requests its key (it offers sign-in and account creation first). */
export const USPTO_KEY_PAGE = 'https://data.uspto.gov/apikey';

export interface Host {
  keyState(registry: string): Promise<KeyState>;
  keySet(registry: string, key: string): Promise<KeyState>;
  keyClear(registry: string): Promise<KeyState>;
  verify(registry: string): Promise<Verify>;
  openExternal(url: string): Promise<unknown>;
  mirrorStatus(registry: string): Promise<RegisterState>;
  mirrorPlan(registry: string): Promise<MirrorPlan>;
  mirrorDownload(registry: string): Promise<RegisterState>;
  mirrorCancel(registry: string): Promise<{ cancelled: boolean }>;
  mirrorRemove(registry: string): Promise<RegisterState>;
  search(names: string[]): Promise<SearchAnswer>;
}

export const sdkHost: Host = {
  keyState: (registry) => sdk.invoke<KeyState>('marks.keyState', { registry }, HOST_TIMEOUT_MS),
  keySet: (registry, key) => sdk.invoke<KeyState>('marks.keySet', { registry, key }, HOST_TIMEOUT_MS),
  keyClear: (registry) => sdk.invoke<KeyState>('marks.keyClear', { registry }, HOST_TIMEOUT_MS),
  verify: (registry) => sdk.invoke<Verify>('marks.verify', { registry }, VERIFY_TIMEOUT_MS),
  openExternal: (url) => sdk.invoke('shell.openExternal', { url }, HOST_TIMEOUT_MS),
  mirrorStatus: (registry) => sdk.invoke<RegisterState>('marks.mirrorStatus', { registry }, HOST_TIMEOUT_MS),
  mirrorPlan: (registry) => sdk.invoke<MirrorPlan>('marks.mirrorPlan', { registry }, PLAN_TIMEOUT_MS),
  mirrorDownload: (registry) => sdk.invoke<RegisterState>('marks.mirrorDownload', { registry }, HOST_TIMEOUT_MS),
  mirrorCancel: (registry) => sdk.invoke<{ cancelled: boolean }>('marks.mirrorCancel', { registry }, HOST_TIMEOUT_MS),
  mirrorRemove: (registry) => sdk.invoke<RegisterState>('marks.mirrorRemove', { registry }, HOST_TIMEOUT_MS),
  search: (names) => sdk.invoke<SearchAnswer>('marks.search', { names }, SEARCH_TIMEOUT_MS),
};

/** The codes main refuses with, each with its own sentence on screen. */
export const KNOWN_ERRORS = ['EMPTY', 'HAS_WHITESPACE', 'LOOKS_LIKE_URL', 'STORE_UNREADABLE', 'SEAL_REFUSED', 'NO_KEY'] as const;
export type KnownError = (typeof KNOWN_ERRORS)[number];

/** The known code inside a thrown error, or null. */
export function errorCode(err: unknown): KnownError | null {
  const msg = err instanceof Error ? err.message : String(err);
  return KNOWN_ERRORS.find((c) => new RegExp(`\\b${c}\\b`).test(msg)) ?? null;
}
