/** Product-owned historical aliases; canonical content remains owned by the global App. */
const movedStandards = [
  ['skill/docs-modeling-fractal/index.md', 'methods/modeling-fractal.md'],
  ['skill/docs-engineering-fractal/index.md', 'methods/engineering-fractal.md'],
  ['operations/_operation-spec.md', 'protocols/operation-authoring.md'],
] as const;

export const CODUMENT_GLOBAL_REFERENCE_RELOCATIONS = Object.freeze(Object.fromEntries(
  ['vfs://@/codument/std/', 'skill://depa-codument/std/', 'skill://depa-codument/references/std/']
    .flatMap(prefix => movedStandards.map(([oldPath,newPath]) => [prefix+oldPath,'skill://depa-codument/references/std/'+newPath])),
));

export function relocateGlobalStandardReferences(source: string): string {
  for (const [oldRef,newRef] of Object.entries(CODUMENT_GLOBAL_REFERENCE_RELOCATIONS)) source = source.replaceAll(oldRef,newRef);
  return source;
}
