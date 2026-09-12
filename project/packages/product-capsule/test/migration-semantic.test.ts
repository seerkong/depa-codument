import { expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readDataForestSourceFragments } from 'depa-codument-domain-logic';
import { createCodumentResourceMigrator } from '../src/migration';
import { createCodumentDomainRuntime } from '../src';
import { readCodumentMigrationGuidance } from '../src/migration-guidance';
import { LEGACY_DECISION_SOURCES } from './fixtures/legacy-decision-sources';

test('replays current Agent semantic review: full archived Decision recovery, and four unresolved cases preserve all input authorities', async () => {
  for (const input of LEGACY_DECISION_SOURCES) {
    const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'codument-semantic-migration-')));
    const runtime = createCodumentDomainRuntime(root, {validation: {file: 'codument'}, clock: {nowIso: () => '2026-09-06T12:00:00Z'}, env: {}, output: {write() {}}});
    try {
      for (const file of input.files) {await fs.mkdir(dirname(join(root, file.path)), {recursive: true}); await fs.writeFile(join(root, file.path), file.source);}
      const markdown = input.files.find(file => file.path.endsWith('/decision.md'))!;
      const migration = createCodumentResourceMigrator(root);
      const receipt = await migration.upgrade(markdown.path);
      expect(receipt.status).toBe('review-required');
      expect(await fs.readFile(receipt.backupPath!, 'utf8')).toBe(markdown.source);
      expect(readCodumentMigrationGuidance('decision')).toContain('stable Decision');
      if (input.name !== 'case-01-archive-recoverable') {
        // Current Agent found missing identity mapping/source or conflicting
        // authorities. These fixtures cannot authorize a semantic publication.
        for (const file of input.files) expect(await fs.readFile(join(root, file.path), 'utf8')).toBe(file.source);
        continue;
      }
      const archived = input.files.find(file => file.path.endsWith('/decisions.xnl'))!;
      const target = 'codument/decisions/migration/recovery.xnl';
      // Owner chosen by the Agent from the original recovery-policy question;
      // not a runtime heuristic based on dates, filename or archive ID.
      await runtime.domain.createDecision({file: target, id: 'fixture.migration.recoverable'});
      const scaffold = await fs.readFile(join(root, target), 'utf8');
      expect(scaffold).toContain('envelopeVersion');
      // Fill the disposable authored candidate with the complete archived root.
      // The CLI migration, not the Agent, normalizes its version metadata.
      await fs.writeFile(join(root, target), archived.source);
      const upgraded = await migration.upgrade(target);
      expect(upgraded.status).toBe('applied');
      const source = await fs.readFile(join(root, target), 'utf8');
      const before = readDataForestSourceFragments(archived.source)[0].node;
      const after = readDataForestSourceFragments(source)[0].node;
      expect({...after, metadata: before.metadata}).toEqual(before);
      expect(await migration.verify(target)).toMatchObject({valid: true, diagnostics: []});
      expect((await runtime.domain.decisions({operation: 'validate', target: 'codument/decisions'})).findings).toEqual([]);
      // Only the verified Markdown projection is retired, into an owned private
      // recovery directory. The historical archive source remains provenance.
      const retired = join(dirname(receipt.backupPath!), 'retired-decision.md');
      await fs.rename(join(root, markdown.path), retired);
      expect(await fs.readFile(retired, 'utf8')).toBe(markdown.source);
      expect(await fs.readFile(receipt.backupPath!, 'utf8')).toBe(markdown.source);
      expect(await fs.stat(join(root, markdown.path)).catch(() => undefined)).toBeUndefined();
      const inode = (await fs.stat(join(root, target))).ino;
      expect((await migration.upgrade(target)).status).toBe('noop');
      expect((await fs.stat(join(root, target))).ino).toBe(inode);
      expect(await migration.verify(target)).toMatchObject({valid: true});
    } finally {await runtime.close(); await fs.rm(root, {recursive: true, force: true});}
  }
}, 30_000);
