import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSteamSample, runLocalSql } from './local-sql.ts';
import { normalizeCampus } from './steam-sample.ts';

test('loads the Steam sample twice with stable entries, fragments and sources', async () => {
  const root = process.env.CIVILOPEDIA_SNAPSHOT;
  assert.ok(root, 'Set CIVILOPEDIA_SNAPSHOT to the path of the private copy.');
  const entries = await normalizeCampus(root);
  const fragments = entries.flatMap(entry => entry.fragments);
  const counts = [entries.length, fragments.length, fragments.flatMap(fragment => fragment.sources).length];

  const readSample = () => runLocalSql(`
SET NOCOUNT ON;
IF NOT EXISTS (
    SELECT 1 FROM dbo.CivilopediaEntry AS entry
    JOIN dbo.CivilopediaFragment AS fragment ON fragment.EntryId = entry.EntryId
    JOIN dbo.CivilopediaSource AS source ON source.FragmentId = fragment.FragmentId
    WHERE entry.GameKey = N'DISTRICT_CAMPUS' AND entry.LanguageCode = 'es_ES'
      AND entry.GameVersion = 'RULESET_EXPANSION_2'
      AND fragment.RequiredModeKey = N'GAMEMODE_SECRETSOCIETIES'
      AND fragment.RequiredContentKey = N'Ethiopia'
      AND CHARINDEX(N'L' + NCHAR(237) + N'nea ley', fragment.Body) > 0
      AND source.RelativePath = N'DLC/Ethiopia/Data/Ethiopia_SecretSocieties_MODE.xml'
      AND source.SourceRecordKey = N'LeyLine_Science'
) THROW 50010, 'Missing the localized, conditional Ley Line source.', 1;

SELECT 'entry', entry.EntryId
FROM dbo.CivilopediaEntry AS entry
WHERE entry.GameKey = N'DISTRICT_CAMPUS' AND entry.LanguageCode = 'es_ES'
ORDER BY entry.EntryId;

SELECT 'fragment', fragment.FragmentId
FROM dbo.CivilopediaFragment AS fragment
JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
WHERE entry.GameKey = N'DISTRICT_CAMPUS' AND entry.LanguageCode = 'es_ES'
ORDER BY fragment.FragmentId;

SELECT 'source', source.SourceId
FROM dbo.CivilopediaSource AS source
JOIN dbo.CivilopediaFragment AS fragment ON fragment.FragmentId = source.FragmentId
JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
WHERE entry.GameKey = N'DISTRICT_CAMPUS' AND entry.LanguageCode = 'es_ES'
ORDER BY source.SourceId;
`);

  await loadSteamSample(entries);
  const first = await readSample();
  const observed = ['entry', 'fragment', 'source'].map(name =>
    first.split(/\r?\n/).filter(line => line.startsWith(`${name}|`)).length);
  assert.deepEqual(observed, counts);

  await loadSteamSample(entries);
  assert.equal(await readSample(), first);
});
