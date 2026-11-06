import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('fuzzes both compiled public entry points in bounded subprocesses', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/fuzz.mjs', import.meta.url)), '--cases','2000'], {
    encoding: 'utf8', timeout: 25_000, maxBuffer: 2_000_000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr || result.stdout).toBe(0);
  expect(result.stdout).toContain('Passed 2000 deterministic fuzz cases');
}, 30_000);
