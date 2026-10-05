import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DomainValidationFinding, DomainValidationSourcePort, DomainValidationUnit } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';
import { readAttractorProfilesSource } from './config';

/** Observation only. Discovery respects resource boundaries; embedded fixtures,
 * reports and backups below an admitted process directory are not new units. */
export function createFileDomainValidationSourcePort(workspaceRoot: string,
  options: { readonly includeArchivedTracks?: boolean } = {}): DomainValidationSourcePort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  async function entries(directory: string): Promise<string[]> {
    const kind = await workspace.kind(directory);
    if (kind === undefined) return [];
    if (kind !== 'directory') throw new Error(`Expected validation directory: ${directory}`);
    return (await fs.readdir(path.join(root, directory))).filter(name => !name.startsWith('.')).sort();
  }
  async function read(file: string): Promise<string> {
    if (await workspace.kind(file) !== 'file') throw new Error(`Missing validation source: ${file}`);
    if (!(await fs.lstat(path.join(root, file))).isFile()) throw new Error(`Validation source must be a regular file: ${file}`);
    const bytes = await fs.readFile(path.join(root, file));
    await workspace.kind(file);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  }
  return { async observe(target) {
    if (target && (target.includes('\\') || target.startsWith('/') || target.split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('Validation target must be a portable resource identity.');
    if (await workspace.kind('codument') !== 'directory') throw new Error('Codument is not initialized. Run codument init first.');
    const units: DomainValidationUnit[] = [], findings: DomainValidationFinding[] = [];
    const selected = (id: string) => !target || target === 'all' || target === id;
    function issue(output: DomainValidationFinding[], file: string, error: unknown, rule = 'source.read'): void {
      output.push({ file, severity: 'error', rule, message: String(error) });
    }
    async function forest(directory: string, output: DomainValidationFinding[], rejectLegacy = false): Promise<Map<string, string>> {
      const sources = new Map<string, string>();
      async function visit(directory: string): Promise<void> {
        try {
          for (const name of await entries(directory)) {
            const file = directory + '/' + name;
            try {
              const kind = await workspace.kind(file);
              if (kind === 'directory') await visit(file);
              else if (kind === 'file' && /\.xnl$/i.test(name)) sources.set(file, await read(file));
              else if (kind === 'file' && rejectLegacy && /\.xml$/i.test(name)) issue(output, file, 'Legacy source requires migration or review.', 'resource.migration');
            } catch (error) { issue(output, file, error); }
          }
        } catch (error) { issue(output, directory, error); }
      }
      await visit(directory);
      return sources;
    }
    async function processUnit(kind: 'Track' | 'Mission', directory: string, id: string): Promise<void> {
      const archiveSelected = kind === 'Track' && target?.startsWith('archived/') && directory === 'codument/tracks/' + target;
      if (!selected(id) && !archiveSelected) return;
      const output: DomainValidationFinding[] = [], missingFiles: string[] = [];
      const file = directory + '/' + kind.toLowerCase() + '.xnl';
      let source: string | undefined;
      try {
        if (await workspace.kind(file) !== undefined) source = await read(file);
        if (await workspace.kind(directory + '/' + kind.toLowerCase() + '.xml') !== undefined) issue(output, file, 'Legacy or competing resource authority requires migration.', kind.toLowerCase() + '.kind');
      } catch (error) { issue(output, file, error); }
      for (const required of ['proposal.md', 'design.md']) {
        const file = directory + '/' + required;
        try { if (await workspace.kind(file) !== 'file') missingFiles.push(file); }
        catch (error) { issue(output, file, error); }
      }
      const canonical = new Map<string, string>();
      const direct = directory + '/decisions.xnl';
      try { if (await workspace.kind(direct) !== undefined) canonical.set(direct, await read(direct)); }
      catch (error) { issue(output, direct, error); }
      for (const [file, source] of await forest(directory + '/decisions', output, true)) canonical.set(file, source);
      const decisionForests: ReadonlyMap<string, string>[] = canonical.size ? [canonical] : [];
      const working = directory + '/analysis/decision-tree.xnl';
      try { if (await workspace.kind(working) !== undefined) decisionForests.push(new Map([[working, await read(working)]])); }
      catch (error) { issue(output, working, error); }
      units.push({ kind, id, file, directory, source, missingFiles, decisionForests, findings: output });
    }
    async function processes(kind: 'Track' | 'Mission', directory: string): Promise<void> {
      try {
        for (const name of await entries(directory)) {
          const current = directory + '/' + name;
          try {
            if (await workspace.kind(current) !== 'directory') continue;
            const stem = current + '/' + kind.toLowerCase();
            if (await workspace.kind(stem + '.xnl') !== undefined || await workspace.kind(stem + '.xml') !== undefined) await processUnit(kind, current, name);
            else await processes(kind, current);
          } catch (error) { issue(findings, current, error); }
        }
      } catch (error) { issue(findings, directory, error); }
    }
    for (const stage of ['pending', 'active']) await processes('Track', 'codument/tracks/' + stage);
    if (options.includeArchivedTracks || target?.startsWith('archived/')) await processes('Track', 'codument/tracks/archived');
    if (target?.startsWith('archived/') && !units.some(unit => unit.kind === 'Track' && unit.directory === 'codument/tracks/' + target)) {
      issue(findings, 'codument/tracks/' + target, 'Requested archived Track was not found.', 'track.missing');
    }
    for (const stage of ['pending', 'active', 'archived']) await processes('Mission', 'codument/missions/' + stage);
    let profiles: string | undefined;
    if (units.length) {
      try { profiles = await readAttractorProfilesSource(root); }
      catch (error) { issue(findings, 'codument/config/attractor-profiles.xnl', error, 'attractor.config'); }
    }
    return { units, findings, profiles };
  } };
}
