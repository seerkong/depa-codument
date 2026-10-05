import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { CODUMENT_APP_CATALOGS, type LifecycleSourceCodec, type WorkspaceAppAuthority,
  type WorkspaceAppSourcePort, type WorkspaceAppSourceSnapshot } from 'depa-codument-domain-contract';
import { createWorkspaceEffect } from 'halfcode-lite-skill-app-support/workspace';
import { createFileDomainValidationSourcePort } from './validate';
import { readXnlRegistrySources } from './registry';

/** Product aggregate observation reuses existing domain source ports. It neither
 * maintains another Host catalog nor promotes owned deltas into durable owners. */
export function createFileWorkspaceAppSourcePort(workspaceRoot: string, codec: Pick<LifecycleSourceCodec, 'inspect'>): WorkspaceAppSourcePort {
  const root = path.resolve(workspaceRoot), workspace = createWorkspaceEffect(root);
  const lifecycle = createFileDomainValidationSourcePort(root, { includeArchivedTracks: true });
  const digest = (source: string) => 'sha256:' + createHash('sha256').update(source).digest('hex');
  async function read(file: string): Promise<string> {
    if (await workspace.kind(file) !== 'file') throw new Error('Missing App source: ' + file);
    const bytes = await fs.readFile(path.join(root, file));
    await workspace.kind(file);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  }
  return { async observe() {
    const manifest = await read('codument/manifest.xnl');
    const skillSource = await read('codument/SKILL.md');
    if (!skillSource.trim()) throw new Error('Codument App SKILL.md must not be empty.');
    const authorities: WorkspaceAppAuthority[] = [];
    const findings: WorkspaceAppSourceSnapshot['findings'][number][] = [];
    function add(file: string, source: string, kind: WorkspaceAppAuthority['kind'], ownerFile?: string): void {
      authorities.push({ file, source, kind, digest: digest(source), ...(ownerFile ? { ownerFile } : {}) });
    }
    for (const catalog of CODUMENT_APP_CATALOGS.filter(item => !item.recursive)) {
      const file = `codument/${catalog.root}/${catalog.entry}`;
      add(file, await read(file), catalog.kind);
      if (await workspace.kind(file.replace(/\.xnl$/u, '.xml')) !== undefined) throw new Error('Competing legacy App config: ' + file);
    }
    const processes = await lifecycle.observe();
    for (const unit of processes.units) {
      if (unit.source !== undefined) add(unit.file, unit.source, unit.kind);
      for (const forest of unit.decisionForests) for (const [file, source] of forest) add(file, source, 'decision', unit.file);
    }
    const decisions = new Map([...await readXnlRegistrySources(path.join(root, 'codument/decisions'), { rejectLegacy: true })]
      .map(([file, source]) => ['codument/decisions/' + file, source]));
    for (const [file, source] of decisions) add(file, source, 'decision');
    authorities.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    return { manifestDigest: digest(manifest), skillSource, authorities, lifecycle: processes, decisions, findings };
  } };
}
