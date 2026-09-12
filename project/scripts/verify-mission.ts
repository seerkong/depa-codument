import * as path from 'node:path';
import { verifyCliArchitecture } from './verification/architecture';
import { verifyCliConsumer } from './verification/consumer';
import { verifyDomainCoreConsumer } from './verification/domain-consumer';
import { verifyDomainCapabilities } from './verification/domain-capabilities';
import { verifyWorkspaceAppCore } from './verification/workspace-app';
import { verifyMigrationCore } from './verification/migration';
import { verifyContextEconomy } from './verification/context-economy';
import { verifyServePlacement } from './verification/serve-placement';

const suites = ['architecture', 'consumer', 'serve-placement', 'workspace-app', 'migration', 'capabilities', 'context-economy', 'distribution', 'all'];
const args = process.argv.slice(2).filter((value) => value !== '--');
const suite = args[0];
const root = path.resolve(import.meta.dir, '..');
try {
  if (!suites.includes(suite)) throw new Error('Unknown suite: ' + (suite ?? '(missing)'));
  const options = args.slice(1);
  if (suite === 'context-economy' && options.length === 0) {
    await verifyContextEconomy(root);
  } else if (suite === 'migration' && options.length === 2 && options[0] === '--scope' && options[1] === 'core') {
    await verifyMigrationCore(root);
  } else if (suite === 'workspace-app' && options.length === 2 && options[0] === '--scope' && options[1] === 'core') {
    await verifyWorkspaceAppCore(root);
  } else if (suite === 'capabilities' && options.length === 2 && options[0] === '--scope' && options[1] === 'domain') {
    await verifyDomainCapabilities(root);
  } else if (suite === 'serve-placement') {
    const policy = options.length === 2 && options[0] === '--scope' && options[1] === 'policy';
    if (options.length && !policy) throw new Error('Unsupported serve-placement options; use no options or --scope policy.');
    await verifyServePlacement(root, policy);
  } else if (suite === 'consumer' && options.length === 0) {
    await verifyCliConsumer(root, true, true, true, true);
    console.log(JSON.stringify({status: 'PASS', suite, scope: 'full-host', fullMission: 'UNVERIFIED'}));
  } else {
  const scopes = ['cli', 'skill-app', 'browser', 'vue', 'mcp', 'domain-core'];
  if (options.length !== 2 || options[0] !== '--scope' || !scopes.includes(options[1])) {
    throw new Error('UNVERIFIED: full mission gates are not implemented yet. Available: architecture|consumer --scope ' + scopes.join('|'));
  }
  const level = scopes.indexOf(options[1]);
  if (suite === 'architecture') await verifyCliArchitecture(root, level >= 1, level >= 2, level >= 3, level >= 4, level >= 5);
  else if (suite === 'consumer' && level < 5) await verifyCliConsumer(root, level >= 1, level >= 2, level >= 3, level >= 4);
  else if (suite === 'consumer' && options[1] === 'domain-core') await verifyDomainCoreConsumer(root);
  else throw new Error('UNVERIFIED: ' + suite);
  console.log(JSON.stringify({ status: 'PASS', suite, scope: options[1], fullMission: 'UNVERIFIED' }));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
