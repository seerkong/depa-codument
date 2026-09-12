import { createCodumentWorkspaceInstaller } from 'depa-codument-product-capsule/workspace-install';
const root = process.argv[2];
if (!root) throw new Error('An isolated existing workspace directory is required.');
const result = await createCodumentWorkspaceInstaller(root).install({ agents: ['codex'] });
if (!result.inspection.ready) throw new Error('Installed App is not ready.');
console.log(JSON.stringify({ appId: result.inspection.appId, createdApp: result.createdApp, writtenCount: result.writtenFiles.length }));
