/**
 * The disk counter and the quick delete on the tiles: the total is the
 * registers' own sizes, a delete asks twice and disarms itself, the card
 * reads its state again after a delete, and a refused delete says why.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from './App';
import type { Host } from './lib/host';
import { diskUse, type RegisterState } from './lib/register';

const reg = (registry: string, sizeBytes: number | null): RegisterState => ({
  registry, phase: 'idle', startedAt: null, done: null, total: null, error: null, unreadable: null,
  installed: { asOf: new Date().toISOString(), dataDate: '2026-10-05', sourceLastModified: null, counts: { marks: 1 }, sizeBytes },
});
const empty = (registry: string): RegisterState => ({ ...reg(registry, 0), installed: null });

function host(over: Partial<Host>): Host {
  return {
    keyState: vi.fn(async () => ({ registry: 'uspto', present: false, savedAt: null, seal: 'sealed' as const, unreadable: false })),
    keySet: vi.fn(), keyClear: vi.fn(), verify: vi.fn(), openExternal: vi.fn(async () => undefined),
    mirrorStatus: vi.fn(async (r: string) => (r === 'ipau' ? reg('ipau', 555_000_000) : r === 'cipo' ? reg('cipo', 474_000_000) : empty(r))),
    mirrorPlan: vi.fn(), mirrorDownload: vi.fn(), mirrorCancel: vi.fn(), search: vi.fn(),
    mirrorRemove: vi.fn(async (r: string) => empty(r)),
    ...over,
  } as unknown as Host;
}

describe('diskUse', () => {
  it('sums the sizes the registers state, and marks the total a floor when one does not say', () => {
    expect(diskUse([reg('a', 10), reg('b', 5), null, empty('c')])).toEqual({ count: 2, bytes: 15, partial: false });
    expect(diskUse([reg('a', 10), reg('b', null)])).toEqual({ count: 2, bytes: 10, partial: true });
  });
});

describe('the disk counter and the quick delete', () => {
  it('shows the total, deletes only from the red button, then the tile reads the register again', async () => {
    const h = host({});
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    expect(await screen.findByText('1.0 GB on the disk')).toBeInTheDocument();
    expect(screen.getByText('2 register(s)')).toBeInTheDocument();
    // A trash can on each tile that has a register, named with the size it frees.
    const trash = screen.getByRole('button', { name: 'Delete this register (474 MB)', expanded: false });
    expect(screen.getByRole('button', { name: 'Delete this register (555 MB)', expanded: false })).toBeInTheDocument();
    fireEvent.click(trash);
    expect(h.mirrorRemove).not.toHaveBeenCalled();
    expect(screen.getAllByText('Delete 474 MB from this computer? It can be downloaded again.').length).toBeGreaterThan(0);
    // Canada is gone from now on.
    (h.mirrorStatus as ReturnType<typeof vi.fn>).mockImplementation(async (r: string) => (r === 'ipau' ? reg('ipau', 555_000_000) : empty(r)));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete 474 MB' })[0]!);
    await waitFor(() => expect(h.mirrorRemove).toHaveBeenCalledWith('cipo'));
    expect(await screen.findByText('555 MB on the disk')).toBeInTheDocument();
  });

  it('cancels without deleting', async () => {
    const h = host({});
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    await screen.findByText('1.0 GB on the disk');
    fireEvent.click(screen.getByRole('button', { name: 'Delete this register (474 MB)', expanded: false }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!);
    expect(screen.queryByRole('button', { name: 'Delete 474 MB' })).toBeNull();
    expect(h.mirrorRemove).not.toHaveBeenCalled();
  });

  it('disarms itself: a press long after the first is a new first press', async () => {
    const h = host({});
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    await screen.findByText('1.0 GB on the disk');
    // Fake clocks only once the screen is loaded: waitFor itself runs on timers.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Delete this register (555 MB)', expanded: false }));
      expect(screen.getAllByRole('button', { name: 'Delete 555 MB' }).length).toBeGreaterThan(0);
      act(() => { vi.advanceTimersByTime(7_000); });
      expect(screen.queryByRole('button', { name: 'Delete 555 MB' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Delete this register (555 MB)', expanded: false }));
      expect(h.mirrorRemove).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('says why a delete was refused, and keeps the register', async () => {
    const h = host({ mirrorRemove: vi.fn(async () => { throw new Error('SEARCH_RUNNING'); }) });
    render(<App host={h} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Registers/ }));
    await screen.findByText('1.0 GB on the disk');
    fireEvent.click(screen.getByRole('button', { name: 'Delete this register (555 MB)', expanded: false }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete 555 MB' })[0]!);
    expect(await screen.findByText('Could not delete: SEARCH_RUNNING')).toBeInTheDocument();
    expect(screen.getByText('1.0 GB on the disk')).toBeInTheDocument();
  });
});
