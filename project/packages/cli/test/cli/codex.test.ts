import { describe, expect, test } from 'bun:test';
import { buildThreadListParams } from '../../src/cli/effects/codex';

describe('Codex thread listing', () => {
  test('passes workspace and state-database filters to the app-server protocol', () => {
    expect(buildThreadListParams({
      cwd: '/workspace/current',
      useStateDbOnly: true,
      sortMode: 'recency_desc',
    })).toMatchObject({
      limit: 80,
      cwd: '/workspace/current',
      useStateDbOnly: true,
      sortKey: 'recency_at',
      sortDirection: 'desc',
    });
  });
});
