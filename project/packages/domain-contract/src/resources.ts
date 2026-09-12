import {
  createKindSubjectOwner, createKindSpecRevision, defineResourceContractRegistrations, digestCanonical,
  type JsonSchema, type PortableSpec,
} from 'halfcode-cli-lite-skill-app-contract/resource';
import { LIFECYCLE_ROOT_STATES } from './lifecycle';
import { KNOWLEDGE_RESOURCE_KINDS, MODELING_SCHEMAS, type KnowledgeResourceProjection } from './knowledge';

const ORIGINAL_RESOURCE_KINDS = Object.freeze([
  'AttractorProfiles', 'Behavior', 'BehaviorPatch', 'decision', 'EngineeringConfig',
  'Mission', 'ModelingConfig', 'OperationHooks', 'Track',
] as const);
export const CODUMENT_RESOURCE_KINDS = Object.freeze([...ORIGINAL_RESOURCE_KINDS, ...KNOWLEDGE_RESOURCE_KINDS]);
export type CodumentResourceKind = typeof CODUMENT_RESOURCE_KINDS[number];

export interface CodumentResourceView {
  readonly kind: CodumentResourceKind;
  /** Structural admission is not full cross-resource domain validation. */
  readonly validationLevel: 'structural';
  readonly spec: PortableSpec;
  readonly knowledge?: KnowledgeResourceProjection;
}

const OWNER = 'depa-codument-domain-contract';
const AUTHORITY = `${OWNER}/structural-contracts/v1`;
const status = (values: readonly string[]): JsonSchema => ({ type: 'string', enum: [...values] });
const common: Record<string, JsonSchema> = {
  gap_round: { type: 'integer', minimum: 0 }, revision: { type: 'integer', minimum: 0 },
  goal: { type: 'string' }, description: { type: 'string' }, created_at: { type: 'string' }, updated_at: { type: 'string' },
};

function schemaFor(kind: CodumentResourceKind): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  if (kind === 'Track' || kind === 'Mission') {
    Object.assign(properties, common);
    properties.status = status(LIFECYCLE_ROOT_STATES[kind === 'Track' ? 'track' : 'mission']);
    required.push('status');
  }
  if (kind === 'EngineeringConfig' || kind === 'ModelingConfig') properties.enabled = { type: 'boolean' };
  if (kind === 'ModelingRegistry') {
    properties.modeling_schema = status(MODELING_SCHEMAS);
    required.push('modeling_schema');
  }
  return {
    type: 'object', required: ['properties', 'body', 'subdomains'],
    properties: {
      // Extension values remain portable and intact. Full business validators
      // are a separate gate, not an excuse to strip fields at structural read.
      properties: { type: 'object', properties, required, additionalProperties: true },
      body: { type: 'array' }, subdomains: { type: 'object' }, text: { type: 'string' },
    },
    additionalProperties: false,
  };
}

/** Draft during the migration: do not label this as full semantic admission. */
export const CODUMENT_KIND_CONTRACTS = Object.freeze(CODUMENT_RESOURCE_KINDS.map((kind) => {
  const directory = kind === 'Track' || kind === 'Mission';
  const owner = createKindSubjectOwner({
    kind, subjectFqn: `codument.resource_kind.${kind}`, ownerPackageId: OWNER,
    // Adding a sibling Kind must not change the nine already admitted subjects.
    ownerPackageFingerprint: digestCanonical({ authority: AUTHORITY, kinds: (ORIGINAL_RESOURCE_KINDS as readonly string[]).includes(kind) ? ORIGINAL_RESOURCE_KINDS : [kind] }),
    sourceShapes: directory ? ['directory'] : ['single-file'],
    documentCardinality: kind === 'decision' ? 'many' : 'one',
    requiredFiles: directory ? ['proposal.md', 'design.md'] : [],
  });
  const specSchema = schemaFor(kind);
  const revision = createKindSpecRevision({
    kind, subjectFqn: owner.subjectFqn, specVersion: 1, specSchema,
    sourceContractFingerprint: owner.sourceContract.sourceContractFingerprint,
    semanticContract: {
      semanticValidatorFingerprint: digestCanonical({ authority: AUTHORITY, kind, specSchema, level: 'structural-only' }),
      referenceProjectionFingerprint: digestCanonical({ authority: AUTHORITY, kind, model: 'portable-tree-preserved' }),
      compilerInputFingerprint: digestCanonical({ authority: AUTHORITY, fields: ['properties', 'body', 'subdomains', 'text?'] }),
    },
    stability: 'experimental',
  });
  return Object.freeze({ kind, owner, revision });
}));

export const CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS = defineResourceContractRegistrations({
  owners: CODUMENT_KIND_CONTRACTS.map(({ owner }) => owner),
  revisions: CODUMENT_KIND_CONTRACTS.map(({ revision }) => revision),
});
