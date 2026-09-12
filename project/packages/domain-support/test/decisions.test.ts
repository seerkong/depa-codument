import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createFileDecisionSourcePort } from '../src';

it('observes process/root/nested sources with legacy labels and rejects ambiguous or symlink authorities', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-decisions-port-'));
  try {
    const active = path.join(root, 'codument/tracks/active/example');
    await fs.mkdir(path.join(active, 'decisions/nested'), { recursive: true });
    await fs.writeFile(path.join(active, 'track.xnl'), 'marker is not parsed by a decision query');
    await fs.writeFile(path.join(active, 'decisions.xnl'), 'root bytes');
    await fs.writeFile(path.join(active, 'decisions/nested/child.xnl'), 'child bytes');
    await fs.writeFile(path.join(active, 'decisions/nested/notes.md'), 'attachment');
    const port = createFileDecisionSourcePort(root);
    const snapshot = await port.read('example');
    expect(snapshot.display).toBe(active);
    expect([...snapshot.sources]).toEqual([['decisions.xnl', 'root bytes'], ['decisions/nested/child.xnl', 'child bytes']]);
    expect(await port.read('codument/tracks/active/example')).toEqual(snapshot);
    expect(await port.read(active)).toEqual(snapshot);
    expect((await port.read('codument/tracks/active/example/decisions.xnl')).sources.get('codument/tracks/active/example/decisions.xnl')).toBe('root bytes');
    const mission = path.join(root, 'codument/missions/pending/example');
    await fs.mkdir(mission, { recursive: true });
    await expect(port.read('example')).rejects.toThrow('Ambiguous');
    await fs.symlink(active, path.join(root, 'linked'));
    await expect(port.read('linked')).rejects.toThrow('symlink');
    await expect(port.read('linked/decisions.xnl')).rejects.toThrow('symlink');
    await fs.writeFile(path.join(root, 'decisions.md'), 'historical authority');
    expect((await port.read(undefined)).findings[0].message).toContain('migration');
    expect(await fs.readFile(path.join(root, 'decisions.md'), 'utf8')).toBe('historical authority');
    await fs.mkdir(path.join(root, 'empty'));
    expect((await port.read('empty')).sources.size).toBe(0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
