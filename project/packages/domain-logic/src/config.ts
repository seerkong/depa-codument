import { parseXnl, wordToString, type DataElementNode } from 'xnl-core';
import { isDataElement, orderedElementChildren } from './registry';

/** Current config observation only; historical syntax belongs to migration. */
export function readAttractorProfileNames(source: string | undefined): readonly string[] {
  return readAttractorProfiles(source).map(profile => wordToString(profile.id)!);
}

/** Activation requires an explicit boolean true, not merely a declared name. */
export function readAttractorProfileEnabled(source: string | undefined, name: string): boolean {
  return readAttractorProfiles(source).find(profile => wordToString(profile.id) === name)?.attributes?.enabled === true;
}

/** Expose only referenced profiles; disabled profiles do not load their bodies. */
export function readAttractorProfileReferences(source: string | undefined, names: readonly string[]) {
  const profiles = readAttractorProfiles(source);
  return [...new Set(names)].map(name => {
    const profile = profiles.find(profile => wordToString(profile.id) === name);
    if (!profile) return {profile: name, enabled: null, refs: [] as string[]};
    const enabled = profile.attributes?.enabled === true;
    const refs: string[] = [];
    if (enabled) for (const container of orderedElementChildren(profile)) {
      if (!isDataElement(container) || container.tag !== 'Attractors') continue;
      for (const node of orderedElementChildren(container)) {
        if (!isDataElement(node) || node.tag !== 'Attractor') continue;
        const ref = node.attributes?.ref;
        if (typeof ref !== 'string' || !ref.trim()) throw new Error(`Profile ${name} requires an explicit Attractor ref.`);
        refs.push(ref);
      }
    }
    return {profile: name, enabled, refs: [...new Set(refs)]};
  });
}

function readAttractorProfiles(source: string | undefined): readonly DataElementNode[] {
  if (source === undefined) return [];
  const parsed = parseXnl(source, { textBlockStyle: true });
  const root = parsed.nodes[0];
  if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== 'AttractorProfiles') {
    throw new Error('Attractor profiles require one unambiguous AttractorProfiles root.');
  }
  if (root.metadata.envelopeVersion !== 'halfcode.resource-envelope/v1' || root.metadata.specVersion !== 1
    || 'apiVersion' in root.metadata || 'version' in root.metadata) {
    throw new Error('Attractor profiles require migration or review before normal admission.');
  }
  const containers = orderedElementChildren(root).filter(node => node.tag === 'Profiles');
  if (containers.length !== 1 || !isDataElement(containers[0])) throw new Error('Attractor profiles require exactly one Profiles collection.');
  const names = new Set<string>();
  const profiles: DataElementNode[] = [];
  for (const profile of orderedElementChildren(containers[0])) {
    if (!isDataElement(profile) || profile.tag !== 'Profile') throw new Error('Profiles collection requires Profile entries.');
    const name = wordToString(profile.id);
    if (!name || names.has(name)) throw new Error('Attractor Profile identity is missing or duplicated.');
    if (profile.attributes?.enabled !== undefined && typeof profile.attributes.enabled !== 'boolean') throw new Error(`Profile ${name} enabled must be boolean.`);
    // A disabled but declared profile still has an identity; hook policy owns activation.
    names.add(name);
    profiles.push(profile);
  }
  return profiles;
}
