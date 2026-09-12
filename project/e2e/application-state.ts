import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertTemporary, type Run } from './runtime';

/** Mutable business facts never share the delivered source fingerprint domain. */
export function applicationEnvironment(run: Run, phase: string): NodeJS.ProcessEnv {
  assertTemporary(run.root);
  if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid application phase');
  const directory = path.join(run.home,'tmp','app-state',phase);
  fs.mkdirSync(directory,{recursive:true});
  return {...run.env,E2E_DATA_DIR:directory,DATA_FILE:path.join(directory,'store.json')};
}
