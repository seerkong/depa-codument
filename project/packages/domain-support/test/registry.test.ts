import { expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { readXnlRegistrySources } from '../src';

it('reads recursive registry sources in portable order and skips hidden trees/non-XNL attachments', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codument-registry-effect-'));
  try {
    for (const file of ['z.xnl', 'alpha/nested/b.xnl', 'alpha/a.XNL', '.tmp/ignored.xnl', 'alpha/.meta/ignored.xnl', 'notes.md']) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), file);
    }
    const sources = await readXnlRegistrySources(root);
    expect([...sources.keys()]).toEqual(['alpha/a.XNL', 'alpha/nested/b.xnl', 'z.xnl']);
    expect(sources.get('z.xnl')).toBe('z.xnl');
    expect((await readXnlRegistrySources(path.join(root, 'missing'))).size).toBe(0);
    await fs.symlink(path.join(root, 'z.xnl'), path.join(root, 'alias.xnl'));
    await expect(readXnlRegistrySources(root)).rejects.toThrow('symlink');
    await expect(readXnlRegistrySources('.')).rejects.toThrow('absolute');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
