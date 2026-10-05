import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [release, output] = process.argv.slice(2);
assert.ok(release && output);
const artifacts = JSON.parse(readFileSync(release + '/release-set.json', 'utf8')).set.artifacts.filter(item => item.role === 'shared');
const results = await Promise.all(artifacts.map(async artifact => {
  const response = await fetch('https://registry.npmjs.org/' + artifact.name + '?fresh=' + Date.now(), {
    signal: AbortSignal.timeout(30000), headers: { 'cache-control': 'no-cache' },
  });
  if (!response.ok) return { name: artifact.name, status: response.status, live: false };
  const metadata = await response.json();
  const version = metadata.versions?.[artifact.version];
  if (!version) return { name: artifact.name, status: response.status, live: false, versions: Object.keys(metadata.versions ?? {}) };
  assert.equal(version.dist.integrity, artifact.integrity, 'Registry changed package bytes: ' + artifact.name);
  assert.ok(/^https:\/\/registry\.npmjs\.(org|com)\//.test(version.dist.tarball));
  const tarball = await fetch(version.dist.tarball, { signal: AbortSignal.timeout(30000) });
  if (!tarball.ok) return { name: artifact.name, status: tarball.status, live: false, metadataVisible: true };
  const bytes = await tarball.arrayBuffer();
  assert.equal('sha512-' + createHash('sha512').update(new Uint8Array(bytes)).digest('base64'), artifact.integrity);
  return { name: artifact.name, version: artifact.version, status: 200, live: true, latest: metadata['dist-tags']?.latest, integrity: artifact.integrity, tarball: version.dist.tarball };
}));
const report = { time: new Date().toISOString(), live: results.filter(item => item.live).length, total: results.length, results };
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ time: report.time, live: report.live, total: report.total, pending: results.filter(item => !item.live) }));
