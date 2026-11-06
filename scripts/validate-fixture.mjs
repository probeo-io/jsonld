import { readFile } from 'node:fs/promises';
import { validateHtml } from '../dist/index.js';
const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error('Usage: npm run validate:fixture -- <fixture.html>');
  process.exit(2);
}
const html = await readFile(file, 'utf8');
console.log(JSON.stringify(validateHtml(html), null, 2));
