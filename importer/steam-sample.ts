import type { Document } from '@xmldom/xmldom';
import { attribute, children, childText, required, rows, steamSnapshot } from './steam-xml.ts';

const languageCode = 'es_ES';
const campusKey = 'DISTRICT_CAMPUS';
const baseDistricts = 'Base/Assets/Gameplay/Data/Districts.xml';
const baseFeatures = 'Base/Assets/Gameplay/Data/Features.xml';
const baseText = 'Base/Assets/Text/Vanilla_es_ES.xml';
const ethiopiaMode = 'DLC/Ethiopia/Data/Ethiopia_SecretSocieties_MODE.xml';
const ethiopiaText = 'DLC/Ethiopia/Text/Ethiopia_Translations_Text_MODE.xml';

const versions = [
  { gameVersion: 'RULESET_STANDARD', core: '', expansion: '' },
  { gameVersion: 'RULESET_EXPANSION_1', core: 'Expansion1', expansion: 'Expansion1' },
  { gameVersion: 'RULESET_EXPANSION_2', core: 'Expansion2', expansion: 'Expansion2' },
] as const;

type Version = typeof versions[number];
type ReadXml = ReturnType<typeof steamSnapshot>;

export type SourceReference = {
  relativePath: string;
  sourceRecordKey: string;
};

type Applicability = {
  requiredContentKey: string | null;
  requiredModeKey: string | null;
  requiredScenarioKey: string | null;
};

type Fragment = Applicability & {
  key: string;
  section: string;
  body: string;
  sources: SourceReference[];
};

type DataFile = Applicability & {
  path: string;
  manifest: SourceReference | null;
};

type Translation = { text: string; source: SourceReference };

export type CampusEntry = {
  gameKey: string;
  languageCode: string;
  gameVersion: Version['gameVersion'];
  category: string;
  title: string;
  fragments: (Fragment & { position: number })[];
};

const general: Applicability = {
  requiredContentKey: null,
  requiredModeKey: null,
  requiredScenarioKey: null,
};

function source(relativePath: string, sourceRecordKey: string): SourceReference {
  return { relativePath, sourceRecordKey };
}

async function readTranslations(read: ReadXml, paths: string[]) {
  const translations = new Map<string, Translation>();
  for (const path of paths) {
    const doc = await read(path);
    for (const row of Array.from(doc.getElementsByTagName('Replace'))) {
      if (row.getAttribute('Language') !== languageCode) continue;
      const key = attribute(row, 'Tag');
      const text = childText(row, 'Text');
      if (text) translations.set(key, { text, source: source(path, key) });
    }
  }
  return (key: string) => required(translations.get(key), `Spanish translation ${key}`);
}

function firstForm(text: string): string {
  return text.split('|', 1)[0].trim();
}

function criteria(document: Document, id: string) {
  return required(Array.from(document.getElementsByTagName('Criteria')).find(item =>
    item.getAttribute('id') === id), `manifest criteria ${id}`);
}

function appliesTo(item: ReturnType<typeof criteria>, version: Version): boolean {
  const core = childText(item, 'GameCoreInUse');
  const ruleset = childText(item, 'RuleSetInUse');
  return (!core || core === version.core) && (!ruleset || ruleset.split(',').includes(version.gameVersion));
}

function requiredGameMode(condition: ReturnType<typeof criteria>): string | null {
  const match = children(condition, 'ConfigurationValueMatches').find(item =>
    childText(item, 'Group') === 'Game' && childText(item, 'Value') === '1');
  return match ? childText(match, 'ConfigurationId') : null;
}

