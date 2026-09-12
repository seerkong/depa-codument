import { expect, it } from 'bun:test';
import { proposeWorkspaceBinding, readWorkspaceBindingSources } from '../src';

it('reads escaped machine-local ProjectRef bindings without treating node IDs as the reference authority', () => {
  expect(readWorkspaceBindingSources(undefined)).toEqual({});
  expect(readWorkspaceBindingSources('<WorkspaceBindings [<Binding #generated {project_ref="library.pkg" workspace_path="/path with space/quoted\\\"dir"}>]>'))
    .toEqual({ 'library.pkg': '/path with space/quoted"dir' });
  expect(readWorkspaceBindingSources('<WorkspaceBindings [<Binding #safe {project_ref="__proto__" workspace_path="/tmp/project"}>]>')['__proto__']).toBe('/tmp/project');
});
it('binds, rebinds and removes the last local reference without rewriting author bytes', () => {
  const original = '<!-- keep -->\n<WorkspaceBindings {extension="keep"} []>\n';
  const first = proposeWorkspaceBinding(original, 'library', '/path with space/quoted"dir');
  expect(first).toContain('<!-- keep -->\n<WorkspaceBindings {extension="keep"} [');
  expect(readWorkspaceBindingSources(first)).toEqual({ library: '/path with space/quoted"dir' });
  expect(proposeWorkspaceBinding(first, 'library', '/path with space/quoted"dir')).toBe(first);
  const second = proposeWorkspaceBinding(first, 'library', '/new');
  expect(second).toBe(first.replace('/path with space/quoted\\"dir', '/new'));
  const withOther = proposeWorkspaceBinding(second, 'other', '/other');
  expect(readWorkspaceBindingSources(withOther)).toEqual({ library: '/new', other: '/other' });
  const removed = proposeWorkspaceBinding(withOther, 'library');
  expect(readWorkspaceBindingSources(removed)).toEqual({ other: '/other' });
  const empty = proposeWorkspaceBinding(removed, 'other');
  expect(readWorkspaceBindingSources(empty)).toEqual({});
  expect(empty).toContain('<!-- keep -->');
  expect(proposeWorkspaceBinding(empty, 'missing')).toBe(empty);
  expect(readWorkspaceBindingSources(proposeWorkspaceBinding(undefined, '__proto__', '/safe'))['__proto__']).toBe('/safe');
  expect(readWorkspaceBindingSources(proposeWorkspaceBinding('<WorkspaceBindings>', 'lib', '/lib'))).toEqual({ lib: '/lib' });
});
it('rejects malformed and duplicate binding facts instead of silently choosing a workspace', () => {
  for (const source of [
    '<WorkspaceBindings [<Binding {project_ref="lib"}>]>', '<Other>',
    '<WorkspaceBindings (<Binding {project_ref="lib" workspace_path="/one"}>)>',
    '<WorkspaceBindings ["ignored data"]>',
    '<WorkspaceBindings [<Binding {project_ref="lib" workspace_path="/one"}><Binding {project_ref="lib" workspace_path="/two"}>]>',
  ]) expect(() => readWorkspaceBindingSources(source)).toThrow();
});
