import * as path from 'node:path';

export type ProductProfileId = 'current' | 'legacy';
export interface ProductProfile {
  readonly id: ProductProfileId;
  readonly command: 'depa-codument' | 'codument';
  readonly rejectedCommand: 'codument' | 'depa-codument';
}
const profiles: Readonly<Record<ProductProfileId, ProductProfile>> = Object.freeze({
  current: Object.freeze({id:'current',command:'depa-codument',rejectedCommand:'codument'}),
  legacy: Object.freeze({id:'legacy',command:'codument',rejectedCommand:'depa-codument'}),
});
export function productProfile(id: string = 'current'): ProductProfile {
  if (!(id === 'current' || id === 'legacy')) throw new Error(`Unknown E2E product profile: ${id}`);
  return profiles[id];
}
export function productGuidance(profile: ProductProfile, workspace: string): string {
  if (profile.id === 'current') return 'Use the installed global depa-codument Skill. Discover current operations through depa-codument commands; do not use the legacy codument binary or old per-operation Skill folders.';
  return `This is the pre-refactor Codument baseline. Use only the run-local codument CLI and each repository's installed codument-* Skills under its .agents/skills (workspace root: ${workspace}). Read codument/std/AGENTS.md, then the matching codument-plan-track / codument-impl-track / codument-plan-mission / codument-impl-mission Skills. Bare operation names in the common benchmark prompt mean those old Skills, not nonexistent top-level commands. Any current-product routing paragraph in acceptance.md is overridden ONLY for tool/Skill routing: use codument project bind, never depa-codument or a current/global Skill. All business requirements, interface contracts, hooks and independent acceptance remain unchanged. The historical full-suite Modeling and Engineering preset is enabled; create the required knowledge through that version's workflow, not a new-format substitute. Do not upgrade this workspace or install another product.`;
}

/** Installation layout is version-owned; business acceptance is not. */
export function installedSkillRoot(profile: ProductProfile, workspace: string, currentRoot: string): string {
  return profile.id === 'legacy' ? path.join(workspace,'.agents/skills') : currentRoot;
}
