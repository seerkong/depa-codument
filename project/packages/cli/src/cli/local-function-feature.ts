import type { LocalFunctionFeatureRuntime } from 'halfcode-lite-local-function-capsule';
import type { CommandRuntime } from './contracts/command';
import { prepareLocalFunctionExecution } from './runtime/local-function-execution';
export function bindLocalFunctionFeature(runtime: CommandRuntime): LocalFunctionFeatureRuntime {
    if (!runtime.localFunctions)
        throw new Error('Local function catalog is not configured');
    return {
        localFunctions: runtime.localFunctions,
        async invokeLocalFunction({ fqn, input, config, profile }) {
            const prepared = await prepareLocalFunctionExecution(runtime, fqn, profile);
            prepared.validate(input, config);
            if (prepared.placement === 'local')
                return prepared.invoke(input, config);
            if (!runtime.invokeServeLocalFunction)
                throw new Error('LocalFunction requires the Serve invocation port; a CLI-private PageWorkflow coordinator is not allowed');
            return runtime.invokeServeLocalFunction({ fqn, input, config, profile: prepared.profile, admissionDigest: prepared.admissionDigest });
        },
    };
}
