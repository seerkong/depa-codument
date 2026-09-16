import { MakeWord, parseXnl, type DataElementNode, type ElementNode, type XnlNode } from 'xnl-core';
import type { CodumentResourceKind, MigrationSource } from 'depa-codument-domain-contract';
import { serializeXnlForest } from './registry';

interface LegacyXmlNode { tag: string; attrs: Record<string, string>; children: LegacyXmlNode[]; text: string }
const NAME = '[A-Za-z_][A-Za-z0-9_.:-]*';

/** Deliberately bounded legacy syntax reader, not a general XML engine. DTDs,
 * entity expansion, processing instructions and mixed content require review.
 * Unlike the former reader, no unparsed attribute bytes are silently ignored. */
export function readMigrationXml(source: string): {root: LegacyXmlNode; comments: readonly string[]} {
  const holder: LegacyXmlNode = {tag: '', attrs: {}, children: [], text: ''};
  const stack = [holder], comments: string[] = [];
  let cursor = 0;
  function decode(value: string): string {
    return value.replace(/&([^;\s]+);|&/gu, (whole, name: string | undefined) => {
      const named: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
      if (name && Object.hasOwn(named, name)) return named[name];
      if (name && /^#(?:[0-9]+|x[0-9a-fA-F]+)$/u.test(name)) {
        const code = name.startsWith('#x') ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        if (Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
          && (code >= 32 || [9, 10, 13].includes(code))) return String.fromCodePoint(code);
      }
      throw new Error('Unknown or unsafe XML entity: ' + whole);
    });
  }
  while (cursor < source.length) {
    if (source[cursor] !== '<') {
      const end = source.indexOf('<', cursor);
      stack.at(-1)!.text += decode(source.slice(cursor, end < 0 ? source.length : end));
      cursor = end < 0 ? source.length : end; continue;
    }
    if (source.startsWith('<!--', cursor)) {
      const end = source.indexOf('-->', cursor + 4);
      if (end < 0 || source.slice(cursor + 4, end).includes('--')) throw new Error('Invalid XML comment.');
      comments.push(source.slice(cursor, end + 3)); cursor = end + 3; continue;
    }
    if (source.startsWith('<![CDATA[', cursor)) {
      const end = source.indexOf(']]>', cursor + 9);
      if (end < 0 || stack.length < 2) throw new Error('Invalid XML CDATA.');
      stack.at(-1)!.text += source.slice(cursor + 9, end); cursor = end + 3; continue;
    }
    if (source.startsWith('<?xml ', cursor) && cursor === 0) {
      const declaration = source.slice(cursor).match(/^<\?xml\s+version=(?:"1\.0"|'1\.0')(?:\s+encoding=(?:"UTF-8"|'UTF-8'))?\s*\?>/u)?.[0];
      if (!declaration) throw new Error('Unsupported XML declaration; retain original encoding for review.');
      cursor += declaration.length; continue;
    }
    if (source.startsWith('<!', cursor) || source.startsWith('<?', cursor)) throw new Error('XML declarations/extensions require semantic review; no entity expansion is performed.');
    let end = cursor + 1, quote = '';
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === source.length || quote) throw new Error('Unclosed XML tag.');
    const token = source.slice(cursor, end + 1); cursor = end + 1;
    const closing = token.match(new RegExp(`^</(${NAME})\\s*>$`, 'u'));
    if (closing) {
      if (stack.length < 2 || stack.at(-1)!.tag !== closing[1]) throw new Error('Mismatched XML closing tag.');
      stack.pop(); continue;
    }
    const header = token.match(new RegExp(`^<(${NAME})(?=\\s|/?>)`, 'u'));
    if (!header) throw new Error('Invalid XML opening tag.');
    const selfClosing = token.endsWith('/>');
    let rest = token.slice(header[0].length, selfClosing ? -2 : -1);
    const attrs: Record<string, string> = Object.create(null);
    while (rest.trim()) {
      const attribute = rest.match(new RegExp(`^\\s+(${NAME})\\s*=\\s*("[^"<]*"|'[^'<]*')`, 'u'));
      if (!attribute || Object.hasOwn(attrs, attribute[1])) throw new Error('Malformed or duplicate XML attribute.');
      attrs[attribute[1]] = decode(attribute[2].slice(1, -1)); rest = rest.slice(attribute[0].length);
    }
    const node: LegacyXmlNode = {tag: header[1], attrs, children: [], text: ''};
    stack.at(-1)!.children.push(node); if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1 || holder.children.length !== 1 || holder.text.trim()) throw new Error('Expected exactly one closed XML resource.');
  const check = (node: LegacyXmlNode): void => {
    if (node.children.length && node.text.trim()) throw new Error('XML mixed content cannot be flattened without review.');
    for (const [key, value] of Object.entries(node.attrs)) {
      if (key.startsWith('xmlns') && !(key === 'xmlns:cdt' && value === 'urn:codument:v1')) throw new Error('Unknown XML namespace requires review.');
    }
    node.children.forEach(check);
  };
  check(holder.children[0]); return {root: holder.children[0], comments};
}

