import { test, expect } from 'bun:test';
import { runtimeWrapper } from './python-runtime';

test('runtime wrappers quote executable paths without changing forwarded arguments', () => {
  expect(runtimeWrapper('/tmp/python3.12')).toBe('#!/bin/sh\nexec \'/tmp/python3.12\' "$@"\n');
  expect(runtimeWrapper("/tmp/a'b $(bad)")).toBe('#!/bin/sh\nexec \'/tmp/a\'\\\'\'b $(bad)\' "$@"\n');
  expect(() => runtimeWrapper('python3')).toThrow();
  expect(() => runtimeWrapper('/tmp/python\nexit 0')).toThrow();
});
