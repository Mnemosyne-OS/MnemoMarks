/**
 * MnemoMarks' agent handlers (doc 149): an agent's check is the panel's own check (the names
 * land in the field, the answer on screen), refusals are named, and an office with no register
 * is never read as clear.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { SearchPanel } from './ui/SearchPanel';
import { translate, type Key } from './i18n/strings';
import { MAX_NAMES, answerSummary, findOffice, marksAgentHandlers, readNames, searchControl, type MarksAgentContext, type SearchControl } from './lib/marksAgent';
import type { Hit, RegisterState, SearchAnswer } from './lib/register';
import type { Host } from './lib/host';

const t = (k: Key, v?: Record<string, string | number>) => translate('en', k, v);
const hit = (over: Partial<Hit>): Hit => ({ number: '1', text: 'X', wordType: 'phrase', status: 'registered', live: true, filed: null, classes: [], kinds: [], owners: [], ...over });
const answer: SearchAnswer = {
  registers: [{ registry: 'ipau', asOf: '2026-10-05T10:00:00Z', dataDate: '2026-10-01', results: [
    { name: 'Noziris', norm: 'noziris', skipped: null, exact: [hit({ number: '7', text: 'NOZIRIS' })], within: Array.from({ length: 9 }, (_, i) => hit({ number: String(i), live: false })), contains: [], totals: { exact: 1, within: 9, contains: 0 } },
    { name: 'Ab', norm: 'ab', skipped: 'TOO_SHORT', exact: [], within: [], contains: [], totals: { exact: 0, within: 0, contains: 0 } },
  ] }],
  missing: ['cipo', 'uspto'], failed: [],
};
const installed = (marks: number): RegisterState => ({
  registry: 'ipau', phase: 'idle', startedAt: null, done: null, total: null, error: null, unreadable: null,
  installed: { asOf: '2026-10-05T10:00:00Z', dataDate: '2026-10-01', sourceLastModified: null, counts: { marks }, sizeBytes: 1 },
});

function ctx(over: Partial<MarksAgentContext> = {}, search: Partial<SearchControl> | null = {}): MarksAgentContext {
  return {
    registers: { ipau: installed(10), cipo: null, inpi: null, prv: null },
    usConnected: false,
    search: search === null ? null : {
      ready: true, busy: false, answer: null, error: null, check: vi.fn(async () => answer),
      showCard: vi.fn(() => true), openRecord: vi.fn(async () => undefined), ...search,
    },
    showSearch: vi.fn(),
    showRegisters: vi.fn(),
    showOffice: vi.fn(),
    now: Date.parse('2026-10-06T10:00:00Z'),
    ...over,
  };
}

afterEach(() => { cleanup(); searchControl.current = null; });

describe('readNames', () => {
  it('trims and de-duplicates as the field does', () => {
    expect(readNames([' Iris ', 'iris', 'Nova'])).toEqual(['Iris', 'Nova']);
  });
  it('refuses an empty list, a non-string, and more names than declared', () => {
    expect(() => readNames([])).toThrow(/^BAD_ARG/);
    expect(() => readNames(['a', 3])).toThrow(/^BAD_ARG/);
    expect(() => readNames(Array.from({ length: MAX_NAMES + 1 }, (_, i) => `n${i}`))).toThrow(/at most 50/);
    expect(readNames(Array.from({ length: MAX_NAMES }, (_, i) => `n${i}`))).toHaveLength(MAX_NAMES);
  });
});

describe('the handlers', () => {
  it('checkNames shows the search tab and runs the panel\'s check', async () => {
    const c = ctx();
    const out = await marksAgentHandlers(() => c).checkNames({ names: ['Noziris'] });
    expect(c.showSearch).toHaveBeenCalled();
    expect(c.search!.check).toHaveBeenCalledWith(['Noziris']);
    expect(out.notRead).toEqual(['cipo', 'uspto']);
  });

  it('checkNames refuses with no register, while a check runs, and without a panel', async () => {
    const none = ctx({ registers: { ipau: null, cipo: null, inpi: null, prv: null } }, { ready: false });
    await expect(marksAgentHandlers(() => none).checkNames({ names: ['A1'] })).rejects.toThrow(/^NO_REGISTER: .*ipau, cipo, inpi, prv/);
    expect(none.search!.check).not.toHaveBeenCalled();
    const busy = ctx({}, { busy: true });
    await expect(marksAgentHandlers(() => busy).checkNames({ names: ['A1'] })).rejects.toThrow(/^BUSY/);
    expect(busy.search!.check).not.toHaveBeenCalled();
    expect(busy.showSearch).not.toHaveBeenCalled();
    await expect(marksAgentHandlers(() => ctx({}, null)).checkNames({ names: ['A1'] })).rejects.toThrow(/^NO_PANEL/);
  });

  it('registers names every office, and says none for one without a register', () => {
    const out = marksAgentHandlers(() => ctx()).registers();
    expect(out.offices.map((o) => [o.office, o.register, o.marks])).toEqual([
      ['ipau', 'on this computer', 10], ['cipo', 'none', null], ['inpi', 'none', null], ['prv', 'none', null],
    ]);
    expect(out.offices[0]).toMatchObject({ dataDay: '2026-10-01', downloadedDaysAgo: 1 });
    expect(out.uspto).toEqual({ office: 'uspto', code: 'US', connected: false });
  });

  it('lastCheck says running, the error, or the answer', () => {
    expect(marksAgentHandlers(() => ctx({}, { busy: true })).lastCheck()).toEqual({ running: true, answer: null });
    expect(marksAgentHandlers(() => ctx({}, { error: 'boom' })).lastCheck()).toMatchObject({ error: 'boom' });
    expect(marksAgentHandlers(() => ctx({}, { answer })).lastCheck().answer?.results).toHaveLength(2);
  });

  it('showOffice moves to an office named as the person says it, and refuses an unknown one with the list', () => {
    const c = ctx();
    expect(marksAgentHandlers(() => c).showOffice({ office: 'inpi' })).toEqual({ shown: 'inpi' });
    expect(marksAgentHandlers(() => c).showOffice({ office: 'le registre français' })).toEqual({ shown: 'inpi' });
    expect(c.showOffice).toHaveBeenLastCalledWith('inpi');
    expect(() => marksAgentHandlers(() => c).showOffice({ office: 'euipo' })).toThrow(/^NO_OFFICE: .*ipau \(Australia\), cipo \(Canada\), inpi \(France\), prv \(Sweden\), uspto \(United States\)/);
  });

  it('showTab shows the tab the person names', () => {
    const c = ctx();
    expect(marksAgentHandlers(() => c).showTab({ tab: 'registers' })).toEqual({ shown: 'registers' });
    expect(c.showRegisters).toHaveBeenCalled();
    marksAgentHandlers(() => c).showTab({ tab: 'search' });
    expect(c.showSearch).toHaveBeenCalled();
    expect(() => marksAgentHandlers(() => c).showTab({ tab: 'home' })).toThrow(/^BAD_ARG/);
  });

  it("showResult scrolls to a checked name's card, by its words, in the office said", async () => {
    const c = ctx({}, { answer });
    expect(await marksAgentHandlers(() => c).showResult({ name: 'noziris' })).toEqual({ shown: { name: 'Noziris', office: 'ipau' } });
    expect(c.showSearch).toHaveBeenCalled();
    expect(c.search!.showCard).toHaveBeenCalledWith('ipau', 'Noziris');
    await expect(marksAgentHandlers(() => c).showResult({ name: 'Noziris', office: 'Australie' })).resolves.toEqual({ shown: { name: 'Noziris', office: 'ipau' } });
    await expect(marksAgentHandlers(() => c).showResult({ name: 'Noziris', office: 'Canada' })).rejects.toThrow(/^NOT_READ: .*read: ipau \(Australia\)/);
  });

  it('showResult refuses a name shared by several, a name not checked, no answer, and a card not drawn', async () => {
    const two: SearchAnswer = { ...answer, registers: [{ ...answer.registers[0]!, results: [
      { ...answer.registers[0]!.results[0]!, name: 'Iris Bleu' }, { ...answer.registers[0]!.results[0]!, name: 'Iris Rouge' },
    ] }] };
    await expect(marksAgentHandlers(() => ctx({}, { answer: two })).showResult({ name: 'iris' })).rejects.toThrow('AMBIGUOUS: "iris" names several checked names: Iris Bleu, Iris Rouge; say which');
    await expect(marksAgentHandlers(() => ctx({}, { answer })).showResult({ name: 'Aurora' })).rejects.toThrow(/^NO_NAME: .*Noziris, Ab/);
    await expect(marksAgentHandlers(() => ctx()).showResult({ name: 'Noziris' })).rejects.toThrow(/^NO_ANSWER/);
    const gone = ctx({}, { answer, showCard: vi.fn(() => false) });
    await expect(marksAgentHandlers(() => gone).showResult({ name: 'Noziris' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it("openMark opens a mark of the last answer on its office's page, by its text or its number", async () => {
    const c = ctx({}, { answer });
    expect(await marksAgentHandlers(() => c).openMark({ mark: 'Noziris' })).toEqual({ opened: { number: '7', text: 'NOZIRIS', office: 'ipau' } });
    expect(c.search!.openRecord).toHaveBeenCalledWith('https://search.ipaustralia.gov.au/trademarks/search/view/7');
    await expect(marksAgentHandlers(() => c).openMark({ mark: '3', office: 'AU' })).resolves.toMatchObject({ opened: { number: '3' } });
  });

  it('openMark refuses a text several marks carry, and says when the page did not open', async () => {
    await expect(marksAgentHandlers(() => ctx({}, { answer })).openMark({ mark: 'X' })).rejects.toThrow(/^AMBIGUOUS: "X" names several marks: X \(0, AU\), X \(1, AU\)/);
    const refused = ctx({}, { answer, openRecord: vi.fn(async () => { throw new Error('DENIED'); }) });
    await expect(marksAgentHandlers(() => refused).openMark({ mark: 'NOZIRIS' })).rejects.toThrow("WRITE_FAILED: the mark's page did not open: DENIED");
  });
});

describe('findOffice', () => {
  it('takes an id, a code, a name or a country in French, English or Spanish', () => {
    expect(findOffice('FR')).toBe('inpi');
    expect(findOffice('se')).toBe('prv');
    expect(findOffice('IP Australia')).toBe('ipau');
    expect(findOffice('le registre australien')).toBe('ipau');
    expect(findOffice('Sweden')).toBe('prv');
    expect(findOffice('registro francés')).toBe('inpi');
    expect(findOffice('les États-Unis')).toBe('uspto');
    expect(findOffice('Estados Unidos')).toBe('uspto');
    expect(findOffice("l'USPTO")).toBe('uspto');
    expect(() => findOffice('Japon')).toThrow(/^NO_OFFICE: no office named "Japon"/);
    expect(() => findOffice('')).toThrow(/^BAD_ARG/);
  });
});

describe('answerSummary', () => {
  it('gives a verdict per name, keeps a skipped name as skipped, and cuts the marks at 5', () => {
    const s = answerSummary(answer);
    expect(s.results[0]).toMatchObject({ name: 'Noziris', verdict: 'taken' });
    expect((s.results[0] as { within: unknown[] }).within).toHaveLength(5);
    expect(s.results[1]).toEqual({ name: 'Ab', office: 'ipau', skipped: 'TOO_SHORT' });
  });
});

describe('the panel\'s control', () => {
  it('puts the names in the field and runs the same search the button runs', async () => {
    const host = { search: vi.fn(async () => answer), openExternal: vi.fn(async () => undefined) } as unknown as Host;
    render(<SearchPanel host={host} t={t} lang="en" ready coverage={[]} onGoRegisters={() => undefined} />);
    let got: SearchAnswer | undefined;
    await act(async () => { got = await searchControl.current!.check(['Noziris', 'Nova']); });
    expect(host.search).toHaveBeenCalledWith(['Noziris', 'Nova']);
    expect(got).toBe(answer);
    expect((screen.getByLabelText(/Aurora/) as HTMLTextAreaElement).value).toBe('Noziris\nNova');
    expect(await screen.findByText('NOZIRIS')).toBeInTheDocument();
  });

  it('a refused search is a named failure, and the panel shows it', async () => {
    const host = { search: vi.fn(async () => { throw new Error('STORE_UNREADABLE'); }), openExternal: vi.fn() } as unknown as Host;
    render(<SearchPanel host={host} t={t} lang="en" ready coverage={[]} onGoRegisters={() => undefined} />);
    await act(async () => { await expect(searchControl.current!.check(['Iris'])).rejects.toThrow(/^SEARCH_FAILED: STORE_UNREADABLE/); });
    expect(screen.getByRole('alert')).toHaveTextContent('STORE_UNREADABLE');
  });

  it('is withdrawn with the panel', () => {
    const host = { search: vi.fn(), openExternal: vi.fn() } as unknown as Host;
    const { unmount } = render(<SearchPanel host={host} t={t} lang="en" ready coverage={[]} onGoRegisters={() => undefined} />);
    expect(searchControl.current).not.toBeNull();
    unmount();
    expect(searchControl.current).toBeNull();
  });
});
