import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  normalizeBuildDiagnostic,
  createFilePageGenerationStore,
  PageBuildCoordinator,
  PACKAGE_BUILD_RECEIPT_ASSET,
  type PageGenerationStoreEffect,
  type VuePageBuildObserver,
  type VuePageBuildRequest,
} from '../../src/cli/runtime/page-build';

async function buildOutput(store: PageGenerationStoreEffect, pageName = 'dashboard'): Promise<string> {
  const work = await store.workDirectory(pageName);
  const output = path.join(work, 'snapshots', crypto.randomUUID());
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'remoteEntry.js'), 'export const ready = true;');
  await fs.writeFile(path.join(output, 'mf-manifest.json'), JSON.stringify({ name: pageName }));
  return output;
}

async function buildSnapshot(request: VuePageBuildRequest, content: string): Promise<string> {
  const snapshot = path.join(path.dirname(request.outputDirectory), 'snapshots', crypto.randomUUID());
  await fs.mkdir(snapshot, { recursive: true });
  await fs.writeFile(path.join(snapshot, 'remoteEntry.js'), content);
  await fs.writeFile(path.join(snapshot, 'mf-manifest.json'), '{}');
  return snapshot;
}

describe('Page generation store', () => {
  test('publishes only complete immutable generations and retains last success after failure', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-generation-store-'));
    const store = createFilePageGenerationStore(root);
    const output = await buildOutput(store);
    const first = await store.publish({
      pageName: 'dashboard',
      generation: 'generation-1',
      sourceDirectory: output,
      remoteEntry: 'remoteEntry.js',
      mfManifest: 'mf-manifest.json',
    });
    expect(first).toMatchObject({ status: 'ready', generation: 'generation-1' });
    expect(first.remoteEntryUrl).toBe('/page-builds/dashboard/generation-1/remoteEntry.js');

    await expect(store.publish({
      pageName: 'dashboard',
      generation: 'generation-1',
      sourceDirectory: output,
      remoteEntry: 'remoteEntry.js',
      mfManifest: 'mf-manifest.json',
    })).rejects.toThrow('already exists');

    await fs.rm(path.join(output, 'mf-manifest.json'));
    await expect(store.publish({
      pageName: 'dashboard',
      generation: 'generation-2',
      sourceDirectory: output,
      remoteEntry: 'remoteEntry.js',
      mfManifest: 'mf-manifest.json',
    })).rejects.toThrow('incomplete');
    store.error('dashboard', [{ message: 'Vue template is invalid', file: 'src/App.vue', line: 2, column: 4 }]);
    expect(store.get('dashboard')).toMatchObject({
      status: 'error',
      generation: 'generation-1',
      remoteEntryUrl: '/page-builds/dashboard/generation-1/remoteEntry.js',
      diagnostics: [{ file: 'src/App.vue', line: 2, column: 4 }],
    });
  });

  test('rejects output roots and symlinks outside the managed generation boundary', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-generation-boundary-'));
    const store = createFilePageGenerationStore(root);
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'remoteEntry.js'), 'outside');
    await fs.writeFile(path.join(outside, 'mf-manifest.json'), '{}');
    await expect(store.publish({
      pageName: 'dashboard', generation: 'generation-1', sourceDirectory: outside,
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json',
    })).rejects.toThrow('escapes managed snapshot root');

    const output = await buildOutput(store);
    await fs.symlink('remoteEntry.js', path.join(output, 'linked.js'));
    await expect(store.publish({
      pageName: 'dashboard', generation: 'generation-1', sourceDirectory: output,
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json',
    })).rejects.toThrow('symlink is not supported');
  });

  test('rejects a symlinked snapshot ancestor without publishing or deleting outside files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-generation-ancestor-symlink-'));
    const store = createFilePageGenerationStore(root);
    const work = await store.workDirectory('dashboard');
    const outside = path.join(root, 'outside');
    const outsideSnapshot = path.join(outside, 'snapshot');
    await fs.mkdir(outsideSnapshot, { recursive: true });
    await fs.writeFile(path.join(outsideSnapshot, 'remoteEntry.js'), 'outside');
    await fs.writeFile(path.join(outsideSnapshot, 'mf-manifest.json'), '{}');
    await fs.symlink(outside, path.join(work, 'snapshots'));
    const lexicalSnapshot = path.join(work, 'snapshots', 'snapshot');
    await expect(store.publish({
      pageName: 'dashboard', generation: 'generation-1', sourceDirectory: lexicalSnapshot,
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json',
    })).rejects.toThrow('contains a symlink');
    expect(store.get('dashboard')).toBeUndefined();
    await expect(store.discardSnapshot('dashboard', lexicalSnapshot)).rejects.toThrow('contains a symlink');
    expect(await fs.readFile(path.join(outsideSnapshot, 'remoteEntry.js'), 'utf8')).toBe('outside');
  });

  test('rejects an intermediate asset symlink introduced after generation publication', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-generation-asset-symlink-'));
    const store = createFilePageGenerationStore(root);
    const output = await buildOutput(store);
    await fs.mkdir(path.join(output, 'assets'));
    await fs.writeFile(path.join(output, 'assets/app.js'), 'owned');
    await store.publish({
      pageName: 'dashboard', generation: 'generation-1', sourceDirectory: output,
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json',
    });
    const generationRoot = path.join(
      root, '.codument/cache/page-builds/generations/dashboard/generation-1',
    );
    await fs.rm(path.join(generationRoot, 'assets'), { recursive: true });
    const outside = path.join(root, 'outside-assets');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'secret.js'), 'OUTSIDE_SECRET');
    await fs.symlink(outside, path.join(generationRoot, 'assets'));
    await expect(store.asset('dashboard', 'generation-1', 'assets/secret.js'))
      .rejects.toThrow('path contains a symlink');
  });
});

