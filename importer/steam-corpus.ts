import type { Document, Element } from '@xmldom/xmldom';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { gameVersions, ordinary, readCorpusManifests, type SteamGap, type SteamScope } from './steam-corpus-manifests.ts';
import { normalizeCampus, type CivilopediaEntry, type Fragment, type SourceReference } from './steam-sample.ts';
import { children, childText, readSteamXml, rows } from './steam-xml.ts';

type Localized = SourceReference & { text: string };
type GameplayRecord = {
  key: string;
  page: string;
  category: string;
  title: string;
  description: string;
};
type EntryDraft = Omit<CivilopediaEntry, 'fragments'> & { fragments: Map<string, Fragment> };

const tables = [
  ['Civilizations', 'CivilizationType', 'Civilizaciones'],
  ['Leaders', 'LeaderType', 'Líderes'],
  ['Districts', 'DistrictType', 'Distritos'],
  ['Buildings', 'BuildingType', 'Edificios'],
  ['Units', 'UnitType', 'Unidades'],
  ['Technologies', 'TechnologyType', 'Tecnologías'],
  ['Civics', 'CivicType', 'Principios'],
  ['Features', 'FeatureType', 'Accidentes del terreno'],
  ['Resources', 'ResourceType', 'Recursos'],
  ['Improvements', 'ImprovementType', 'Mejoras'],
  ['Policies', 'PolicyType', 'Políticas'],
  ['Governments', 'GovernmentType', 'Gobiernos'],
  ['Beliefs', 'BeliefType', 'Creencias'],
  ['GreatPersonIndividuals', 'GreatPersonIndividualType', 'Grandes personajes'],
  ['UnitPromotions', 'UnitPromotionType', 'Ascensos'],
  ['GovernorPromotions', 'GovernorPromotionType', 'Ascensos de gobernador'],
  ['Governors', 'GovernorType', 'Gobernadores'],
] as const;

function value(row: Element, key: string): string {
  return row.getAttribute(key) || childText(row, key);
}

function cleanText(text: string): string {
  return text.replaceAll('[NEWLINE]', '\n').replace(/\[(?:ICON_[^\]]+|COLOR[^\]]*|ENDCOLOR)\]/g, '').trim();
}

function dataRecords(document: Document): GameplayRecord[] {
  const records: GameplayRecord[] = [];
  for (const [table, keyField, category] of tables) {
    for (const row of rows(document, table)) {
      const key = value(row, keyField);
      if (!key || key === 'DISTRICT_CAMPUS') continue;
      records.push({ key, page: key, category, title: value(row, 'Name'), description: value(row, 'Description') });
    }
  }
  for (const row of rows(document, 'CivilopediaPages')) {
    const page = value(row, 'PageId');
    const section = value(row, 'SectionId');
    if (!page || !section || page === 'INTRO') continue;
    records.push({
      key: `PEDIA_${section}_${page}`, page, category: section === 'CONCEPTS' ? 'Conceptos' : 'Civilopedia',
      title: value(row, 'Name'), description: '',
    });
  }
  for (const row of rows(document, 'Parameters')) {
    const key = value(row, 'ConfigurationId');
    if (key.startsWith('GAMEMODE_')) {
      records.push({ key, page: key, category: 'Modos', title: value(row, 'Name'), description: value(row, 'Description') });
    }
  }
  for (const row of rows(document, 'RuleSets')) {
    const key = value(row, 'RuleSetType');
    if (key.startsWith('RULESET_SCENARIO_')) {
      records.push({ key, page: key, category: 'Escenarios', title: value(row, 'Name'),
        description: value(row, 'LongDescription') || value(row, 'Description') });
    }
  }
  return records;
}

function sameContext(candidate: SteamScope, scope: SteamScope): boolean {
  return candidate.version === scope.version &&
    (!candidate.requiredModeKey || candidate.requiredModeKey === scope.requiredModeKey) &&
    (!candidate.requiredScenarioKey || candidate.requiredScenarioKey === scope.requiredScenarioKey);
}

