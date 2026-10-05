import builderManifest from 'halfcode-lite-page-builder-vue-support/package.json';
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildVuePage, VUE_PAGE_BUILDER_VERSIONS, watchVuePage } from '../src';

async function fixture(source = '<template><main class="app">Live Vue</main></template><style>.app{color:red}</style>') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vue-page-builder-'));
  const pageRoot = path.join(root, 'page');
  const outputDirectory = path.join(root, 'output');
  await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(pageRoot, 'src/App.vue'), source);
  return { root, pageRoot, outputDirectory };
}

describe('Host-owned Vue Page builder', () => {
  test('builds a Vue SFC as a version-pinned Module Federation remote', async () => {
    const { pageRoot, outputDirectory } = await fixture();
    const receipt = await buildVuePage({
      pageName: 'live-dashboard',
      pageRoot,
      entry: 'src/App.vue',
      expose: './app',
      outputDirectory,
      packageBuild: {
        packageName: '@test/live-dashboard', generationId: 'sha256:source-generation',
        pages: [{ fqn: 'Test.Page.Live', route: '/' }],
        source: { descriptor: 'src/halfcode.page.ts', sourceDigest: 'sha256:source', lockDigest: 'sha256:lock' },
        toolchain: { contractVersion: '0.1.1' },
      },
    });
    expect(receipt.remoteEntry).toBe('remoteEntry.js');
    expect(receipt.mfManifest).toBe('mf-manifest.json');
    expect(VUE_PAGE_BUILDER_VERSIONS.moduleFederationProtocol).toBe('@module-federation/vite');
    expect(receipt.outputFiles.some((file) => file.endsWith('.css'))).toBe(true);
    expect(receipt).toMatchObject({
      protocolVersion: '2', packageName: '@test/live-dashboard', generationId: 'sha256:source-generation',
      entry: 'remoteEntry.js', pages: [{ fqn: 'Test.Page.Live', route: '/' }],
      source: { descriptor: 'src/halfcode.page.ts', sourceDigest: 'sha256:source', lockDigest: 'sha256:lock' },
      toolchain: { contractVersion: '0.1.1', builderVersion: builderManifest.version, federationVersion: '1.20.1' },
    });
    expect(receipt.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'remoteEntry.js', digest: expect.stringMatching(/^sha256:/), kind: 'js' }),
      expect.objectContaining({ path: 'mf-manifest.json', digest: expect.stringMatching(/^sha256:/), kind: 'manifest' }),
    ]));
    expect(receipt.assetsDigest).toMatch(/^sha256:/);
    const manifest = JSON.parse(await fs.readFile(path.join(outputDirectory, receipt.mfManifest), 'utf8'));
    expect(manifest.exposes).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'app' })]));
    expect(manifest.shared).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'vue', version: VUE_PAGE_BUILDER_VERSIONS.vue }),
    ]));
    expect(manifest.metaData?.remoteEntry?.name).toBe('remoteEntry.js');
  });

  test('ignores App-owned build config and rejects undeclared or escaping imports before Vite runs', async () => {
    const configured = await fixture();
    await fs.writeFile(path.join(configured.pageRoot, 'vite.config.ts'), 'throw new Error("must not execute")');
    await expect(buildVuePage({
      pageName: 'configured', pageRoot: configured.pageRoot, entry: 'src/App.vue', expose: './app',
      outputDirectory: configured.outputDirectory,
    })).resolves.toMatchObject({ remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json' });

    const dependency = await fixture('<script setup>import leftPad from "left-pad"</script><template>{{ leftPad }}</template>');
    await expect(buildVuePage({
      pageName: 'dependency', pageRoot: dependency.pageRoot, entry: 'src/App.vue', expose: './app',
      outputDirectory: dependency.outputDirectory,
    })).rejects.toThrow('not declared');

    const escaping = await fixture('<script setup>import secret from "../../secret.js"</script><template>{{ secret }}</template>');
    await expect(buildVuePage({
      pageName: 'escaping', pageRoot: escaping.pageRoot, entry: 'src/App.vue', expose: './app',
      outputDirectory: escaping.outputDirectory,
    })).rejects.toThrow('Relative import escapes Page root');
  });

  test('keeps one Vite watcher alive and coalesces adjacent source writes into a successful rebuild', async () => {
    const { pageRoot, outputDirectory } = await fixture();
    const receipts: Array<{
      durationMs: number;
      outputFiles: readonly string[];
      generationId: string;
      source: { sourceDigest: string };
    }> = [];
    const waiters: Array<() => void> = [];
    const nextReady = () => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for Vue watcher')), 5_000);
      waiters.push(() => { clearTimeout(timer); resolve(); });
    });
    const firstReady = nextReady();
    const errors: string[] = [];
    const handle = await watchVuePage({
      pageName: 'watched-dashboard', pageRoot, entry: 'src/App.vue', expose: './app', outputDirectory,
    }, {
      building() {},
      ready(receipt) {
        receipts.push(receipt);
        waiters.shift()?.();
      },
      error(diagnostics) {
        errors.push(...diagnostics.map((item) => item.message));
        waiters.shift()?.();
      },
    });
    await firstReady;
    expect(errors).toEqual([]);
    const firstGenerationId = receipts[0].generationId;
    const firstSourceDigest = receipts[0].source.sourceDigest;
    const secondReady = nextReady();
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template><main>second</main></template>');
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template><main>third</main></template>');
    await secondReady;
    await handle.close();
    expect(errors).toEqual([]);
    expect(receipts).toHaveLength(2);
    expect(receipts[1].generationId).not.toBe(firstGenerationId);
    expect(receipts[1].source.sourceDigest).not.toBe(firstSourceDigest);
    expect(receipts[1].outputFiles).toContain('remoteEntry.js');
    expect(await fs.readFile(path.join(pageRoot, 'src/App.vue'), 'utf8')).toContain('third');
  });
});
