import { defineLocalFunction } from '../src/host';
import { defineSite } from '../src/site';
import { pageRoute } from '../src/vue';
import {
  createKindSpecRevision,
  createKindSubjectOwner,
  defineResourceContractRegistrations,
  digestCanonical,
} from '../src/resource';

const schema = { type: 'object' } as const;

defineLocalFunction({
  fqn: 'Test.Typed.LocalFunction.Good', operation: 'query',
  inputSchema: schema, configSchema: schema, outputSchema: schema,
  handler: (_runtime, input) => input,
});

// @ts-expect-error operation is a closed union
defineLocalFunction({ fqn: 'Test.Typed.LocalFunction.Bad', operation: 'mutation', inputSchema: schema, configSchema: schema, outputSchema: schema, handler: () => null });

defineSite({
  fqn: 'Test.Typed.Site.Main', name: 'main', description: 'Main', defaultMount: 'home',
  entry: './src/main.ts', expose: './site', lifecycle: { mount: 'install', unmount: 'dispose' }, mounts: [],
});

// @ts-expect-error Page metadata requires a dotted FQN field at compile time
pageRoute({ path: '/', component: './Home.vue', page: { name: 'home', title: 'Home' } });

const semanticContract = {
  semanticValidatorFingerprint: digestCanonical('validator'),
  referenceProjectionFingerprint: digestCanonical('projection'),
  compilerInputFingerprint: digestCanonical('compiler-input'),
} as const;
const owner = createKindSubjectOwner({
  kind: 'Example', subjectFqn: 'Halfcode.ResourceKind.Example',
  ownerPackageId: 'example', ownerPackageFingerprint: digestCanonical('example'),
  sourceShapes: ['single-file'],
});
const revision = createKindSpecRevision({
  kind: owner.kind, subjectFqn: owner.subjectFqn, specVersion: 1,
  specSchema: schema, semanticContract,
  sourceContractFingerprint: owner.sourceContract.sourceContractFingerprint,
  stability: 'stable',
});
defineResourceContractRegistrations({
  owners: [owner],
  revisions: [revision],
  readers: [{
    readerId: 'example.reader/v1', subjectFqn: revision.subjectFqn, readerSpecVersion: 1,
    contractFingerprint: revision.contractFingerprint,
    readerImplementationFingerprint: digestCanonical('example.reader/v1'),
    compatibilityPolicy: 'exact', read: (spec) => spec,
  }],
});
