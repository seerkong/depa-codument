import { expect, test } from 'bun:test';
import { parseXnl, wordToString, type DataElementNode } from 'xnl-core';
import { inspectResourceMigration, planResourceMigration } from '../src/migration';
import { readMigrationXml } from '../src/migration-xml';

test('legacy XML resource families have explicit current targets and retain source meaning', () => {
  const fixtures = [
    ['codument/tracks/active/example/track.xml', '<Track id="example" version="1" xmlns:cdt="urn:codument:v1"><Metadata><ApiVersion>codument.tech/v1alpha1</ApiVersion><Status>completed</Status><Goal>Example</Goal></Metadata><TaskSpace id="space_example"><SubNodes><TaskGroup id="P1" status="DONE"/></SubNodes></TaskSpace><Schedule/><Hooks/></Track>', 'Track'],
    ['codument/missions/active/example/mission.xml', '<Mission id="example" version="1"><Metadata><Status>active</Status><Revision>1</Revision></Metadata><TaskSpace id="space_example"><SubNodes/></TaskSpace><ProjectRefs><cdt:ProjectRef id="external" path="../related"/></ProjectRefs></Mission>', 'Mission'],
    ['codument/config/action-hooks.xml', '<ActionHooks version="1"><Action name="gap-loop"><cdt:GapLoopDefaults verify-round="true"/></Action></ActionHooks>', 'OperationHooks'],
    ['codument/config/attractor-profiles.xml', '<AttractorProfiles version="1"><Profile name="depa" enabled="true"><Description>my DEPA</Description><Attractor href="vfs://./attractors/depa.md"/></Profile></AttractorProfiles>', 'AttractorProfiles'],
  ] as const;
  for (const [path, source, kind] of fixtures) {
    const result = planResourceMigration({path, source});
    expect(result.diagnostics).toEqual([]);
    expect(result.status).toBe('planned');
    expect(result.targetKind).toBe(kind);
    const root = parseXnl(result.proposal!.source!, {textBlockStyle: true}).nodes[0] as DataElementNode;
    expect(root.metadata).toEqual({envelopeVersion: 'halfcode.resource-envelope/v1', specVersion: 1});
    expect(wordToString(root.id)).toBeTruthy();
    expect(planResourceMigration({path: result.targetPath!, source: result.proposal!.source!}).status).toBe('noop');
  }
  expect(inspectResourceMigration({path: fixtures[0][0], source: fixtures[0][1]}).apiVersions).toEqual(['codument.tech/v1alpha1']);
});

test('XML parser handles quoted delimiters, entities, comments and opaque text without executing expansions', () => {
  const source = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- keep audit -->\n<Track id=\'test\' note=\'a > b &amp; c&#x4e2d;\'><Metadata><Status>active</Status></Metadata><Description><![CDATA[<opaque> & not an entity]]></Description></Track>';
  const plan = planResourceMigration({path: 'codument/tracks/active/test/track.xml', source});
  expect(plan.status).toBe('planned');
  expect(plan.proposal!.source).toContain('<!-- keep audit -->');
  const root = parseXnl(plan.proposal!.source!, {textBlockStyle: true}).nodes[0] as DataElementNode;
  expect(root.attributes?.note).toBe('a > b & c中');
  expect(root.extend?.children.Description).toMatchObject({kind: 'TextElement', text: '<opaque> & not an entity'});
});

test('unsupported/lossy XML interpretations are review, never silent field deletion', () => {
  const inputs = [
    '<!DOCTYPE Track [<!ENTITY secret SYSTEM "file:///etc/passwd">]><Track id="x">&secret;</Track>',
    '<Track id="x" id="y"/>', '<Track id="x" attr=bare/>', '<Track id="x" broken/>',
    '<Track id="x" namespace:attr="x"/>', '<Track id="x"><Metadata><Status extra="x">active</Status></Metadata></Track>',
    '<Track id="x"><Metadata><Status>active</Status><Status>completed</Status></Metadata></Track>',
    '<Track id="x" foo-bar="x" foo_bar="y"/>', '<Track id="x">mixed<Task id="t"/></Track>',
    '<Track id="x" version="99"/>', '<Track id="x"><Unknown/><Unknown/></Track>', '<Track id="x">Keep root meaning</Track>',
  ];
  for (const source of inputs) expect(planResourceMigration({path: 'codument/tracks/active/x/track.xml', source}).status).toBe('review-required');
  const config = planResourceMigration({path: 'codument/config/operation-hooks.xml', source: '<OperationHooks><Unknown important="keep"/></OperationHooks>'});
  expect(config.status).toBe('review-required');
  for (const [path, source] of [
    ['codument/config/operation-hooks.xml', '<OperationHooks><Operation name="impl-track">Keep operation meaning</Operation></OperationHooks>'],
    ['codument/config/attractor-profiles.xml', '<AttractorProfiles><Profile name="custom">Keep profile meaning</Profile></AttractorProfiles>'],
    ['codument/config/modeling.xml', '<Modeling><MergePolicy>Keep merge meaning</MergePolicy></Modeling>'],
  ]) expect(planResourceMigration({path, source}).status).toBe('review-required');
  expect(() => readMigrationXml('<Track id="x"><X></Track>')).toThrow('Mismatched');
});
