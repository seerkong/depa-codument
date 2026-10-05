import * as path from 'node:path';
import type { GlobalInstallCommandRuntime } from 'halfcode-lite-management-capsule';
import type { CommandRuntime } from './contracts/command';
import { applyGlobalInstall, resolveInstallHome } from './global-install';
export function bindGlobalInstallFeature(runtime: CommandRuntime): GlobalInstallCommandRuntime {
    return { async install(operation, agent) {
            const home = resolveInstallHome();
            const receipt = await applyGlobalInstall(runtime.resources, root => runtime.workspace(path.join(home, root ?? '.')), home, operation, agent);
            return { ...receipt, home };
        } };
}
