import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  renderSkillAppKindDefinition,
  skillAppKindContract,
  type SkillAppResourceKind,
} from 'depa-codument-skill-app-contract/resource';

const envelopeVersion = 'halfcode.resource-envelope/v1';

function quoted(value: string): string {
  return JSON.stringify(value);
}

function segment(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join('');
  return normalized || 'Fixture';
}

export function skillAppKindDefinitionSource(kind: SkillAppResourceKind): string {
  return renderSkillAppKindDefinition(skillAppKindContract(kind));
}

export async function writeSkillApp(skillRoot: string, skillId = path.basename(skillRoot)): Promise<void> {
  await Promise.all([
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/Page'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/PageBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/Site'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/SOP'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/SkillApp'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/LocalFunctionBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/PageWorkflowBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/PageObjectBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/BrowserWebApiBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/McpApp'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/SkillModule'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'KindDefinitions/HostBundle'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'pages'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'page-bundles'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'sites'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'modules'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'SOP'), { recursive: true }),
    fs.mkdir(path.join(skillRoot, 'McpApp'), { recursive: true }),
  ]);
  await fs.writeFile(path.join(skillRoot, 'manifest.xnl'), [
    `<SkillApp #Test.${segment(skillId)}.App envelopeVersion="${envelopeVersion}" specVersion=1 (`,
    '  <Catalogs [',
    '    <DirectoryResourceCatalog #kind_definitions { resourceKind = "KindDefinition" root = "vfs://./KindDefinitions/" entry = "manifest.xnl" scope = "children" }>',
    '    <ManifestResourceCatalog #pages { resourceKind = "Page" root = "vfs://./pages/" entry = "manifest.xnl" }>',
    '    <DirectoryResourceCatalog #page_bundles { resourceKind = "PageBundle" root = "vfs://./page-bundles/" entry = "manifest.xnl" scope = "children" }>',
    '    <ManifestResourceCatalog #sites { resourceKind = "Site" root = "vfs://./sites/" entry = "manifest.xnl" }>',
    '    <FileResourceCatalog #sops { resourceKind = "SOP" root = "vfs://./SOP/" }>',
    '    <ManifestResourceCatalog #mcp_apps { resourceKind = "McpApp" root = "vfs://./McpApp/" entry = "manifest.xnl" }>',
    '    <ManifestResourceCatalog #modules { resourceKind = "SkillModule" root = "vfs://./modules/" entry = "manifest.xnl" }>',
    '  ]>',
    ')>',
    '',
  ].join('\n'));
  const kinds = [
    'Page', 'PageBundle', 'Site', 'SOP', 'SkillApp', 'LocalFunctionBundle',
    'PageWorkflowBundle', 'PageObjectBundle', 'BrowserWebApiBundle', 'McpApp',
    'SkillModule', 'HostBundle',
  ] as const;
  await Promise.all(kinds.map((kind) => fs.writeFile(
    path.join(skillRoot, `KindDefinitions/${kind}/manifest.xnl`),
    skillAppKindDefinitionSource(kind),
  )));
}

export interface PageFixtureManifest {
  readonly fqn?: string;
  readonly version?: 1 | 2;
  readonly name: string;
  readonly description: string;
  readonly entry?: string;
  readonly localFunctions?: readonly string[];
  readonly navigation?: Readonly<Record<string, unknown>>;
  readonly agentAction?: Readonly<Record<string, unknown>>;
  readonly mcpApp?: Readonly<Record<string, unknown>>;
  readonly runtime?: Readonly<Record<string, unknown>>;
}

function properties(values: Readonly<Record<string, unknown>>): string {
  return Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => {
    if (Array.isArray(value)) return `  ${key} = [${value.map((item) => quoted(String(item))).join(' ')}]`;
    if (typeof value === 'string') return `  ${key} = ${quoted(value)}`;
    if (typeof value === 'boolean' || typeof value === 'number') return `  ${key} = ${String(value)}`;
    throw new TypeError(`Unsupported XNL fixture property: ${key}`);
  }).join('\n');
}

function child(tag: string, values: Readonly<Record<string, unknown>> | undefined): string | undefined {
  if (!values) return undefined;
  const attrs = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => {
    if (typeof value === 'string') return `${key} = ${quoted(value)}`;
    if (typeof value === 'boolean' || typeof value === 'number') return `${key} = ${String(value)}`;
    throw new TypeError(`Unsupported XNL fixture child property: ${tag}.${key}`);
  }).join(' ');
  return `  <${tag} { ${attrs} }>`;
}

