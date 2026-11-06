/**
 * MnemoMarks' agent actions (doc 149): the manifest's declaration passes the HOST's own check,
 * every declared action has its handler (a declared action without one would be offered to
 * agents and fail), and the limits it declares are the handlers' own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import { MAX_NAMES, OFFICE_IDS, findOffice } from './lib/marksAgent';

const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'lib', 'marksAgent.ts'), 'utf8');
const block = source.slice(source.indexOf('// agent-actions:begin'), source.indexOf('// agent-actions:end'));
const handlers = [...block.matchAll(/^ {4}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

function declared() {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("MnemoMarks' agent actions", () => {
  it("pass the host's check of the manifest", () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(3);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
  });

  it('nothing spends credits, and the reads are the registers and the last answer', () => {
    expect(declared().filter((a) => a.effect === 'spend')).toEqual([]);
    expect(declared().filter((a) => a.effect === 'read').map((a) => a.id).sort()).toEqual(['lastCheck', 'registers']);
  });

  it('declares the handlers\' own limits', () => {
    const check = declared().find((a) => a.id === 'checkNames')!;
    expect(check.params.names).toMatchObject({ maxItems: MAX_NAMES });
    // An office is taken by the words a person says, never only by its id: no enum.
    const show = declared().find((a) => a.id === 'showOffice')!;
    expect(show.params.office).not.toHaveProperty('enum');
    for (const id of OFFICE_IDS) expect(findOffice(id)).toBe(id);
  });

  it('carries a guide and spoken examples in French, English and Spanish', () => {
    const m = manifest as { agentGuide?: string[]; voiceCommands?: Record<string, string[]> };
    expect(m.agentGuide?.[0]).toMatch(/AMBIGUOUS/);
    for (const lang of ['fr', 'en', 'es']) expect(m.voiceCommands?.[lang]?.length).toBeGreaterThanOrEqual(5);
  });
});
