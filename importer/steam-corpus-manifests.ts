import type { Element } from '@xmldom/xmldom';
import { posix } from 'node:path';
import type { Applicability, SourceReference } from './steam-sample.ts';
import { children, childText, readSteamXml } from './steam-xml.ts';

export const gameVersions = ['RULESET_STANDARD', 'RULESET_EXPANSION_1', 'RULESET_EXPANSION_2'];
export const ordinary: Applicability = {
  requiredContentKey: null, requiredModeKey: null, requiredScenarioKey: null,
};

export type SteamScope = Applicability & {
  version: string;
  manifest?: SourceReference;
};

export type SteamGap = { relativePath: string; reason: string };

const coreVersions = new Map([
  ['Standard', gameVersions[0]], ['Expansion1', gameVersions[1]], ['Expansion2', gameVersions[2]],
]);

function splitKeys(value: string): string[] {
  return value.split(',').map(key => key.trim()).filter(Boolean);
}

function resolveCriteria(condition: Element | undefined, action: Element) {
  const inline = children(action, 'Properties')[0];
  const inlineRules = inline ? splitKeys(childText(inline, 'RuleSet')) : [];
  if (!condition) return {
    rules: inlineRules, mode: null, unsupported: [], explicitAlternative: false, useDefaults: inlineRules.length === 0,
  };

  const tests = Array.from(condition.childNodes).filter(node => node.nodeType === 1) as Element[];
  const ruleGroups: string[][] = [];
  let mode: string | null = null;
  const unsupported: string[] = [];
  for (const test of tests) {
    const value = test.textContent?.trim() ?? '';
    if (test.tagName === 'RuleSetInUse') ruleGroups.push(splitKeys(value));
    else if (test.tagName === 'GameCoreInUse') {
      const supported: string[] = [];
      for (const core of splitKeys(value)) {
        const version = coreVersions.get(core);
        if (version) supported.push(version);
        else unsupported.push(`game core ${core}`);
      }
      ruleGroups.push(supported);
    } else if (test.tagName === 'ConfigurationValueMatches' &&
      childText(test, 'Group') === 'Game' && childText(test, 'Value') === '1' &&
      childText(test, 'ConfigurationId').startsWith('GAMEMODE_') && !mode) {
      mode = childText(test, 'ConfigurationId');
    } else unsupported.push(test.tagName);
  }
  const any = condition.getAttribute('any') === '1';
  let rules = any ? ruleGroups.flat() : (ruleGroups[0] ?? []).filter(rule => ruleGroups.every(group => group.includes(rule)));
  if (inlineRules.length) rules = ruleGroups.length ? rules.filter(rule => inlineRules.includes(rule)) : inlineRules;
  const explicitAlternative = any && rules.length > 0 && !mode;
  return { rules: [...new Set(rules)], mode, unsupported, explicitAlternative, useDefaults: !inlineRules.length && !ruleGroups.length };
}

export async function readCorpusManifests(root: string, manifestPaths: string[], available: Set<string>, pending: SteamGap[]) {
  const sourceScopes = new Map<string, SteamScope[]>();
  const modeScopes = new Map<string, SteamScope[]>();
  const scenarioScopes = new Map<string, SteamScope>();

  for (const manifestPath of manifestPaths) {
    const document = await readSteamXml(root, manifestPath);
    const directory = posix.dirname(manifestPath);
    const pack = posix.basename(directory);
    const content = ['Expansion1', 'Expansion2'].includes(pack) ? null : pack;
    const manifestCriteria = Array.from(document.getElementsByTagName('Criteria'));
    const defaultVersions = pack === 'Expansion1' ? [gameVersions[1]]
      : pack === 'Expansion2' ? [gameVersions[2]] : gameVersions;
    for (const criterion of manifestCriteria) {
      const id = criterion.getAttribute('id');
      if (!id) continue;
      for (const test of children(criterion, 'RuleSetInUse')) {
        for (const version of splitKeys(test.textContent ?? '')) {
          if (!version.startsWith('RULESET_SCENARIO_')) continue;
          scenarioScopes.set(`${pack}\0${version}`, { ...ordinary, version, requiredScenarioKey: version,
            requiredContentKey: content, manifest: { relativePath: manifestPath, sourceRecordKey: id } });
        }
      }
    }

    const actions = ['UpdateDatabase', 'UpdateText'].flatMap(tag => Array.from(document.getElementsByTagName(tag)));
    for (const action of actions) {
      const id = action.getAttribute('criteria') || action.getAttribute('id');
      const criterionId = action.getAttribute('criteria');
      const condition = criterionId ? manifestCriteria.find(item => item.getAttribute('id') === criterionId) : undefined;
      const paths = [...children(action, 'File'), ...children(action, 'Items').flatMap(item => children(item, 'File'))]
        .map(file => posix.join(directory, (file.textContent ?? '').trim().replaceAll('\\', '/')));
      if (!id || (criterionId && !condition)) {
        pending.push({ relativePath: manifestPath, reason: `Unresolved action ${id || '(unnamed)'}` });
        continue;
      }

      const context = resolveCriteria(condition, action);
      if (context.unsupported.length) {
        pending.push({ relativePath: manifestPath, reason: `${id}: ${[...new Set(context.unsupported)].join(', ')}` });
        if (!context.explicitAlternative) continue;
      }
      const scopes = (context.useDefaults ? defaultVersions : context.rules)
        .filter(version => gameVersions.includes(version) || version.startsWith('RULESET_SCENARIO_'))
        .map((version): SteamScope => ({
          version, requiredContentKey: content, requiredModeKey: context.mode,
          requiredScenarioKey: version.startsWith('RULESET_SCENARIO_') ? version : null,
          manifest: { relativePath: manifestPath, sourceRecordKey: id },
        }));
      if (context.mode) modeScopes.set(context.mode, [...(modeScopes.get(context.mode) ?? []), ...scopes]);
      for (const scope of scopes) {
        if (scope.requiredScenarioKey && !scope.requiredModeKey) {
          scenarioScopes.set(`${pack}\0${scope.version}`, scope);
        }
      }
      for (const path of paths) {
        if (available.has(path)) sourceScopes.set(path, [...(sourceScopes.get(path) ?? []), ...scopes]);
        else if (action.tagName === 'UpdateDatabase' && /\.(?:sql|xml)$/i.test(path) && /\/Data\//.test(path)
          && !/(^|_)Icons?[_\.]/i.test(posix.basename(path))) {
          pending.push({ relativePath: path, reason: `Referenced by ${manifestPath} but absent from the snapshot` });
        }
      }
    }
  }
  return { sourceScopes, modeScopes, scenarioScopes };
}
