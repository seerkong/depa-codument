import { parseXnl, stringifyLineBlock, wordToString, XnlParseError, type DataElementNode, type ElementNode, type XnlNode, type XnlWord } from 'xnl-core';
import type {
  RegistryIndexBindings, RegistryIndexIssue, RegistryIndexSpec, RegistryNodePathSegment,
  RegistryTraversalContext, XnlRegistryIndex, XnlRegistryNodeRef,
} from 'depa-codument-domain-contract/registry';

/** Index explicit source snapshots without discovering files or changing cwd. */
export function indexXnlRegistry(
  input: ReadonlyMap<string, string>, spec: RegistryIndexSpec, bindings: RegistryIndexBindings = {},
): XnlRegistryIndex {
  const sources = new Map([...input].sort(([a], [b]) => comparePortablePaths(a, b)));
  const files = new Map<string, XnlNode[]>();
  const state: MutableLoadState = {
    registry: { index: new Map() }, issues: [], spec,
    bindings: { ...bindings, readId: bindings.readId ?? readStableNodeId },
  };
  for (const [file, content] of sources) {
    if (!file || file.startsWith('/') || file.includes('\\') || /^[A-Za-z]:/.test(file)
      || file.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Registry source requires a portable relative file path.');
    let nodes: XnlNode[];
    try {
      const parsed = parseXnl(content, { textBlockStyle: true });
      if (parsed.warnings?.length) {
        state.issues.push(...parsed.warnings.map((warning) => ({kind: 'duplicate-slot' as const, file, message: warning.message})));
        // A unique-slot collision has already lost one child in the parsed tree.
        // Retain the source, but never publish that partial tree as writable.
        continue;
      }
      nodes = parsed.nodes;
    } catch (error) {
      if (!(error instanceof XnlParseError)) throw error;
      state.issues.push({kind: 'syntax', file, line: error.line, message: error.message});
      continue;
    }
    files.set(file, nodes);
    for (let topLevelIndex = 0; topLevelIndex < nodes.length; topLevelIndex++) {
      visitValue(nodes[topLevelIndex], {
        file, owner: { file, topLevelIndex }, ancestors: [],
        path: [{kind: 'root', index: topLevelIndex}],
      }, state);
    }
  }
  return { sources, files, index: state.registry.index, issues: state.issues, ready: state.issues.length === 0 };
}

export function requireReadyRegistry(registry: XnlRegistryIndex): XnlRegistryIndex {
  if (!registry.ready) throw new Error(registry.issues.map((issue) => issue.message).join('; '));
  return registry;
}

/** Format the supplied AST, including any explicit Comment nodes. xnl-core's
 * parser omits source comments; this is not a source-preserving patch writer.
 * Explicit marker bindings prevent hidden time/random effects. */
export function serializeXnlForest(
  nodes: readonly XnlNode[],
  bindings: { textMarkerFactory: () => string },
  options: { textBlockStyle?: boolean; indent?: number | string } = {},
): string {
  return nodes.map((node) => stringifyLineBlock(node, { textBlockStyle: true, ...options, textMarkerFactory: bindings.textMarkerFactory })).join('\n\n') + '\n';
}

function comparePortablePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isDataElement(node: XnlNode | undefined): node is DataElementNode {
  return Boolean(
    node
    && typeof node === 'object'
    && !Array.isArray(node)
    && (node as DataElementNode).kind === 'DataElement',
  );
}

function valueAsStableId(value: XnlNode | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as XnlWord).kind === 'Word'
  ) {
    return wordToString(value as XnlWord);
  }
  return undefined;
}

/** Read stable identity from `#word`, `attributes.id`, or `metadata.id`. */
export function readStableNodeId(node: DataElementNode): string | undefined {
  return wordToString(node.id)
    ?? valueAsStableId(node.attributes?.id)
    ?? valueAsStableId(node.metadata?.id);
}

interface MutableLoadState {
  registry: { index: Map<string, XnlRegistryNodeRef> };
  issues: RegistryIndexIssue[];
  spec: RegistryIndexSpec;
  bindings: RegistryIndexBindings & { readId: (node: DataElementNode) => string | undefined };
}

