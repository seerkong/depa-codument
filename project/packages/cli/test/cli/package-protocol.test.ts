import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PackageProtocolError,
  packagePathSafetyIssue,
  validatePackageProtocol,
} from '../../src/cli/resources/package-protocol';

const roots = new Set<string>();
const contract = 'depa-codument-skill-app-contract';
const compiler = 'halfcode-compiler.xnl';

function installedContractPath(root: string): string {
  return path.join(root, 'node_modules', ...contract.split('/'));
}

afterEach(async () => {
  await Promise.all([...roots].map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.clear();
});

async function protocolFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-package-protocol-'));
  roots.add(root);
  const manifest = {
    name: '@test/protocol',
    type: 'module',
    dependencies: { [contract]: '0.1.1', alpha: '1.0.0' },
  };
  const lockPath = path.join(root, 'bun.lock');
  const lock = {
    lockfileVersion: 1,
    workspaces: {
      '': { name: '@test/protocol', dependencies: { [contract]: '0.1.1', alpha: '1.0.0' } },
    },
    packages: {
      [contract]: [`${contract}@0.1.1`, 'https://registry.example.test/contract.tgz', { dependencies: { [compiler]: '0.3.0' } }, 'sha512-contract'],
      'halfcode-compiler.xnl': ['halfcode-compiler.xnl@0.3.0', 'https://registry.example.test/compiler.tgz', {}, 'sha512-compiler'],
      alpha: ['alpha@1.0.0', 'https://registry.example.test/alpha.tgz', { dependencies: { beta: '^2.0.0' } }, 'sha512-alpha'],
      beta: ['beta@2.1.0', 'https://registry.example.test/beta.tgz', {}, 'sha512-beta'],
      unrelated: ['unrelated@9.0.0', 'https://registry.example.test/unrelated.tgz', {}, 'sha512-unrelated'],
    },
  };
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(manifest, null, 2));
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
  const installedContract = installedContractPath(root);
  await fs.mkdir(path.dirname(installedContract), { recursive: true });
  await fs.symlink(path.resolve(import.meta.dir, '../../../skill-app-contract'), installedContract);
  return { root, manifest, lockPath, lock };
}