async function campusDataFiles(read: ReadXml, version: Version): Promise<DataFile[]> {
  const files: DataFile[] = [baseDistricts, baseFeatures].map(path => ({ ...general, path, manifest: null }));
  if (!version.expansion) return files;

  const expansion = version.expansion;
  const expansionFiles = expansion === 'Expansion1'
    ? ['Data/Expansion1_Districts.xml']
    : ['Data/Expansion1_Districts.xml', 'Data/Expansion2_Districts.xml', 'Data/Expansion2_Features.xml'];
  const manifests = [
    { path: `DLC/${expansion}/${expansion}.modinfo`, content: null, files: expansionFiles },
    { path: 'DLC/Ethiopia/Ethiopia.modinfo', content: 'Ethiopia', files: ['Data/Ethiopia_SecretSocieties_MODE.xml'] },
  ];

  for (const manifest of manifests) {
    const document = await read(manifest.path);
    const actions = Array.from(document.getElementsByTagName('UpdateDatabase'));
    for (const relative of manifest.files) {
      const action = required(actions.find(item => children(item, 'File').some(file => file.textContent?.trim() === relative)
        && appliesTo(criteria(document, attribute(item, 'criteria')), version)), `active manifest action for ${relative}`);
      const criteriaId = attribute(action, 'criteria');
      const condition = criteria(document, criteriaId);
      files.push({
        ...general,
        path: `${manifest.path.slice(0, manifest.path.lastIndexOf('/') + 1)}${relative}`,
        requiredContentKey: manifest.content,
        requiredModeKey: requiredGameMode(condition),
        manifest: source(manifest.path, criteriaId),
      });
    }
  }
  return files;
}

export async function normalizeCampus(root: string): Promise<CampusEntry[]> {
  const read = steamSnapshot(root);
  const district = required(rows(await read(baseDistricts), 'Districts')
    .find(row => row.getAttribute('DistrictType') === campusKey), campusKey);
  const points = required(rows(await read(baseDistricts), 'District_GreatPersonPoints')
    .find(row => row.getAttribute('DistrictType') === campusKey), 'Campus great person points');
  const entries: CampusEntry[] = [];

  for (const version of versions) {
    const textPaths = [baseText];
    if (version.expansion) {
      textPaths.push(`DLC/${version.expansion}/Text/${version.expansion}_Translations_Text.xml`, ethiopiaText);
    }
    if (version.expansion === 'Expansion2') {
      textPaths.push('DLC/Expansion2/Text/Expansion2_Translations_ConfigText.xml');
    }
    const translate = await readTranslations(read, textPaths);
    const title = translate(attribute(district, 'Name'));
    const description = translate(attribute(district, 'Description'));
    const technology = translate(`LOC_${attribute(district, 'PrereqTech')}_NAME`);
    const scientist = translate(`LOC_${attribute(points, 'GreatPersonClassType')}_NAME`);
    const fragments: Fragment[] = [
      { ...general, key: 'description', section: 'Descripción', body: description.text,
        sources: [title.source, description.source, source(baseDistricts, campusKey)] },
      { ...general, key: 'requirements', section: 'Requisitos',
        body: `Requiere ${firstForm(technology.text)}. Coste base: ${attribute(district, 'Cost')} de Producción. Mantenimiento: ${attribute(district, 'Maintenance')} de Oro.`,
        sources: [source(baseDistricts, campusKey), technology.source] },
      { ...general, key: 'great-person-points', section: 'Rasgos',
        body: `Genera ${attribute(points, 'PointsPerTurn')} punto de ${firstForm(scientist.text)} por turno.`,
        sources: [source(baseDistricts, campusKey), scientist.source] },
    ];

    for (const file of await campusDataFiles(read, version)) {
      const document = await read(file.path);
      const adjacencies = rows(document, 'District_Adjacencies').filter(row => row.getAttribute('DistrictType') === campusKey);
      const yields = rows(document, 'Adjacency_YieldChanges');
      for (const adjacency of adjacencies) {
        const key = attribute(adjacency, 'YieldChangeId');
        const row = required(yields.find(item => item.getAttribute('ID') === key), `adjacency ${key}`);
        const target = row.getAttribute('AdjacentTerrain') || row.getAttribute('AdjacentFeature') || row.getAttribute('AdjacentDistrict');
        const targetText = target ? translate(`LOC_${target}_NAME`)
          : row.getAttribute('AdjacentResourceClass') === 'RESOURCECLASS_LEY_LINE' ? translate('LOC_RESOURCE_LEY_LINE_NAME')
          : translate('LOC_TYPE_TRAIT_ADJACENT_OBJECT_DISTRICT');
        const yieldText = translate(`LOC_${attribute(row, 'YieldType')}_NAME`);
        const tiles = attribute(row, 'TilesRequired');
        const sources = [source(file.path, key), targetText.source, yieldText.source];
        if (file.manifest) sources.push(file.manifest);
        fragments.push({
          key,
          section: 'Bonificación por adyacencia',
          body: `+${attribute(row, 'YieldChange')} de ${firstForm(yieldText.text)} por ${tiles === '1' ? 'cada casilla adyacente de' : `cada ${tiles} casillas adyacentes de`} ${firstForm(targetText.text)}.`,
          requiredContentKey: file.requiredContentKey,
          requiredModeKey: file.requiredModeKey,
          requiredScenarioKey: file.requiredScenarioKey,
          sources,
        });
      }

      if (file.path === ethiopiaMode) {
        const visibility = translate('LOC_GOVERNOR_PROMOTION_HERMETIC_ORDER_1_DESCRIPTION');
        const promotion = translate('LOC_GOVERNOR_PROMOTION_HERMETIC_ORDER_1_NAME');
        fragments.push({
          key: 'ley-line-visibility',
          section: 'Sociedades secretas',
          body: `Orden Hermética · ${firstForm(promotion.text)}. ${visibility.text}`,
          requiredContentKey: file.requiredContentKey,
          requiredModeKey: file.requiredModeKey,
          requiredScenarioKey: file.requiredScenarioKey,
          sources: [visibility.source, promotion.source,
            source(file.path, 'GOVERNOR_PROMOTION_HERMETIC_ORDER_1_UNLOCK_LEY_LINE')],
        });
      }
    }

    entries.push({
      gameKey: campusKey,
      languageCode,
      gameVersion: version.gameVersion,
      category: 'Distritos',
      title: firstForm(title.text),
      fragments: fragments.map((fragment, index) => ({ ...fragment, position: index + 1 })),
    });
  }

  return entries;
}

