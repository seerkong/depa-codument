import { expect, it } from 'bun:test';
import { KIND_SCHEMA_KINDS, parseKindSchemaKind, renderKindSchema, TRACK_MATERIAL_DOMAINS } from '../src';

it('prints XNL slot catalogs for track, mission and decision and rejects other kinds', () => {
  expect(KIND_SCHEMA_KINDS).toEqual(['track', 'mission', 'decision']);
  expect(TRACK_MATERIAL_DOMAINS).toEqual(['code', 'test', 'docs', 'artifact', 'memory']);
  const track = renderKindSchema('track');
  expect(track).toContain('<!-- kind: track -->');
  expect(track).toContain('<Track #id');
  expect(track).toContain('slot:MaterialBundle');
  expect(track).toContain(`domain=${TRACK_MATERIAL_DOMAINS.join('|')}`);
  expect(track).toContain('<TaskGroup #P1');
  expect(track).toContain('<GapLoop');
  expect(track).not.toMatch(/domain = "behavior"|domain = "modeling"|domain = "engineering"/);
  expect(track).not.toContain('fill --input');
  const mission = renderKindSchema('mission');
  expect(mission).toContain('<Mission #id');
  expect(mission).toContain('MissionPlanner');
  expect(mission).toContain('<TrackLink');
  expect(mission).toContain('<MissionLink');
  const decision = renderKindSchema('decision');
  expect(decision).toContain('<decision #track.example.root');
  expect(decision).toContain('<options { }');
  expect(decision).toContain('</?>');
  expect(decision).not.toContain('</question>');
  expect(parseKindSchemaKind('track')).toBe('track');
  expect(() => parseKindSchemaKind('behavior')).toThrow('schema <track|mission|decision>');
  expect(() => parseKindSchemaKind('fill')).toThrow('schema <track|mission|decision>');
});
