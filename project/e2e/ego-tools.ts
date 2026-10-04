import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const EGO_SKILL = path.join(os.homedir(), '.agents/skills/ego-browser');
export function resolveEgo(): { executable: string; installRoot: string } {
  const executable = process.env.E2E_EGO_BINARY ?? path.join(os.homedir(), '.local/bin/ego-browser');
  const real = fs.realpathSync(executable);
  return { executable, installRoot: path.dirname(path.dirname(real)) };
}
export function egoToolPaths(): { read: string[]; write: string[] } {
  return { read: [resolveEgo().installRoot, path.join(os.homedir(), '.local/share/ego'), EGO_SKILL], write: [] };
}
/** Supplied by the owner; never create/claim a replacement space on failure. */
export function egoSpace(): number {
  const id = Number(process.env.E2E_EGO_SPACE_ID);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('E2E_EGO_SPACE_ID must identify the owner-created Ego TaskSpace');
  return id;
}
