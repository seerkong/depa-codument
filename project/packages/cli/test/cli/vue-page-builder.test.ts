import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createVuePageBuilderPort } from '../../src/cli/runtime/vue-page-builder';

async function observeWorkerFailure(source: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-page-builder-worker-'));
  const worker = path.join(root, 'worker.ts');
  const pageRoot = path.join(root, 'page');
  await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>worker</template>');
  await fs.writeFile(worker, source);
  let resolveUnavailable!: (message: string) => void;
  const unavailable = new Promise<string>((resolve) => { resolveUnavailable = resolve; });
  await createVuePageBuilderPort({
    async workerEntry() { return worker; },
    bunExecutable() { return process.execPath; },
  }).watch({
    pageName: 'worker-page',
    pageRoot,
    entry: 'src/App.vue',
    expose: './app',
    outputDirectory: path.join(root, 'work', 'dist'),
  }, {
    building() {},
    ready() {},
    error() {},
    unavailable(message) { resolveUnavailable(message); },
  });
  return Promise.race([
    unavailable,
    Bun.sleep(3_000).then(() => { throw new Error('Timed out waiting for worker unavailability'); }),
  ]);
}

describe('Vue Page builder worker lifecycle', () => {
  test('terminates a worker before rejecting a pre-start protocol failure', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-page-builder-prestart-invalid-'));
    const worker = path.join(root, 'worker.ts');
    const pidFile = path.join(root, 'worker.pid');
    const pageRoot = path.join(root, 'page');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>worker</template>');
    await fs.writeFile(worker, [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`,
      'process.stdout.write(JSON.stringify({ type: "protocol-corruption" }) + "\\n");',
      'setInterval(() => {}, 1_000);',
    ].join('\n'));
    const port = createVuePageBuilderPort({
      async workerEntry() { return worker; },
      bunExecutable() { return process.execPath; },
    });
    await expect(port.watch({
      pageName: 'worker-page', pageRoot, entry: 'src/App.vue', expose: './app',
      outputDirectory: path.join(root, 'work', 'dist'),
    }, {
      building() {}, ready() {}, error() {}, unavailable() {},
    })).rejects.toThrow('unknown event type');
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  test('rejects clean event-stream EOF before startup completes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-page-builder-startup-eof-'));
    const worker = path.join(root, 'worker.sh');
    const pageRoot = path.join(root, 'page');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>worker</template>');
    await fs.writeFile(worker, 'exec 1>&-\nread line\n');
    const port = createVuePageBuilderPort({
      async workerEntry() { return worker; },
      bunExecutable() { return '/bin/sh'; },
    });
    await expect(port.watch({
      pageName: 'worker-page', pageRoot, entry: 'src/App.vue', expose: './app',
      outputDirectory: path.join(root, 'work', 'dist'),
    }, {
      building() {}, ready() {}, error() {}, unavailable() {},
    })).rejects.toThrow('event stream ended before started');
  });

  test('reports an unexpected exit after startup', async () => {
    const message = await observeWorkerFailure([
      'process.stdout.write(JSON.stringify({ type: "started" }) + "\\n");',
      'setTimeout(() => process.exit(9), 20);',
    ].join('\n'));
    expect(message).toMatch(/exited with code 9|event stream ended unexpectedly/);
  });

  test('reports and terminates an invalid event stream after startup', async () => {
    const message = await observeWorkerFailure([
      'process.stdout.write(JSON.stringify({ type: "started" }) + "\\n");',
      'setTimeout(() => process.stdout.write("not-json\\n"), 20);',
      'setInterval(() => {}, 1_000);',
    ].join('\n'));
    expect(message).toMatch(/JSON|Unexpected token/);
  });

  test('reports and terminates a syntax-valid unknown event after startup', async () => {
    const message = await observeWorkerFailure([
      'process.stdout.write(JSON.stringify({ type: "started" }) + "\\n");',
      'setTimeout(() => process.stdout.write(JSON.stringify({ type: "protocol-corruption" }) + "\\n"), 20);',
      'setInterval(() => {}, 1_000);',
    ].join('\n'));
    expect(message).toContain('unknown event type');
  });

  test('rejects a terminal build event outside a building cycle', async () => {
    const message = await observeWorkerFailure([
      'process.stdout.write(JSON.stringify({ type: "started" }) + "\\n");',
      'setTimeout(() => process.stdout.write(JSON.stringify({ type: "error", diagnostics: [{ message: "bad order" }] }) + "\\n"), 20);',
      'setInterval(() => {}, 1_000);',
    ].join('\n'));
    expect(message).toContain('outside a building cycle');
  });
});