describe('Package watcher provenance', () => {
  test('refreshes Page source identity for every successful watcher generation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-current-provenance-'));
    const pageRoot = path.join(root, '.agents/skills/demo/PageBundle/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>one</template>');
    let observer: VuePageBuildObserver | undefined;
    let request: VuePageBuildRequest | undefined;
    let current = {
      packageName: '@test/dashboard', generationId: 'sha256:generation-one',
      pages: [{ fqn: 'Test.Page.Dashboard', route: '/' }],
      source: { descriptor: 'src/halfcode.page.ts', sourceDigest: 'sha256:source-one', lockDigest: 'sha256:lock' },
      toolchain: { contractVersion: '0.1.1' },
    };
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      builder: {
        async watch(nextRequest, nextObserver) {
          request = nextRequest;
          observer = nextObserver;
          return { async close() {} };
        },
      },
    });
    await coordinator.open({
      pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app',
      packageBuild: current,
      refreshPackageBuild: async () => current,
    });
    const ready = async (content: string) => {
      const snapshotDirectory = await buildSnapshot(request!, content);
      await observer!.ready({
        remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 1,
        snapshotDirectory, protocolVersion: '2', packageName: '@test/dashboard', generationId: 'stale',
        entry: 'remoteEntry.js', pages: [], assets: [], assetsDigest: `sha256:${content}`,
        source: { descriptor: 'stale', sourceDigest: 'stale', lockDigest: 'stale' },
        toolchain: { contractVersion: 'stale', builderVersion: '0.1.1', federationVersion: '1.20.1' },
      });
      return coordinator.get('dashboard')!.generation!;
    };
    const firstGeneration = await ready('one');
    const firstReceipt = JSON.parse(new TextDecoder().decode(
      await coordinator.asset('dashboard', firstGeneration, PACKAGE_BUILD_RECEIPT_ASSET),
    ));
    current = {
      ...current,
      generationId: 'sha256:generation-two',
      source: { ...current.source, sourceDigest: 'sha256:source-two' },
    };
    const secondGeneration = await ready('two');
    const secondReceipt = JSON.parse(new TextDecoder().decode(
      await coordinator.asset('dashboard', secondGeneration, PACKAGE_BUILD_RECEIPT_ASSET),
    ));
    expect(secondGeneration).not.toBe(firstGeneration);
    expect(firstReceipt).toMatchObject({ generationId: 'sha256:generation-one', source: { sourceDigest: 'sha256:source-one' } });
    expect(secondReceipt).toMatchObject({
      generationId: 'sha256:generation-two',
      source: { sourceDigest: 'sha256:source-two', lockDigest: 'sha256:lock' },
      toolchain: { contractVersion: '0.1.1', builderVersion: '0.1.1', federationVersion: '1.20.1' },
    });
    await coordinator.shutdown();
  });

  test('does not reuse an immutable generation name after the Host restarts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-restart-generation-'));
    const pageRoot = path.join(root, '.agents/skills/demo/PageBundle/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>stable</template>');
    const packageBuild = {
      packageName: '@test/dashboard', generationId: 'sha256:stable-generation',
      pages: [{ fqn: 'Test.Page.Dashboard', route: '/' }],
      source: { descriptor: 'src/halfcode.page.ts', sourceDigest: 'sha256:stable-source', lockDigest: 'sha256:lock' },
      toolchain: { contractVersion: '0.1.1' },
    };
    const buildOnce = async () => {
      let observer: VuePageBuildObserver | undefined;
      let request: VuePageBuildRequest | undefined;
      const coordinator = new PageBuildCoordinator({
        generationStore: createFilePageGenerationStore(root),
        builder: {
          async watch(nextRequest, nextObserver) {
            request = nextRequest;
            observer = nextObserver;
            return { async close() {} };
          },
        },
      });
      await coordinator.open({
        pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app', packageBuild,
      });
      const snapshotDirectory = await buildSnapshot(request!, 'stable');
      await observer!.ready({
        remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 1,
        snapshotDirectory, assetsDigest: 'sha256:stable-assets',
      });
      const generation = coordinator.get('dashboard')!.generation!;
      await coordinator.shutdown();
      return generation;
    };
    const first = await buildOnce();
    const afterRestart = await buildOnce();
    expect(afterRestart).not.toBe(first);
    expect(first).toMatch(/^g-[a-f0-9]{16}-[a-f0-9]{12}-1$/);
    expect(afterRestart).toMatch(/^g-[a-f0-9]{16}-[a-f0-9]{12}-1$/);
  });
});

