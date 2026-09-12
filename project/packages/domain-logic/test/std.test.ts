import { expect, it } from 'bun:test';
import { inspectStdDocumentation, isCurrentStdDocumentation } from '../src/std';

it('preserves all thirteen rules, deterministic file/line/rule order and repeatable inspection', () => {
  const source = ['std/actions', 'cdt:Task', 'child-mode', '<Task id=', '<Needs>', 'Metadata.Status',
    'ADDED vs MODIFIED', 'behavior delta 继续使用 XML', '兼容 fallback', 'Move an approved track',
    '更新根属性 updated_at', 'Task 标记为 DONE', '每个顶层 decision 使用 apiVersion'].join('\r\n');
  const input = { root: '/docs', sources: new Map([['z.md', 'std/actions'], ['a.md', source]]) };
  const result = inspectStdDocumentation(input);
  expect(result.findings).toHaveLength(14);
  expect(new Set(result.findings.map(item => item.rule)).size).toBe(13);
  expect(result.findings.slice(0, 13).map(item => item.line)).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
  expect(result.findings[0]).toEqual({ file: 'a.md', line: 1, rule: 'std.legacy.actions-path', message: 'current skill and operation routes must use std/operations' });
  expect(result.findings.at(-1)?.file).toBe('z.md');
  expect(inspectStdDocumentation(input)).toEqual(result);
  expect(inspectStdDocumentation({ root: '/docs', sources: new Map([['clean.md', 'Task source is updated through codument track task transition.']]) }).findings).toEqual([]);
});
it('excludes only historical documentation paths, not similarly named live paths', () => {
  const excluded = ['compat/a.md', 'nested/spec/a.md', 'operations/migrate.md', 'nested/std/operations/migrate.md'];
  for (const file of excluded) expect(isCurrentStdDocumentation(file)).toBe(false);
  for (const file of ['compatible/a.md', 'specs/a.md', 'other/operations/migrate.md']) expect(isCurrentStdDocumentation(file)).toBe(true);
  expect(inspectStdDocumentation({ root: '/docs', sources: new Map(excluded.map(file => [file, 'std/actions'])) }).findings).toEqual([]);
});
