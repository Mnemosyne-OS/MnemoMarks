/**
 * The Australian register and the names check, driven like a human with a
 * fake host: the size is read before the download, the download is followed,
 * and every answer names the registers read AND the offices not covered.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';
import type { Host } from './lib/host';
import type { KeyState } from './lib/onboarding';
import { parseNames, verdictOf, type NameResult, type RegisterState, type SearchAnswer, type Hit } from './lib/register';

const idle: RegisterState = { registry: 'ipau', phase: 'idle', startedAt: null, done: null, total: null, error: null, installed: null, unreadable: null };
const installed: RegisterState = { ...idle, installed: { asOf: '2026-10-05T10:00:00.000Z', dataDate: '2026-10-05', sourceLastModified: 'Mon, 05 Oct 2026 00:34:51 GMT', counts: { marks: 2331273 }, sizeBytes: 600 * 1024 * 1024 } };
const noKey: KeyState = { registry: 'uspto', present: false, savedAt: null, seal: 'sealed', unreadable: false };

function host(over: Partial<Host> = {}): Host {
  return {
    keyState: vi.fn(async () => noKey), keySet: vi.fn(async () => noKey), keyClear: vi.fn(async () => noKey),
    verify: vi.fn(async () => ({ state: 'refused' as const, at: 1, status: 401 })),
    openExternal: vi.fn(async () => undefined),
    mirrorStatus: vi.fn(async () => idle),
    mirrorPlan: vi.fn(async () => ({ bytes: 437_000_000, archiveBytes: 1_347_000_000, lastModified: 'Mon, 05 Oct 2026 00:34:51 GMT', bytesPartial: false, dataDate: '2026-10-05' })),
    mirrorDownload: vi.fn(async () => ({ ...idle, phase: 'downloading' as const, done: 0, total: 437_000_000 })),
    mirrorCancel: vi.fn(async () => ({ cancelled: true })),
    mirrorRemove: vi.fn(async () => idle),
    search: vi.fn(async (): Promise<SearchAnswer> => ({ registers: [], missing: ['uspto'], failed: [] })),
    ...over,
  };
}

const hit = (over: Partial<Hit>): Hit => ({ number: '1', text: 'X', wordType: 'phrase', status: 'registered', live: true, filed: null, classes: [], kinds: [], owners: [], ...over });
const result = (over: Partial<NameResult>): NameResult => ({ name: 'N', norm: 'N', skipped: null, exact: [], within: [], contains: [], totals: { exact: 0, within: 0, contains: 0 }, ...over });

describe('the Australian register', () => {
  it('reads the size first and downloads only on the second press, naming the bytes', async () => {
    const h = host();
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    // Two register cards (Australia shown, Canada hidden): the first is Australia's.
    fireEvent.click((await screen.findAllByText('Read the size'))[0]!);
    expect(await screen.findByText(/to download \(of a 1\.3 GB archive\)/)).toBeInTheDocument();
    // The size is on screen and nothing has been downloaded: that takes a second press.
    expect(h.mirrorDownload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Download 437 MB'));
    await waitFor(() => expect(h.mirrorDownload).toHaveBeenCalledWith('ipau'));
    expect(await screen.findByRole('progressbar')).toBeInTheDocument();
  });

  it('follows a running download by polling, and stops polling once it is done', async () => {
    vi.useFakeTimers();
    try {
      const states = [{ ...idle, phase: 'downloading' as const, done: 100, total: 400 }, installed];
      // Only Australia's card moves; Canada's stays idle.
      const mirrorStatus = vi.fn(async (registry: string) => (registry === 'ipau' ? states.shift() ?? installed : idle));
      const ipauCalls = () => mirrorStatus.mock.calls.filter(([r]) => r === 'ipau').length;
      render(<App host={host({ mirrorStatus })} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByText('100 B of 400 B')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getAllByText(/Data of/).length).toBeGreaterThan(0);
      const calls = ipauCalls();
      await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
      expect(ipauCalls()).toBe(calls);
    } finally { vi.useRealTimers(); }
  });

  it('says a failure leaves the previous register whole', async () => {
    render(<App host={host({ mirrorStatus: vi.fn(async (registry: string) => (registry === 'ipau' ? { ...installed, error: 'TRUNCATED: application.csv 10/20' } : idle)) })} />);
    expect(await screen.findByText(/The download failed: TRUNCATED: application.csv 10\/20\. The previous register/)).toBeInTheDocument();
  });
});

describe('the Canadian register', () => {
  it('says how old the newest extract is, and opens a Canadian mark on the office\'s own page', async () => {
    const caInstalled: RegisterState = { ...installed, registry: 'cipo', installed: { ...installed.installed!, dataDate: '2025-01-28' } };
    const search = vi.fn(async (): Promise<SearchAnswer> => ({
      registers: [{ registry: 'cipo', asOf: '2026-10-05T10:00:00.000Z', dataDate: '2025-01-28', results: [result({ name: 'Ariadne', exact: [hit({ number: '0463457', text: 'ARIADNE' })], totals: { exact: 1, within: 0, contains: 0 } })] }],
      missing: ['uspto', 'ipau'], failed: [],
    }));
    const h = host({ mirrorStatus: vi.fn(async (registry: string) => (registry === 'cipo' ? caInstalled : idle)), search });
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    fireEvent.click(screen.getByRole('button', { name: /Canada · CIPO/ }));
    expect(await screen.findByText(/The newest extract CIPO publishes is of .*marks filed or changed since then are missing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText(/Aurora/), { target: { value: 'Ariadne' } });
    await waitFor(() => expect(screen.getByText('Check 1 name(s)')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Check 1 name(s)'));
    fireEvent.click(await screen.findByText('0463457'));
    expect(h.openExternal).toHaveBeenCalledWith('https://ised-isde.canada.ca/cipo/trademark-search/0463457');
    expect(screen.getByText(/Not covered: United States · USPTO, Australia · IP Australia\./)).toBeInTheDocument();
  });
});

describe('the French register', () => {
  it('says the copy stops at a bulletin, shows who holds a mark, and links the INPI page', async () => {
    const frInstalled: RegisterState = { ...installed, registry: 'inpi', installed: { ...installed.installed!, dataDate: '2024-09-06' } };
    const search = vi.fn(async (): Promise<SearchAnswer> => ({
      registers: [{ registry: 'inpi', asOf: '2026-10-05T10:00:00.000Z', dataDate: '2024-09-06', results: [result({ name: 'Timeless and timely', exact: [hit({ number: '3862845', text: 'TIMELESS AND TIMELY', owners: ['CHANEL, Société par Actions Simplifiée'] })], totals: { exact: 1, within: 0, contains: 0 } })] }],
      missing: ['uspto', 'ipau', 'cipo'], failed: [],
    }));
    const h = host({ mirrorStatus: vi.fn(async (registry: string) => (registry === 'inpi' ? frInstalled : idle)), search });
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    fireEvent.click(screen.getByRole('button', { name: /France · INPI/ }));
    expect(await screen.findByText(/This copy stops at the INPI bulletin of .*needs an INPI account/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText(/Aurora/), { target: { value: 'Timeless and timely' } });
    await waitFor(() => expect(screen.getByText('Check 1 name(s)')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Check 1 name(s)'));
    expect(await screen.findByText('CHANEL, Société par Actions Simplifiée')).toBeInTheDocument();
    fireEvent.click(screen.getByText('3862845'));
    expect(h.openExternal).toHaveBeenCalledWith('https://data.inpi.fr/marques/FR3862845');
  });
});

describe('checking names', () => {
  it('cannot run before a register is on this computer', async () => {
    render(<App host={host()} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText(/Aurora/), { target: { value: 'MnemoHub' } });
    expect(screen.getByText('Check 1 name(s)')).toBeDisabled();
    expect(screen.getByText(/No register on this computer yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Download a register'));
    expect(screen.getByRole('tab', { name: /^Registers/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('names the register read with its date, the office not covered, and each verdict', async () => {
    const search = vi.fn(async (): Promise<SearchAnswer> => ({
      registers: [{ registry: 'ipau', asOf: '2026-10-05T10:00:00.000Z', dataDate: '2026-10-05', results: [
        result({ name: 'MnemoVulns', within: [hit({ number: '2524022', text: 'MNEMO', classes: ['9', '42'] })], totals: { exact: 0, within: 1, contains: 0 } }),
        result({ name: 'Engramm' }),
      ] }],
      missing: ['uspto'],
      failed: [],
    }));
    const h = host({ mirrorStatus: vi.fn(async () => installed), search });
    const { container } = render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText(/Aurora/), { target: { value: 'MnemoVulns\nEngramm\nmnemovulns' } });
    await waitFor(() => expect(screen.getByText('Check 2 name(s)')).not.toBeDisabled());
    fireEvent.click(screen.getByText('Check 2 name(s)'));
    expect(await screen.findByText(/Read: Australia · IP Australia \(data of/)).toBeInTheDocument();
    expect(screen.getByText(/Not covered: United States · USPTO\./)).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(['MnemoVulns', 'Engramm']);
    const verdicts = [...container.querySelectorAll('[data-name] [data-verdict]')].map((e) => e.getAttribute('data-verdict'));
    expect(verdicts).toEqual(['close', 'clear']);
    fireEvent.click(screen.getByText('2524022'));
    expect(h.openExternal).toHaveBeenCalledWith('https://search.ipaustralia.gov.au/trademarks/search/view/2524022');
  });
});

describe('verdictOf and parseNames', () => {
  it('reads taken, close, unknown and clear from the buckets', () => {
    expect(verdictOf(result({ exact: [hit({})] }))).toBe('taken');
    expect(verdictOf(result({ exact: [hit({ live: false })], contains: [hit({ number: '2' })] }))).toBe('close');
    expect(verdictOf(result({ within: [hit({ live: null })] }))).toBe('unknown');
    expect(verdictOf(result({ exact: [hit({ live: false })] }))).toBe('clear');
  });

  it('splits on lines, commas and semicolons, and drops repeats whatever their case', () => {
    expect(parseNames(' MnemoHub ,engramm;\n\nENGRAMM\nXpacegems')).toEqual(['MnemoHub', 'engramm', 'Xpacegems']);
  });
});
