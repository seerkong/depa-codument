import { CODUMENT_RESOURCE_KINDS, type WorkspaceMigrationSnapshot, type WorkspaceMigrationPlan, type WorkspaceMigrationRuntime, type WorkspaceMigrationResult,
  type WorkspaceMigrationDefinition, type WorkspaceMigrationChange } from 'depa-codument-domain-contract';
import { parseXnl } from 'xnl-core';
import { isDataElement } from './registry';
import { digestCanonical } from 'halfcode-cli-lite-skill-app-contract/resource';
import { planResourceMigration } from './migration';

function migrationStatus(diagnostics: readonly string[], hasChanges: boolean): WorkspaceMigrationPlan['status'] {
  if (diagnostics.length) return 'review-required';
  return hasChanges ? 'planned' : 'noop';
}

export function workspaceMigrationFingerprint(snapshot: WorkspaceMigrationSnapshot): string {
  return digestCanonical(snapshot.files.map(({path, fingerprint, mode}) => ({path, fingerprint, mode})).sort((a, b) => a.path.localeCompare(b.path)));
}

export function selectTrackMigrationSource(snapshot: WorkspaceMigrationSnapshot, identifier: string): string {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/u.test(identifier) || identifier === '..') throw new Error('Track upgrade requires an unambiguous track-id or archive-id.');
  const candidates = snapshot.files.filter(file => {
    const match = file.path.match(/^codument\/tracks\/(active|archived)\/(.+)\/(?:plan\.xml|track\.(?:xml|xnl))$/u);
    if (!match) return false;
    const name = match[2].split('/').at(-1)!;
    return match[1] === 'active' ? match[2] === identifier : name === identifier || name.endsWith('-' + identifier);
  });
  const active = candidates.filter(file => file.path.startsWith('codument/tracks/active/'));
  const selected = active.length ? active : candidates;
  if (selected.length !== 1) throw new Error(selected.length ? 'Ambiguous Track upgrade authority; retain all candidates for review.' : 'Track not found: ' + identifier);
  return selected[0].path;
}

/** Deterministic multi-resource proposal. Membership/template upgrades compose
 * onto this data; no filesystem or validation bypass is hidden in the planner. */
export function planWorkspaceResourceMigration(snapshot: WorkspaceMigrationSnapshot, paths: readonly string[]): WorkspaceMigrationPlan {
  const files = new Map(snapshot.files.map(file => [file.path, file]));
  const resources = [...new Set(paths)].sort().map(path => {
    const file = files.get(path);
    if (!file || file.source === undefined) throw new Error('Migration resource missing or not UTF-8: ' + path);
    return planResourceMigration({path, source: file.source});
  });
  const changes = new Map<string, string | null>(), diagnostics: string[] = [];
  for (const resource of resources) {
    diagnostics.push(...resource.diagnostics.map(message => `${resource.path}: ${message}`));
    if (resource.status === 'review-required' || !resource.proposal) continue;
    const target = resource.targetPath ?? resource.path;
    if (target !== resource.path) {
      const existing = files.get(target);
      if (existing && existing.source !== resource.proposal.source) {
        diagnostics.push(`Migration target conflicts with an existing authority: ${target}`); continue;
      }
      if (changes.has(target)) { diagnostics.push(`Multiple migration sources target ${target}`); continue; }
      changes.set(resource.path, null);
    }
    changes.set(target, resource.proposal.source);
  }
  const result = {status: migrationStatus(diagnostics, changes.size > 0),
    sourceFingerprint: workspaceMigrationFingerprint(snapshot), changes: [...changes].map(([path, source]) => {
      const from = resources.find(resource => resource.targetPath === path)?.path ?? path;
      return {path, source, mode: files.get(from)?.mode};
    }), resources, diagnostics};
  return {...result, planDigest: digestCanonical(result)};
}

/** Whole App content policy. User attractors/configuration/history are not
 * template-owned. Unknown old managed material is preserved for Agent review. */
