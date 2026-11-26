import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { CivilopediaEntry } from './steam-sample.ts';

export function runLocalSql(batch: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = spawn('sqlcmd', [
      '-S', 'lpc:.', '-E', '-N', '-C', '-d', 'CivilizationVI_Rag_Dev',
      '-l', '5', '-t', '30', '-b', '-r', '1', '-x', '-X1', '-f', '65001',
      '-h', '-1', '-W', '-s', '|',
    ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let diagnostics = '';
    client.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    client.stderr.setEncoding('utf8').on('data', chunk => { diagnostics += chunk; });
    client.on('error', reject);
    client.stdin.on('error', reject);
    client.on('close', code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(diagnostics.trim() || `sqlcmd exited with code ${code}`));
    });
    client.stdin.end(`${batch}\nGO\n`);
  });
}

export async function loadSteamSample(entries: CivilopediaEntry[]): Promise<void> {
  const loadSql = await readFile(new URL('../database/load_steam_sample.sql', import.meta.url), 'utf8');
  const jsonHex = Buffer.from(JSON.stringify(entries), 'utf16le').toString('hex');
  // Hex keeps private XML text out of SQL syntax and preserves Unicode over stdin.
  const statements = ["DECLARE @Payload nvarchar(max) = N'';"];
  for (let offset = 0; offset < jsonHex.length; offset += 2000) {
    statements.push(`SET @Payload += CONVERT(nvarchar(max), 0x${jsonHex.slice(offset, offset + 2000)});`);
  }
  await runLocalSql(`${statements.join('\n')}\n${loadSql}`);
}
