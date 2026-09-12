import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { commandHelp, dispatchCommand, resolveCommandPath, rootHelp } from '../../src/cli/command-registry';
import { createCommandRuntime } from '../../src/cli/runtime';
import { buildOutputPayload } from '../../src/cli/output';
import { BUILTIN_RESOURCE_KINDS } from '../../src/cli/resources/kinds';
import { writeBundleResources, writePageManifest, writeSkillApp, writeSop } from '../fixtures/xnl-skill-app';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

async function fixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-kind-native-'));
  roots.push(root);
  const skill = path.join(root, '.agents/skills/demo');
  await writeSkillApp(skill, 'demo');
  const page = path.join(skill, 'pages/hello');
  await writePageManifest(page, { fqn: 'Test.Page.Hello', name: 'hello', description: 'Hello Page' });
  await fs.writeFile(path.join(page, 'index.html'), '<h1>Hello</h1>');
  await writeSop(skill, 'Test.SOP.Hello', 'hello.md', '# Hello');
  await writeBundleResources(skill, 'Test.Bundles', `
const api = globalThis.Codument;
if (!api) throw new Error('missing definition api');
export const local = api.defineLocalFunction({ fqn: 'Test.LocalFunction.Echo', operation: 'query', inputSchema: {}, configSchema: {}, outputSchema: {}, handler: (_runtime, input) => input });
export const workflow = api.definePageWorkflow({ fqn: 'Test.PageWorkflow.Run', inputSchema: {}, outputSchema: {}, selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.test/', cardinality: 'exactly-one' }, defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload });
export const object = api.definePageObject({ fqn: 'Test.PageObject.Hello', selectionPolicy: { kind: 'served-page', pageName: 'hello', cardinality: 'exactly-one' }, actions: [{ fqn: 'Test.PageObject.Hello.read', inputSchema: {}, outputSchema: {}, handler: (_runtime, _selector, invocation) => invocation.payload }] });
`);
  return root;
}

describe('PascalCase Kind-native resource CLI', () => {
  test('publishes only canonical Kind commands and rejects removed routes', async () => {
    const help = rootHelp();
    for (const kind of ['Resource', 'SOP', 'Page', 'LocalFunction', 'PageWorkflow', 'PageObject']) {
      expect(help).toMatch(new RegExp(`^\\s+${kind}\\s`, 'm'));
    }
    expect(help).not.toMatch(/^\s+(?:page|page-automation|page-workflow|local-function)\s/m);
    expect(commandHelp(['LocalFunction'])).toContain('invoke');
    expect(commandHelp(['PageWorkflow'])).toContain('start');
    expect(commandHelp(['PageObject'])).toContain('invoke');
    for (const definition of BUILTIN_RESOURCE_KINDS) {
      for (const verb of definition.verbs) expect(resolveCommandPath([definition.kind, verb])).toEqual([definition.kind, verb]);
    }
    expect(resolveCommandPath(['Page', 'list'])).toEqual(['Page', 'list']);
    for (const structuralKind of ['SkillApp', 'LocalFunctionBundle', 'PageWorkflowBundle', 'PageObjectBundle']) {
      expect(resolveCommandPath([structuralKind, 'list'])).toEqual([]);
    }
    for (const legacy of ['ApplicationSOP', 'page', 'page-automation', 'page-workflow', 'local-function']) {
      expect(resolveCommandPath([legacy, 'list'])).toEqual([]);
      await expect(dispatchCommand([legacy, 'list'], createCommandRuntime(), true)).rejects.toThrow('Unknown command');
    }
  });

  test('lists, details and validates declarative and executable Kinds from XNL authority', async () => {
    const runtime = createCommandRuntime(await fixture());
    const pages = await dispatchCommand(['Page', 'list'], runtime, true);
    expect(pages.data).toMatchObject({ command: 'Page.list', count: 1 });
    const sop = await dispatchCommand(['SOP', 'detail', '--fqn', 'Test.SOP.Hello'], runtime, true);
    expect(sop.data).toMatchObject({ kind: 'SOP', resource: { fqn: 'Test.SOP.Hello', logicalPath: expect.stringMatching(/^SOP\//) } });
    const locals = await dispatchCommand(['LocalFunction', 'list'], runtime, true);
    expect(locals.data).toMatchObject({ command: 'LocalFunction.list', count: 1 });
    const workflow = await dispatchCommand(['PageWorkflow', 'detail', '--fqn', 'Test.PageWorkflow.Run'], runtime, true);
    expect(workflow.data).toMatchObject({ kind: 'PageWorkflow', resource: { fqn: 'Test.PageWorkflow.Run' } });
    const pageObject = await dispatchCommand(['PageObject', 'detail', '--fqn', 'Test.PageObject.Hello'], runtime, true);
    expect(pageObject.data).toMatchObject({ resource: { actions: [{ fqn: 'Test.PageObject.Hello.read' }] } });
    expect((await dispatchCommand(['Resource', 'validate'], runtime, true)).code).toBe(0);
    const tree = await dispatchCommand(['Resource', 'tree'], runtime, true);
    const treePayload = buildOutputPayload(tree);
    expect(treePayload.ok).toBe(true);
    expect(treePayload.command).toBe('Resource.tree');
    expect(treePayload.readerProfileId).toBe('cli-host/resource-readers/v1');
    expect(treePayload.contractLock).toMatchObject({
      lockDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    if (!Array.isArray(treePayload.packages)) throw new Error('Resource.tree packages must be an array');
    const treeResources = treePayload.packages
      .flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || !('resources' in entry)) return [];
        return Array.isArray(entry.resources) ? entry.resources : [];
      });
    const resourceKinds = treeResources.map((resource) => resource && typeof resource === 'object'
      && 'kind' in resource ? resource.kind : undefined);
    expect(resourceKinds).not.toContain('SkillApp');
    expect(resourceKinds).not.toContain('LocalFunctionBundle');
    expect(resourceKinds).not.toContain('PageWorkflowBundle');
    expect(resourceKinds).not.toContain('PageObjectBundle');
    const resolvedPage = treeResources
      .find((resource) => resource && typeof resource === 'object'
        && 'fqn' in resource && resource.fqn === 'Test.Page.Hello');
    expect(resolvedPage).toMatchObject({
      kind: 'Page',
      fqn: 'Test.Page.Hello',
      resolution: {
        readerProfileId: 'cli-host/resource-readers/v1',
        source: {
          envelopeVersion: 'halfcode.resource-envelope/v1',
          specVersion: 1,
          contractFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        },
        reader: {
          readerId: 'cli-host.Page.reader/v1',
          readerSpecVersion: 1,
          implementationFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        },
        sourceContentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        effectiveContentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      },
    });
  }, 15_000);
});