export function planCodumentWorkspaceMigration(snapshot: WorkspaceMigrationSnapshot, definition: WorkspaceMigrationDefinition): WorkspaceMigrationPlan {
  const relocations: {from: string; to: string}[] = [];
  if (snapshot.files.some(file => file.path.startsWith('codument/archive/'))) relocations.push({from: 'codument/archive', to: 'codument/tracks/archived'});
  for (const file of snapshot.files) {
    const match = file.path.match(/^codument\/tracks\/([^/]+)\/(?:track\.(?:xml|xnl)|plan\.xml)$/u);
    if (match && !['pending', 'active', 'archived'].includes(match[1]) && !relocations.some(move => move.from === 'codument/tracks/' + match[1])) {
      relocations.push({from: 'codument/tracks/' + match[1], to: 'codument/tracks/active/' + match[1]});
    }
  }
  const diagnostics: string[] = [];
  const mapped = snapshot.files.map(file => {
    const move = relocations.find(move => file.path.startsWith(move.from + '/'));
    return move ? {...file, path: move.to + file.path.slice(move.from.length)} : file;
  });
  const files = new Map(mapped.map(file => [file.path, file]));
  if (files.size !== mapped.length) diagnostics.push('Legacy lifecycle relocation collides with an existing destination; preserve both for review.');
  const input = {...snapshot, files: mapped};
  const manifest = files.get('codument/manifest.xnl');
  let currentApp = false;
  if (manifest?.source !== undefined) {
    try {
      const parsed = parseXnl(manifest.source, {textBlockStyle: true});
      const root = parsed.nodes[0];
      currentApp = !parsed.warnings?.length && parsed.nodes.length === 1 && isDataElement(root)
        && root.tag === 'SkillApp' && root.metadata.envelopeVersion === 'halfcode.resource-envelope/v1' && root.metadata.specVersion === 1;
    } catch { /* Unknown manifest remains review-required below. */ }
  }
  const knownAsset = (path: string) => {
    const file = files.get(path);
    return Boolean(file && definition.legacyManagedFingerprints[path]?.includes(file.fingerprint));
  };
  if (manifest && !currentApp && !knownAsset(manifest.path)) diagnostics.push('Unknown or modified legacy manifest; retain authored membership for review.');
  const paths = input.files.filter(file => {
    if (file.path.split('/').some(part => part.startsWith('.') || part === 'node_modules')) return false;
    if (file.path.startsWith('codument/std/') || file.path === 'codument/manifest.xnl'
      || !/\.(?:xnl|xml)$/u.test(file.path) && !/(?:^|\/)decisions?\.md$/iu.test(file.path)) return false;
    // A current App may mix public Host resources with product resources. The
    // real compiler validates its membership; the product does not rewrite it.
    if (currentApp && file.source !== undefined && file.path.endsWith('.xnl')) {
      try {
        const parsed = parseXnl(file.source, {textBlockStyle: true}), root = parsed.nodes[0];
        if (!parsed.warnings?.length && parsed.nodes.length === 1 && isDataElement(root) && !CODUMENT_RESOURCE_KINDS.includes(root.tag as typeof CODUMENT_RESOURCE_KINDS[number])
          && root.metadata.envelopeVersion === 'halfcode.resource-envelope/v1' && root.metadata.specVersion === 1) return false;
      } catch { /* Malformed resources go through explicit review. */ }
    }
    return true;
  }).map(file => file.path);
  const resourcePlan = planWorkspaceResourceMigration(input, paths);
  diagnostics.push(...resourcePlan.diagnostics);
  const changes = new Map<string, WorkspaceMigrationChange>(resourcePlan.changes.map(change => [change.path, change]));
  const put = (path: string, source: string | null) => {
    if (source === null ? !files.has(path) : files.get(path)?.source === source) return;
    changes.set(path, {path, source, mode: files.get(path)?.mode});
  };
  const targets = new Map(definition.appFiles.map(file => ['codument/' + file.path, file.source]));
  for (const [path, source] of targets) {
    const previous = files.get(path);
    if (path === 'codument/manifest.xnl') {
      if (!currentApp && (!previous || knownAsset(path))) put(path, source);
      continue;
    }
    if (changes.has(path)) continue; // Converted user config owns its values.
    if (!previous) { put(path, source); continue; }
    if (previous.source === source || path.startsWith('codument/attractors/') || path.startsWith('codument/std/attractors/')
      || path.startsWith('codument/config/') || !path.startsWith('codument/std/') && path !== 'codument/SKILL.md' && path !== 'codument/README.md') continue;
    if (knownAsset(path)) put(path, source);
    else diagnostics.push('Modified or unknown managed source requires review: ' + path);
  }
  for (const file of snapshot.files.filter(file => file.path.startsWith('codument/std/'))) {
    if (targets.has(file.path)) continue;
    // Finder metadata is not authored guidance; the complete App backup still
    // retains its original opaque bytes before the retired directory leaves discovery.
    if (file.path.split('/').at(-1) === '.DS_Store' || knownAsset(file.path)) put(file.path, null);
    else diagnostics.push('Unknown or modified workspace standard requires review before global relocation: ' + file.path);
  }
  const configPaths = new Set([...files.keys(), ...changes.keys()].filter(path => path.startsWith('codument/config/')));
  for (const path of configPaths) {
    const source = changes.has(path) ? changes.get(path)!.source : files.get(path)?.source;
    if (source === null || source === undefined) continue;
    const relocated = source.replace(/(?<![\w:/])(?:vfs:\/\/@\/codument\/|skill:\/\/depa-codument\/(?:references\/)?)std\/[^"'`\s<>]+/gu, reference => {
      const punctuation = reference.match(/[),;.!?]+$/u)?.[0] ?? '';
      const uri = reference.slice(0,reference.length-punctuation.length);
      const anchorAt = uri.indexOf('#');
      const base = anchorAt < 0 ? uri : uri.slice(0,anchorAt);
      const anchor = anchorAt < 0 ? '' : uri.slice(anchorAt);
      const target = definition.globalReferences?.[base];
      if (!target) { diagnostics.push('No global standard target for configuration reference: ' + reference); return reference; }
      return target + anchor + punctuation;
    });
    if (relocated !== source) put(path, relocated);
  }
  const result = {...resourcePlan, sourceFingerprint: workspaceMigrationFingerprint(snapshot),
    status: migrationStatus(diagnostics, changes.size > 0 || relocations.length > 0),
    changes: [...changes.values()].sort((a, b) => a.path.localeCompare(b.path)), diagnostics,
    directories: definition.appDirectories.map(path => 'codument/' + path), removeDirectories: ['codument/std'], relocations};
  const {planDigest: _old, ...content} = result;
  return {...content, planDigest: digestCanonical(content)};
}

