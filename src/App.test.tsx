/**
 * The onboarding screen, driven the way a human does it, with a fake host:
 * paste → save → the app checks at once → the USPTO's own listing appears.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import type { Host } from './lib/host';
import type { KeyState, Verify } from './lib/onboarding';
import type { RegisterState, SearchAnswer } from './lib/register';

const idle: RegisterState = { registry: 'ipau', phase: 'idle', startedAt: null, done: null, total: null, error: null, installed: null, unreadable: null };

const absent: KeyState = { registry: 'uspto', present: false, savedAt: null, seal: 'sealed', unreadable: false };
const stored: KeyState = { ...absent, present: true, savedAt: Date.UTC(2026, 9, 5) };

function fakeHost(verify: Verify | Error, over: Partial<Host> = {}): Host {
  return {
    keyState: vi.fn(async () => absent),
    keySet: vi.fn(async () => stored),
    keyClear: vi.fn(async () => absent),
    verify: vi.fn(async () => { if (verify instanceof Error) throw verify; return verify; }),
    openExternal: vi.fn(async () => undefined),
    mirrorStatus: vi.fn(async () => idle),
    mirrorPlan: vi.fn(async () => ({ bytes: 437_000_000, archiveBytes: 1_347_000_000, lastModified: 'Mon, 05 Oct 2026 00:34:51 GMT', bytesPartial: false, dataDate: '2026-10-05' })),
    mirrorDownload: vi.fn(async () => ({ ...idle, phase: 'planning' as const })),
    mirrorCancel: vi.fn(async () => ({ cancelled: true })),
    mirrorRemove: vi.fn(async () => idle),
    search: vi.fn(async (): Promise<SearchAnswer> => ({ registers: [], missing: ['uspto'], failed: [] })),
    ...over,
  };
}

const paste = (value: string) => {
  // The USPTO card is shown once its office is chosen; Australia opens first.
  fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
  fireEvent.click(screen.getByRole('button', { name: /United States · USPTO/ }));
  fireEvent.change(screen.getByLabelText('Your USPTO API key'), { target: { value } });
  fireEvent.click(screen.getByText('Save the key'));
};

describe('MnemoMarks onboarding', () => {
  it('saves the pasted key, checks it at once, and shows the USPTO listing with every step done', async () => {
    const host = fakeHost({
      state: 'ok', at: 1,
      products: {
        daily: { state: 'ok', listing: { product: 'TRTDXFAP', files: 3, bytes: 3_000_000, bytesPartial: false, newest: { name: 'apc261004.zip', bytes: 1_000_000, date: '2026-10-04' } } },
      },
      catalog: [{ id: 'TRTDXFAP', title: 'Daily' }, { id: 'TRCFECO2', title: null }],
    });
    const { container } = render(<App host={host} />);
    paste('  abc123  ');
    expect(await screen.findByText('The USPTO accepts the key.')).toBeInTheDocument();
    expect(host.keySet).toHaveBeenCalledWith('uspto', '  abc123  ');
    expect(screen.getByText(/Daily files: 3 files · 3.0 MB in all · newest 2026-10-04/)).toBeInTheDocument();
    expect(screen.getByText('Trademark sets the USPTO offers (2): TRTDXFAP (Daily) · TRCFECO2')).toBeInTheDocument();
    const statuses = [...container.querySelectorAll('[data-step=account],[data-step=key],[data-step=paste],[data-step=check]')].map((li) => li.getAttribute('data-status'));
    expect(statuses).toEqual(['done', 'done', 'done', 'done']);
    // The field is emptied: the key is never shown again.
    expect((screen.getByLabelText('Your USPTO API key') as HTMLInputElement).value).toBe('');
  });

  it('lights the first step not done, and only that one', async () => {
    const { container } = render(<App host={fakeHost({ state: 'ok', at: 1, products: {}, catalog: null }, { keyState: vi.fn(async () => stored) })} />);
    await screen.findByText('Forget the key');
    // One 'Now' per card: the Australian, Canadian, French and Swedish downloads and the USPTO account.
    expect(screen.getAllByText('Now')).toHaveLength(5);
    expect(container.querySelector('[data-step="paste"]')?.getAttribute('data-status')).toBe('done');
    expect(container.querySelector('[data-step="account"]')).toHaveTextContent('Now');
  });

  it('tells a refused key apart from an office it could not reach', async () => {
    render(<App host={fakeHost({ state: 'refused', at: 1, status: 401 })} />);
    paste('k');
    expect(await screen.findByText(/The USPTO refused the key \(HTTP 401\)/)).toBeInTheDocument();
  });

  it('says what was wrong with a paste in its own words', async () => {
    render(<App host={fakeHost({ state: 'ok', at: 1, products: {}, catalog: null }, { keySet: vi.fn(async () => { throw new Error('LOOKS_LIKE_URL'); }) })} />);
    paste('https://data.uspto.gov/apikey');
    expect(await screen.findByRole('alert')).toHaveTextContent('That is a web address, not the key.');
  });

  it('forgets the key only on a second press', async () => {
    const host = fakeHost({ state: 'ok', at: 1, products: {}, catalog: null }, { keyState: vi.fn(async () => stored) });
    render(<App host={host} />);
    fireEvent.click(await screen.findByText('Forget the key'));
    expect(host.keyClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Forget it'));
    await waitFor(() => expect(host.keyClear).toHaveBeenCalledWith('uspto'));
  });

  it('opens the USPTO key page from the button and from the address it shows', async () => {
    const host = fakeHost({ state: 'ok', at: 1, products: {}, catalog: null });
    render(<App host={host} />);
    fireEvent.click(screen.getByText('Open the Open Data Portal ↗'));
    // The address itself is on screen and clickable, not hidden behind a label.
    fireEvent.click(screen.getAllByText('data.uspto.gov/apikey')[0]!);
    expect(host.openExternal).toHaveBeenCalledTimes(2);
    expect(host.openExternal).toHaveBeenCalledWith('https://data.uspto.gov/apikey');
  });
});
