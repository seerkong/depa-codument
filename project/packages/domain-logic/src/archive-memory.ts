import {indexXnlRegistry, isDataElement, requireReadyRegistry} from './registry';
import type {ArchiveCalendar} from 'depa-codument-domain-contract';
export type {ArchiveCalendar} from 'depa-codument-domain-contract';

/** Calendar fields are observations supplied by the local-time effect. Logic
 * does not read the clock, timezone, mtime or implicit process environment. */
export function formatArchiveCalendar(value: ArchiveCalendar): {monthBucket: string; minutePrefix: string; day: string} {
  const {year, month, day, hour, minute} = value;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (![year, month, day, hour, minute].every(Number.isSafeInteger) || year < 1 || year > 9999 || month < 1 || month > 12
    || day < 1 || day > days[month - 1] || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Invalid archive calendar observation.');
  const pad = (number: number) => String(number).padStart(2, '0');
  const monthBucket = `${String(year).padStart(4, '0')}-${pad(month)}`;
  const date = `${monthBucket}-${pad(day)}`;
  return {monthBucket, day: date, minutePrefix: `${date}-${pad(hour)}${pad(minute)}`};
}

/** Explicit candidates only. Paths are relative to memory/, and an existing
 * different value is a conflict rather than a falsely successful promotion. */
export function proposeArchiveMemory(input: {
  readonly enabled: boolean;
  readonly archiveId: string;
  readonly calendar: ArchiveCalendar;
  readonly candidates: ReadonlyMap<string, string>;
  readonly canonicalSources: ReadonlyMap<string, string>;
}): {readonly updates: ReadonlyMap<string, string>; readonly promoted: readonly string[]} {
  if (typeof input.enabled !== 'boolean') throw new Error('Memory activation must be an admitted boolean.');
  if (!input.enabled) return {updates: new Map(), promoted: []};
  if (!input.archiveId || /[/\\\u0000-\u001f]/.test(input.archiveId) || input.archiveId.startsWith('.')) throw new Error('Memory archive source identity is invalid.');
  const time = formatArchiveCalendar(input.calendar);
  const types: Readonly<Record<string, string>> = {lessons: 'lesson', incidents: 'incident', patterns: 'pattern', summaries: 'summary'};
  const updates = new Map<string, string>(), promoted: string[] = [];
  for (const [file, source] of [...input.candidates].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const parts = file.split('/');
    if (parts.length !== 2 || !Object.hasOwn(types, parts[0]) || !parts[1].endsWith('.md') || parts[1].startsWith('.')) continue;
    const [type, filename] = parts, slug = filename.slice(0, -3);
    if (!slug || /[\\\u0000-\u001f]/.test(slug)) throw new Error('Memory candidate identity is invalid.');
    if (!source.trim()) continue;
    const target = `${type}/${time.monthBucket}/${time.minutePrefix}-${slug}/${types[type]}.md`;
    const content = `# ${types[type]}: ${slug}\n\nMemory URI: memory://${type}/${encodeURIComponent(slug)}\nSource: archive://${encodeURIComponent(input.archiveId)}\n\n${source}${source.endsWith('\n') ? '' : '\n'}`;
    const existing = input.canonicalSources.get(target);
    if (existing !== undefined && existing !== content) throw new Error(`Memory promotion conflict at '${target}'; retain both sources for review.`);
    if (existing === undefined) updates.set(target, content);
    promoted.push(target);
  }
  return {updates, promoted};
}

/** A summary is a derived list, never a replacement for durable Decision trees. */
export function proposeArchiveSummary(input: {
  readonly processId: string;
  readonly decisionSources: ReadonlyMap<string, string>;
  readonly existingSource?: string;
}): string | undefined {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input.processId)) throw new Error('Archive summary process identity is invalid.');
  const indexed = requireReadyRegistry(indexXnlRegistry(input.decisionSources, {registryName: 'decision'}, {shouldIndex: node => node.tag === 'decision'}));
  for (const nodes of indexed.files.values()) if (nodes.some(node => !isDataElement(node) || node.tag !== 'decision')) throw new Error('Archive summary requires Decision source roots.');
  const ids = [...indexed.index.keys()].sort();
  if (!ids.length) return undefined;
  if (ids.some(id => /[\r\n]/.test(id))) throw new Error('Archive summary Decision identity contains a line break.');
  const source = [`# Archive Summary: ${input.processId}`, '', ...ids.map(id => `- ${id}`), ''].join('\n');
  if (input.existingSource !== undefined && input.existingSource !== source) throw new Error('Archive summary conflicts with existing authored content; retain it for review.');
  return input.existingSource === source ? undefined : source;
}
