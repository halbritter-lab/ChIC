import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const swPath = resolve(dist, 'sw.js');
if (!existsSync(swPath)) throw new Error('dist/sw.js missing; run npm run build first.');

const sw = readFileSync(swPath, 'utf8');
const urls = [...new Set([...sw.matchAll(/\burl:"([^"]+)"/g)].map((match) => match[1]))];
const forbidden = [
  /exceljs/i,
  /ChICLogo_/,
  /ChIC_ApplicationComponents_/,
  /logo_v2\.svg$/,
  /og-image\.png$/,
];
const violations = urls.filter((url) => forbidden.some((pattern) => pattern.test(url)));
if (violations.length > 0) throw new Error(`Forbidden precache entries: ${violations.join(', ')}`);

const bytes = urls.reduce((total, url) => {
  const path = resolve(dist, url.replace(/^\//, ''));
  return existsSync(path) ? total + statSync(path).size : total;
}, 0);
const limit = 2_190_000;
console.log(JSON.stringify({ entries: urls.length, bytes, limit }));
if (bytes > limit) throw new Error(`Precache ${bytes} bytes exceeds ${limit}-byte limit.`);