type SampleApplicability = Applicability & {
  gameKey: string;
  title: string;
  gameVersions: Version['gameVersion'][];
  sources: SourceReference[];
};

export async function readSampleApplicability(root: string): Promise<SampleApplicability[]> {
  const read = steamSnapshot(root);
  const samples = [
    {
      content: 'Portugal',
      criteriaId: 'Portugal',
      dataPath: 'Data/Portugal_Leaders.xml',
      textPath: 'Text/Portugal_Translations_ConfigText.xml',
      table: 'Leaders',
      keyField: 'LeaderType',
      gameKey: 'LEADER_JOAO_III',
    },
    {
      content: 'GranColombia_Maya',
      criteriaId: 'GranColombiaMaya_Mode_Expansion2',
      dataPath: 'Data/GranColombia_Maya_ConfigData.xml',
      textPath: 'Text/GranColombia_Maya_Translations_ConfigText.xml',
      table: 'Parameters',
      keyField: 'ConfigurationId',
      gameKey: 'GAMEMODE_APOCALYPSE',
    },
    {
      content: 'VikingsScenario',
      criteriaId: 'VikingsScenario',
      dataPath: 'Data/VikingsScenario_Config.xml',
      textPath: 'Text/VikingsScenario_Translations_ConfigText.xml',
      table: 'RuleSets',
      keyField: 'RuleSetType',
      gameKey: 'RULESET_SCENARIO_VIKINGS',
    },
  ];

  return Promise.all(samples.map(async sample => {
    const prefix = `DLC/${sample.content}/`;
    const manifestPath = `${prefix}${sample.content}.modinfo`;
    const dataPath = prefix + sample.dataPath;
    const [manifest, data, translate] = await Promise.all([
      read(manifestPath),
      read(dataPath),
      readTranslations(read, [prefix + sample.textPath]),
    ]);
    const condition = criteria(manifest, sample.criteriaId);
    const row = required(rows(data, sample.table).find(item =>
      (item.getAttribute(sample.keyField) || childText(item, sample.keyField)) === sample.gameKey),
    sample.gameKey);
    const title = translate(row.getAttribute('Name') || childText(row, 'Name'));
    const isScenario = childText(row, 'IsScenario') === '1';
    return {
      gameKey: sample.gameKey,
      title: firstForm(title.text),
      gameVersions: versions.filter(version => appliesTo(condition, version)).map(version => version.gameVersion),
      requiredContentKey: sample.content,
      requiredModeKey: requiredGameMode(condition),
      requiredScenarioKey: isScenario ? childText(condition, 'RuleSetInUse') : null,
      sources: [source(manifestPath, sample.criteriaId), source(dataPath, sample.gameKey), title.source],
    };
  }));
}
