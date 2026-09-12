import { expect, it } from 'bun:test';
import type { DomainValidationSnapshot, DomainValidationUnit } from 'depa-codument-domain-contract';
import { inspectDomainValidation } from '../src';
const envelope = 'envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
const source = `<Track #example ${envelope} {status="in_progress" goal="Validate" description="Keep checks" created_at="2026-09-06" updated_at="2026-09-06" commit_mode="manual"} (
<Ports {scope="track"} [<MaterialBundle {name="outputs" role="output" domain="docs" path="vfs://./docs/"}>]>
<TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE" child_mode="sequential"} (<SubNodes [<Task #T1 {status="DONE"} (<Acceptance [<Criterion #C1 {checked=false} ?>Check.</?>]>)>]>)>]>)>
<Schedule []><Hooks []>)>`;
const patch = `<BehaviorPatch #track.example.behavior_patch.cli ${envelope} {capability="cli"} (<Mutations [<Delete {selector="behavior://cli/requirements/old"}>]>)>`;
function unit(): DomainValidationUnit {
  return { kind: 'Track', id: 'example', directory: 'codument/tracks/active/example', file: 'codument/tracks/active/example/track.xnl',
    source, missingFiles: [], patches: new Map([['delta.xnl', patch]]), decisionForests: [], findings: [] };
}
it('composes structural/semantic/companion/patch checks with strict warning promotion without mutating snapshots', () => {
  const input: DomainValidationSnapshot = { units: [unit()], findings: [] };
  const before = structuredClone(input);
  const normal = inspectDomainValidation(input, {});
  expect(normal.findings.map(finding => [finding.rule, finding.severity])).toEqual([['track.lifecycle.done-criterion', 'warning']]);
  expect(inspectDomainValidation(input, { strict: true }).findings[0].severity).toBe('error');
  expect(input).toEqual(before);
  const missing = { ...unit(), missingFiles: ['proposal.md'], patches: new Map<string, string>() };
  expect(inspectDomainValidation({ units: [missing], findings: [] }, {}).findings.map(finding => finding.rule)).toContain('track.required-file');
  expect(inspectDomainValidation({ units: [missing], findings: [] }, {}).findings.map(finding => finding.rule)).toContain('track.behavior-delta.missing');
});
it('keeps canonical and working Decision forests separate and checks duplicates/profiles/old envelopes', () => {
  const decision = `<decision #same ${envelope} {status="accepted"}>`;
  const forests = [new Map([['decisions.xnl', decision]]), new Map([['analysis/decision-tree.xnl', decision]])];
  const current = { ...unit(), source: source.replace('checked=false', 'checked=true'), decisionForests: forests };
  expect(inspectDomainValidation({ units: [current], findings: [] }, {}).findings).toEqual([]);
  const duplicates = inspectDomainValidation({ units: [current, { ...current, file: 'duplicate.xnl' }], findings: [] }, {});
  expect(duplicates.findings.map(finding => finding.rule)).toContain('track.duplicate-authority');
  const hooked = { ...current, source: current.source.replace('<Hooks []>', '<Hooks [<Hook {on="track:after"} [<AttractorCheck {use="project"}>]>]>') };
  expect(inspectDomainValidation({ units: [hooked], findings: [] }, {}).findings.map(finding => finding.rule)).toContain('attractor.profile');
  expect(inspectDomainValidation({ units: [hooked], findings: [], profiles: `<AttractorProfiles #profiles ${envelope} (<Profiles [<Profile #project {enabled=true}>]>)>` }, {}).findings).toEqual([]);
  expect(inspectDomainValidation({ units: [{ ...current, source: current.source.replace('specVersion=1', 'apiVersion="old" version="1"') }], findings: [] }, {}).findings[0].rule).toBe('track.kind');
  const broken = { ...current, patches: new Map([['delta.xnl', patch.replace('<Delete {selector="behavior://cli/requirements/old"}>', '')]]) };
  expect(inspectDomainValidation({ units: [broken], findings: [] }, {}).findings.map(finding => finding.rule)).toContain('behavior.patch.mutations');
});