function packageOf(path: string): string | undefined {
  return path.startsWith('DLC/') ? path.split('/')[1] : undefined;
}

function compatibleText(path: string, scope: SteamScope, packageKey: string | undefined, scopes: Map<string, SteamScope[]>) {
  const origin = packageOf(path);
  if (!origin) return 0;
  const allowed = scopes.get(path);
  if (allowed?.some(candidate => sameContext(candidate, scope)) && (
    origin === packageKey || origin === scope.requiredContentKey || origin === 'Expansion1' || origin === 'Expansion2'
  )) return origin === packageKey ? 3 : 2;
  if (allowed) return -1;
  if (origin === packageKey && !/_MODE/i.test(path)) return 1;
  return -1;
}

export async function normalizeSteamCorpus(snapshot: string) {
  const root = resolve(snapshot);
  const files = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter(item => item.isFile())
    .map(item => relative(root, join(item.parentPath, item.name)).split(sep).join('/'))
    .sort();
  const manifestPaths = files.filter(path => /^DLC\/[^/]+\/[^/]+\.modinfo$/i.test(path));
  if (!manifestPaths.length) throw new Error('The private Steam copy has no DLC manifests.');
  const pending: SteamGap[] = [];
  const { sourceScopes, modeScopes, scenarioScopes } = await readCorpusManifests(root, manifestPaths, new Set(files), pending);
  const localization = new Map<string, Localized[]>();
  const paragraphs = new Map<string, Set<string>>();
  const textFiles = files.filter(path => /^(Base\/Assets|DLC\/[^/]+)\/Text\/.*\.xml$/i.test(path));

  for (const path of textFiles) {
    const document = await readSteamXml(root, path);
    const textRows = ['Replace', 'Row'].flatMap(tag => Array.from(document.getElementsByTagName(tag)));
    for (const row of textRows) {
      if (value(row, 'Language') !== 'es_ES') continue;
      const tag = value(row, 'Tag');
      const text = cleanText(childText(row, 'Text'));
      if (!tag || !text) continue;
      const translations = localization.get(tag) ?? [];
      translations.push({ relativePath: path, sourceRecordKey: tag, text });
      localization.set(tag, translations);
      const page = /^LOC_PEDIA_[A-Z0-9]+_PAGE_(.+?)_CHAPTER_.*_PARA_\d+$/i.exec(tag)?.[1];
      if (page) {
        const tags = paragraphs.get(page) ?? new Set<string>();
        tags.add(tag);
        paragraphs.set(page, tags);
      }
    }
  }

  const choose = (tag: string, scope: SteamScope, pack?: string) => {
    let best: Localized | undefined;
    let bestWeight = -1;
    for (const candidate of localization.get(tag) ?? []) {
      const weight = compatibleText(candidate.relativePath, scope, pack, sourceScopes);
      if (weight > bestWeight) {
        best = candidate;
        bestWeight = weight;
      }
    }
    return best;
  };
  const drafts = new Map<string, EntryDraft>();
  const baseScopes: SteamScope[] = gameVersions.map(version => ({ ...ordinary, version }));
  const missingTitles = new Set<string>();
  const missingText = new Set<string>();
  const dataFiles = files.filter(path => /^(Base\/Assets\/(Gameplay|Configuration)|DLC\/[^/]+)\/Data\/.*\.(xml|sql)$/i.test(path));

  for (const path of dataFiles) {
    if (path.endsWith('.sql')) {
      pending.push({ relativePath: path, reason: 'SQL gameplay script requires separate review' });
      continue;
    }
    const document = await readSteamXml(root, path);
    const pack = packageOf(path);
    const scopes = pack ? sourceScopes.get(path) ?? [] : baseScopes;
    const records = dataRecords(document);
    if (records.length && !scopes.length) pending.push({ relativePath: path, reason: 'No supported manifest action for gameplay rows' });
    const patchedTables = tables.map(([name]) => name).filter(name =>
      Array.from(document.getElementsByTagName(name)).some(table =>
        children(table, 'Update').length > 0 || children(table, 'Delete').length > 0));
    if (patchedTables.length) {
      pending.push({ relativePath: path, reason: `Structured gameplay changes require review: ${patchedTables.join(', ')}` });
    }
    for (const record of records) {
      const scenarioScope = scenarioScopes.get(`${pack}\0${record.key}`);
      const recordScopes = record.category === 'Modos' ? (modeScopes.get(record.key) ?? []).filter(scope => scope.requiredContentKey === pack)
        : record.category === 'Escenarios' ? scenarioScope?.requiredContentKey === pack && scenarioScope ? [scenarioScope] : []
        : scopes;
      if (!recordScopes.length && (record.category === 'Modos' || record.category === 'Escenarios')) {
        pending.push({ relativePath: path, reason: `No explicit applicability for ${record.key}` });
      }
      for (const scope of recordScopes) {
        if (scope.version.length > 32) {
          pending.push({ relativePath: path, reason: `Ruleset exceeds the database key length: ${scope.version}` });
          continue;
        }
        const title = choose(record.title, scope, pack) ?? choose(`LOC_${record.key}_NAME`, scope, pack);
        if (!title) {
          missingTitles.add(`${path} · ${record.key}`);
          continue;
        }
        const tags = [...(paragraphs.get(record.page) ?? [])].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
        const text = [
          { tag: record.description, section: 'Descripción' },
          ...tags.map(tag => ({ tag, section: tag.includes('_HISTORY_') ? 'Contexto histórico' : 'Civilopedia' })),
        ];
        const identity = `${record.key}\0${scope.version}`;
        const entry = drafts.get(identity) ?? {
          gameKey: record.key, languageCode: 'es_ES', gameVersion: scope.version,
          category: record.category, title: title.text.split('|', 1)[0], fragments: new Map<string, Fragment>(),
        };
        for (const { tag, section } of text) {
          if (!tag) continue;
          const localized = choose(tag, scope, pack);
          if (!localized) continue;
          const sources = [
            { relativePath: path, sourceRecordKey: record.page },
            { relativePath: localized.relativePath, sourceRecordKey: localized.sourceRecordKey },
          ];
          if (title.sourceRecordKey !== localized.sourceRecordKey) {
            sources.push({ relativePath: title.relativePath, sourceRecordKey: title.sourceRecordKey });
          }
          if (scope.manifest) sources.push(scope.manifest);
          const fragmentKey = [tag, scope.requiredContentKey, scope.requiredModeKey, scope.requiredScenarioKey].join('\0');
          entry.fragments.set(fragmentKey, {
            key: tag, section, body: localized.text, sources,
            requiredContentKey: scope.requiredContentKey, requiredModeKey: scope.requiredModeKey,
            requiredScenarioKey: scope.requiredScenarioKey,
          });
        }
        if (entry.fragments.size) drafts.set(identity, entry);
        else missingText.add(`${path} · ${record.key}`);
      }
    }
  }

  const entries = [
    ...await normalizeCampus(root),
    ...Array.from(drafts.values(), entry => ({
      ...entry, fragments: Array.from(entry.fragments.values(), (fragment, index) => ({ ...fragment, position: index + 1 })),
    })),
  ];
  const byVersion: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let fragments = 0;
  for (const entry of entries) {
    byVersion[entry.gameVersion] = (byVersion[entry.gameVersion] ?? 0) + 1;
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    fragments += entry.fragments.length;
  }
  return { entries, report: {
    manifests: manifestPaths.length, textFiles: textFiles.length, dataFiles: dataFiles.length,
    entries: entries.length, fragments, byVersion, byCategory,
    missingSpanishTitle: [...missingTitles], missingSpanishText: [...missingText],
    pending: [...new Map(pending.map(gap => [JSON.stringify(gap), gap])).values()],
  } };
}
