import type { BrowserFeatureRuntime, BrowserWebApiFeatureRuntime } from 'halfcode-lite-browser-capsule';
import type { CommandRuntime } from './contracts/command';
import { productRoots } from './runtime/registry';
import { invokeBrowserWebApi } from './runtime/browser-web-api';
export function bindBrowserFeature(runtime: CommandRuntime): BrowserFeatureRuntime {
    return {
        workspace: () => runtime.workspace(),
        defaultBrowserSelection: () => runtime.defaultBrowserSelection?.() ?? Promise.resolve({ transport: 'ego-browser' }),
        browserProviderFor: selection => {
            const provider = runtime.browserProviderFor?.(selection) ?? runtime.browserProvider;
            if (!provider)
                throw new Error('Browser provider effect is not configured');
            return provider;
        },
        registryOptions: productRoots,
    };
}
export function bindBrowserWebApiFeature(runtime: CommandRuntime): BrowserWebApiFeatureRuntime {
    return { invokeBrowserWebApi: input => invokeBrowserWebApi({ ...input, runtime }) };
}
