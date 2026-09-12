export const VUE_PAGE_SDK_KEY = Symbol.for('codument.page-sdk.vue');
export const VUE_PAGE_CONNECTION_KEY = Symbol.for('codument.page-connection.vue');

function sameOrigin(value, origin, label) {
  const url = new URL(value, origin);
  if (url.origin !== origin) throw new Error(`${label} must use a same-origin URL`);
  return url;
}

function cssAssets(manifest, expose) {
  const record = manifest?.exposes?.find?.((item) => item?.path === expose || `./${item?.name}` === expose);
  const css = record?.assets?.css;
  return [...(css?.sync ?? []), ...(css?.async ?? [])].filter((item) => typeof item === 'string' && item);
}

function runtimeName(value) {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

export async function loadFederatedModule(options) {
  const {
    pageName, expose, generation, remoteEntryUrl, mfManifestUrl,
  } = options;
  const origin = new URL(options.origin).origin;
  sameOrigin(remoteEntryUrl, origin, 'Module Federation remoteEntry');
  const manifestUrl = sameOrigin(mfManifestUrl, origin, 'Module Federation manifest');
  const fetchManifest = options.fetch ?? fetch;
  const documentRef = options.document ?? document;
  const existingRuntimeAssets = new Set(documentRef.querySelectorAll?.('script[src],link[href]') ?? []);
  const generationBase = new URL('.', manifestUrl).href;
  const removeRuntimeAssets = () => {
    for (const element of documentRef.querySelectorAll?.('script[src],link[href]') ?? []) {
      if (existingRuntimeAssets.has(element)) continue;
      const source = element.src || element.href;
      if (typeof source === 'string' && source.startsWith(generationBase)) element.remove?.();
    }
  };
  const response = await fetchManifest(manifestUrl.href);
  if (!response.ok) throw new Error(`Unable to load Module Federation manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  const links = cssAssets(manifest, expose).map((asset) => {
    const url = sameOrigin(new URL(asset, manifestUrl).href, origin, 'Module Federation CSS');
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = url.href;
    link.dataset.pageGeneration = generation;
    documentRef.head.append(link);
    return link;
  });
  const createFederationInstance = options.createFederationInstance
    ?? (await import('/module-federation-runtime.js')).createInstance;
  const remoteName = runtimeName(`${pageName}_${generation}`);
  const hostName = runtimeName(`halfcode_host_${pageName}_${generation}`);
  const instance = createFederationInstance({
    name: hostName,
    remotes: [{ name: remoteName, entry: manifestUrl.href }],
    ...(options.vue ? {
      shared: {
        vue: {
          version: options.vue.version ?? '3.5.41',
          lib: () => options.vue,
          shareConfig: { singleton: true, requiredVersion: '^3.5.0' },
        },
      },
    } : {}),
  });
  try {
    const module = await instance.loadRemote(`${remoteName}/${expose.replace(/^\.\//, '')}`);
    if (!module) throw new Error(`Module Federation expose is unavailable: ${expose}`);
    return {
      module,
      dispose() {
        for (const link of links) link.remove?.();
        removeRuntimeAssets();
      },
    };
  } catch (error) {
    for (const link of links) link.remove?.();
    removeRuntimeAssets();
    throw error;
  }
}

export async function loadVueMfPage(options) {
  const { pageName, generation, root, vue, pageSdk } = options;
  const loaded = await loadFederatedModule(options);
  const connection = options.connection ?? pageSdk.connectPage(pageName);
  let app;
  let disposed = false;
  try {
    const module = loaded.module;
    const component = module?.default ?? module;
    app = vue.createApp(component);
    app.provide(VUE_PAGE_SDK_KEY, pageSdk);
    app.provide(VUE_PAGE_CONNECTION_KEY, connection);
    const cleanup = typeof module?.install === 'function'
      ? await module.install(app, { pageName, generation, root, pageSdk, connection })
      : undefined;
    app.mount(root);
    if (typeof cleanup === 'function') app.__halfcodeCleanup = cleanup;
  } catch (error) {
    connection.close?.();
    loaded.dispose();
    throw error;
  }
  return {
    pageName,
    generation,
    connection,
    dispose() {
      if (disposed) return;
      disposed = true;
      app?.unmount?.();
      app?.__halfcodeCleanup?.();
      connection.close?.();
      loaded.dispose();
    },
  };
}
