#!/usr/bin/env bun
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildVuePage, watchVuePage } from '../packages/page-builder-vue/src/index';
// @ts-expect-error The browser runner is intentionally shipped as a native JavaScript template.
import { loadVueMfPage } from '../packages/cli/src/templates/web/vue-mf-runner.js';

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

async function fixture(root: string): Promise<string> {
  const pageRoot = path.join(root, 'page');
  await fs.mkdir(path.join(pageRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(pageRoot, 'src/App.vue'), '<template><main>benchmark 0</main></template>');
  return pageRoot;
}

async function oneBuild(pageRoot: string, outputDirectory: string): Promise<number> {
  const started = performance.now();
  await buildVuePage({ pageName: 'benchmark', pageRoot, entry: 'src/App.vue', expose: './app', outputDirectory });
  return performance.now() - started;
}

if (process.argv[2] === '--child') {
  const durationMs = await oneBuild(process.argv[3]!, process.argv[4]!);
  console.log(JSON.stringify({ durationMs }));
  process.exit(0);
}

async function processCold(pageRoot: string, outputDirectory: string): Promise<number> {
  const started = performance.now();
  const child = Bun.spawn([process.execPath, import.meta.path, '--child', pageRoot, outputDirectory], {
    stdout: 'pipe', stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exitCode !== 0) throw new Error(stderr || `Cold builder process exited with ${exitCode}`);
  return performance.now() - started;
}

async function rebuildSamples(pageRoot: string, outputDirectory: string, count = 20): Promise<number[]> {
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const handle = await watchVuePage({
    pageName: 'benchmark', pageRoot, entry: 'src/App.vue', expose: './app', outputDirectory,
  }, {
    building() {},
    ready() { resolveReady(); },
    error(diagnostics) { rejectReady(new Error(diagnostics[0]?.message ?? 'Benchmark rebuild failed')); },
  });
  try {
    await ready;
    const samples: number[] = [];
    for (let index = 1; index <= count; index += 1) {
      ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      const started = performance.now();
      await fs.writeFile(path.join(pageRoot, 'src/App.vue'), `<template><main>benchmark ${index}</main></template>`);
      await ready;
      samples.push(performance.now() - started);
    }
    return samples;
  } finally {
    await handle.close();
  }
}

async function frameReadySamples(count = 20): Promise<number[]> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const started = performance.now();
    const loaded = await loadVueMfPage({
      pageName: 'benchmark', expose: './app', generation: `g-${index}`,
      remoteEntryUrl: 'http://127.0.0.1/page-builds/benchmark/g/remoteEntry.js',
      mfManifestUrl: 'http://127.0.0.1/page-builds/benchmark/g/mf-manifest.json',
      origin: 'http://127.0.0.1', root: {},
      document: {
        head: { append() {} },
        createElement() { return { dataset: {}, remove() {} }; },
      },
      pageSdk: { connectPage() { return { close() {} }; } },
      vue: { createApp() { return { provide() { return this; }, mount() {}, unmount() {} }; } },
      fetch: async () => ({ ok: true, json: async () => ({ exposes: [] }) }),
      importModule: async () => ({ init() {}, get: async () => async () => ({ default: {} }) }),
    });
    samples.push(performance.now() - started);
    loaded.dispose();
  }
  return samples;
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-vue-page-benchmark-'));
try {
  const pageRoot = await fixture(root);
  const processColdMs = await processCold(pageRoot, path.join(root, 'process-cold'));
  const viteColdMs = await oneBuild(pageRoot, path.join(root, 'vite-cold'));
  const warmMs = await oneBuild(pageRoot, path.join(root, 'warm'));
  const rebuild = await rebuildSamples(pageRoot, path.join(root, 'watch'));
  const frameReady = await frameReadySamples();
  const report = {
    version: 1,
    samples: { rebuild: rebuild.length, frameReady: frameReady.length },
    processColdMs,
    viteColdMs,
    warmMs,
    rebuildP50Ms: percentile(rebuild, 0.5),
    rebuildP95Ms: percentile(rebuild, 0.95),
    frameReadyP50Ms: percentile(frameReady, 0.5),
    frameReadyP95Ms: percentile(frameReady, 0.95),
    thresholds: { processColdMs: 3000, rebuildP95Ms: 500 },
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.processColdMs > report.thresholds.processColdMs) throw new Error('Vue Page process cold build exceeded 3 seconds');
  if (report.rebuildP95Ms > report.thresholds.rebuildP95Ms) throw new Error('Vue Page rebuild P95 exceeded 500ms');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
