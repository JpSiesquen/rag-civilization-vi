import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSteamCorpus } from './steam-corpus.ts';

const root = process.env.CIVILOPEDIA_SNAPSHOT;

test('normalizes Spanish evidence for game versions, leaders, modes and scenarios', {
  skip: root ? false : 'Set CIVILOPEDIA_SNAPSHOT to run against the private copy.',
}, async () => {
  assert.ok(root);
  const { entries, report } = await normalizeSteamCorpus(root);
  assert.equal(report.manifests, 37);
  const byKey = (key: string) => entries.filter(entry => entry.gameKey === key);
  const versions = ['RULESET_STANDARD', 'RULESET_EXPANSION_1', 'RULESET_EXPANSION_2'];
  assert.deepEqual(byKey('TECH_WRITING').map(entry => entry.gameVersion).sort(), [...versions].sort());
  assert.equal(byKey('DISTRICT_CAMPUS').find(entry => entry.gameVersion === 'RULESET_EXPANSION_2')?.fragments.length, 17);

  const leader = byKey('LEADER_JOAO_III');
  assert.equal(leader.length, 3);
  assert.ok(leader.every(entry => entry.fragments.every(fragment => fragment.requiredContentKey === 'Portugal')));

  const mode = byKey('GAMEMODE_APOCALYPSE');
  assert.deepEqual(mode.map(entry => entry.gameVersion), ['RULESET_EXPANSION_2']);
  assert.ok(mode[0].fragments.every(fragment => fragment.requiredModeKey === 'GAMEMODE_APOCALYPSE'));

  const [scenario] = byKey('RULESET_SCENARIO_VIKINGS');
  assert.equal(scenario.gameVersion, 'RULESET_SCENARIO_VIKINGS');
  assert.ok(scenario.fragments.every(fragment => fragment.requiredScenarioKey === scenario.gameVersion));
  for (const entry of [...leader, ...mode, scenario]) {
    assert.ok(entry.fragments.every(fragment => fragment.sources.some(source => source.relativePath.endsWith('.modinfo'))));
  }
  assert.ok(report.pending.length > 0, 'List unsupported Steam conditions and source files.');
  const keys = entries.map(entry => JSON.stringify([entry.gameKey, entry.languageCode, entry.gameVersion]));
  assert.equal(new Set(keys).size, entries.length);
});
