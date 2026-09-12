import { describe, expect, test } from 'bun:test';
import { Buffer } from 'node:buffer';
import { deflateRawSync } from 'node:zlib';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CommandRuntime } from '../../src/cli/contracts/command';
import { createWorkspaceEffect } from '../../src/cli/effects/workspace';
import { installHostResourceDefinitionGlobals } from '../../src/cli/resources/definitions';
import { createHttpApp } from '../../src/cli/http/app';
import { createPageInstanceHub } from '../../src/cli/http/page-instances';
import type { EgoBrowserSupervisor } from '../../src/cli/runtime/ego-supervisor';
import { createPageAutomationCatalog, createPageWorkflowCoordinator } from '../../src/cli/runtime/page-workflow';
import { createPageResourceCatalog } from '../../src/cli/runtime/page-registry';
import { createMcpPageTargetStore } from 'depa-codument-mcp-app-capsule';
installHostResourceDefinitionGlobals();

const {
  OwidOpenDataWorkflow,
  decodeZipEntries,
  normalizeOwidInput,
  parseCsv,
  processOwidArchive,
} = await import('../../src/templates/agents/workspace/skills/codument-demo/PageWorkflow/bundle/index.js');

function zipFixture(files: Record<string, string>, compressed = false): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const fileName = Buffer.from(name);
    const plain = Buffer.from(content);
    const data = compressed ? deflateRawSync(plain) : plain;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(compressed ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(plain.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    localParts.push(local, fileName, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compressed ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(plain.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...localParts, central, end]));
}

const input: ReturnType<typeof normalizeOwidInput> = {
  chartSlug: 'life-expectancy',
  entityCodes: ['CHN', 'TUR'],
  startYear: 2000,
  endYear: 2023,
  downloadScope: 'displayed',
};

const archive = zipFixture({
  'life-expectancy.csv': '\uFEFFEntity,Code,Year,Life expectancy\r\n"China, mainland",CHN,2000,71.9\r\nTurkey,TUR,2000,"70\r\nyears"\r\n',
  'life-expectancy.metadata.json': JSON.stringify({ chart: { title: 'Life expectancy' }, columns: { value: { unit: 'years' } } }),
  'README.md': '# Life expectancy\nOpen data from Our World in Data.',
}, true);

async function settled(coordinator: ReturnType<typeof createPageWorkflowCoordinator>, runId: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const run = coordinator.get(runId);
    if (run?.status === 'completed' || run?.status === 'failed') return run;
    await Bun.sleep(5);
  }
  throw new Error('workflow did not settle');
}

