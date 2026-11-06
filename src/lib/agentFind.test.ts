import { describe, expect, it } from 'vitest';
import { findNamed, nameWords, type Named } from './agentFind';

const entry = (id: string, name: string): Named<string> => ({ item: id, id, names: [name], label: name });
const NAMES = [entry('n1', 'Nova'), entry('n2', 'Nova Labs'), entry('n3', 'Noziris'), entry('n4', 'Labs Nova Studio')];
const kind = { code: 'NO_NAME', noun: 'checked name' };

describe('a name said the way a person says it', () => {
  it('folds case, accents, fillers and a plural', () => {
    expect(nameWords('le registre FRANÇAIS')).toEqual(['francai']);
    expect(nameWords('les marques Noziris')).toEqual(['noziri']);
    expect(nameWords('Bol à thé')).toEqual(['bol', 'the']);
  });

  it('an id, the whole name, or every word of it', () => {
    expect(findNamed(NAMES, 'n3', kind)).toBe('n3');
    expect(findNamed(NAMES, 'noziris', kind)).toBe('n3');
    // « Nova » is a whole name: it wins over the names that hold the word.
    expect(findNamed(NAMES, 'la marque Nova', kind)).toBe('n1');
    expect(findNamed(NAMES, 'nova studio', kind)).toBe('n4');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(NAMES, 'labs', kind)).toThrow('AMBIGUOUS: "labs" names several checked names: Nova Labs, Labs Nova Studio; say which');
  });

  it('no match is refused with the names that exist', () => {
    expect(() => findNamed(NAMES, 'Aurora', kind)).toThrow('NO_NAME: no checked name named "Aurora"; checked names: Nova, Nova Labs, Noziris, Labs Nova Studio');
    expect(() => findNamed(NAMES, ' ', kind)).toThrow(/^BAD_ARG/);
    expect(() => findNamed([], 'nova', kind)).toThrow('checked names: none');
  });

  it('an id shared by two entries is not an answer: the words decide, or it is refused', () => {
    const two = [{ item: 'a', id: '7', names: ['NOZIRIS', '7'], label: 'NOZIRIS (7, AU)' }, { item: 'b', id: '7', names: ['NOVA', '7'], label: 'NOVA (7, CA)' }];
    expect(() => findNamed(two, '7', { code: 'NO_MARK', noun: 'mark' })).toThrow(/^AMBIGUOUS: .*NOZIRIS \(7, AU\).*NOVA \(7, CA\)/);
    expect(findNamed(two, 'nova', { code: 'NO_MARK', noun: 'mark' })).toBe('b');
  });
});
