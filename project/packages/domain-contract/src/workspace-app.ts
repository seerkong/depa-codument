import type { CodumentResourceKind } from './resources';
import type { DomainValidationFinding, DomainValidationSnapshot } from './validation';
import type { WorkspaceResourceSnapshot } from 'halfcode-cli-lite-skill-app-contract/catalog';

/** Product membership policy. Host mechanics know neither this path nor these Kinds. */
export const CODUMENT_APP_DIRECTORY = 'codument' as const;
export interface CodumentAppCatalog {
  readonly id: string;
  readonly kind: CodumentResourceKind;
  /** Relative to the one formal App, never to Host private state. */
  readonly root: string;
  readonly shape: 'single-file' | 'directory';
  readonly entry?: string;
  readonly recursive: boolean;
}
export const CODUMENT_APP_CATALOGS: readonly CodumentAppCatalog[] = Object.freeze([
  ...(['Track', 'Mission'] as const).flatMap(kind => (['pending', 'active', 'archived'] as const).map(stage => ({
    id: `${stage}_${kind.toLowerCase()}s`, kind, root: `${kind.toLowerCase()}s/${stage}`,
    shape: 'directory' as const, entry: `${kind.toLowerCase()}.xnl`, recursive: true,
  }))),
  ...([
    ['decisions', 'decision'],
  ] as const).map(([root, kind]) => ({ id: root, kind, root, shape: 'single-file' as const, recursive: true })),
  ...([
    ['operation_hooks', 'OperationHooks', 'operation-hooks.xnl'], ['attractor_profiles', 'AttractorProfiles', 'attractor-profiles.xnl'],
  ] as const).map(([id, kind, entry]) => ({ id, kind, root: 'config', shape: 'single-file' as const, entry, recursive: false })),
].map(value => Object.freeze(value)));

export const CODUMENT_APP_DIRECTORIES: readonly string[] = Object.freeze([...new Set([
  ...CODUMENT_APP_CATALOGS.map(catalog => catalog.root), 'attractors', 'backlog', 'analysis', 'sop',
  'memory/lessons', 'memory/incidents', 'memory/patterns', 'memory/summaries',
])]);

export interface WorkspaceAppAuthority {
  readonly file: string;
  readonly kind: CodumentResourceKind;
  readonly source: string;
  readonly digest: string;
  /** An owner-local semantic input, not an independent Catalog resource. */
  readonly ownerFile?: string;
}
export interface WorkspaceAppSourceSnapshot {
  readonly manifestDigest: string;
  readonly skillSource: string;
  readonly authorities: readonly WorkspaceAppAuthority[];
  readonly lifecycle: DomainValidationSnapshot;
  readonly decisions: ReadonlyMap<string, string>;
  readonly findings: readonly DomainValidationFinding[];
}
export interface WorkspaceAppSourcePort { observe(): Promise<WorkspaceAppSourceSnapshot> }
export interface WorkspaceAppInspection {
  readonly ready: boolean;
  readonly appId?: string;
  readonly memberFiles: readonly string[];
  readonly ownedFiles: readonly string[];
  readonly findings: readonly DomainValidationFinding[];
}
export interface WorkspaceAppInspectionInput {
  readonly before: WorkspaceAppSourceSnapshot;
  readonly after: WorkspaceAppSourceSnapshot;
  readonly catalog: WorkspaceResourceSnapshot;
}