describe('package protocol closure', () => {
  test('digests registry, integrity, metadata, and the complete relevant transitive closure only', async () => {
    const value = await protocolFixture();
    const first = await validatePackageProtocol({
      packageRoot: value.root,
      lockPath: value.lockPath,
      manifest: value.manifest,
      dependencyNames: ['alpha'],
    });

    value.lock.packages.unrelated[3] = 'sha512-unrelated-changed';
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    const unrelated = await validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    });
    expect(unrelated.lockDigest).toBe(first.lockDigest);

    value.lock.packages.beta[3] = 'sha512-beta-changed';
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    const integrity = await validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    });
    expect(integrity.lockDigest).not.toBe(first.lockDigest);

    value.lock.packages.alpha[1] = 'https://mirror.example.test/alpha.tgz';
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    const registry = await validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    });
    expect(registry.lockDigest).not.toBe(integrity.lockDigest);

    value.lock.packages['depa-codument-skill-app-contract'][3] = 'sha512-contract-changed';
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    const contractIntegrity = await validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    });
    expect(contractIntegrity.lockDigest).not.toBe(registry.lockDigest);

    (value.lock.packages['depa-codument-skill-app-contract'][2] as { dependencies?: Record<string, string> }).dependencies = {
      [compiler]: '0.3.0',
      'contract-runtime': '^1.0.0',
    };
    Object.assign(value.lock.packages, {
      'depa-codument-skill-app-contract/contract-runtime': [
        'contract-runtime@1.2.0',
        'https://registry.example.test/contract-runtime.tgz',
        {},
        'sha512-contract-runtime',
      ],
    });
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    const contractClosure = await validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    });
    expect(contractClosure.lockDigest).not.toBe(contractIntegrity.lockDigest);
  });

  test('fails closed when a relevant transitive dependency has no resolved tuple', async () => {
    const value = await protocolFixture();
    (value.lock.packages.alpha[2] as { dependencies: Record<string, string> }).dependencies.gamma = '^3.0.0';
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);
  });

  test('accepts Bun npm aliases while retaining their complete resolved tuple', async () => {
    const value = await protocolFixture();
    (value.lock.packages.alpha[2] as { dependencies: Record<string, string> }).dependencies['beta-alias'] = 'npm:beta@^2.0.0';
    Object.assign(value.lock.packages, {
      'alpha/beta-alias': ['beta@2.1.0', 'https://registry.example.test/beta.tgz', {}, 'sha512-beta-alias'],
    });
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    })).resolves.toMatchObject({ contractVersion: '0.1.1', compilerVersion: '0.3.0' });
  });

  test('accepts a scoped Bun workspace tuple and binds it to the exact workspace record', async () => {
    const value = await protocolFixture();
    const shared = '@test/shared';
    (value.manifest.dependencies as Record<string, string>)[shared] = 'workspace:*';
    (value.lock.workspaces[''].dependencies as Record<string, string>)[shared] = 'workspace:*';
    (value.lock.workspaces as Record<string, unknown>)['packages/shared'] = {
      name: shared,
      dependencies: { beta: '^2.0.0' },
    };
    (value.lock.packages as Record<string, unknown>)[shared] = [`${shared}@workspace:packages/shared`];
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha', shared],
    })).resolves.toMatchObject({ contractVersion: '0.1.1', compilerVersion: '0.3.0' });

    (value.lock.packages as Record<string, unknown>)[shared] = [`${shared}@workspace:packages/other`];
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha', shared],
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);
  });

  test('fails closed when the declared contract has no complete resolved tuple', async () => {
    const value = await protocolFixture();
    delete (value.lock.packages as Record<string, unknown>)[contract];
    await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest, dependencyNames: ['alpha'],
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);
  });

  test('rejects malformed contract tuples and versions that disagree with the installed package', async () => {
    const malformed = await protocolFixture();
    (malformed.lock.packages as Record<string, unknown>)[contract] = [null, null, {}, null];
    await fs.writeFile(malformed.lockPath, JSON.stringify(malformed.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: malformed.root, lockPath: malformed.lockPath, manifest: malformed.manifest,
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);

    const mismatched = await protocolFixture();
    (mismatched.lock.packages as Record<string, unknown>)[contract] = [
      `${contract}@9.9.9`, 'https://registry.example.test/contract-9.9.9.tgz', {}, 'sha512-contract-9',
    ];
    await fs.writeFile(mismatched.lockPath, JSON.stringify(mismatched.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: mismatched.root, lockPath: mismatched.lockPath, manifest: mismatched.manifest,
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);

    const wrongArity = await protocolFixture();
    (wrongArity.lock.packages as Record<string, unknown>)[contract] = [
      `${contract}@0.1.1`, 'https://registry.example.test/contract.tgz', {}, 'sha512-contract', 'unexpected',
    ];
    await fs.writeFile(wrongArity.lockPath, JSON.stringify(wrongArity.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: wrongArity.root, lockPath: wrongArity.lockPath, manifest: wrongArity.manifest,
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);

    const workspaceSource = await protocolFixture();
    workspaceSource.lock.packages[contract][1] = 'workspace:packages/fake-contract';
    await fs.writeFile(workspaceSource.lockPath, JSON.stringify(workspaceSource.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: workspaceSource.root, lockPath: workspaceSource.lockPath, manifest: workspaceSource.manifest,
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);
  });

  test('requires the exact published contract spec and installed package identity', async () => {
    for (const spec of ['npm:@evil/not-contract@2.0.0', 'workspace:2.0.0', 'file:../contract-2.0.0']) {
      const value = await protocolFixture();
      (value.manifest.dependencies as Record<string, string>)[contract] = spec;
      (value.lock.workspaces[''].dependencies as Record<string, string>)[contract] = spec;
      await fs.writeFile(value.lockPath, JSON.stringify(value.lock, null, 2));
      await expect(validatePackageProtocol({
        packageRoot: value.root, lockPath: value.lockPath, manifest: value.manifest,
      })).rejects.toMatchObject({ code: 'CONTRACT_VERSION_INVALID' } satisfies Partial<PackageProtocolError>);
    }

    const wrongIdentity = await protocolFixture();
    const installed = installedContractPath(wrongIdentity.root);
    await fs.unlink(installed);
    await fs.mkdir(installed, { recursive: true });
    await fs.writeFile(path.join(installed, 'package.json'), JSON.stringify({
      name: '@evil/not-the-contract', version: '2.0.0', type: 'module',
    }));
    await expect(validatePackageProtocol({
      packageRoot: wrongIdentity.root, lockPath: wrongIdentity.lockPath, manifest: wrongIdentity.manifest,
    })).rejects.toMatchObject({ code: 'LOCK_MISMATCH' } satisfies Partial<PackageProtocolError>);

    const drifted = await protocolFixture();
    const driftedInstalled = installedContractPath(drifted.root);
    await fs.unlink(driftedInstalled);
    await fs.mkdir(driftedInstalled, { recursive: true });
    await fs.writeFile(path.join(driftedInstalled, 'package.json'), JSON.stringify({
      name: contract, version: '2.0.1', type: 'module',
    }));
    drifted.lock.packages[contract][0] = `${contract}@2.0.1`;
    await fs.writeFile(drifted.lockPath, JSON.stringify(drifted.lock, null, 2));
    await expect(validatePackageProtocol({
      packageRoot: drifted.root, lockPath: drifted.lockPath, manifest: drifted.manifest,
    })).rejects.toMatchObject({ code: 'CONTRACT_VERSION_INVALID' } satisfies Partial<PackageProtocolError>);
  });

  test('detects an intermediate directory symlink even when the final file is regular', async () => {
    const value = await protocolFixture();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'halfcode-package-outside-'));
    roots.add(outside);
    await fs.writeFile(path.join(outside, 'entry.ts'), 'export default 1;\n');
    await fs.symlink(outside, path.join(value.root, 'src'));
    expect(await packagePathSafetyIssue(value.root, path.join(value.root, 'src', 'entry.ts')))
      .toContain("path component 'src' is a symbolic link");
  });
});
