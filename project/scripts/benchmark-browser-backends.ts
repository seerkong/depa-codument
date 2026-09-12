#!/usr/bin/env bun
import { performance } from 'node:perf_hooks';
import { createEgoBrowserEffect } from '../packages/cli/src/cli/effects/ego-browser';
import { createOpenCliEffect, OPENCLI_SESSION } from '../packages/cli/src/cli/effects/opencli';
import { invokeCompiledFunction } from '../packages/cli/src/cli/runtime/invoke';

const workspace = process.env.AI_CLI_BENCH_WORKSPACE ?? process.cwd();
const skillsDir = process.env.AI_CLI_BENCH_SKILLS_DIR ?? '.agents/skills';
const fqn = process.env.AI_CLI_BENCH_FQN;
const warmupUrl = process.env.AI_CLI_BENCH_WARMUP_URL;
const rounds = Number(process.env.AI_CLI_BENCH_ROUNDS ?? 3);
const input = JSON.parse(process.env.AI_CLI_BENCH_INPUT ?? '{}') as unknown;

if (!fqn || !warmupUrl) {
  throw new Error('AI_CLI_BENCH_FQN and AI_CLI_BENCH_WARMUP_URL are required');
}
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
  throw new Error('AI_CLI_BENCH_ROUNDS must be an integer from 1 to 20');
}

async function time<T>(callback: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const started = performance.now();
  const value = await callback();
  return { ms: performance.now() - started, value };
}

function summary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    values: values.map((value) => Number(value.toFixed(1))),
    min: Number(sorted[0]!.toFixed(1)),
    median: Number(sorted[Math.floor(sorted.length / 2)]!.toFixed(1)),
    mean: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)),
  };
}

const ego = createEgoBrowserEffect({ taskSpace: `codument-benchmark-${process.pid}` });
const opencli = createOpenCliEffect({ subtransport: 'browser-eval', session: OPENCLI_SESSION });
const warmupRequest = { url: warmupUrl, method: 'GET', headers: {}, timeoutMs: 30_000 };
const egoPreparation = await time(() => ego.browserFetch(warmupRequest));
const opencliPreparation = await time(() => opencli.browserFetch(warmupRequest));
const egoTimes: number[] = [];
const opencliTimes: number[] = [];

for (let round = 0; round < rounds; round++) {
  egoTimes.push((await time(() => invokeCompiledFunction({
    cwd: workspace, skillsDirs: [skillsDir], fqn, input,
    transport: 'ego-browser', provider: ego,
  }))).ms);
  opencliTimes.push((await time(() => invokeCompiledFunction({
    cwd: workspace, skillsDirs: [skillsDir], fqn, input,
    transport: 'opencli', session: OPENCLI_SESSION, provider: opencli,
  }))).ms);
}

console.log(JSON.stringify({
  preparationMs: {
    ego: Number(egoPreparation.ms.toFixed(1)),
    opencli: Number(opencliPreparation.ms.toFixed(1)),
  },
  warmEndToEndMs: {
    ego: summary(egoTimes),
    opencli: summary(opencliTimes),
  },
  rounds,
}, null, 2));
