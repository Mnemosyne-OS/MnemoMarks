/**
 * Results — the answer of a search as a reader uses it: rows that open the
 * office's page, filters, the rest of a bucket on demand, the cut said.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SearchPanel } from './ui/SearchPanel';
import { translate, type Key } from './i18n/strings';
import { classFacets, dataDay, filterHits, type Hit, type SearchAnswer } from './lib/register';
import type { Host } from './lib/host';

const t = (k: Key, v?: Record<string, string | number>) => translate('en', k, v);
const hit = (over: Partial<Hit>): Hit => ({ number: '1', text: 'X', wordType: 'phrase', status: 'registered', live: true, filed: null, classes: [], kinds: [], owners: [], ...over });

/** 12 marks inside the name were loaded, out of 30 the register holds. */
const within12 = Array.from({ length: 12 }, (_, i) => hit({ number: String(100 + i), text: `IRIS${i}`, classes: i < 4 ? ['9'] : ['41'], live: i % 3 !== 0 }));
const answer: SearchAnswer = {
  registers: [{ registry: 'ipau', asOf: '2026-10-05T10:00:00Z', dataDate: '2026-10-01', results: [
    { name: 'Noziris', norm: 'noziris', skipped: null, exact: [], within: within12, contains: [], totals: { exact: 0, within: 30, contains: 0 } },
  ] }],
  missing: ['uspto'], failed: [],
};

function mount() {
  const host = { search: vi.fn(async () => answer), openExternal: vi.fn(async () => undefined) } as unknown as Host;
  render(<SearchPanel host={host} t={t} lang="en" ready coverage={[]} onGoRegisters={() => undefined} />);
  fireEvent.change(screen.getByLabelText(/Aurora/), { target: { value: 'Noziris' } });
  fireEvent.click(screen.getByText('Check 1 name(s)'));
  return host;
}

describe('the search results', () => {
  it('opens the office page from anywhere on a row, not only its number', async () => {
    const host = mount();
    fireEvent.click(await screen.findByText('IRIS1'));
    expect(host.openExternal).toHaveBeenCalledWith('https://search.ipaustralia.gov.au/trademarks/search/view/101');
  });

  it('shows the rest of what was loaded on demand, and says how much the host did not send', async () => {
    mount();
    await screen.findByText('IRIS0');
    expect(screen.queryByText('IRIS5')).toBeNull();
    expect(screen.queryByText(/are loaded here/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show 7 more' }));
    expect(screen.getByText('IRIS11')).toBeInTheDocument();
    expect(screen.getByText('The first 12 of 30 are loaded here.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByText('IRIS11')).toBeNull();
  });

  it('narrows to one class and to live marks, and says the filters only see what was loaded', async () => {
    mount();
    await screen.findByText('IRIS0');
    fireEvent.click(screen.getByRole('button', { name: /^9 4$/ }));
    expect(screen.getByText(/4 with these filters/)).toBeInTheDocument();
    expect(screen.queryByText('IRIS4')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Live only' }));
    // IRIS0 and IRIS3 are dead (i % 3 === 0): 1 and 2 remain in class 9.
    expect(screen.getByText(/2 with these filters/)).toBeInTheDocument();
    expect(screen.queryByText('IRIS0')).toBeNull();
    expect(screen.getByText('Filters apply to the 12 loaded marks out of 30.')).toBeInTheDocument();
  });

  it('sums up every name per office, and a verdict there jumps to its card', async () => {
    mount();
    await screen.findByText('IRIS0');
    const summary = screen.getByTestId('summary');
    const cell = within(summary).getByRole('button', { name: 'Close marks' });
    const card = document.getElementById(`mm-card-ipau-${encodeURIComponent('Noziris')}`)!;
    card.scrollIntoView = vi.fn();
    fireEvent.click(cell);
    expect(card.scrollIntoView).toHaveBeenCalled();
  });
});

describe('result helpers', () => {
  it('never dates data after the day its copy was built', () => {
    expect(dataDay({ asOf: '2026-10-05T10:00:00Z', dataDate: '2028-01-22' })).toBe('2026-10-05');
    expect(dataDay({ asOf: '2026-10-05T10:00:00Z', dataDate: '2026-10-05' })).toBe('2026-10-05');
    expect(dataDay({ asOf: '2026-10-05T10:00:00Z', dataDate: '2025-01-28' })).toBe('2025-01-28');
    expect(dataDay({ asOf: '2026-10-05T10:00:00Z', dataDate: null })).toBe('2026-10-05');
  });

  it('counts each class once per mark, most frequent first', () => {
    expect(classFacets([hit({ classes: ['9', '9', '42'] }), hit({ classes: ['42'] }), hit({ classes: ['3'] })]))
      .toEqual([{ nice: '42', n: 2 }, { nice: '3', n: 1 }, { nice: '9', n: 1 }]);
  });

  it('keeps an unknown status out of "live only"', () => {
    expect(filterHits([hit({ live: null }), hit({ live: true, number: '2' })], { liveOnly: true, nice: null }).map((h) => h.number)).toEqual(['2']);
  });
});
