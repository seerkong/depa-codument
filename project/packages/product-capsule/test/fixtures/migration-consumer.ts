import { createCodumentWorkspaceMigrator } from '../../src/workspace-migration';
import { readCodumentMigrationGuidance } from '../../src/migration-guidance';

if (process.argv[2] === 'guide') console.log(readCodumentMigrationGuidance('decision'));
else if (process.argv[2]) console.log(JSON.stringify(await createCodumentWorkspaceMigrator(process.argv[2]).upgrade()));
else throw new Error('Expected guide or isolated workspace path.');