export async function applyWorkspaceMigration(runtime: WorkspaceMigrationRuntime, expected: WorkspaceMigrationPlan): Promise<WorkspaceMigrationResult> {
  const snapshot = await runtime.files.observe(), plan = runtime.plan(snapshot);
  if (digestCanonical(expected) !== digestCanonical(plan)) throw new Error('Workspace migration plan is stale or altered; observe and plan again.');
  const prepared = await runtime.files.prepare(snapshot, plan);
  try {
    if (plan.status === 'review-required') {
      await prepared.abort(); return {status: 'review-required', planDigest: plan.planDigest, backupPath: prepared.backupPath, diagnostics: plan.diagnostics};
    }
    const findings = await runtime.validate(prepared.validationRoot, plan);
    if (findings.some(finding => finding.severity === 'error')) {
      await prepared.abort(); return {status: 'review-required', planDigest: plan.planDigest, backupPath: prepared.backupPath, diagnostics: findings.map(finding => finding.message)};
    }
    await prepared.commit();
    return {status: plan.status === 'noop' ? 'noop' : 'applied', planDigest: plan.planDigest, backupPath: prepared.backupPath, diagnostics: findings.map(finding => finding.message)};
  } catch (cause) {
    try { await prepared.abort(); }
    catch (recovery) { throw new AggregateError([cause, recovery], 'Workspace migration recovery requires attention; retain backup and ledger.', {cause}); }
    throw cause;
  }
}
