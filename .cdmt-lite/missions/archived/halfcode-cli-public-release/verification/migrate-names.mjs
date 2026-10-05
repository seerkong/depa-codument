import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const roots = ['/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite', '/Users/kongweixian/infra-dev/depa-codument/project'];
const output = '/private/tmp/halfcode-cli-public-release-NRFNf0';
const mode = process.argv[2];
const protectedPaths = [
  '/Users/kongweixian/.local/bin/codument', '/Users/kongweixian/.local/bin/depa-codument',
  '/Users/kongweixian/.agents/skills/depa-codument', '/Users/kongweixian/.claude/skills/depa-codument',
  '/Users/kongweixian/.codex/skills/depa-codument', '/Users/kongweixian/.eidolon/skills/depa-codument',
  '/Users/kongweixian/infra-dev/depa-codument/codument', roots[0] + '/codument',
];
function digest(file) {
  if (!existsSync(file)) return null;
  const hash = createHash('sha256');
  function visit(path, relative) {
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name), relative + '/' + name);
    } else { hash.update(relative); hash.update(readFileSync(path)); }
  }
  visit(file, '');
  return hash.digest('hex');
}
if (mode === 'protect' || mode === 'verify-protection') {
  const snapshot = Object.fromEntries(protectedPaths.map(path => [path, digest(path)]));
  const file = join(output, 'protected-before.json');
  if (mode === 'protect') writeFileSync(file, JSON.stringify(snapshot, null, 2), { flag: 'wx' });
  else assert.deepEqual(snapshot, JSON.parse(readFileSync(file, 'utf8')));
  console.log(mode + ': ' + protectedPaths.length + ' paths');
} else if (mode === 'rename') {
  const receipts = [];
  for (const [index, root] of roots.entries()) {
    const files = execFileSync('rg', ['--files', '--hidden', '-g', '!node_modules', '-g', '!.git', '-g', '!codument', '-g', '!.cdmt-lite', '-g', '!dist'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
    for (const relative of files) {
      if (!/\.(?:ts|tsx|js|mjs|json|md|lock)$/.test(relative)) continue;
      // Current product material only, never historical workspaces or compatibility evidence.
      if (!(relative.startsWith('packages/') || relative.startsWith('scripts/') || !relative.includes('/'))) continue;
      const file = join(root, relative);
      const before = readFileSync(file, 'utf8');
      let after = before;
      if (index === 0) after = after.replaceAll('halfcode-lite-cli-shell', 'halfcode-lite-product-cli-shell');
      after = after.replaceAll('halfcode-lite-cli-host-', 'halfcode-lite-cli-');
      if (['scripts/verify-public-cli.ts', 'scripts/verify-feature-composition.ts', 'packages/cli-host-logic/src/clone-scaffold.ts', 'scripts/verification/architecture.ts'].includes(relative)) {
        after = after.replace(/(['"])cli-host-(contract|logic|support|capsule|shell)\1/g, '$1cli-$2$1');
      }
      if (relative.endsWith('package.json')) {
        const manifest = JSON.parse(after);
        if (manifest.halfcodeClone?.identity === 'shared') manifest.version = '0.2.1';
        for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
          for (const name of Object.keys(manifest[field] ?? {})) {
            if (name.startsWith('halfcode-lite-') && manifest[field][name] === '0.2.1-composition.12') manifest[field][name] = '0.2.1';
          }
        }
        if (JSON.stringify(manifest) !== JSON.stringify(JSON.parse(after))) after = JSON.stringify(manifest, null, 2) + '\n';
      }
      if (relative === 'bun.lock') after = after.replaceAll('0.2.1-composition.12', '0.2.1');
      if (after === before) continue;
      const backup = join(output, 'before', String(index), relative);
      mkdirSync(dirname(backup), { recursive: true });
      writeFileSync(backup, before, { flag: 'wx' });
      writeFileSync(file, after);
      receipts.push({ file, backup, before: createHash('sha256').update(before).digest('hex'), after: createHash('sha256').update(after).digest('hex') });
    }
  }
  writeFileSync(join(output, 'rename-receipt.json'), JSON.stringify(receipts, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ changed: receipts.length, output }));
} else throw new Error('Expected protect, verify-protection or rename');
