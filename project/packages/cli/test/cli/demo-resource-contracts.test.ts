import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  renderSkillAppKindDefinition,
  SKILL_APP_KIND_CONTRACT_DESCRIPTORS,
} from 'depa-codument-skill-app-contract/resource';

const demoRoot = path.resolve(
  import.meta.dir,
  '../../src/templates/agents/workspace/skills/codument-demo',
);
const globalReferencesRoot = path.resolve(
  import.meta.dir,
  '../../src/templates/agents/global/skills/codument/references',
);
const integrationDocs = [
  path.resolve(import.meta.dir, '../../../../docs/markdown-step-graph-v1.md'),
];

async function filesUnder(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  }))).flat();
}

describe('built-in demo resource contracts', () => {
  test('materializes every catalogued KindDefinition from the canonical descriptor facade', async () => {
    const descriptors = SKILL_APP_KIND_CONTRACT_DESCRIPTORS
      .filter((descriptor) => descriptor.kind !== 'ConfigBinding' && descriptor.kind !== 'CommandOperation');
    const definitionRoot = path.join(demoRoot, 'KindDefinitions');
    expect((await fs.readdir(definitionRoot)).sort())
      .toEqual(descriptors.map((descriptor) => descriptor.kind).sort());
    for (const descriptor of descriptors) {
      const source = await fs.readFile(
        path.join(definitionRoot, descriptor.kind, 'manifest.xnl'),
        'utf8',
      );
      expect(source).toBe(renderSkillAppKindDefinition(descriptor));
    }
  });

  test('uses only the envelopeVersion/specVersion writer model in demo and SOP reference sources', async () => {
    const references = ['freeform-sop.md', 'typed-leaf-sop.md', 'typed-pipeline-sop.md']
      .map((name) => path.join(globalReferencesRoot, name));
    const authored = (await filesUnder(demoRoot))
      .filter((file) => /\.(?:md|xnl|ya?ml)$/.test(file))
      .concat(references, integrationDocs);
    for (const file of authored) {
      const source = await fs.readFile(file, 'utf8');
      expect(source, path.relative(demoRoot, file))
        .not.toMatch(/\bapiVersion\s*[:=]|\b(?:currentApiVersion|supportedApiVersions|currentSpecVersion|supportedSpecVersions)\s*=|\bversion\s*[:=]/m);
    }

    const binding = await fs.readFile(
      path.join(demoRoot, 'config-profiles/personal/app/web-api-endpoints.yaml'),
      'utf8',
    );
    expect(binding).toMatch(/^envelopeVersion: halfcode\.resource-envelope\/v1\nspecVersion: 1\n/);
    const sop = await fs.readFile(
      path.join(demoRoot, 'modules/google-search/sops/codument-demo--sop--google-search.md'),
      'utf8',
    );
    expect(sop).toMatch(/^---\nenvelopeVersion: halfcode\.resource-envelope\/v1\nspecVersion: 1\n/);
    const integrationDoc = await fs.readFile(integrationDocs[0], 'utf8');
    expect(integrationDoc).toContain([
      '---',
      'envelopeVersion: halfcode.resource-envelope/v1',
      'specVersion: 1',
      'kind: SOP',
    ].join('\n'));
  });
});
