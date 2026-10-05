import * as path from 'node:path';
import type { DecisionSourcePort, DecisionSourceSnapshot } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';
import { readXnlRegistrySources } from './registry';

/** Explicit CLI target reads only. No cwd mutation, parser, or registry writes. */
export function createFileDecisionSourcePort(workspaceRoot: string): DecisionSourcePort {
  const root = path.resolve(workspaceRoot);
  const workspace = createWorkspaceEffect(root);
  function access(file: string) {
    const relative = path.relative(root, file);
    if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) return { port: workspace, relative };
    return { port: createWorkspaceEffect(path.dirname(file)), relative: path.basename(file) };
  }
  async function kind(file: string) {
    const selected = access(file);
    return selected.port.kind(selected.relative);
  }
  async function fileSource(file: string, label = file): Promise<ReadonlyMap<string, string>> {
    const selected = access(file);
    const content = await selected.port.readText(selected.relative);
    if (content === undefined) throw new Error(`Decision source disappeared: ${file}`);
    return new Map([[label, content]]);
  }
  function unavailable(display: string, message: string): DecisionSourceSnapshot {
    return { display, sources: new Map(), findings: [{ file: display, decision: '(file)', severity: 'error', message }] };
  }
  async function processDirectory(directory: string): Promise<DecisionSourceSnapshot> {
    const file = path.join(directory, 'decisions.xnl');
    const nested = path.join(directory, 'decisions');
    const sources = new Map<string, string>();
    if (await kind(file) !== undefined) for (const [key, value] of await fileSource(file, 'decisions.xnl')) sources.set(key, value);
    if (await kind(nested) !== undefined) {
      for (const [key, value] of await readXnlRegistrySources(nested)) sources.set('decisions/' + key, value);
    }
    if (!sources.size) {
      const legacy = path.join(directory, 'decisions.md');
      return unavailable(legacy, await kind(legacy) === undefined ? 'decisions file not found' : 'Legacy decisions require migration or review before normal admission.');
    }
    return { display: sources.size === 1 && sources.has('decisions.xnl') ? file : directory, sources, findings: [] };
  }
  async function directorySource(directory: string): Promise<DecisionSourceSnapshot> {
    if (path.resolve(directory) !== path.join(root, 'codument/decisions')) {
      for (const marker of ['track.xnl', 'track.xml', 'mission.xnl', 'mission.xml', 'decisions.xnl', 'decisions']) {
        if (await kind(path.join(directory, marker)) !== undefined) return processDirectory(directory);
      }
    }
    return { display: directory, sources: await readXnlRegistrySources(directory), findings: [] };
  }
  return { async read(target) {
    if (!target) return processDirectory(root);
    const absolute = path.resolve(root, target);
    const selected = await kind(absolute);
    if (selected === 'directory') return directorySource(absolute);
    if (target.endsWith('.xnl')) {
      if (selected === undefined) return unavailable(target, 'decisions file not found');
      return { display: target, sources: await fileSource(absolute, target), findings: [] };
    }
    if (target.endsWith('.md') || target.includes('/') || target.includes('\\')) {
      return unavailable(target, selected === undefined ? 'decisions file not found' : 'Legacy decisions require migration or review before normal admission.');
    }
    const matches: string[] = [];
    for (const parent of ['codument/tracks/active', 'codument/tracks/pending', 'codument/missions/active', 'codument/missions/pending']) {
      const relative = parent + '/' + target;
      if (await workspace.kind(relative) === 'directory') matches.push(path.join(root, relative));
    }
    if (matches.length > 1) throw new Error(`Ambiguous process ID: ${target}; specify an explicit directory.`);
    if (matches.length === 1) return processDirectory(matches[0]);
    return unavailable(path.join(root, 'codument/tracks/active', target, 'decisions.md'), 'decisions file not found');
  } };
}
