import { describe, expect, test } from 'bun:test';
import {
  defineBrowserWebApi,
  defineHostModule,
  defineLocalFunction,
  definePageObject,
  definePageWorkflow,
} from '../src/host';
import { defineSkillApp, defineSkillModule } from '../src/app';
import { defineSite, pageRef } from '../src/site';
import { defineVuePageBundle, pageRoute } from '../src/vue';
import {
  createSkillAppKindContractDescriptors,
  createKindSpecRevision,
  createKindSubjectOwner,
  defineResourceContractRegistrations,
  digestCanonical,
  renderSkillAppKindDefinition,
  SKILL_APP_KIND_CONTRACT_DESCRIPTORS,
  skillAppKindContract,
} from '../src/resource';

const schema = Object.freeze({ type: 'object', additionalProperties: false });

describe('skill app contract', () => {
  test('creates portable authoring descriptors without a runtime-private brand', () => {
    const local = defineLocalFunction({
      fqn: 'Test.CodeFirst.LocalFunction.Echo',
      operation: 'query',
      inputSchema: schema,
      configSchema: schema,
      outputSchema: schema,
      handler: (_runtime, input) => input,
    });
    const browser = defineBrowserWebApi({
      fqn: 'Test.CodeFirst.BrowserWebApi.Public', endpointKey: 'public',
      inputSchema: schema, outputSchema: schema, handler: (_runtime, input) => input,
    });
    const workflow = definePageWorkflow({
      fqn: 'Test.CodeFirst.PageWorkflow.Open', inputSchema: schema, outputSchema: schema,
      selectionPolicy: { kind: 'external-page', urlPattern: '^https://example\\.test', cardinality: 'exactly-one' },
      defaultSelector: { direct: { byExternalPage: {} } }, start: (_runtime, _selector, invocation) => invocation.payload,
    });
    const pageObject = definePageObject({
      fqn: 'Test.CodeFirst.PageObject.Page',
      selectionPolicy: { kind: 'served-page', pageName: 'page', cardinality: 'exactly-one' },
      actions: [{ fqn: 'Test.CodeFirst.PageObject.Page.Read', inputSchema: schema, outputSchema: schema, handler: () => ({}) }],
    });
    const module = defineHostModule({ resources: [local, browser, workflow, pageObject] });

    expect(module.protocolVersion).toBe('2');
    expect(module.resources.map((item) => item.kind)).toEqual(['LocalFunction', 'BrowserWebApi', 'PageWorkflow', 'PageObject']);
    expect(Reflect.ownKeys(local).every((key) => typeof key === 'string')).toBe(true);
    expect(Object.isFrozen(module)).toBe(true);
    expect(Object.isFrozen(module.resources)).toBe(true);
  });

  test('defines app, site, and explicit page route descriptors', () => {
    const pages = defineVuePageBundle({
      fqn: 'Test.CodeFirst.PageBundle.Flow', name: 'flow', entry: './src/main.ts', expose: './app',
      routes: [
        pageRoute({ path: '/', component: './views/Home.vue', page: { fqn: 'Test.CodeFirst.Page.Home', name: 'home', title: 'Home' } }),
        { path: '/old', redirect: '/' },
      ],
    });
    const site = defineSite({
      fqn: 'Test.CodeFirst.Site.Main', name: 'main', description: 'Main', defaultMount: 'home',
      entry: './src/main.ts', expose: './site', lifecycle: { mount: 'install', unmount: 'dispose' },
      mounts: [{ id: 'home', path: '/', page: pageRef('Test.CodeFirst.Page.Home'), label: 'Home' }],
    });
    const skillModule = defineSkillModule({
      fqn: 'Test.CodeFirst.Module.Basic',
      host: 'Test.CodeFirst.Module.Basic.Host',
      resources: ['Test.CodeFirst.Page.Basic'],
    });
    const app = defineSkillApp({
      fqn: 'Test.CodeFirst.SkillApp.Main', name: 'code-first',
      modules: ['./modules/basic'], pageBundles: ['./PageBundle/flow'], sites: ['./Site/main'],
    });

    expect(pages.routes[0]).toMatchObject({ kind: 'page', path: '/', page: { name: 'home' } });
    expect(pages.routes[1]).toEqual({ kind: 'redirect', path: '/old', redirect: '/' });
    expect(site.mounts[0].page.fqn).toBe('Test.CodeFirst.Page.Home');
    expect(skillModule.protocolVersion).toBe('2');
    expect(Object.isFrozen(skillModule.resources)).toBe(true);
    expect(app.protocolVersion).toBe('2');
  });

  test('forwards compiler contract authority and only freezes portable registrations', () => {
    const semanticContract = Object.freeze({
      semanticValidatorFingerprint: digestCanonical('validator'),
      referenceProjectionFingerprint: digestCanonical('projection'),
      compilerInputFingerprint: digestCanonical('compiler-input'),
    });
    const owner = createKindSubjectOwner({
      kind: 'Example',
      subjectFqn: 'Halfcode.ResourceKind.Example',
      ownerPackageId: 'example-owner',
      ownerPackageFingerprint: digestCanonical('example-owner'),
      sourceShapes: ['single-file'],
    });
    const revision = createKindSpecRevision({
      kind: owner.kind,
      subjectFqn: owner.subjectFqn,
      specVersion: 1,
      specSchema: schema,
      semanticContract,
      sourceContractFingerprint: owner.sourceContract.sourceContractFingerprint,
      stability: 'stable',
    });
    const registrations = defineResourceContractRegistrations({
      owners: [owner],
      revisions: [revision],
      readers: [{
        readerId: 'example.reader/v1',
        subjectFqn: revision.subjectFqn,
        readerSpecVersion: 1,
        contractFingerprint: revision.contractFingerprint,
        readerImplementationFingerprint: digestCanonical('example-reader'),
        compatibilityPolicy: 'exact',
        read: (spec) => spec,
      }],
    });

    expect(registrations.revisions[0]).toBe(revision);
    expect(revision.schemaFingerprint).toBe(digestCanonical(schema));
    expect(Object.isFrozen(registrations)).toBe(true);
    expect(Object.isFrozen(registrations.readers)).toBe(true);
    expect('registerOwner' in registrations).toBe(false);
  });

  test('publishes exact code-owned source and revision contracts for app-facing Kinds', () => {
    const pageBundle = skillAppKindContract('PageBundle');
    const configBinding = skillAppKindContract('ConfigBinding');

    expect(pageBundle.sourceShapes).toEqual(['directory']);
    expect(pageBundle.documentCardinality).toBe('one');
    expect(pageBundle.requiredFiles).toEqual([]);
    expect(pageBundle.revision.sourceContractFingerprint).toBe(pageBundle.sourceContractFingerprint);
    expect(configBinding.sourceShapes).toEqual(['single-file']);
    expect(configBinding.revision.contractFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.isFrozen(pageBundle.owner.sourceContract)).toBe(true);
  });

  test('regenerates exact KindDefinition sources for a cloned package authority', () => {
    const defaultDescriptors = createSkillAppKindContractDescriptors({
      ownerPackageId: 'depa-codument-skill-app-contract',
      contractAuthority: 'depa-codument-skill-app-contract/resource-contracts/v1',
    });
    expect(defaultDescriptors).toEqual(SKILL_APP_KIND_CONTRACT_DESCRIPTORS);
    const defaultPage = defaultDescriptors.find((descriptor) => descriptor.kind === 'Page');
    expect(defaultPage).toBeDefined();
    // Authority is clone-specific: check exact canonical descriptors, not the
    // original template's digest (which must change when package identity does).
    expect(defaultPage).toEqual(skillAppKindContract('Page'));
    expect(renderSkillAppKindDefinition(defaultPage!)).toContain(
      `contractFingerprint = "${skillAppKindContract('Page').revision.contractFingerprint}"`,
    );

    const clonedDescriptors = createSkillAppKindContractDescriptors({
      ownerPackageId: '@example-ai-cli/skill-app-contract',
      contractAuthority: '@example-ai-cli/skill-app-contract/resource-contracts/v1',
    });
    const clonedPage = clonedDescriptors.find((descriptor) => descriptor.kind === 'Page');
    expect(clonedPage).toBeDefined();
    expect(clonedPage?.subjectFqn).toBe('Halfcode.ResourceKind.Page');
    expect(clonedPage?.ownerPackageId).toBe('@example-ai-cli/skill-app-contract');
    expect(clonedPage?.ownerPackageFingerprint).not.toBe(defaultPage?.ownerPackageFingerprint);
    expect(clonedPage?.revision.contractFingerprint).not.toBe(defaultPage?.revision.contractFingerprint);
    const source = renderSkillAppKindDefinition(clonedPage!);
    expect(source).toContain(`contractFingerprint = "${clonedPage?.revision.contractFingerprint}"`);
    expect(source).not.toContain(defaultPage?.revision.contractFingerprint ?? 'missing-default-fingerprint');
    expect(() => renderSkillAppKindDefinition(clonedDescriptors.find((descriptor) => descriptor.kind === 'ConfigBinding')!))
      .toThrow('SKILL_APP_KIND_DEFINITION_UNSUPPORTED');
  });
});
