/**
 * marksAgent.ts — what an agent may do in MnemoMarks (doc 149), as plain functions over the
 * window's own state and its own moves. Declared in `mnemo-plugin.json` › agentActions, served
 * by `MarksAgentActions` while the window is open.
 *
 * 🚨 Every move is the one the person's own control makes: a check goes through the search
 * panel's own `run` (the « Check » button), so the names land in the field and the answer is
 * drawn on screen; an office is shown through the tab and the tile the person clicks.
 * Downloading or removing a register is NOT offered: hundreds of MB on an agent's say-so is not
 * the order of consent this app keeps (the size is shown first, the person presses).
 *
 * Refusals throw `CODE: reason`.
 */
import { RECORD_URL, dataDay, freshness, parseNames, verdictOf, type Hit, type RegisterState, type SearchAnswer } from './register';
import { findNamed, type Named } from './agentFind';

/** The offices of the window, in the order of its tiles. */
export const OFFICE_IDS = ['ipau', 'cipo', 'inpi', 'prv', 'uspto'] as const;
export type AgentOfficeId = (typeof OFFICE_IDS)[number];
/** The offices that keep a register on this computer (the USPTO is reached with a key). */
const REGISTER_IDS = ['ipau', 'cipo', 'inpi', 'prv'] as const;
const CODE: Record<AgentOfficeId, string> = { ipau: 'AU', cipo: 'CA', inpi: 'FR', prv: 'SE', uspto: 'US' };

/**
 * The words a person says for each office, in the three languages of the voice: its id, its
 * code, its own name, its country and the country's adjective. « le registre français »,
 * « Australia », « l'USPTO » and `inpi` all reach an office.
 */
const OFFICE_WORDS: Record<AgentOfficeId, string[]> = {
  ipau: ['ipau', 'AU', 'IP Australia', 'Australie', 'Australia', 'australien', 'australienne', 'Australian', 'australiano', 'australiana'],
  cipo: ['cipo', 'CA', 'OPIC', 'Canada', 'Canadá', 'canadien', 'canadienne', 'Canadian', 'canadiense'],
  inpi: ['inpi', 'FR', 'France', 'Francia', 'français', 'française', 'French', 'francés', 'francesa'],
  prv: ['prv', 'SE', 'Suède', 'Sweden', 'Suecia', 'suédois', 'suédoise', 'Swedish', 'sueco', 'sueca'],
  uspto: ['uspto', 'US', 'USA', 'États-Unis', 'United States', 'Estados Unidos', 'Amérique', 'America', 'américain', 'américaine', 'American', 'estadounidense'],
};
const OFFICE_NAME: Record<AgentOfficeId, string> = {
  ipau: 'ipau (Australia)', cipo: 'cipo (Canada)', inpi: 'inpi (France)', prv: 'prv (Sweden)', uspto: 'uspto (United States)',
};
const OFFICES: Named<AgentOfficeId>[] = OFFICE_IDS.map((id) => ({ item: id, id, names: OFFICE_WORDS[id], label: OFFICE_NAME[id] }));

/** The office `ref` names: its id, its code, its name or its country, in French, English or Spanish. */
export function findOffice(ref: unknown): AgentOfficeId {
  if (typeof ref !== 'string' || !ref.trim()) throw new Error(`BAD_ARG: name the office; offices: ${OFFICE_IDS.map((id) => OFFICE_NAME[id]).join(', ')}`);
  // A code said in capitals (« FR ») or lower case (« fr ») is the same office.
  const code = OFFICE_IDS.find((id) => CODE[id].toLowerCase() === ref.trim().toLowerCase());
  if (code) return code;
  return findNamed(OFFICES, ref, { code: 'NO_OFFICE', noun: 'office' });
}

/** How many names one check may carry: what the manifest declares as `names`' maxItems. */
export const MAX_NAMES = 50;
/** How long one name may be. */
export const MAX_NAME_LENGTH = 120;
/** How many marks of each kind an answer carries per name and register (the screen shows 5). */
export const MARKS_PER_KIND = 5;

/** The search panel's own controls, written by the panel at every render (one panel per window). */
export interface SearchControl {
  /** At least one register is on this computer. */
  ready: boolean;
  busy: boolean;
  answer: SearchAnswer | null;
  error: string | null;
  /** Puts the names in the field and runs the panel's own check; throws `SEARCH_FAILED` when the host refuses. */
  check: (names: string[]) => Promise<SearchAnswer>;
  /** Scrolls to one name's card in one register, as a click on its verdict in the summary does; false when no such card is drawn. */
  showCard: (registry: string, name: string) => boolean;
  /** Opens one mark on its office's own register, as a click on its row does; rejects when the host refuses. */
  openRecord: (url: string) => Promise<void>;
}

