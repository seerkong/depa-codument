# depa-codument-page-builder-vue-support

Host-owned, version-pinned Vue 3 and official `@module-federation/vite` builder used by the CLI runtime.

The public `depa-codument-skill-app-contract/page-build` owns the request/receipt/observer contracts. This package implements the build effect; `./worker-port` provides isolated Bun worker startup, event validation and close. The default worker is resolved within this installed package, while executable-adjacent layouts are explicitly bound by the product. Importing the worker port does not load Vite or start a process.

Legacy Vue resources may continue to provide only XNL metadata and a source tree. Package-authored PageBundles may additionally carry normal `package.json`, `tsconfig.json`, `vite.config.ts`, and `module-federation.config.ts` files for IDE and standalone engineering workflows. The Host validates and digests that package closure, but retains final build authority and does not execute app-owned configuration or lifecycle scripts implicitly.
