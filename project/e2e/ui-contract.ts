import assert from 'node:assert/strict';

/** Transport vocabulary only; never a generated application's test plan. */
export const UI_ACTION_OPERATIONS: readonly string[] = Object.freeze(['click', 'fill', 'select', 'dialog', 'observe']);
export const UI_BUDGETS = Object.freeze({scenario:360_000,review:780_000,protocol:120_000,overhead:60_000});
export const UI_ACTION_GUIDANCE = `Each action has {operation,coverage,url,target,expected,observed}; operation must be one of: ${UI_ACTION_OPERATIONS.join(', ')}. This is a low-level action kind, NOT a business step name; describe the business requirement in coverage/target. All other fields are non-empty strings. observed must contain expected and be a verbatim substring of a successful native snapshot.`;

/** Shared by proposal admission and the controller's official-receipt gate. */
export function validateUiActions(actions: unknown): void {
  assert.ok(Array.isArray(actions) && actions.length > 0, 'Require actual UI interaction observations, not a bare HTML response');
  for (const raw of actions) {
    assert.ok(raw !== null && typeof raw === 'object', 'Browser action must be an object');
    const action = raw as Record<string, unknown>;
    assert.ok(typeof action.operation === 'string' && UI_ACTION_OPERATIONS.includes(action.operation), 'Browser action operation is not a supported low-level kind');
    for (const key of ['url', 'target', 'expected', 'observed', 'coverage']) {
      assert.ok(typeof action[key] === 'string' && (action[key] as string).trim(), `Browser action ${key} must be a non-empty string`);
    }
    assert.match(action.url as string, /^http:\/\/127\.0\.0\.1:\d+(\/|$)/, 'Browser action URL must be a local application origin');
    assert.ok((action.observed as string).includes(action.expected as string), 'Visible browser assertion failed');
  }
}
