import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const upstream = '/Users/kongweixian/infra-dev/halfcode-cli/halfcode-cli-lite';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'contract-build-repro-'));
try {
  if (process.argv.includes('--preload')) {
    const contract = await import(path.join(upstream, 'packages/skill-app-contract-public/src/app.ts'));
    console.log(contract.defineSkillApp({ fqn: 'Test.App', name: 'test', modules: [], sites: [], pageBundles: [] }));
  }
  if (process.argv.includes('--native')) {
    await import(path.join(upstream, 'packages/skill-app-contract/src/host'));
    await import(path.join(upstream, 'packages/skill-app-contract/src/site'));
    await import(path.join(upstream, 'packages/skill-app-contract/src/vue'));
    await import(path.join(upstream, 'packages/skill-app-contract/src/resource'));
    const contract = await import(path.join(upstream, 'packages/skill-app-contract/src/app'));
    console.log(contract.defineSkillApp({ fqn: 'Test.Native', name: 'native', modules: [], sites: [], pageBundles: [] }));
  }
  await fs.mkdir(path.join(root, 'node_modules/@halfcode-cli-lite'), { recursive: true });
  await fs.symlink(path.join(upstream, 'packages/skill-app-contract'), path.join(root, 'node_modules/@halfcode-cli-lite/skill-app-contract'));
  for (let attempt = 0; attempt < 3; attempt++) {
  const stage = path.join(root, `stage-${attempt}`);
  await fs.mkdir(path.join(stage, 'node_modules/@halfcode-cli-lite'), { recursive: true });
  await fs.symlink(path.join(root, 'node_modules/@halfcode-cli-lite/skill-app-contract'), path.join(stage, 'node_modules/@halfcode-cli-lite/skill-app-contract'));
  await fs.writeFile(path.join(stage, 'app.ts'), 'export { defineSkillApp } from "@halfcode-cli-lite/skill-app-contract/app";');
  console.log(new Bun.Transpiler({ loader: 'ts' }).scanImports(await fs.readFile(path.join(stage, 'app.ts'), 'utf8')));
  const result = await Bun.build({ entrypoints: [path.join(stage, 'app.ts')], outdir: path.join(root, 'output'), target: 'bun', packages: 'bundle' });
  console.log({ success: result.success, logs: result.logs });
  if (result.success) console.log(Object.keys(await import(result.outputs[0].path + `?attempt=${attempt}`)));
  if (!result.success) process.exitCode = 1;
  await fs.rm(stage, { recursive: true, force: true });
  }
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
