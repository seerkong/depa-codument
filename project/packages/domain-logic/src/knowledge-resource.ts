import { MODELING_SCHEMAS, type KnowledgeResourceKind, type KnowledgeResourceMember, type KnowledgeResourceProjection } from 'depa-codument-domain-contract';
import type { PortableSpec } from 'halfcode-cli-lite-skill-app-contract/resource';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function identifier(node: Record<string, unknown>): string | undefined {
  const value = node.resourceId ?? (object(node.properties) ? node.properties.id : undefined) ?? (object(node.metadata) ? node.metadata.id : undefined);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function profile(value: unknown): void {
  if (!(MODELING_SCHEMAS as readonly unknown[]).includes(value)) throw new Error('Unknown or missing modeling_schema; migration or review is required.');
}

/** Read a compiler-normalized owner without inventing separate resource identities.
 * The caller retains the enclosing catalog record/receipt and its source digest. */
export function readKnowledgeResource(kind: KnowledgeResourceKind, spec: PortableSpec): KnowledgeResourceProjection {
  if (!object(spec.properties) || !Array.isArray(spec.body) || !object(spec.subdomains)) throw new Error('Knowledge resource requires the canonical portable container.');
  if (kind === 'ModelingRegistry') profile(spec.properties.modeling_schema);
  const members: KnowledgeResourceMember[] = [];
  const ids = new Set<string>();
  function visit(value: unknown, path: readonly (string | number)[], ancestorIds: readonly string[] = [], required = false): void {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, [...path, index], ancestorIds)); return; }
    if (!object(value)) {
      if (required) throw new Error('Knowledge owner body must contain knowledge nodes.');
      return;
    }
    const isNode = typeof value.tag === 'string' && object(value.properties) && object(value.metadata) && Array.isArray(value.body) && object(value.subdomains);
    let nextAncestors = ancestorIds;
    if (isNode) {
      const id = identifier(value);
      const properties = value.properties as Record<string, unknown>;
      const metadata = value.metadata as Record<string, unknown>;
      const selected = required || id !== undefined || properties.kind !== undefined || metadata.kind !== undefined;
      if (selected) {
        if (!id) throw new Error('Knowledge node identity is missing.');
        if (ids.has(id)) throw new Error(`Duplicate knowledge node id '${id}'.`);
        ids.add(id);
        if (kind === 'ModelingRegistry') {
          const override = properties.modeling_schema ?? metadata.modeling_schema;
          if (override !== undefined) profile(override);
        }
        const references = new Set<string>();
        function collect(item: unknown): void {
          if (typeof item === 'string' && /^(modeling|engineering|behavior|decision):\/\//.test(item)) references.add(item);
          else if (Array.isArray(item)) item.forEach(collect);
          else if (object(item)) Object.values(item).forEach(collect);
        }
        collect(properties); collect(metadata);
        members.push({ id, tag: value.tag as string, parentId: ancestorIds.at(-1), ancestorIds: [...ancestorIds], references: [...references], path: [...path], node: value });
        nextAncestors = [...ancestorIds, id];
      }
    } else if (required) throw new Error('Knowledge owner body must contain knowledge nodes.');
    for (const [key, child] of Object.entries(value)) {
      if (isNode && ['tag', 'resourceId', 'text'].includes(key)) continue;
      visit(child, [...path, key], nextAncestors);
    }
  }
  spec.body.forEach((node, index) => visit(node, ['body', index], [], true));
  for (const [key, value] of Object.entries(spec.subdomains)) visit(value, ['subdomains', key]);
  return { members };
}
