import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name), value = index < 0 ? fallback : Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}
const seed = option('--seed', 1), cases = option('--cases', 20_000);
if (!cases || cases > 1_000_000 || seed + cases > 2 ** 32) throw new Error('Use 1–1,000,000 cases within the 32-bit seed range');
const worker = fileURLToPath(new URL('../tests/fuzz/worker.mjs', import.meta.url));
for (let offset = 0; offset < cases; offset += 2000) {
  const start = seed + offset, count = Math.min(2000,cases-offset);
  const result = spawnSync(process.execPath,['--max-old-space-size=192',worker,String(start),String(count)], {
    encoding:'utf8',timeout:20_000,maxBuffer:2_000_000,
  });
  if (result.error || result.status !== 0) {
    const last = result.stdout?.trim().split('\n').at(-1);
    let failingSeed = start;
    try { failingSeed = JSON.parse(last).seed; } catch { /* worker may fail before its first case */ }
    console.error(`Fuzz failure; last started case: ${last ?? 'worker startup'}. Replay: npm run test:fuzz -- --seed ${failingSeed} --cases 1`);
    console.error(result.stderr || result.error?.message || `Worker exit ${result.status}, signal ${result.signal}`);
    process.exit(1);
  }
}
console.log(`Passed ${cases} deterministic fuzz cases (seeds ${seed}–${seed+cases-1}); each validated twice. Workers limited to 192 MiB V8 heap and 20 seconds per 2,000 cases.`);
