import { createProductionCommandRuntime } from '../src/cli/runtime';
import { completeRuntimeProfile, type ProductRuntimeProfiles } from '../src/cli/runtime-profiles';
import { requireResourceFeature, createResourceCommands } from 'halfcode-lite-resource-capsule';
/** Never executed: compile real producer profile and binding failures, not a toy runtime. */
export function productionProfileTypeProof(basic: ProductRuntimeProfiles['basic'], catalog: ProductRuntimeProfiles['catalog']) {
    // @ts-expect-error Browser execution is dynamic, not a basic local profile.
    createProductionCommandRuntime('/unused', { placement: 'local', runtimeProfile: 'browser' });
    completeRuntimeProfile('catalog', catalog);
    requireResourceFeature(catalog);
    // @ts-expect-error The actual production catalog profile must construct all resource ports.
    completeRuntimeProfile('catalog', basic);
    // @ts-expect-error A real catalog cannot be routed to the live host producer.
    completeRuntimeProfile('serve-host', catalog);
    // @ts-expect-error G2 counterexample: static binding must not accept an empty runtime.
    createResourceCommands<{}>({ bin: 'invalid', bind: r => requireResourceFeature(r) });
    // @ts-expect-error Browser selection is not present in the basic execution profile.
    completeRuntimeProfile('browser', basic);
}
