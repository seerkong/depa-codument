import type { ServeFeatureRuntime, PageLiveFeatureRuntime } from 'halfcode-lite-serve-capsule';
import type { CommandRuntime } from './contracts/command';
import { waitForShutdown } from './lifecycle';
import { serverInstanceId } from './runtime/ego-scope';
import { invokeServeLifecycle, invokePageWorkflowStart, invokePageWorkflowGet, invokePageObjectAction } from './app/invoke';
import { admitResourceDefinition, normalizePageWorkflowSelector, validateResourceValue } from './resources/schema-validator';
export function bindServeFeature(runtime: CommandRuntime): ServeFeatureRuntime {
    return { foreground: Boolean(process.env.CODUMENT_SERVER_INSTANCE_ID),
        lifecycle: input => invokeServeLifecycle(runtime, input),
        async startForeground({ host, port }) {
            const effect = runtime.httpServer;
            if (!effect)
                throw new Error('HTTP server effect is not configured');
            const started = effect.start({
                runtime: runtime,
                host,
                port,
                serverInstanceId: process.env.CODUMENT_SERVER_INSTANCE_ID?.trim() || serverInstanceId(),
            });
            return {
                port: started.port, url: started.url,
                wait: waitForShutdown(async () => {
                    const results = await Promise.allSettled([started.stop()]);
                    // Legacy injected runtimes have no aggregate owner; retain their explicit cleanup.
                    if (!runtime.close) {
                        results.push(...await Promise.allSettled([runtime.page?.workflows?.close()]));
                        results.push(...await Promise.allSettled([runtime.page?.supervisor?.close()]));
                    }
                    const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
                    if (failures.length)
                        throw new AggregateError(failures, 'Serve shutdown failed');
                }),
            };
        },
    };
}
export function bindPageLiveFeature(runtime: CommandRuntime): PageLiveFeatureRuntime {
    return {
        async admitWorkflow({ fqn, workflowInput, selector }) {
            const definitions = runtime.definitionCatalog;
            if (!definitions)
                throw new Error('PageWorkflow definition catalog is not configured');
            const definition = await definitions.detail(fqn);
            if (definition.kind !== 'PageWorkflow')
                throw new Error(`${fqn} is not a PageWorkflow`);
            admitResourceDefinition(definition);
            validateResourceValue(fqn, 'input', 'inputSchema', definition.inputSchema, workflowInput);
            normalizePageWorkflowSelector(fqn, selector === undefined ? definition.defaultSelector : selector);
        },
        lifecycle: input => invokeServeLifecycle(runtime, input),
        startWorkflow: input => invokePageWorkflowStart(runtime, input),
        getWorkflow: runId => invokePageWorkflowGet(runtime, runId),
        invokePageObject: input => invokePageObjectAction(runtime, input),
    };
}
