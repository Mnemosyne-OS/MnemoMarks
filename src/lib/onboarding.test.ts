import { describe, it, expect } from 'vitest';
import { formatBytes, stepsOf, type KeyState } from './onboarding';
import { errorCode } from './host';

const key = (over: Partial<KeyState> = {}): KeyState => ({ registry: 'uspto', present: true, savedAt: 1, seal: 'sealed', unreadable: false, ...over });

describe('stepsOf', () => {
  it('never ticks a step done outside the app until the office accepts the key', () => {
    expect(stepsOf(key(), null, false)).toEqual({ account: 'todo', key: 'todo', paste: 'done', check: 'todo' });
    expect(stepsOf(key(), { state: 'ok', at: 1, products: {}, catalog: null }, false)).toEqual({ account: 'done', key: 'done', paste: 'done', check: 'done' });
  });

  it('sends a refused key back to step 2, and an unreachable office to no step at all', () => {
    expect(stepsOf(key(), { state: 'refused', at: 1, status: 401 }, false)).toMatchObject({ account: 'todo', key: 'fix', check: 'fix' });
    expect(stepsOf(key(), { state: 'unreachable', at: 1, why: 'x' }, false)).toMatchObject({ key: 'todo', check: 'fix' });
  });

  it('asks to paste again when the saved keys cannot be opened', () => {
    expect(stepsOf(key({ present: false, unreadable: true }), null, false).paste).toBe('fix');
    expect(stepsOf(null, null, true).check).toBe('running');
  });
});

describe('formatBytes', () => {
  it('keeps an unknown size a dash, never 0', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(5_000_000)).toBe('5.0 MB');
    expect(formatBytes(437_000_000)).toBe('437 MB');
    expect(formatBytes(12_000_000_000)).toBe('12 GB');
    expect(formatBytes(474_000_000, 'fr')).toBe('474 Mo');
    expect(formatBytes(1_210_000_000, 'fr-CA')).toBe('1,2 Go');
  });
});

describe('errorCode', () => {
  it('finds a known code inside the bridge error, and nothing else', () => {
    expect(errorCode(new Error('HAS_WHITESPACE'))).toBe('HAS_WHITESPACE');
    expect(errorCode(new Error('marks.keySet: SEAL_REFUSED'))).toBe('SEAL_REFUSED');
    expect(errorCode(new Error('Permission denied'))).toBeNull();
  });
});
