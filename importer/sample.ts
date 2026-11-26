import { normalizeCampus, readSampleApplicability } from './steam-sample.ts';

const root = process.env.CIVILOPEDIA_SNAPSHOT;
if (!root) {
  console.error('Set CIVILOPEDIA_SNAPSHOT to the path of the private Steam copy.');
  process.exitCode = 1;
} else {
  const [entries, applicability] = await Promise.all([
    normalizeCampus(root),
    readSampleApplicability(root),
  ]);
  console.log(JSON.stringify({ entries, applicability }, null, 2));
}
