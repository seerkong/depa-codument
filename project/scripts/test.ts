#!/usr/bin/env bun
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const testRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'codument-test-run-')));
const child = Bun.spawn([process.execPath, 'test', ...process.argv.slice(2)], {
  cwd: path.resolve(import.meta.dir, '..'),
  env: {
    ...process.env,
    TMPDIR: testRoot,
    TMP: testRoot,
    TEMP: testRoot,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

let exitCode = 1;
try {
  exitCode = await child.exited;
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
process.exit(exitCode);

