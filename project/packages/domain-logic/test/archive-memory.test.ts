import {expect, it} from 'bun:test';
import {formatArchiveCalendar, proposeArchiveMemory, proposeArchiveSummary, readAttractorProfileEnabled, readAttractorProfileNames} from '../src';

const calendar = {year: 2026, month: 9, day: 6, hour: 10, minute: 3};
const profile = '<AttractorProfiles #profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Profiles [<Profile #memory {enabled=true}><Profile #off {enabled=false}>]>)>';
it('requires explicit memory activation and rejects invalid configuration instead of silently disabling promotion', () => {
  expect(readAttractorProfileNames(profile)).toEqual(['memory', 'off']);
  expect(readAttractorProfileEnabled(profile, 'memory')).toBe(true);
  expect(readAttractorProfileEnabled(profile, 'off')).toBe(false);
  expect(readAttractorProfileEnabled(undefined, 'memory')).toBe(false);
  expect(readAttractorProfileEnabled(profile.replace('enabled=true', ''), 'memory')).toBe(false);
  for (const invalid of [profile.replace('enabled=true', 'enabled="true"'), profile.replace('#off', '#memory'), profile.replace('specVersion=1', 'apiVersion="old"')]) expect(() => readAttractorProfileEnabled(invalid, 'memory')).toThrow();
});
it('promotes only explicit candidates with exact source bodies and deterministic local-calendar provenance', () => {
  const candidates = new Map([['lessons/careful.md', '    indented original\r\n'], ['summaries/结论.md', '# Source\nbody'], ['patterns/empty.md', '  '], ['nested/deeper/ignored.md', 'not selected'], ['lessons/.hidden.md', 'not selected']]);
  const input = {enabled: true, archiveId: '2026-09-06-1003-work', calendar, candidates, canonicalSources: new Map<string, string>()};
  const result = proposeArchiveMemory(input);
  expect(result.promoted).toEqual(['lessons/2026-09/2026-09-06-1003-careful/lesson.md', 'summaries/2026-09/2026-09-06-1003-结论/summary.md']);
  expect(result.updates.get(result.promoted[0])).toEndWith('    indented original\r\n');
  expect(result.updates.get(result.promoted[1])).toContain('Memory URI: memory://summaries/%E7%BB%93%E8%AE%BA');
  expect(result.updates.get(result.promoted[1])).toStartWith('# summary:');
  expect(proposeArchiveMemory({...input, canonicalSources: result.updates}).updates.size).toBe(0);
  expect(proposeArchiveMemory({...input, enabled: false})).toEqual({updates: new Map(), promoted: []});
  expect(() => proposeArchiveMemory({...input, canonicalSources: new Map([[result.promoted[0], 'authored elsewhere']])})).toThrow('conflict');
  expect(candidates.get('lessons/careful.md')).toBe('    indented original\r\n');
});
it('keeps naming calendar-only and rejects impossible dates or unsafe identities', () => {
  expect(formatArchiveCalendar(calendar)).toEqual({monthBucket: '2026-09', day: '2026-09-06', minutePrefix: '2026-09-06-1003'});
  expect(formatArchiveCalendar({...calendar, year: 2024, month: 2, day: 29}).day).toBe('2024-02-29');
  for (const changed of [{year: 2025, month: 2, day: 29}, {month: 0}, {day: 32}, {hour: 24}, {minute: NaN}]) expect(() => formatArchiveCalendar({...calendar, ...changed})).toThrow('calendar');
  expect(() => proposeArchiveMemory({enabled: true, archiveId: '../escape', calendar, candidates: new Map(), canonicalSources: new Map()})).toThrow('identity');
});
it('derives sorted nested Decision IDs and never overwrites an existing authored summary', () => {
  const decisionSources = new Map([['decisions/topic.xnl', '<decision #z [<decision #a>]>']]);
  const source = proposeArchiveSummary({processId: 'work', decisionSources})!;
  expect(source).toBe('# Archive Summary: work\n\n- a\n- z\n');
  expect(proposeArchiveSummary({processId: 'work', decisionSources, existingSource: source})).toBeUndefined();
  expect(() => proposeArchiveSummary({processId: 'work', decisionSources, existingSource: '# My authored summary'})).toThrow('conflicts');
  expect(proposeArchiveSummary({processId: 'work', decisionSources: new Map(), existingSource: 'keep'})).toBeUndefined();
});
