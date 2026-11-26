import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeCampus, readSampleApplicability } from './steam-sample.ts';

const snapshot = process.env.CIVILOPEDIA_SNAPSHOT;
const versions = ['RULESET_STANDARD', 'RULESET_EXPANSION_1', 'RULESET_EXPANSION_2'];

test('normalizes Campus from the private Steam copy', {
  skip: snapshot ? false : 'Set CIVILOPEDIA_SNAPSHOT to run against the private copy.',
}, async () => {
  assert.ok(snapshot);
  const entries = await normalizeCampus(snapshot);
  assert.deepEqual(entries.map(entry => entry.gameVersion), versions);
  const files = new Map<string, string>();

  for (const entry of entries) {
    assert.equal(entry.gameKey, 'DISTRICT_CAMPUS');
    assert.equal(entry.languageCode, 'es_ES');
    assert.equal(entry.title, 'Campus');
    assert.ok(entry.fragments.some(fragment => fragment.body.includes('Escritura')));
    assert.ok(entry.fragments.some(fragment => fragment.key === 'GBR_Science'));
    assert.equal(entry.fragments.some(fragment => fragment.key === 'Government_Science'),
      entry.gameVersion !== 'RULESET_STANDARD');
    assert.equal(entry.fragments.some(fragment => fragment.key === 'Reef_Science'),
      entry.gameVersion === 'RULESET_EXPANSION_2');

    const leyLine = entry.fragments.find(fragment => fragment.key === 'LeyLine_Science');
    if (entry.gameVersion === 'RULESET_STANDARD') {
      assert.equal(leyLine, undefined);
    } else {
      assert.ok(leyLine);
      assert.match(leyLine.body, /\+2 .*Línea ley/i);
      assert.equal(leyLine.requiredModeKey, 'GAMEMODE_SECRETSOCIETIES');
      assert.equal(leyLine.requiredContentKey, 'Ethiopia');
      const expansion = entry.gameVersion === 'RULESET_EXPANSION_1' ? 1 : 2;
      assert.ok(leyLine.sources.some(source =>
        source.relativePath === 'DLC/Ethiopia/Ethiopia.modinfo' &&
        source.sourceRecordKey === `Ethiopia_Mode_Expansion${expansion}`));
      assert.ok(leyLine.sources.some(source =>
        source.relativePath === 'DLC/Ethiopia/Data/Ethiopia_SecretSocieties_MODE.xml' &&
        source.sourceRecordKey === 'LeyLine_Science'));
      const visibility = entry.fragments.find(fragment => fragment.key === 'ley-line-visibility');
      assert.ok(visibility);
      assert.match(visibility.body, /Orden Hermética.*Neófito/i);
    }

    for (const fragment of entry.fragments) {
      assert.ok(fragment.sources.length > 0, fragment.key);
      for (const source of fragment.sources) {
        assert.match(source.relativePath, /^(Base|DLC)\//);
        assert.doesNotMatch(source.relativePath, /[:\\]|(?:^|\/)\.\.(?:\/|$)/);
        assert.ok(source.sourceRecordKey);
        let xml = files.get(source.relativePath);
        if (xml === undefined) {
          xml = await readFile(join(snapshot, source.relativePath), 'utf8');
          files.set(source.relativePath, xml);
        }
        assert.ok(xml.includes(source.sourceRecordKey), source.sourceRecordKey);
      }
    }
  }
});

test('distinguishes a DLC, an optional mode and a dedicated scenario', {
  skip: snapshot ? false : 'Set CIVILOPEDIA_SNAPSHOT to run against the private copy.',
}, async () => {
  assert.ok(snapshot);
  const [portugal, apocalypse, vikings] = await readSampleApplicability(snapshot);
  assert.equal(portugal.gameKey, 'LEADER_JOAO_III');
  assert.equal(portugal.requiredContentKey, 'Portugal');
  assert.deepEqual(portugal.gameVersions, versions);
  assert.equal(portugal.requiredModeKey, null);

  assert.equal(apocalypse.gameKey, 'GAMEMODE_APOCALYPSE');
  assert.equal(apocalypse.requiredModeKey, 'GAMEMODE_APOCALYPSE');
  assert.deepEqual(apocalypse.gameVersions, ['RULESET_EXPANSION_2']);

  assert.equal(vikings.requiredScenarioKey, 'RULESET_SCENARIO_VIKINGS');
  assert.deepEqual(vikings.gameVersions, []);
});
