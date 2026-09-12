import * as pageSdk from './page-runner.js';
import { loadVueMfPage } from './vue-mf-runner.js';

const root = document.querySelector('#app');
const error = document.querySelector('#page-error');
const config = document.documentElement.dataset;
let pageConnection;

function applySourceRoute(sourceRoute) {
  const route = typeof sourceRoute === 'string' && sourceRoute.startsWith('/') ? sourceRoute : '/';
  globalThis.__HALFCODE_PAGE_ROUTE__ = route;
  dispatchEvent(new CustomEvent('codument.route', { detail: {
    pageName: config.pageName,
    sourceRoute: route,
  } }));
}

addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'codument.site.navigate') return;
  if (event.data.pageName && event.data.pageName !== config.pageName) {
    config.pageName = event.data.pageName;
    pageConnection?.register?.(config.pageName);
  }
  if (event.data.pageLabel) document.title = event.data.pageLabel;
  applySourceRoute(event.data.sourceRoute);
});

addEventListener('codument.route-change', (event) => {
  const sourceRoute = event.detail?.sourceRoute;
  if (typeof sourceRoute !== 'string' || !sourceRoute.startsWith('/')) return;
  parent.postMessage({
    type: 'codument.page.route-change',
    pageName: config.pageName,
    sourceRoute,
  }, location.origin);
});

async function start() {
  pageConnection = pageSdk.connectPage(config.pageName);
  applySourceRoute(config.sourceRoute);
  const vue = await import(config.vueRuntimeUrl);
  return loadVueMfPage({
    pageName: config.pageName,
    generation: config.generation,
    expose: config.expose,
    remoteEntryUrl: config.remoteEntryUrl,
    mfManifestUrl: config.mfManifestUrl,
    origin: location.origin,
    root,
    vue,
    pageSdk,
    connection: pageConnection,
  });
}

export const frameReady = start();
frameReady.catch((cause) => {
  root.hidden = true;
  error.hidden = false;
  error.textContent = String(cause?.message ?? cause);
});
