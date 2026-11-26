import { loadSteamSample } from './local-sql.ts';
import { normalizeCampus } from './steam-sample.ts';

const root = process.env.CIVILOPEDIA_SNAPSHOT;
if (!root) throw new Error('Set CIVILOPEDIA_SNAPSHOT to the path of the private Steam copy.');

const entries = await normalizeCampus(root);
await loadSteamSample(entries);
console.log(`Loaded ${entries.length} Campus entries into the local development database.`);
