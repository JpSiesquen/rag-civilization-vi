import { loadSteamSample } from './local-sql.ts';
import { normalizeSteamCorpus } from './steam-corpus.ts';

const root = process.env.CIVILOPEDIA_SNAPSHOT;
if (!root) throw new Error('Set CIVILOPEDIA_SNAPSHOT to the path of the private Steam copy.');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--load')) {
  throw new Error('Use corpus.ts with no arguments for a report, or --load for the local database.');
}

const { entries, report } = await normalizeSteamCorpus(root);
if (args[0] === '--load') {
  const batchSize = 60;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    await loadSteamSample(entries.slice(offset, offset + batchSize));
    const loaded = Math.min(offset + batchSize, entries.length);
    if (loaded % 600 === 0 || loaded === entries.length) {
      console.error(`Loaded ${loaded}/${entries.length} entries into local SQL Server.`);
    }
  }
}

console.log(JSON.stringify({ ...report, loadedToLocalSql: args[0] === '--load' }, null, 2));
