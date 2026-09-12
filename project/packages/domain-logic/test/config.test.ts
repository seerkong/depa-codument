import { expect, it } from 'bun:test';
import { readAttractorProfileNames } from '../src';

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
