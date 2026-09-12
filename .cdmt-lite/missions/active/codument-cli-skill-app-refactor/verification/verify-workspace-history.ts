import * as fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createCodumentWorkspaceMigrator } from '../../../../../project/packages/product-capsule/src/workspace-migration';
import { createFileWorkspaceMigrationPort } from '../../../../../project/packages/domain-support/src/workspace-migration';

// Historical input test, not an installed consumer proof. Production code is
// tested against immutable old Git blobs and an isolated copy of real dogfood.
const sourceRoot = resolve(import.meta.dir, '../../../../..');
const label = process.argv[2];
if (!/^[a-z0-9-]+$/u.test(label ?? '')) throw new Error('Unique history verification label required.');
const temporary = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-workspace-history-')));
const reports = [];
const protectedPort = createFileWorkspaceMigrationPort(sourceRoot);
const original = await protectedPort.observe();
const identity = (files: typeof original.files) => JSON.stringify(files.map(({path, fingerprint, mode}) => ({path, fingerprint, mode})));
try {
  for (const revision of ['v0.5.2', 'v0.5.4', 'protected-dogfood']) {
    const root = join(temporary, revision); await fs.mkdir(root);
    if (revision === 'protected-dogfood') await fs.cp(join(sourceRoot, 'codument'), join(root, 'codument'), {recursive: true, dereference: false});
    else {
      const listing = Bun.spawnSync(['git', 'ls-tree', '-r', '--name-only', revision, '--', 'codument'], {cwd: sourceRoot});
      if (listing.exitCode) throw new Error('Local history unavailable: ' + revision);
      for (const path of listing.stdout.toString().trim().split('\n').filter(Boolean)) {
        const blob = Bun.spawnSync(['git', 'show', revision + ':' + path], {cwd: sourceRoot});
        if (blob.exitCode) throw new Error('Cannot read historical blob: ' + path);
        await fs.mkdir(dirname(join(root, path)), {recursive: true}); await fs.writeFile(join(root, path), blob.stdout);
      }
    }
    const port = createFileWorkspaceMigrationPort(root), before = await port.observe();
    const migration = createCodumentWorkspaceMigrator(root), plan = await migration.plan();
    const result = await migration.apply(plan);
    const after = await port.observe();
    if (result.status === 'review-required' && identity(before.files) !== identity(after.files)) throw new Error('Review changed historical authority: ' + revision);
    if (!result.backupPath) throw new Error('Historical migration lacks backup.');
    for (const file of before.files) {
      const bytes = await fs.readFile(join(result.backupPath, file.path.slice(9)));
      if ('sha256:' + createHash('sha256').update(bytes).digest('hex') !== file.fingerprint) throw new Error('Historical backup differs: ' + file.path);
    }
    if (result.status === 'applied' && (await migration.upgrade()).status !== 'noop') throw new Error('Historical migration is not idempotent.');
    reports.push({revision, sourceFiles: before.files.length, planStatus: plan.status, status: result.status,
      resourceCandidates: plan.resources.length, changes: plan.changes.length, planDigest: plan.planDigest,
      diagnostics: result.diagnostics, allOriginalBackupsExact: true, reviewPreservedOriginals: result.status === 'review-required'});
  }
  if (identity((await protectedPort.observe()).files) !== identity(original.files)) throw new Error('Protected dogfood input changed.');
  const report = {status: 'PASS', scope: 'historical-preservation-and-review', reports, protectedDogfoodUnchanged: true,
    unavailableLocalRelease: 'v0.5.3 (not inferred from adjacent tags)', fullSemanticUpgrade: 'UNVERIFIED'};
  await fs.writeFile(join(import.meta.dir, 'logs', label + '.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({...report, reports: reports.map(({diagnostics, ...rest}) => ({...rest, diagnosticsCount: diagnostics.length, firstDiagnostics: diagnostics.slice(0, 4)}))}));
} finally {await fs.rm(temporary, {recursive: true, force: true});}