/** The mounted panel, or null while none is. */
export const searchControl: { current: SearchControl | null } = { current: null };

/** The window's state and its own moves, read fresh at every call. */
export interface MarksAgentContext {
  registers: Record<(typeof REGISTER_IDS)[number], RegisterState | null>;
  usConnected: boolean;
  search: SearchControl | null;
  /** The search tab, as the person's tab does. */
  showSearch: () => void;
  /** The registers tab, as the person's tab does. */
  showRegisters: () => void;
  /** The registers tab on one office, as a click on its tile does. */
  showOffice: (id: AgentOfficeId) => void;
  now: number;
}

/** One office as an agent reads it. */
export function officeLine(id: (typeof REGISTER_IDS)[number], s: RegisterState | null, now: number) {
  const inst = s?.installed ?? null;
  const f = freshness(inst, now);
  return {
    office: id,
    code: CODE[id],
    register: inst ? 'on this computer' : 'none',
    marks: typeof inst?.counts?.marks === 'number' ? inst.counts.marks : null,
    dataDay: inst ? dataDay(inst) : null,
    downloadedDaysAgo: f.days,
    freshness: f.level,
    phase: s?.phase ?? null,
    ...(s?.error ? { error: s.error } : {}),
    ...(s?.unreadable ? { unreadable: s.unreadable } : {}),
  };
}

/** One mark, short. */
const markLine = (h: Hit) => ({
  number: h.number, text: h.text, live: h.live, status: h.status, classes: h.classes, ...(h.owners.length ? { owners: h.owners } : {}),
});

/** An answer as an agent reads it: one verdict per name and register, and the first marks behind it. */
export function answerSummary(a: SearchAnswer) {
  return {
    read: a.registers.map((r) => ({ office: r.registry, dataDay: dataDay(r) })),
    notRead: a.missing,
    failed: a.failed,
    results: a.registers.flatMap((reg) => reg.results.map((r) => r.skipped
      ? { name: r.name, office: reg.registry, skipped: r.skipped }
      : {
        name: r.name,
        office: reg.registry,
        verdict: verdictOf(r),
        totals: r.totals,
        exact: r.exact.slice(0, MARKS_PER_KIND).map(markLine),
        within: r.within.slice(0, MARKS_PER_KIND).map(markLine),
        contains: r.contains.slice(0, MARKS_PER_KIND).map(markLine),
      })),
    note: '"clear" speaks for that one register as of its date, never for an office not read, and is never legal clearance.',
  };
}

/** Lets the tab the agent just showed be laid out before a card in it is scrolled to. */
const nextPaint = () => new Promise<void>((resolve) => { setTimeout(resolve, 60); });

/** The last answer's checked names, as the person says them. */
function answerNames(a: SearchAnswer): Named<string>[] {
  const names = [...new Set(a.registers.flatMap((reg) => reg.results.map((r) => r.name)))];
  return names.map((n) => ({ item: n, id: n, names: [n], label: n }));
}

/** One mark of the last answer, with the office it is in. */
interface MarkEntry { registry: string; hit: Hit }

