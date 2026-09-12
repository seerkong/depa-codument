import { test, expect } from 'bun:test';
import { pythonRuntimeGuidance, runtimeWrapper } from './python-runtime';

test('runtime wrappers quote executable paths without changing forwarded arguments', () => {
  expect(runtimeWrapper('/tmp/python3.12')).toBe('#!/bin/sh\nexec \'/tmp/python3.12\' "$@"\n');
  expect(runtimeWrapper("/tmp/a'b $(bad)")).toBe('#!/bin/sh\nexec \'/tmp/a\'\\\'\'b $(bad)\' "$@"\n');
  expect(() => runtimeWrapper('python3')).toThrow();
  expect(() => runtimeWrapper('/tmp/python\nexit 0')).toThrow();
});

test('runtime handoff names the admitted interpreter and isolated environment without affecting non-Python cases', () => {
  expect(pythonRuntimeGuidance(undefined)).toBe('');
  const guidance = pythonRuntimeGuidance('/private/managed/python3.12');
  expect(guidance).toContain('"/private/managed/python3.12"');
  expect(guidance).toContain('"$UV_PYTHON" -m venv');
  expect(guidance).toContain('"$TMPDIR"');
  expect(guidance).toContain('child reviewers');
  expect(() => pythonRuntimeGuidance('python3')).toThrow('Absolute prepared Python');
  expect(() => pythonRuntimeGuidance('/tmp/python\nother')).toThrow('Absolute prepared Python');
});
