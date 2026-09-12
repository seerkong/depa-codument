import { expect, it } from 'bun:test';
import { readAttractorProfileNames, readAttractorProfileReferences } from '../src';

const profiles = `<AttractorProfiles #codument.config.attractor_profiles envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (
  <Profiles [<Profile #project {enabled=true future={keep=1}}><Profile #memory {enabled=false}>]>
)>`;
it('observes declared profile identities without confusing enabled state or mutating extensions', () => {
  expect(readAttractorProfileNames(undefined)).toEqual([]);
  expect(readAttractorProfileNames(profiles)).toEqual(['project', 'memory']);
  expect(readAttractorProfileNames(profiles.replace('<Profile #memory {enabled=false}>', ''))).toEqual(['project']);
});
it('rejects ambiguous, historical and invalid profile config rather than admitting unknown hooks', () => {
  for (const source of [
    profiles.replace('#memory', '#project'), profiles.replace('#memory', ''), profiles.replace('enabled=false', 'enabled="false"'),
    profiles.replace('specVersion=1', 'specVersion=2'), profiles.replace('specVersion=1', 'specVersion=1 apiVersion="old"'),
    profiles + profiles, profiles.replace('<Profiles [', '<ProfilesBAD ['), profiles.replace('<Profile #memory', '<Other #memory'),
  ]) expect(() => readAttractorProfileNames(source)).toThrow();
});

it('projects only selected profile bodies, retains activation and distinguishes missing configuration', () => {
  const source = profiles.replace('<Profile #project {enabled=true future={keep=1}}>', '<Profile #project {enabled=true} (<Attractors [<Attractor {ref="skill://depa-codument/references/std/attractors/depa-attractor.md"}>]>)>');
  expect(readAttractorProfileReferences(source, ['memory'])).toEqual([{profile:'memory',enabled:false,refs:[]}]);
  expect(readAttractorProfileReferences(source, ['project','project'])).toEqual([{profile:'project',enabled:true,refs:['skill://depa-codument/references/std/attractors/depa-attractor.md']}]);
  expect(readAttractorProfileReferences(undefined, ['project'])).toEqual([{profile:'project',enabled:null,refs:[]}]);
  expect(readAttractorProfileReferences(source, [])).toEqual([]);
  expect(readAttractorProfileReferences(source.replace('depa-attractor.md','changed.md'), ['project'])[0].refs[0].endsWith('changed.md')).toBe(true);
  expect(() => readAttractorProfileReferences(source.replace('ref="skill://depa-codument/references/std/attractors/depa-attractor.md"','ref=42'), ['project'])).toThrow('explicit Attractor ref');
});
