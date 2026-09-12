import { BIN, PACKAGE_NAME } from '../packages/cli/src/identity';

export const RELEASE_TARGETS = [
  {
    id: 'darwin-arm64',
    platform: 'darwin',
    architecture: 'arm64',
    bunTarget: 'bun-darwin-arm64',
    packageDirectory: 'runtime-darwin-arm64',
    packageName: `${PACKAGE_NAME}-darwin-arm64`,
    binaryName: BIN,
    nativeFormat: 'mach-o',
  },
  {
    id: 'darwin-x64',
    platform: 'darwin',
    architecture: 'x64',
    bunTarget: 'bun-darwin-x64',
    packageDirectory: 'runtime-darwin-x64',
    packageName: `${PACKAGE_NAME}-darwin-x64`,
    binaryName: BIN,
    nativeFormat: 'mach-o',
  },
  {
    id: 'windows-x64',
    platform: 'win32',
    architecture: 'x64',
    bunTarget: 'bun-windows-x64',
    packageDirectory: 'runtime-windows-x64',
    packageName: `${PACKAGE_NAME}-windows-x64`,
    binaryName: `${BIN}.exe`,
    nativeFormat: 'pe',
  },
] as const;

export type ReleaseTarget = typeof RELEASE_TARGETS[number];
export type ReleaseTargetId = ReleaseTarget['id'];

export function releaseTargetById(id: string): ReleaseTarget {
  const target = RELEASE_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Unsupported release target: ${id}`);
  return target;
}

export function resolveReleaseTarget(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): ReleaseTarget {
  const target = RELEASE_TARGETS.find(
    (candidate) => candidate.platform === platform && candidate.architecture === architecture,
  );
  if (target) return target;
  throw new Error(`${BIN} does not support release target: ${platform}-${architecture}`);
}

export function conflictingReleasePackageNames(target: ReleaseTarget): string[] {
  return RELEASE_TARGETS.map(({ packageName }) => packageName).filter(
    (packageName) => packageName !== target.packageName,
  );
}