const word = (value: string) => /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/u.test(value);
const strip = (value: string) => { if (value.includes(':') && !value.startsWith('cdt:')) throw new Error('Unknown XML namespace prefix.'); return value.replace(/^cdt:/u, ''); };
const snake = (value: string) => strip(value).replace(/([a-z0-9])([A-Z])/gu, '$1_$2').replaceAll('-', '_').toLowerCase();
function scalar(value: string): string | number | boolean {
  if (value === 'true' || value === 'false') return value === 'true';
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
  return value;
}
function put(output: Record<string, XnlNode>, key: string, value: XnlNode): void {
  if (Object.hasOwn(output, key)) throw new Error('XML normalization would merge distinct fields: ' + key);
  output[key] = value;
}
function attributes(node: LegacyXmlNode, omit: readonly string[] = [], strings = false): Record<string, XnlNode> {
  const result: Record<string, XnlNode> = {};
  for (const [key, value] of Object.entries(node.attrs)) if (!omit.includes(key) && key !== 'xmlns:cdt') put(result, snake(key), strings ? value : scalar(value));
  return result;
}
function data(tag: string, id?: string, attrs: Record<string, XnlNode> = {}): DataElementNode {
  if (id !== undefined && !word(id)) throw new Error('XML resource identity needs explicit review: ' + id);
  return {kind: 'DataElement', tag, metadata: {}, ...(id ? {id: MakeWord(id)} : {}), ...(Object.keys(attrs).length ? {attributes: attrs} : {})};
}
function children(target: DataElementNode, elements: ElementNode[], body = false): void {
  if (!elements.length) return;
  if (body) {target.body = elements; return;}
  if (new Set(elements.map(node => node.tag)).size !== elements.length) throw new Error('Repeated XML singleton fields require review; nothing is overwritten.');
  target.extend = {order: elements.map(node => node.tag), children: Object.fromEntries(elements.map(node => [node.tag, node]))};
}
const collection = (tag: string, nodes: ElementNode[]) => {const result = data(tag); result.body = nodes; return result;};
const COLLECTIONS = new Set(['Ports', 'SubNodes', 'Schedule', 'Hooks', 'Dag', 'Node', 'Acceptance', 'Gate', 'ProjectRefs', 'ActorSets']);
function generic(node: LegacyXmlNode): ElementNode {
  const tag = strip(node.tag), id = node.attrs.id, identity = id && word(id) ? id : undefined;
  const attrs = attributes(node, identity ? ['id'] : []);
  if (!node.children.length && node.text.length) return {kind: 'TextElement', tag, metadata: {}, text: node.text,
    ...(identity ? {id: MakeWord(identity)} : {}), ...(Object.keys(attrs).length ? {attributes: attrs} : {})};
  const result = data(tag, identity, attrs); children(result, node.children.map(generic), COLLECTIONS.has(tag)); return result;
}
function metadata(root: LegacyXmlNode): {attributes: Record<string, XnlNode>; children: LegacyXmlNode[]} {
  const containers = root.children.filter(child => child.tag === 'Metadata');
  if (containers.length > 1 || containers.some(node => Object.keys(node.attrs).length || node.text.trim())) throw new Error('Ambiguous XML Metadata requires review.');
  const attrs: Record<string, XnlNode> = {};
  let apiVersion = root.attrs.apiVersion;
  for (const node of containers[0]?.children ?? []) {
    if (node.children.length || Object.keys(node.attrs).length) throw new Error('Structured XML Metadata cannot be flattened.');
    if (node.tag === 'ApiVersion') {if (apiVersion !== undefined) throw new Error('Competing XML apiVersion fields.'); apiVersion = node.text.trim();}
    else put(attrs, snake(node.tag), scalar(node.text.trim()));
  }
  if (apiVersion !== undefined && apiVersion !== 'codument.tech/v1alpha1') throw new Error('Unknown legacy XML apiVersion.');
  if (root.attrs.version !== undefined && root.attrs.version !== '1') throw new Error('Unknown legacy XML version.');
  return {attributes: attrs, children: root.children.filter(child => child.tag !== 'Metadata')};
}

const pascal = (value: string) => strip(value).split(/[-_]/u).map(part => part[0].toUpperCase() + part.slice(1)).join('');