describe('Page builder diagnostics protocol', () => {
  test('normalizes Page-root files and validates status diagnostic positions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-diagnostic-'));
    const pageRoot = path.join(root, 'page');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    expect(normalizeBuildDiagnostic(pageRoot, {
      code: 'VUE_PARSE_ERROR',
      message: 'Unexpected closing tag',
      file: path.join(pageRoot, 'src/App.vue'),
      line: 4,
      column: 9,
    })).toEqual({
      code: 'VUE_PARSE_ERROR',
      message: 'Unexpected closing tag',
      file: 'src/App.vue',
      line: 4,
      column: 9,
    });
    expect(() => normalizeBuildDiagnostic(pageRoot, {
      message: 'escaped', file: path.join(root, 'secret.ts'), line: 1, column: 1,
    })).toThrow('escapes Page root');
    expect(() => normalizeBuildDiagnostic(pageRoot, { message: 'bad position', line: 0 })).toThrow('positive integer');
    expect(() => normalizeBuildDiagnostic(pageRoot, { message: 'unknown', stack: 'private path' })).toThrow('unknown field stack');
  });
});

describe('Page build coordinator', () => {
  test('shares one watcher and generation across route Pages from the same PageBundle', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-shared-bundle-'));
    const pageRoot = path.join(root, '.agents/skills/demo/page-bundles/flow');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>flow</template>');
    let watches = 0;
    let closes = 0;
    let observer: VuePageBuildObserver | undefined;
    let request: VuePageBuildRequest | undefined;
    const events: string[] = [];
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      idleTtlMs: 0,
      builder: {
        async watch(next, nextObserver) {
          watches += 1;
          request = next;
          observer = nextObserver;
          return { async close() { closes += 1; } };
        },
      },
    });
    coordinator.subscribe((event) => events.push(`${event.type}:${event.pageName}`));
    const common = {
      buildIdentity: 'Test.Demo.PageBundle.Flow',
      pageRoot,
      entry: 'src/App.vue',
      expose: './app',
    };
    await coordinator.open({ ...common, pageName: 'flow-home', sourceRoute: '/' });
    await coordinator.open({ ...common, pageName: 'flow-lesson', sourceRoute: '/lesson/:id' });
    expect(watches).toBe(1);
    expect(request?.pageName).toMatch(/^bundle-[a-f0-9]{20}$/);
    expect(request?.pageName).not.toBe(common.buildIdentity);
    const snapshot = await buildSnapshot(request!, 'shared');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 1,
      snapshotDirectory: snapshot,
    });
    expect(coordinator.get('Test.Demo.PageBundle.Flow')).toMatchObject({ status: 'ready' });
    expect(events).toEqual(expect.arrayContaining([
      'page.build-ready:flow-home',
      'page.build-ready:flow-lesson',
    ]));
    await coordinator.close('flow-home');
    expect(closes).toBe(0);
    await coordinator.close('flow-lesson');
    expect(closes).toBe(1);
  });

  test('starts lazily, publishes immutable generations, and keeps last success on watcher errors', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-coordinator-'));
    const pageRoot = path.join(root, '.agents/skills/demo/pages/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>dashboard</template>');
    let observer: VuePageBuildObserver | undefined;
    let request: VuePageBuildRequest | undefined;
    let watches = 0;
    let closes = 0;
    const invalidated: string[] = [];
    const events: string[] = [];
    let now = 100;
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      now: () => now,
      idleTtlMs: 0,
      invalidateCatalog: (name) => invalidated.push(name),
      builder: {
        async watch(nextRequest, nextObserver) {
          watches += 1;
          request = nextRequest;
          observer = nextObserver;
          return { async close() { closes += 1; } };
        },
      },
    });
    coordinator.subscribe((event) => events.push(event.type));
    expect(coordinator.get('dashboard')).toBeUndefined();
    expect(await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' }))
      .toMatchObject({ status: 'building', generation: null });
    expect(watches).toBe(1);
    expect(await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' }))
      .toMatchObject({ status: 'building' });
    expect(watches).toBe(1);

    expect(request?.outputDirectory).toBeString();
    const firstSnapshot = await buildSnapshot(request!, 'export const ready = true;');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 25,
      snapshotDirectory: firstSnapshot,
    });
    expect(coordinator.get('dashboard')).toMatchObject({ status: 'ready', generation: 'g-2s-1' });

    observer?.error([{ message: 'Template failed', file: 'src/App.vue', line: 1, column: 2 }]);
    expect(coordinator.get('dashboard')).toMatchObject({
      status: 'error', generation: 'g-2s-1', diagnostics: [{ file: 'src/App.vue' }],
    });
    now = 101;
    const secondSnapshot = await buildSnapshot(request!, 'export const ready = "second";');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 20,
      snapshotDirectory: secondSnapshot,
    });
    expect(coordinator.get('dashboard')).toMatchObject({ status: 'ready', generation: 'g-2t-2' });
    expect(events).toEqual(expect.arrayContaining(['page.building', 'page.build-ready', 'page.build-error']));
    expect(invalidated.length).toBeGreaterThanOrEqual(4);

    await coordinator.close('dashboard');
    expect(closes).toBe(0);
    await coordinator.close('dashboard');
    expect(closes).toBe(1);
  });

  test('retires idle watchers, prunes generations, and never deletes Skill App source', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-lifecycle-'));
    const pageRoot = path.join(root, '.agents/skills/demo/pages/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    const source = path.join(pageRoot, 'src/App.vue');
    await fs.writeFile(source, '<template>authority</template>');
    let observer: VuePageBuildObserver | undefined;
    let request: VuePageBuildRequest | undefined;
    let closes = 0;
    let now = 200;
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      now: () => now,
      idleTtlMs: 10,
      generationRetention: 1,
      builder: {
        async watch(nextRequest, nextObserver) {
          request = nextRequest;
          observer = nextObserver;
          return { async close() { closes += 1; } };
        },
      },
    });
    await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' });
    const firstSnapshot = await buildSnapshot(request!, 'first');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 5,
      snapshotDirectory: firstSnapshot,
    });
    now = 201;
    const secondSnapshot = await buildSnapshot(request!, 'second');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 4,
      snapshotDirectory: secondSnapshot,
    });

    const generationRoot = path.join(root, '.codument/cache/page-builds/generations/dashboard');
    expect((await fs.readdir(generationRoot)).filter((name) => !name.startsWith('.tmp-'))).toHaveLength(1);
    await coordinator.close('dashboard');
    await Bun.sleep(25);
    expect(closes).toBe(1);
    expect(await fs.lstat(path.join(root, '.codument/cache/page-builds/work/dashboard')).catch(() => undefined))
      .toBeUndefined();
    expect(await fs.readFile(source, 'utf8')).toContain('authority');
  });

  test('publishes the receipt snapshot even when the mutable watcher output has advanced', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-snapshot-race-'));
    const pageRoot = path.join(root, '.agents/skills/demo/pages/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>dashboard</template>');
    let observer: VuePageBuildObserver | undefined;
    let request: VuePageBuildRequest | undefined;
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      idleTtlMs: 0,
      builder: {
        async watch(nextRequest, nextObserver) {
          request = nextRequest;
          observer = nextObserver;
          return { async close() {} };
        },
      },
    });
    await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' });
    const receiptSnapshot = await buildSnapshot(request!, 'BUILD_ONE');
    await fs.mkdir(request!.outputDirectory, { recursive: true });
    await fs.writeFile(path.join(request!.outputDirectory, 'remoteEntry.js'), 'BUILD_TWO');
    await fs.writeFile(path.join(request!.outputDirectory, 'mf-manifest.json'), '{}');
    await observer?.ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 1,
      snapshotDirectory: receiptSnapshot,
    });
    const generation = coordinator.get('dashboard')?.generation;
    expect(generation).toBeString();
    expect(new TextDecoder().decode(await coordinator.asset('dashboard', generation!, 'remoteEntry.js'))).toBe('BUILD_ONE');
    expect(await fs.lstat(receiptSnapshot).catch(() => undefined)).toBeUndefined();
    await coordinator.shutdown();
  });

  test('retires an unexpectedly unavailable worker and restarts on the next open', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-unavailable-'));
    const pageRoot = path.join(root, '.agents/skills/demo/pages/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>dashboard</template>');
    const observers: VuePageBuildObserver[] = [];
    const requests: VuePageBuildRequest[] = [];
    let watches = 0;
    let closes = 0;
    const events: string[] = [];
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      builder: {
        async watch(request, observer) {
          watches += 1;
          requests.push(request);
          observers.push(observer);
          return { async close() { closes += 1; } };
        },
      },
    });
    coordinator.subscribe((event) => events.push(event.type));
    await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' });
    const successfulSnapshot = await buildSnapshot(requests[0], 'last-success');
    await observers[0].ready({
      remoteEntry: 'remoteEntry.js', mfManifest: 'mf-manifest.json', outputFiles: [], durationMs: 1,
      snapshotDirectory: successfulSnapshot,
    });
    const lastGeneration = coordinator.get('dashboard')?.generation;
    await observers[0].unavailable('worker exited with code 9');
    expect(coordinator.get('dashboard')).toMatchObject({
      status: 'unavailable', generation: lastGeneration, diagnostics: [{ code: 'BUILDER_UNAVAILABLE' }],
    });
    expect(new TextDecoder().decode(await coordinator.asset('dashboard', lastGeneration!, 'remoteEntry.js')))
      .toBe('last-success');
    expect(events).toContain('page.unavailable');
    await coordinator.open({ pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' });
    expect(watches).toBe(2);
    expect(closes).toBe(1);
    await coordinator.shutdown();
    expect(closes).toBe(2);
  });

  test('settles a startup failure as unavailable and retries on the next open', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'page-build-startup-failure-'));
    const pageRoot = path.join(root, '.agents/skills/demo/pages/dashboard');
    await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template>dashboard</template>');
    let watches = 0;
    const events: string[] = [];
    const coordinator = new PageBuildCoordinator({
      generationStore: createFilePageGenerationStore(root),
      builder: {
        async watch() {
          watches += 1;
          if (watches === 1) throw new Error('event stream ended before started');
          return { async close() {} };
        },
      },
    });
    coordinator.subscribe((event) => events.push(event.type));
    const demand = { pageName: 'dashboard', pageRoot, entry: 'src/App.vue', expose: './app' };
    await expect(coordinator.open(demand)).rejects.toThrow('event stream ended before started');
    expect(coordinator.get('dashboard')).toMatchObject({ status: 'unavailable' });
    expect(events).toContain('page.unavailable');
    await expect(coordinator.open(demand)).resolves.toMatchObject({ status: 'building' });
    expect(watches).toBe(2);
    await coordinator.shutdown();
  });
});