describe('OWID open data advanced demo', () => {
  test('validates the fixed chart, entity codes, year range and download scope', () => {
    expect(normalizeOwidInput(input)).toEqual(input);
    expect(() => normalizeOwidInput({ ...input, chartSlug: 'arbitrary-chart' })).toThrow('chartSlug');
    expect(() => normalizeOwidInput({ ...input, entityCodes: ['../../etc'] })).toThrow('entityCodes');
    expect(() => normalizeOwidInput({ ...input, startYear: 2024, endYear: 2023 })).toThrow('year');
    expect(() => normalizeOwidInput({ ...input, downloadScope: 'server-path' })).toThrow('downloadScope');
  });

  test('parses RFC4180 CSV and a bounded ZIP inventory outside the browser effect', () => {
    expect(parseCsv('\uFEFFA,B\r\n"x,y","line 1\r\nline 2"\r\n')).toEqual([
      ['A', 'B'],
      ['x,y', 'line 1\r\nline 2'],
    ]);
    const entries = decodeZipEntries(archive);
    expect([...entries.keys()].sort()).toEqual(['README.md', 'life-expectancy.csv', 'life-expectancy.metadata.json']);
    const data = processOwidArchive({
      guid: 'fixture-guid', suggestedFilename: 'life-expectancy.filtered.zip', fileName: 'life-expectancy.filtered.zip',
      mimeType: 'application/zip', size: archive.byteLength, bytes: archive,
    }, input);
    expect(data).toMatchObject({
      columns: ['Entity', 'Code', 'Year', 'Life expectancy'],
      rowCount: 2,
      previewRows: [
        { Entity: 'China, mainland', Code: 'CHN', Year: '2000', 'Life expectancy': '71.9' },
        { Entity: 'Turkey', Code: 'TUR', Year: '2000', 'Life expectancy': '70\r\nyears' },
      ],
      files: expect.arrayContaining(['README.md', 'life-expectancy.csv', 'life-expectancy.metadata.json']),
    });
    expect(data).not.toHaveProperty('bytes');
    expect(() => parseCsv('A\n"unterminated')).toThrow('unterminated');
    expect(() => decodeZipEntries(zipFixture({ '../secret.csv': 'x', 'metadata.json': '{}', 'README.md': 'x' }))).toThrow('path');
    expect(() => decodeZipEntries(zipFixture(Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`file-${index}.csv`, 'x']))))).toThrow('entry count');
  });

  test('returns a standard business envelope after configure, verify, download UI and one binary download', async () => {
    const methods: string[] = [];
    const session = {
      async send(method: string) {
        methods.push(method);
        if (method === 'Page.download') return {
          guid: 'fixture-guid', suggestedFilename: 'life-expectancy.filtered.zip', fileName: 'life-expectancy.filtered.zip',
          mimeType: 'application/zip', size: archive.byteLength, bytes: archive,
        };
        return { result: { value: { ok: true } } };
      },
    };
    const result = await OwidOpenDataWorkflow.run(session, input);
    expect(methods).toEqual(['Runtime.evaluate', 'Runtime.evaluate', 'Runtime.evaluate', 'Runtime.evaluate', 'Page.download']);
    expect(result).toMatchObject({
      code: 0,
      message: expect.stringContaining('2'),
      data: { rowCount: 2 },
      meta: { chartSlug: 'life-expectancy', downloadScope: 'displayed', downloadGuid: 'fixture-guid' },
    });
    expect(result.error).toBeUndefined();
  });

  test('classifies expected download and decode failures as completed business envelopes', async () => {
    const downloadFailure = await OwidOpenDataWorkflow.run({
      async send(method: string) {
        if (method === 'Page.download') throw new Error('Browser download was canceled');
        return { result: { value: { ok: true } } };
      },
    }, input);
    expect(downloadFailure).toMatchObject({ code: 1, error: { kind: 'download', detail: expect.stringContaining('canceled') } });
    const invalidArchive = zipFixture({ 'README.md': 'missing data files' });
    expect(() => processOwidArchive({
      guid: 'bad', suggestedFilename: 'bad.zip', fileName: 'bad.zip', size: invalidArchive.byteLength, bytes: invalidArchive,
    }, input)).toThrow('CSV');
    expect(await OwidOpenDataWorkflow.run({ send: async () => ({ result: { value: { ok: false, error: 'Download button moved' } } }) }, input))
      .toMatchObject({ code: 1, error: { kind: 'page-interaction', detail: 'Download button moved' } });
    expect(await OwidOpenDataWorkflow.run({
      send: async (_method: string, _params: unknown, _session?: string) => ({ result: { value: { ok: false, error: 'Chart state changed' } } }),
    }, { ...input, chartSlug: 'not-allowlisted' })).toMatchObject({ code: 1, error: { kind: 'input-validation' } });
    const ignoredSelection = zipFixture({
      'life-expectancy.csv': 'Entity,Code,Year,Life expectancy\nAfghanistan,AFG,2000,55\n',
      'life-expectancy.metadata.json': '{}',
      'README.md': 'fixture',
    });
    expect(await OwidOpenDataWorkflow.run({
      async send(method: string) {
        if (method === 'Page.download') return {
          guid: 'ignored', suggestedFilename: 'life-expectancy.filtered.zip', fileName: 'life-expectancy.filtered.zip',
          size: ignoredSelection.byteLength, bytes: ignoredSelection,
        };
        return { result: { value: { ok: true } } };
      },
    }, input)).toMatchObject({ code: 1, error: { kind: 'business-response', detail: expect.stringContaining('did not honor') } });
  });

  test('supports direct receipts without a page and exact optional target backfill', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-owid-workflow-'));
    const sourceSkill = path.resolve(import.meta.dir, '../../src/templates/agents/workspace/skills/codument-demo');
    const installedSkill = path.join(root, '.agents/skills/codument-demo');
    await fs.mkdir(path.dirname(installedSkill), { recursive: true });
    await fs.cp(sourceSkill, installedSkill, { recursive: true });
    const supervisor: EgoBrowserSupervisor = {
      transport: 'ego-browser', session: 'fixture', taskSpace: 'fixture', prepare: async () => {}, browserFetch: async () => ({
        ok: true, status: 200, statusText: 'OK', url: 'https://ourworldindata.org/grapher/life-expectancy', contentType: 'text/html', headers: {}, text: '',
      }),
      evaluate: async () => ({ ok: true }), listTabs: async () => [], selectTab: async () => ({}), navigate: async () => ({}),
      download: async () => ({
        guid: 'fixture-guid', suggestedFilename: 'life-expectancy.filtered.zip', fileName: 'life-expectancy.filtered.zip',
        mimeType: 'application/zip', size: archive.byteLength, bytes: archive,
      }),
      close: async () => {},
    };
    const automation = createPageAutomationCatalog(root, ['.agents/skills']);
    const pages = createPageResourceCatalog(root, ['.agents/skills'], automation);
    expect(await pages.get('open-data-export')).toMatchObject({
      status: 'ready',
      entryUrl: '/pages/open-data-export/',
      agentAction: {
        action: 'Codument.Demo.SOP.OwidOpenDataExport',
        workflowFqn: 'Codument.Owid.OpenDataExport.Workflow.Run',
        inputSchema: { type: 'object' },
      },
      mcpApp: { status: 'ready', viewAsset: 'client/view.js' },
    });
    const resources = await automation.list();
    expect(resources).toContainEqual(expect.objectContaining({
      kind: 'workflow',
      fqn: 'Codument.Owid.OpenDataExport.Workflow.Run',
      inputSchema: expect.objectContaining({ type: 'object' }),
      outputSchema: expect.objectContaining({ type: 'object' }),
    }));
    const runtime: CommandRuntime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => ({ root }) as ReturnType<CommandRuntime['workspace']>,
      page: { skillsDirs: ['.agents/skills'], supervisor, automation },
    };
    const coordinator = createPageWorkflowCoordinator(runtime);
    const workflowInput = { ...input };
    const direct = await coordinator.start({ fqn: 'Codument.Owid.OpenDataExport.Workflow.Run', input: workflowInput });
    expect(await settled(coordinator, direct.runId)).toMatchObject({ status: 'completed', result: { code: 0, data: { rowCount: 2 } } });
    const targets = createMcpPageTargetStore();
    const target = targets.register('open-data-export');
    const pageRun = await coordinator.start({
      fqn: 'Codument.Owid.OpenDataExport.Workflow.Run',
      selector: { fromServedPage: { subject: { byExternalPage: {} }, origin: { byServedPageRef: target.targetRef } } },
      input: workflowInput,
    }, targets);
    expect(await settled(coordinator, pageRun.runId)).toMatchObject({ status: 'completed', result: { code: 0 } });
    expect((targets.get(target.targetRef) as { result?: unknown } | undefined)?.result).toMatchObject({ run: { runId: pageRun.runId, status: 'completed', result: { code: 0 } } });
    await coordinator.close();
  });

  test('sends typed OWID input through the standalone Page using the workflow-owned schema', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-cli-owid-http-'));
    const sourceSkill = path.resolve(import.meta.dir, '../../src/templates/agents/workspace/skills/codument-demo');
    const installedSkill = path.join(root, '.agents/skills/codument-demo');
    await fs.mkdir(path.dirname(installedSkill), { recursive: true });
    await fs.cp(sourceSkill, installedSkill, { recursive: true });
    const automation = createPageAutomationCatalog(root, ['.agents/skills']);
    const sent: string[] = [];
    const runtime: CommandRuntime = {
      resources: {} as CommandRuntime['resources'],
      workspace: () => createWorkspaceEffect(root),
      agent: 'codex',
      codex: {
        listThreads: async () => [{ id: 'codex-task', cwd: root, name: 'Current task' }],
        sendMessage: async ({ message, threadId }) => {
          sent.push(message);
          return { accepted: true, threadId: threadId ?? '', via: 'desktop' };
        },
      },
      page: {
        skillsDirs: ['.agents/skills'],
        automation,
        pages: createPageResourceCatalog(root, ['.agents/skills'], automation),
      },
    };
    const pageInstances = createPageInstanceHub();
    const registrations: Array<Record<string, unknown>> = [];
    const socket = { send(data: string) { registrations.push(JSON.parse(data)); } };
    pageInstances.add(socket);
    pageInstances.message(socket, JSON.stringify({ type: 'page.register', pageName: 'open-data-export' }));
    const targetRef = String(registrations[0].targetRef);
    const app = createHttpApp(runtime, undefined, pageInstances, {
      serveInstance: { serverInstanceId: 'fixture', pid: 1, host: '127.0.0.1', port: 8787, url: 'http://127.0.0.1:8787/' },
    });
    expect((await app.request('/api/agent/bind', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetId: 'codex-task', scopeId: '' }),
    })).status).toBe(200);
    const response = await app.request('/api/agent/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetRef,
        action: 'Codument.Demo.SOP.OwidOpenDataExport',
        input,
      }),
    });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(`targetRef: ${targetRef}`);
    expect(sent[0]).toContain('input: {"chartSlug":"life-expectancy","downloadScope":"displayed","endYear":2023,"entityCodes":["CHN","TUR"],"startYear":2000}');
  });

  test('ships a thin business catalog, dual-host page assets and a two-entry SOP without internal traces', async () => {
    const skillRoot = path.resolve(import.meta.dir, '../../src/templates/agents/workspace/skills/codument-demo');
    const pageRoot = path.join(skillRoot, 'modules/owid-open-data-export/pages/open-data-export');
    const [skill, manifest, html, app, view, styles, sop] = await Promise.all([
      fs.readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'manifest.xnl'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'index.html'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'client/app.js'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'client/view.js'), 'utf8'),
      fs.readFile(path.join(pageRoot, 'styles.css'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/owid-open-data-export/sops/codument-demo--sop--owid-open-data-export.md'), 'utf8'),
    ]);
    expect(skill).toContain('<page name="open-data-export">');
    expect(skill).toContain('Codument.Owid.OpenDataExport.Workflow.Run');
    expect(skill).toContain('Codument.Owid.LifeExpectancy.Page.Chart');
    expect(skill).toContain('全局 `codument`');
    const mcpManifest = await fs.readFile(path.join(skillRoot, 'modules/owid-open-data-export/mcp-apps/OpenDataExport/manifest.xnl'), 'utf8');
    expect(mcpManifest).toContain('inputMode = "workflow"');
    expect(manifest).not.toContain('inputSchema');
    expect(html).toContain('id="refresh-targets"');
    expect(html).toContain('id="bind"');
    expect(app).toContain("refreshTargetsButton.addEventListener('click', refreshTargets)");
    expect(app).toContain('sendAgentTask({ action: SOP_FQN, targetRef, input })');
    expect(styles).toContain('.binding-row > * { min-width: 0; max-width: 100%; }');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(styles).toContain('.binding-row select { grid-column: 1 / -1; }');
    expect(styles).toContain('text-overflow: ellipsis');
    expect(view).toContain("views['open-data-export']");
    expect(view).toContain('previewRows');
    expect(sop).toContain('两个入口');
    expect(sop).toContain('直接入口省略 selector');
    expect(sop).toContain('不得把 targetRef 加进 input');
    expect([skill, manifest, html, app, view, styles, sop].join('\n')).not.toMatch(/EE[-_ ]?SQL|company\.internal/i);
    const [moduleManifest, hostManifest, hostEntry, compatibilityShim] = await Promise.all([
      fs.readFile(path.join(skillRoot, 'modules/owid-open-data-export/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/owid-open-data-export/host/manifest.xnl'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'modules/owid-open-data-export/host/entry.ts'), 'utf8'),
      fs.readFile(path.join(skillRoot, 'PageObject/bundle/index.js'), 'utf8'),
    ]);
    expect(moduleManifest).toContain('<SkillModule #Codument.Demo.Module.OwidOpenDataExport');
    expect(hostManifest).toContain('<HostBundle #Codument.Demo.Module.OwidOpenDataExport.Host');
    expect(hostManifest).toContain('exports = ["PageWorkflow" "PageObject"]');
    expect(hostEntry).toContain('pageWorkflowDefinitions');
    expect(hostEntry).toContain('pageObjectDefinitions');
    expect(hostEntry).not.toContain('inflateRawSync');
    expect(compatibilityShim).toContain('Stable source-import compatibility shim');
    expect(compatibilityShim).not.toContain('ZIP end-of-central-directory');
  });
});
