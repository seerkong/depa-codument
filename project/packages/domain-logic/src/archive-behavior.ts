import {MakeWord, parseXnl, wordToString, type DataElementNode, type ElementNode, type XnlNode} from 'xnl-core';
import {isDataElement} from './registry';
import {children, attr, id} from './validation-tree';
import {proposeBehaviorMutation, validateBehaviorTree} from './behavior';
import {patchDataTreeSource} from './source-patch';

interface Selector {capability: string; pairs: {tag: string; id: string}[]}
interface Entry {file: string; source: string; before: DataElementNode; root: DataElementNode; created: boolean}
interface Slot {node: ElementNode; replace(node: ElementNode): void; remove(): void}
const collections: Readonly<Record<string, string>> = {Requirement: 'Requirements', Suite: 'Suites', Case: 'Cases', And: 'Ands'};

/** Compose ordered BehaviorPatch operations directly on complete native trees.
 * There is no XML DTO, filesystem discovery, publication or partial commit. */
export function proposeArchiveBehaviors(input: {
  readonly canonicalSources: ReadonlyMap<string, string>;
  readonly patchSources: ReadonlyMap<string, string>;
}): {readonly updates: ReadonlyMap<string, string>; readonly capabilities: readonly string[]} {
  if (!input.patchSources.size) return {updates: new Map(), capabilities: []};
  const entries = new Map<string, Entry>();
  for (const [file, source] of input.canonicalSources) {
    visiblePath(file);
    const before = readRoot(source, 'Behavior');
    const capability = wordToString(before.id)!;
    if (entries.has(capability)) throw new Error(`Behavior capability '${capability}' has multiple source owners.`);
    entries.set(capability, {file, source, before, root: structuredClone(before), created: false});
  }
  function entry(capability: string, create: boolean): Entry {
    const existing = entries.get(capability);
    if (existing) return existing;
    if (!create) throw new Error(`Behavior registry entry not found for capability: ${capability}`);
    const file = `${capability}.xnl`;
    if (input.canonicalSources.has(file)) throw new Error(`Behavior owner path '${file}' is already occupied.`);
    const source = `<Behavior #${capability} envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Requirements []>)>\n`;
    const before = readRoot(source, 'Behavior');
    const created = {file, source, before, root: structuredClone(before), created: true};
    entries.set(capability, created);
    return created;
  }
  const touched = new Set<string>();
  for (const [file, source] of [...input.patchSources].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    visiblePath(file);
    const patch = readRoot(source, 'BehaviorPatch');
    const findings = validateBehaviorTree(patch, file);
    if (findings.length) throw new Error(findings.map(finding => `${file}: ${finding.message}`).join('\n'));
    const collection = children(patch).filter(node => node.tag === 'Mutations');
    if (collection.length !== 1 || !isDataElement(collection[0])) throw new Error('BehaviorPatch requires one Mutations collection.');
    for (const operation of collection[0].body ?? []) {
      if (!isDataElement(operation)) throw new Error('BehaviorPatch operations must be data elements.');
      const selector = parseSelector(attr(operation, 'selector') ?? '');
      if (!selector.pairs.length) throw new Error('Cannot mutate the Behavior capability root.');
      if (operation.tag === 'Upsert') {
        const payloads = operation.extend?.order.map(key => operation.extend!.children[key]) ?? [];
        if (payloads.length !== 1) throw new Error('Behavior Upsert requires exactly one target payload.');
        upsert(entry(selector.capability, true).root, selector, structuredClone(payloads[0]));
        touched.add(selector.capability);
      } else if (operation.tag === 'Delete') {
        find(entry(selector.capability, false).root, selector).remove();
        touched.add(selector.capability);
      } else if (operation.tag === 'Move') {
        const destination = parseSelector(attr(operation, 'to') ?? '');
        if (!destination.pairs.length) throw new Error('Cannot move onto a Behavior capability root.');
        if (selector.capability === destination.capability && isDescendant(selector, destination)) throw new Error('Cannot move a Behavior subject into its own descendant.');
        const selected = find(entry(selector.capability, false).root, selector);
        const moved = structuredClone(selected.node), pair = destination.pairs.at(-1)!;
        moved.tag = pair.tag; setIdentity(moved, pair.id);
        selected.remove();
        upsert(entry(destination.capability, true).root, destination, moved);
        touched.add(selector.capability); touched.add(destination.capability);
      } else throw new Error(`Unsupported BehaviorPatch operation '${operation.tag}'.`);
    }
  }
  const updates = new Map<string, string>();
  for (const capability of [...touched].sort()) {
    const current = entries.get(capability)!;
    const proposal = proposeBehaviorMutation(current.before, current.root);
    const source = patchDataTreeSource(current.source, current.before, proposal.root);
    if (current.created || source !== current.source) updates.set(current.file, source);
  }
  return {updates, capabilities: [...touched]};
}

