import { loadFederatedModule } from './vue-mf-runner.js';

export async function mountFederatedSite(options) {
  const loaded = await loadFederatedModule({
    ...options,
    pageName: options.siteName,
  });
  const module = loaded.module;
  const component = module?.default ?? module;
  const app = options.vue.createApp(component);
  const context = Object.freeze({
    siteName: options.siteName,
    generation: options.generation,
    root: options.root,
  });
  const mount = module?.[options.lifecycle.mount];
  const unmount = module?.[options.lifecycle.unmount];
  if (typeof mount !== 'function' || typeof unmount !== 'function') {
    loaded.dispose();
    throw new Error(`Site lifecycle exports are unavailable: ${options.lifecycle.mount}/${options.lifecycle.unmount}`);
  }
  let cleanup;
  let disposed = false;
  try {
    cleanup = await mount(app, context);
    app.mount(options.root);
  } catch (error) {
    loaded.dispose();
    throw error;
  }
  const outlet = options.root.querySelector?.('[data-halfcode-site-outlet]') ?? options.root;
  return {
    siteName: options.siteName,
    generation: options.generation,
    outlet,
    dispose() {
      if (disposed) return;
      disposed = true;
      app.unmount?.();
      if (typeof cleanup === 'function') cleanup();
      unmount(context);
      loaded.dispose();
      options.root.replaceChildren?.();
    },
  };
}
