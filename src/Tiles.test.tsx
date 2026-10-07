/**
 * The office tiles: their colour follows the age of this computer's copy
 * (green under 7 days, orange to 30, red after), the data day is the
 * calendar day whatever the reader's time zone, and a press opens the office.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import type { Host } from './lib/host';
import { formatDay, freshness, type RegisterState } from './lib/register';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 10, 12);

describe('freshness', () => {
  it('is green under 7 days, orange to 30, red after, and old when the date cannot be read', () => {
    const at = (days: number) => ({ asOf: new Date(NOW - days * DAY).toISOString() });
    expect(freshness(at(0), NOW)).toEqual({ level: 'fresh', days: 0 });
    expect(freshness(at(6), NOW).level).toBe('fresh');
    expect(freshness(at(7), NOW).level).toBe('stale');
    expect(freshness(at(29), NOW).level).toBe('stale');
    expect(freshness(at(30), NOW).level).toBe('old');
    expect(freshness({ asOf: 'garbage' }, NOW).level).toBe('old');
    expect(freshness(null, NOW)).toEqual({ level: 'none', days: null });
  });
});

describe('formatDay', () => {
  it('writes the calendar day itself, never the day before west of Greenwich', () => {
    expect(formatDay('2025-01-28', 'en-CA')).toBe('2025-01-28');
    expect(formatDay('2026-10-05', 'fr-FR')).toBe('05/10/2026');
  });
});

describe('office tiles', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('colours each register by the age of its download, and opens an office on press', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const reg = (registry: string, daysAgo: number, dataDate: string): RegisterState => ({
      registry, phase: 'idle', startedAt: null, done: null, total: null, error: null, unreadable: null,
      installed: { asOf: new Date(NOW - daysAgo * DAY).toISOString(), dataDate, sourceLastModified: null, counts: { marks: 2054876 }, sizeBytes: 1 },
    });
    const host = {
      keyState: vi.fn(async () => ({ registry: 'uspto', present: false, savedAt: null, seal: 'sealed' as const, unreadable: false })),
      keySet: vi.fn(), keyClear: vi.fn(), verify: vi.fn(), openExternal: vi.fn(async () => undefined),
      mirrorStatus: vi.fn(async (r: string) => (r === 'ipau' ? reg('ipau', 2, '2026-10-05') : r === 'cipo' ? reg('cipo', 40, '2025-01-28') : reg('inpi', 12, '2024-09-06'))),
      mirrorPlan: vi.fn(), mirrorDownload: vi.fn(), mirrorCancel: vi.fn(), search: vi.fn(),
    } as unknown as Host;
    const { container } = render(<App host={host} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    await waitFor(() => expect(container.querySelectorAll('nav [data-state]')).toHaveLength(5));
    const states = [...container.querySelectorAll('nav [data-state]')].map((e) => e.getAttribute('data-state'));
    expect(states).toEqual(['fresh', 'old', 'stale', 'stale', 'disconnected']);
    expect(screen.getByText(/2[   ,.]?054[   ,.]?876 marks · data of 2025-01-28|2,054,876 marks · data of 1\/28\/2025/)).toBeInTheDocument();
    // On the tile and in the office's own card.
    expect(screen.getAllByText('Downloaded 40 day(s) ago')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Canada · CIPO/ }));
    expect(screen.getByRole('button', { name: /Canada · CIPO/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('the general screen', () => {
  it('opens on the search, names the registers it will read with their date, and the offices it will not', async () => {
    const reg = (registry: string, dataDate: string): RegisterState => ({
      registry, phase: 'idle', startedAt: null, done: null, total: null, error: null, unreadable: null,
      installed: { asOf: new Date().toISOString(), dataDate, sourceLastModified: null, counts: { marks: 1 }, sizeBytes: 1_000_000 },
    });
    const host = {
      keyState: vi.fn(async () => ({ registry: 'uspto', present: false, savedAt: null, seal: 'sealed' as const, unreadable: false })),
      keySet: vi.fn(), keyClear: vi.fn(), verify: vi.fn(), openExternal: vi.fn(async () => undefined),
      mirrorStatus: vi.fn(async (r: string) => (r === 'ipau' ? reg('ipau', '2026-10-05') : { ...reg(r, ''), installed: null })),
      mirrorPlan: vi.fn(), mirrorDownload: vi.fn(), mirrorCancel: vi.fn(), mirrorRemove: vi.fn(), search: vi.fn(),
    } as unknown as Host;
    const { container } = render(<App host={host} />);
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(container.querySelector('[data-testid="coverage"]')).toHaveTextContent('10/5/2026'));
    const chips = container.querySelector('[data-testid="coverage"]')!.textContent!;
    expect(chips).toContain('AU');
    expect((chips.match(/not covered/g) ?? []).length).toBe(4);
    expect(screen.getByRole('tab', { name: /^Registers · / })).toBeInTheDocument();
  });
});

describe('statusWord', () => {
  it('translates an office status, and shows a word it does not know as written', async () => {
    const { translate } = await import('./i18n/strings');
    const { statusWord } = await import('./lib/register');
    const fr = (k: string) => translate('fr', k as never);
    expect(statusWord('registered', fr)).toBe('enregistrée');
    expect(statusWord('refused_appeal_pending', fr)).toBe('refusée, appel en cours');
    expect(statusWord('brand_new_status', fr)).toBe('brand_new_status');
    expect(statusWord(null, fr)).toBe('—');
  });
});
