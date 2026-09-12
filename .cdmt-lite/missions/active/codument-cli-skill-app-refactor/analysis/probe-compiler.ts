import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = path.resolve(import.meta.dir, '../../../../..');
const compilers = [
  ['0.2.8', path.join(repository, 'node_modules/halfcode-compiler.xnl/dist/resource-core.js')],
  ['0.3.0', path.join(repository, 'project/packages/cli/node_modules/halfcode-compiler.xnl/dist/resource-core.js')],
] as const;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compiler-envelope-probe-'));
const results: unknown[] = [];
try {
  for (const [version, modulePath] of compilers) {
    const compiler = await import(pathToFileURL(modulePath).href);
    for (const [sourceVersion, metadata] of [
      ['0.2.8', 'apiVersion="halfcode.resources/v1" version="1.0.0"'],
      ['0.3.0', 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1'],
    ]) {
      fs.writeFileSync(path.join(root, 'manifest.xnl'), '<ResourcePackage #Probe ' + metadata + ' (<Catalogs []>)>\n');
      try {
        const tree = await compiler.loadResourceTree({ rootDir: root });
        results.push({ version, sourceVersion, accepted: true, stage: tree.stage ?? 'legacy', fields: Object.keys(tree) });
      } catch (error) {
        results.push({ version, sourceVersion, accepted: false,
          diagnostics: (error as { diagnostics?: unknown }).diagnostics ?? String(error) });
      }
    }
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