/** Explicit shape conversion. Full semantic validation is still mandatory at
 * apply; unsupported historical structures retain their original source. */
export function convertMigrationXml(input: MigrationSource): {kind: CodumentResourceKind; targetPath: string; source: string} {
  const {root, comments} = readMigrationXml(input.source), meta = metadata(root);
  if (root.text.trim()) throw new Error('XML resource root text requires semantic review; it cannot be discarded.');
  let converted: DataElementNode;
  const filename = input.path.split('/').at(-1)!;
  let targetPath = input.path.replace(/\.xml$/u, '.xnl');
  if ((root.tag === 'Track' || root.tag === 'Mission') && filename === root.tag.toLowerCase() + '.xml') {
    const attrs = attributes(root, ['id', 'version', 'apiVersion']);
    for (const [key, value] of Object.entries(meta.attributes)) put(attrs, key, value);
    converted = data(root.tag, root.attrs.id, attrs);
    if (!converted.id) throw new Error('Legacy lifecycle resource has no stable ID.');
    children(converted, meta.children.map(generic));
  } else if (['ActionHooks', 'OperationHooks', 'AttractorProfiles'].includes(root.tag)) {
    const expectedFile = ({ActionHooks: 'action-hooks.xml', OperationHooks: 'operation-hooks.xml', AttractorProfiles: 'attractor-profiles.xml'} as Record<string, string>)[root.tag];
    if (filename !== expectedFile || !input.path.endsWith('/config/' + filename)) throw new Error('XML config path and kind disagree.');
    if (Object.keys(meta.attributes).length) throw new Error('Unknown config Metadata must be preserved for review.');
    const tag = root.tag === 'ActionHooks' ? 'OperationHooks' : root.tag;
    const ids: Record<string, string> = {OperationHooks: 'operation_hooks', AttractorProfiles: 'attractor_profiles'};
    converted = data(tag, 'codument.config.' + ids[tag], attributes(root, ['version', 'apiVersion']));
    if (tag === 'OperationHooks') {
      if (meta.children.some(node => !['Action', 'Operation'].includes(node.tag))) throw new Error('Unknown OperationHooks XML child requires review.');
      const operations = meta.children.map(node => {
        if (node.text.trim()) throw new Error('XML Operation text requires review.');
        if (!node.attrs.name) throw new Error('Operation name missing.');
        const value = data('Operation', node.attrs.name, attributes(node, ['name'])); children(value, node.children.map(generic)); return value;
      });
      children(converted, [collection('Operations', operations)]);
      targetPath = input.path.slice(0, -filename.length) + 'operation-hooks.xnl';
    } else if (tag === 'AttractorProfiles') {
      if (meta.children.some(node => node.tag !== 'Profile')) throw new Error('Unknown AttractorProfiles XML child requires review.');
      const profiles = meta.children.map(node => {
        if (node.text.trim()) throw new Error('XML Profile text requires review.');
        if (!node.attrs.name) throw new Error('Profile name missing.');
        const value = data('Profile', node.attrs.name, attributes(node, ['name']));
        if (node.children.some(child => !['Description', 'Attractor'].includes(child.tag))) throw new Error('Unknown Profile child requires review.');
        const ordinary = node.children.filter(child => child.tag === 'Description').map(generic);
        const attractors = node.children.filter(child => child.tag === 'Attractor').map(generic);
        if (attractors.length) ordinary.push(collection('Attractors', attractors)); children(value, ordinary); return value;
      });
      children(converted, [collection('Profiles', profiles)]);
    } else children(converted, meta.children.map(node => {
      if (node.tag !== 'MergePolicy') return generic(node);
      if (node.text.trim()) throw new Error('XML MergePolicy text requires review.');
      if (node.children.some(child => child.tag !== 'Conflict')) throw new Error('Unknown MergePolicy XML child requires review.');
      const value = data('MergePolicy', undefined, attributes(node)); children(value, [collection('Conflicts', node.children.map(generic))]); return value;
    }));
  } else throw new Error('This historical XML shape requires a dedicated conversion or semantic review.');
  converted.metadata = {envelopeVersion: 'halfcode.resource-envelope/v1', specVersion: 1};
  let marker = 'CODUMENT_XML_MIGRATION';
  while (input.source.includes('</?' + marker + '>')) marker += '_';
  const source = (comments.length ? comments.join('\n') + '\n' : '') + serializeXnlForest([converted], {textMarkerFactory: () => marker});
  const parsed = parseXnl(source, {textBlockStyle: true});
  if (parsed.warnings?.length || parsed.nodes.length !== 1) throw new Error('Converted XML has ambiguous XNL structure.');
  return {kind: converted.tag as CodumentResourceKind, targetPath, source};
}
