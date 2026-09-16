import { expect, test } from 'bun:test';
import { parseXnl, type DataElementNode } from 'xnl-core';
import { planResourceMigration } from '../src/migration';
import { validateLifecycleTree } from '../src/lifecycle-validation';
import { historicalCompletion } from '../src/historical-completion';
import { transitionLifecycleResource } from '../src/lifecycle';
import { inspectDomainValidation } from '../src/validate';
import { projectTrackQuery } from '../src/query';

const file = 'codument/tracks/archived/2026-01/example/track.xnl';
const source = `<Track #example apiVersion="codument.tech/v1alpha1" {status="completed" goal="Keep history" description="No invented evidence" created_at="2026-01-01" updated_at="2026-01-02" question_mode="decision-tree" question_severity="auto" commit_mode="manual"} (
  <Ports {scope="track"} []>
  <TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="DONE"} (
    <Gate [<Criterion ?>Historical assertion, unchecked field absent.</?>]>
    <SubNodes [<Task #T1 {status="DONE"} (<Acceptance [<Criterion {checked=true} ?>Task evidence.</?>]>)>]>
  )>]>)>
)>`;
const tree = (value: string) => parseXnl(value, { textBlockStyle: true }).nodes[0] as DataElementNode;
function migrated(value = source, path = file) {
  const plan = planResourceMigration({ path, source: value });
  expect(plan.status).toBe('planned');
  return plan.proposal!.source!;
}

test('legacy archived declaration preserves body and status, binds source, and repeats without claiming new verification', () => {
  const output = migrated(), root = tree(output);
  expect(root.body).toEqual(tree(source).body);
  expect(root.attributes?.status).toBe('completed');
  expect(output).toContain('Historical assertion, unchecked field absent.');
  expect(historicalCompletion(root, file)).toMatchObject({ currentVerification: 'not-reverified', sourcePath: file });
  expect(validateLifecycleTree(root, { file, strict: true })).toEqual([]);
  expect(planResourceMigration({ path: file, source: output }).status).toBe('noop');
  expect(projectTrackQuery({ id: 'example', file, absolutePath: '/' + file, source: output }).metadata.historicalCompletion?.currentVerification).toBe('not-reverified');
  const inspected = inspectDomainValidation({ findings: [], units: [{ kind: 'Track', id: 'example', file, directory: file.slice(0, -10),
    source: output, missingFiles: [], decisionForests: [], findings: [] }] }, { strict: true });
  expect(inspected.units[0].historicalCompletion?.currentVerification).toBe('not-reverified');
  expect(() => transitionLifecycleResource({ kind: 'track', id: 'example', stage: 'archived', root }, 'in_progress', '2026-09-08')).toThrow('Historical completion');
});

test('history compatibility never launders explicit failure, active tasks, current envelopes or altered content', () => {
  const current = source.replace('apiVersion="codument.tech/v1alpha1"', 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1');
  expect(planResourceMigration({ path: file, source: current }).status).toBe('noop');
  expect(validateLifecycleTree(tree(current), { file, strict: true }).some(f => f.rule === 'track.lifecycle.completed-criteria')).toBe(true);
  const activeFile = file.replace('/archived/', '/active/');
  const active = tree(migrated(source, activeFile));
  expect(historicalCompletion(active, activeFile)).toBeUndefined();
  expect(validateLifecycleTree(active, { file: activeFile, strict: true }).length).toBeGreaterThan(0);
  const failed = tree(migrated(source.replace('<Criterion ?>', '<Criterion {checked=false} ?>')));
  expect(validateLifecycleTree(failed, { file, strict: true }).some(f => f.rule === 'track.lifecycle.completed-criteria')).toBe(true);
  const output = migrated();
  for (const value of [output.replace('No invented evidence', 'changed'), output.replace('legacy-declared/v1', 'legacy-declared/v2')]) {
    expect(validateLifecycleTree(tree(value), { file, strict: true }).some(f => f.rule === 'track.history.provenance')).toBe(true);
  }
  expect(validateLifecycleTree(tree(output), { file: activeFile, strict: true }).some(f => f.rule === 'track.history.provenance')).toBe(true);
});

test('legacy XML archives retain their original provenance and cannot inject reserved completion fields', () => {
  const xml = '<Track id="example" version="1"><Metadata><Status>completed</Status><Goal>Keep</Goal></Metadata><TaskSpace id="TS"><SubNodes><TaskGroup id="G" status="DONE"/></SubNodes></TaskSpace></Track>';
  const plan = planResourceMigration({ path: file.replace('.xnl', '.xml'), source: xml });
  expect(plan.status).toBe('planned');
  expect(historicalCompletion(tree(plan.proposal!.source!), plan.targetPath!)?.sourcePath).toBe(file.replace('.xnl', '.xml'));
  expect(planResourceMigration({ path: file, source: source.replace('status="completed"', 'status="completed" completion_basis="legacy-declared/v1"') }).status).toBe('review-required');
});