export async function writePageManifest(pageRoot: string, input: PageFixtureManifest): Promise<string> {
  await fs.mkdir(pageRoot, { recursive: true });
  const children = [
    child('Navigation', input.navigation),
  ].filter((value): value is string => Boolean(value));
  const fqn = input.fqn ?? `Test.Page.${segment(input.name)}`;
  const source = [
    `<Page #${fqn} envelopeVersion="${envelopeVersion}" specVersion=1 {`,
    properties({
      name: input.name,
      description: input.description,
      localFunctions: input.localFunctions ?? [],
    }),
    `}${children.length ? ' (' : '>'}`,
    ...children,
    ...(children.length ? [')>'] : []),
    '',
  ].join('\n');
  const manifestPath = path.join(pageRoot, 'manifest.xnl');
  await fs.writeFile(manifestPath, source);
  const integration = input.mcpApp ?? input.agentAction;
  if (integration) {
    const mcp = input.mcpApp ?? {};
    const action = input.agentAction ?? {};
    const sopFqn = String(mcp.sopFqn ?? action.action ?? '').trim();
    const workflowFqn = String(mcp.workflowFqn ?? action.workflowFqn ?? '').trim();
    const viewAsset = String(mcp.viewAsset ?? 'view.js').trim();
    if (!sopFqn || !workflowFqn) throw new TypeError('McpApp fixture requires sopFqn/action and workflowFqn');
    const skillRoot = path.dirname(path.dirname(pageRoot));
    const appRoot = path.join(skillRoot, 'McpApp', segment(input.name));
    await fs.mkdir(appRoot, { recursive: true });
    await fs.writeFile(path.join(appRoot, 'manifest.xnl'), [
      `<McpApp #${fqn}.McpApp envelopeVersion="${envelopeVersion}" specVersion=1 {`,
      `  pageFqn = ${quoted(fqn)}`,
      `  pageName = ${quoted(input.name)}`,
      `  sopFqn = ${quoted(sopFqn)}`,
      `  workflowFqn = ${quoted(workflowFqn)}`,
      `  viewAsset = ${quoted(viewAsset)}`,
      ...(action.inputMode === 'workflow' ? ['  inputMode = "workflow"'] : []),
      '}>',
      '',
    ].join('\n'));
  }
  return manifestPath;
}

export interface SiteFixtureMount {
  readonly id: string;
  readonly path: string;
  readonly pageFqn: string;
  readonly label?: string;
  readonly order?: number;
  readonly visible?: boolean;
}

export async function writeSiteManifest(
  skillRoot: string,
  input: {
    fqn?: string;
    name: string;
    description: string;
    defaultMount: string;
    mounts: readonly SiteFixtureMount[];
  },
): Promise<string> {
  const siteRoot = path.join(skillRoot, 'sites', input.name);
  await fs.mkdir(siteRoot, { recursive: true });
  const source = [
    `<Site #${input.fqn ?? `Test.Site.${segment(input.name)}`} envelopeVersion="${envelopeVersion}" specVersion=1 {`,
    `  name = ${quoted(input.name)}`,
    `  description = ${quoted(input.description)}`,
    `  defaultMount = ${quoted(input.defaultMount)}`,
    '} (',
    '  <PageMounts [',
    ...input.mounts.map((mount) => [
      `    <PageMount #${mount.id} {`,
      `      path = ${quoted(mount.path)}`,
      `      pageFqn = ${quoted(mount.pageFqn)}`,
      `      label = ${quoted(mount.label ?? mount.id)}`,
      `      order = ${mount.order ?? 1000}`,
      `      visible = ${mount.visible ?? true}`,
      '    }>',
    ].join('\n')),
    '  ]>',
    ')>',
    '',
  ].join('\n');
  const manifest = path.join(siteRoot, 'manifest.xnl');
  await fs.writeFile(manifest, source);
  return manifest;
}

export async function writeSop(
  skillRoot: string,
  fqn: string,
  documentName: string,
  text: string,
  profile?: string,
): Promise<void> {
  const root = path.join(skillRoot, 'SOP');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, documentName), [
    '---',
    `envelopeVersion: ${envelopeVersion}`,
    'specVersion: 1',
    'kind: SOP',
    'metadata:',
    `  fqn: ${fqn}`,
    'spec:',
    `  description: ${fqn} SOP`,
    ...(profile ? [`  profile: ${profile}`] : []),
    '---',
    '',
    text,
    '',
  ].join('\n'));
}

export async function writeBundleResources(
  skillRoot: string,
  resourceFqn: string,
  source: string,
): Promise<void> {
  const kinds = [
    ['LocalFunction', 'LocalFunctionBundle'],
    ['PageWorkflow', 'PageWorkflowBundle'],
    ['PageObject', 'PageObjectBundle'],
    ['BrowserWebApi', 'BrowserWebApiBundle'],
  ] as const;
  const selected = kinds.filter(([leaf]) => source.includes(`define${leaf}`));
  if (selected.length === 0) throw new TypeError('Bundle fixture source must define at least one Host leaf resource');
  const namedDefinitions = [...source.matchAll(/export const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*api\.define/g)]
    .map((match) => match[1]);
  const definitionsExpression = source.includes('export const definitions')
    ? 'definitions'
    : `[${namedDefinitions.join(', ')}]`;
  let manifest = await fs.readFile(path.join(skillRoot, 'manifest.xnl'), 'utf8');
  for (const [leafKind, bundleKind] of selected) {
    const root = path.join(skillRoot, leafKind);
    await fs.mkdir(path.join(root, 'bundle'), { recursive: true });
    const bundleFqn = `${resourceFqn}.${bundleKind}`;
    await fs.writeFile(path.join(root, 'manifest.xnl'), [
      `<${bundleKind} #${bundleFqn} envelopeVersion="${envelopeVersion}" specVersion=1 {`,
      '  entry = "vfs://./bundle/index.js"',
      '  runtime = "bun"',
      '}>',
      '',
    ].join('\n'));
    await fs.writeFile(path.join(root, 'bundle/index.js'), `${source}\nexport const resourceDefinitions = ${definitionsExpression}.filter((definition) => definition.kind === ${JSON.stringify(leafKind)});\n`);
    const catalog = `    <DirectoryResourceCatalog #${leafKind.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`).replace(/^_/, '')}_bundle { resourceKind = "${bundleKind}" root = "vfs://./${leafKind}/" entry = "manifest.xnl" scope = "root" }>`;
    if (!manifest.includes(catalog)) manifest = manifest.replace('  ]>\n)>', `${catalog}\n  ]>\n)>`);
  }
  await fs.writeFile(path.join(skillRoot, 'manifest.xnl'), manifest);
}
