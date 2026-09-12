import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { observePlannedIdentities, reconcilePlannedIdentities, implementationHandoff } from './handoff';
import { lifecycleSourceCodec } from 'depa-codument-domain-logic';

test('fresh planning handoff retains pending identity, permits moves and rejects replacement/duplicate authorities', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'depa-handoff-'));
  const pending = path.join(root, 'codument/tracks/pending/example');
  const active = path.join(root, 'codument/tracks/active/example');
  try {
    fs.mkdirSync(pending, {recursive:true});
    const source = '<Track #example envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {status="new"} (<TaskSpace #TS (<SubNodes []>)><Schedule []><Hooks []>)>';
    fs.writeFileSync(path.join(pending, 'track.xnl'), source);
    const planned = observePlannedIdentities(root, [root]);
    expect(planned[0]).toMatchObject({repository:'.',kind:'track',id:'example',stage:'pending'});
    expect(planned[0].sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(implementationHandoff(planned)).toContain('track context <id> --json');
    fs.mkdirSync(path.dirname(active), {recursive:true});
    fs.renameSync(pending, active);
    fs.writeFileSync(path.join(active, 'track.xnl'), source.replace('new', 'in_progress'));
    const current = observePlannedIdentities(root, [root]);
    expect(current[0].sourceSha256).not.toBe(planned[0].sourceSha256);
    expect(() => reconcilePlannedIdentities(planned, current)).not.toThrow();
    expect(() => reconcilePlannedIdentities(planned, [])).toThrow('identity drift');
    expect(() => reconcilePlannedIdentities(planned, [{...current[0], id:'replacement'}])).toThrow('identity drift');
    const invalidState = source.replace('status="new"', 'status="invalid" gap_round=-1');
    fs.writeFileSync(path.join(active, 'track.xnl'), invalidState);
    expect(() => reconcilePlannedIdentities(planned, observePlannedIdentities(root, [root]))).not.toThrow();
    expect(() => lifecycleSourceCodec.inspect(invalidState, 'track')).toThrow();
    fs.mkdirSync(pending, {recursive:true});
    fs.writeFileSync(path.join(pending, 'track.xnl'), source);
    expect(() => observePlannedIdentities(root, [root])).toThrow('Ambiguous');
  } finally { fs.rmSync(root, {recursive:true,force:true}); }
});