function reportIssue(state: MutableLoadState, issue: RegistryIndexIssue): void {
  state.issues.push(issue);
}

function orderedExtendKeys(node: DataElementNode): string[] {
  if (!node.extend) return [];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of node.extend.order ?? []) {
    if (node.extend.children[key] && !seen.has(key)) {
      keys.push(key);
      seen.add(key);
    }
  }
  const remaining = Object.keys(node.extend.children)
    .filter((key) => !seen.has(key))
    .sort(comparePortablePaths);
  return [...keys, ...remaining];
}

/**
 * Return direct element children in XNL structural order: singleton slots from
 * `()` first, followed by collection/legacy children from `[]`.
 */
export function orderedElementChildren(node: DataElementNode): ElementNode[] {
  const children = orderedExtendKeys(node)
    .map((key) => node.extend?.children[key])
    .filter((child): child is ElementNode => child !== undefined);
  for (const child of node.body ?? []) {
    if (
      child
      && typeof child === 'object'
      && !Array.isArray(child)
      && ((child as ElementNode).kind === 'DataElement' || (child as ElementNode).kind === 'TextElement')
    ) {
      children.push(child as ElementNode);
    }
  }
  return children;
}

function childContext(
  context: RegistryTraversalContext,
  node: DataElementNode,
  segment: RegistryNodePathSegment,
): RegistryTraversalContext {
  return {
    ...context,
    ancestors: [
      ...context.ancestors,
      { tag: node.tag, id: readStableNodeId(node), node },
    ],
    path: [...context.path, segment],
  };
}

function visitValue(
  value: XnlNode,
  context: RegistryTraversalContext,
  state: MutableLoadState,
): void {
  if (isDataElement(value)) {
    const id = state.bindings.readId(value);
    const selected = state.bindings.shouldIndex
      ? state.bindings.shouldIndex(value, context)
      : Boolean(id);

    if (selected && !id) {
      reportIssue(state, {
        kind: 'missing-id',
        file: context.file,
        nodeTag: value.tag,
        path: context.path,
        message: `Missing ${state.spec.registryName} node id for <${value.tag}> in '${context.file}'`,
      });
    } else if (selected && id) {
      const existing = state.registry.index.get(id);
      if (existing) {
        reportIssue(state, {
          kind: 'duplicate-id',
          file: context.file,
          otherFile: existing.file,
          id,
          nodeTag: value.tag,
          path: context.path,
          message:
            `Duplicate ${state.spec.registryName} node id '${id}'`
            + ` in '${context.file}' and '${existing.file}'`,
        });
      } else {
        const parent = context.ancestors.at(-1);
        state.registry.index.set(id, {
          id,
          node: value,
          file: context.file,
          owner: context.owner,
          ancestors: context.ancestors,
          parent: parent ? { tag: parent.tag, id: parent.id } : undefined,
          path: context.path,
          uri: state.bindings.uriFor?.(context.file, id, value),
        });
      }
    }

    for (let index = 0; index < (value.body?.length ?? 0); index += 1) {
      visitValue(
        value.body![index],
        childContext(context, value, { kind: 'body', index }),
        state,
      );
    }
    for (const key of orderedExtendKeys(value)) {
      visitValue(
        value.extend!.children[key],
        childContext(context, value, { kind: 'extend', key }),
        state,
      );
    }
    for (const key of Object.keys(value.attributes ?? {}).sort(comparePortablePaths)) {
      visitValue(
        value.attributes![key],
        childContext(context, value, { kind: 'attributes', key }),
        state,
      );
    }
    for (const key of Object.keys(value.metadata ?? {}).sort(comparePortablePaths)) {
      visitValue(
        value.metadata[key],
        childContext(context, value, { kind: 'metadata', key }),
        state,
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      visitValue(value[index], { ...context, path: [...context.path, { kind: 'array', index }] }, state);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort(comparePortablePaths)) {
      visitValue(
        (value as Record<string, XnlNode>)[key],
        { ...context, path: [...context.path, { kind: 'object', key }] },
        state,
      );
    }
  }
}