/** Every mark the last answer loaded, once per office and number; `office` keeps one office only. */
function answerMarks(a: SearchAnswer, office: string | null): Named<MarkEntry>[] {
  const seen = new Set<string>();
  const out: Named<MarkEntry>[] = [];
  for (const reg of a.registers) {
    if (office && reg.registry !== office) continue;
    for (const r of reg.results) {
      for (const h of [...r.exact, ...r.within, ...r.contains]) {
        const key = `${reg.registry}:${h.number}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const code = CODE[reg.registry as AgentOfficeId] ?? reg.registry;
        out.push({ item: { registry: reg.registry, hit: h }, id: h.number, names: [h.text, h.number], label: `${h.text} (${h.number}, ${code})` });
      }
    }
  }
  return out;
}

/** The names of a call, checked and de-duplicated as the field does. */
export function readNames(v: unknown): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error('BAD_ARG: names must be a non-empty list of names');
  if (v.length > MAX_NAMES) throw new Error(`BAD_ARG: at most ${MAX_NAMES} names in one check`);
  for (const n of v) {
    if (typeof n !== 'string' || !n.trim()) throw new Error('BAD_ARG: every name must be a non-empty string');
    if (n.length > MAX_NAME_LENGTH) throw new Error(`BAD_ARG: a name is at most ${MAX_NAME_LENGTH} characters`);
  }
  const names = parseNames((v as string[]).join('\n'));
  if (names.length === 0) throw new Error('BAD_ARG: no name left once separators are removed');
  return names;
}

/** The handlers `sdk.onAgentActions` serves, over a context read fresh at every call. */
export function marksAgentHandlers(get: () => MarksAgentContext) {
  return {
    // agent-actions:begin
    registers: () => {
      const c = get();
      return {
        offices: REGISTER_IDS.map((id) => officeLine(id, c.registers[id], c.now)),
        uspto: { office: 'uspto', code: 'US', connected: c.usConnected },
        note: 'A name is only checked against the registers on this computer; an office with none is named in every answer, never read as "no mark".',
      };
    },

    checkNames: async (args: Record<string, unknown>) => {
      const names = readNames(args.names);
      const c = get();
      const s = c.search;
      if (!s) throw new Error('NO_PANEL: the search panel is not mounted; reopen MnemoMarks');
      if (!s.ready) {
        const none = REGISTER_IDS.filter((id) => !c.registers[id]?.installed).join(', ');
        throw new Error(`NO_REGISTER: no trademark register is on this computer (none for ${none}); the person downloads one from the Registers tab`);
      }
      if (s.busy) throw new Error('BUSY: a check is already running; call lastCheck for its answer');
      c.showSearch();
      return answerSummary(await s.check(names));
    },

    lastCheck: () => {
      const s = get().search;
      if (!s) throw new Error('NO_PANEL: the search panel is not mounted; reopen MnemoMarks');
      if (s.busy) return { running: true, answer: null };
      if (s.error) return { running: false, error: s.error, answer: null };
      return { running: false, answer: s.answer ? answerSummary(s.answer) : null };
    },

    showOffice: (args: Record<string, unknown>) => {
      const id = findOffice(args.office);
      get().showOffice(id);
      return { shown: id };
    },

    showTab: (args: Record<string, unknown>) => {
      const tab = args.tab;
      if (tab !== 'search' && tab !== 'registers') throw new Error(`BAD_ARG: tab is search or registers, not "${String(tab)}"`);
      const c = get();
      if (tab === 'search') c.showSearch(); else c.showRegisters();
      return { shown: tab };
    },

    showResult: async (args: Record<string, unknown>) => {
      const c = get();
      const s = c.search;
      if (!s) throw new Error('NO_PANEL: the search panel is not mounted; reopen MnemoMarks');
      if (!s.answer) throw new Error('NO_ANSWER: no check is on screen yet; call checkNames first');
      const name = findNamed(answerNames(s.answer), String(args.name ?? ''), { code: 'NO_NAME', noun: 'checked name' });
      const read = s.answer.registers.filter((reg) => reg.results.some((r) => r.name === name));
      let registry: string;
      if (args.office !== undefined) {
        const office = findOffice(args.office);
        if (!read.some((reg) => reg.registry === office)) {
          const where = read.map((reg) => OFFICE_NAME[reg.registry as AgentOfficeId] ?? reg.registry).join(', ') || 'none';
          throw new Error(`NOT_READ: "${name}" was not checked in ${OFFICE_NAME[office]}; read: ${where}`);
        }
        registry = office;
      } else {
        // The name's first card: the one its summary row starts with.
        registry = read[0]!.registry;
      }
      c.showSearch();
      await nextPaint();
      if (!s.showCard(registry, name)) throw new Error(`WRITE_FAILED: the card of "${name}" in ${registry} is not drawn; call lastCheck`);
      return { shown: { name, office: registry } };
    },

    openMark: async (args: Record<string, unknown>) => {
      const s = get().search;
      if (!s) throw new Error('NO_PANEL: the search panel is not mounted; reopen MnemoMarks');
      if (!s.answer) throw new Error('NO_ANSWER: no check is on screen yet; call checkNames first');
      const office = args.office === undefined ? null : findOffice(args.office);
      const { registry, hit } = findNamed(answerMarks(s.answer, office), String(args.mark ?? ''), { code: 'NO_MARK', noun: 'mark' });
      const base = RECORD_URL[registry];
      if (!base) throw new Error(`NO_RECORD_LINK: ${registry} has no page per mark to open`);
      try {
        await s.openRecord(base + encodeURIComponent(hit.number));
      } catch (err) {
        throw new Error(`WRITE_FAILED: the mark's page did not open: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { opened: { number: hit.number, text: hit.text, office: registry } };
    },
    // agent-actions:end
  };
}