function readRoot(source: string, tag: 'Behavior' | 'BehaviorPatch'): DataElementNode {
  const parsed = parseXnl(source, {textBlockStyle: true}), root = parsed.nodes[0];
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== tag || !wordToString(root.id)) throw new Error(`Behavior authority requires one unambiguous current ${tag} root.`);
  if (root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
    || 'apiVersion' in root.metadata || 'version' in root.metadata) throw new Error('Behavior envelope requires migration or review.');
  return root;
}
function visiblePath(file: string): void {
  if (!file.endsWith('.xnl') || file.includes('\\') || file.split('/').some(segment => !segment || segment.startsWith('.'))) throw new Error('Behavior sources require visible portable XNL paths.');
}
function parseSelector(value: string): Selector {
  const match = /^behavior:\/\/([^/?#]+)([^?#]*)(?:\?[^#]*)?(?:#.*)?$/.exec(value);
  if (!match) throw new Error('Behavior selector must use behavior:// with tag/id pairs.');
  const capability = decodeURIComponent(match[1]);
  if (!/^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(capability)) throw new Error('Behavior selector capability is not a safe resource identity.');
  const rest = match[2].split('/').filter(Boolean).map(decodeURIComponent);
  if (rest.length % 2 || rest.some(part => !part.trim() || /[/\\\u0000-\u001f]/.test(part) || part === '.' || part === '..')) throw new Error('Behavior selector requires safe tag/id pairs.');
  const pairs: Selector['pairs'] = [];
  for (let index = 0; index < rest.length; index += 2) {
    const plural: Record<string, string> = {requirements: 'requirement', suites: 'suite', cases: 'case'};
    const tag = (plural[rest[index]] ?? rest[index]).split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(tag)) throw new Error('Behavior selector tag is invalid.');
    pairs.push({tag, id: rest[index + 1]});
  }
  return {capability, pairs};
}
function isDescendant(parent: Selector, candidate: Selector): boolean {
  return candidate.pairs.length > parent.pairs.length && parent.pairs.every((pair, index) => pair.tag.toLowerCase() === candidate.pairs[index].tag.toLowerCase() && pair.id === candidate.pairs[index].id);
}
function slots(parent: DataElementNode): Slot[] {
  const result: Slot[] = [];
  for (const [index, value] of (parent.body ?? []).entries()) {
    if (isDataElement(value) && Object.values(collections).includes(value.tag)) {result.push(...slots(value)); continue;}
    if (isElement(value)) result.push({node: value, replace: node => {parent.body![index] = node;}, remove: () => {parent.body!.splice(index, 1);}});
  }
  for (const key of parent.extend?.order ?? []) {
    const node = parent.extend!.children[key];
    if (isDataElement(node) && Object.values(collections).includes(node.tag)) {result.push(...slots(node)); continue;}
    result.push({node, replace: value => {parent.extend!.children[key] = value;}, remove: () => {
      delete parent.extend!.children[key]; parent.extend!.order = parent.extend!.order.filter(item => item !== key);
    }});
  }
  return result;
}
function select(parent: DataElementNode, pair: Selector['pairs'][number]): Slot | undefined {
  const matches = slots(parent).filter(slot => slot.node.tag.toLowerCase() === pair.tag.toLowerCase() && id(slot.node) === pair.id);
  if (matches.length > 1) throw new Error(`Ambiguous Behavior subject '${pair.tag}/${pair.id}'.`);
  return matches[0];
}
function find(root: DataElementNode, selector: Selector): Slot {
  let parent = root;
  for (const [index, pair] of selector.pairs.entries()) {
    const found = select(parent, pair);
    if (!found) throw new Error(`Behavior selector target not found: ${pair.tag}/${pair.id}`);
    if (index === selector.pairs.length - 1) return found;
    if (!isDataElement(found.node)) throw new Error('Behavior selector traverses a text subject.');
    parent = found.node;
  }
  throw new Error('Cannot mutate the Behavior capability root.');
}
function upsert(root: DataElementNode, selector: Selector, payload: ElementNode): void {
  let parent = root;
  for (const pair of selector.pairs.slice(0, -1)) {
    let existing = select(parent, pair)?.node;
    if (!existing) {
      existing = {kind: 'DataElement', tag: pair.tag, metadata: {}};
      setIdentity(existing, pair.id); insert(parent, existing);
    }
    if (!isDataElement(existing)) throw new Error('Behavior selector parent is not a data subject.');
    parent = existing;
  }
  const pair = selector.pairs.at(-1)!;
  if (payload.tag.toLowerCase() !== pair.tag.toLowerCase() || id(payload) !== undefined && id(payload) !== pair.id) throw new Error('Behavior Upsert payload identity does not match its selector.');
  if (id(payload) === undefined) setIdentity(payload, pair.id);
  const existing = select(parent, pair);
  if (existing) existing.replace(payload);
  else insert(parent, payload);
}
function insert(parent: DataElementNode, node: ElementNode): void {
  const collectionTag = collections[node.tag];
  if (!collectionTag) {parent.body = [...parent.body ?? [], node]; return;}
  const matching = children(parent).filter(child => child.tag === collectionTag);
  if (matching.length > 1 || matching[0] && !isDataElement(matching[0])) throw new Error(`Ambiguous Behavior collection '${collectionTag}'.`);
  let collection = matching[0] as DataElementNode | undefined;
  if (!collection) {
    collection = {kind: 'DataElement', tag: collectionTag, metadata: {}, body: []};
    parent.extend ??= {order: [], children: {}};
    if (parent.extend.children[collectionTag]) throw new Error('Behavior collection slot is occupied.');
    parent.extend.children[collectionTag] = collection; parent.extend.order.push(collectionTag);
  }
  collection.body = [...collection.body ?? [], node];
}
function setIdentity(node: ElementNode, identity: string): void {
  if (/^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(identity)) {
    node.id = MakeWord(identity);
    if (node.attributes?.id !== undefined) node.attributes.id = identity;
  } else {delete node.id; node.attributes = {...node.attributes, id: identity};}
}
function isElement(value: XnlNode): value is ElementNode {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'kind' in value && (value.kind === 'DataElement' || value.kind === 'TextElement'));
}
