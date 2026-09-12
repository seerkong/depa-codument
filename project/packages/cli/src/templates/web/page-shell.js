import {
  HOME_TAB, activateAdjacent, closeTabRange, navigationGroups, projectSharedPageBuild,
  reconcileTabs, removeTab, requestedSiteLocation,
} from './page-shell-state.js';
import { mountFederatedSite } from './site-host.js';

const STORAGE_KEY = 'codument.site-shell.tabs.v2';
const HOME_URL = '/workspace/';
const byId = (id) => document.querySelector(`#${id}`);
const menuButton = byId('workspace-menu-button');
const menuClose = byId('workspace-menu-close');
const menu = byId('workspace-menu');
const backdrop = byId('workspace-menu-backdrop');
const menuGroups = byId('workspace-menu-groups');
const tabsRoot = byId('workspace-tabs');
const previousButton = byId('workspace-tab-previous');
const nextButton = byId('workspace-tab-next');
const overflowButton = byId('workspace-tab-overflow-button');
const overflowPanel = byId('workspace-tab-overflow');
const overflowTabs = byId('workspace-tab-overflow-tabs');
const closeLeftButton = byId('workspace-close-left');
const closeRightButton = byId('workspace-close-right');
const closeAllButton = byId('workspace-close-all');
const sessionButton = byId('workspace-session-button');
const sessionPanel = byId('workspace-session');
const sessionClose = byId('workspace-session-close');
const sessionStatus = byId('workspace-session-status');
const sessionTargets = byId('workspace-session-targets');
const home = byId('workspace-home');
const homeGroups = byId('workspace-home-groups');
const siteNavigation = byId('workspace-site-pages');
const defaultSiteContent = byId('workspace-site-default-content');
const siteHostsRoot = byId('workspace-site-hosts');
const framesRoot = byId('workspace-page-frames');
const errorBox = byId('workspace-page-error');
const state = {
  pages: new Map(),
  sites: new Map(),
  tabs: [HOME_TAB],
  active: HOME_TAB,
  activeMounts: new Map(),
};
const frames = new Map();
const buildUsers = new Map();
const siteHosts = new Map();
const mountingSites = new Map();
const siteBuildUsers = new Set();
let buildEvents;
let siteBuildEvents;

function storedTabs() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch { return []; }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tabs.filter((name) => name !== HOME_TAB)));
}

function closeOverlays() {
  menu.hidden = true; overflowPanel.hidden = true; sessionPanel.hidden = true; backdrop.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  overflowButton.setAttribute('aria-expanded', 'false');
  sessionButton.setAttribute('aria-expanded', 'false');
}

function openOverlay(panel, button) {
  const wasOpen = !panel.hidden;
  closeOverlays();
  if (wasOpen) return;
  panel.hidden = false; backdrop.hidden = false; button.setAttribute('aria-expanded', 'true');
  panel.querySelector('button')?.focus();
}

function frameKey(page) {
  return page.runtime?.buildIdentity ?? page.name;
}

function frameUrl(page) {
  if (page.runtime?.type === 'module-federation') {
    return page.runtime.generation
      ? `/page-frame/${encodeURIComponent(page.name)}/${encodeURIComponent(page.runtime.generation)}/`
      : '';
  }
  return `/page-content/${encodeURIComponent(page.name)}/`;
}

function navigateFrame(frame, page, site) {
  frame.dataset.page = page.name;
  frame.dataset.site = site.name;
  frame.dataset.sourceRoute = page.sourceRoute ?? '/';
  frame.title = `${site.navigation.label} · ${page.navigation.label}`;
  try {
    if (frame.contentDocument) frame.contentDocument.title = page.navigation.label;
  } catch { /* The Host only embeds same-origin frames; fail closed if that invariant changes. */ }
  if (page.runtime?.type === 'module-federation') {
    frame.contentWindow?.postMessage({
      type: 'codument.site.navigate',
      siteName: site.name,
      pageName: page.name,
      pageLabel: page.navigation.label,
      sourceRoute: page.sourceRoute ?? '/',
    }, location.origin);
  }
}

function newFrame(page, site) {
  const src = frameUrl(page);
  if (!src) return null;
  const frame = document.createElement('iframe');
  frame.className = 'page-frame';
  frame.dataset.generation = page.runtime?.generation ?? '';
  frame.src = src;
  frame.hidden = true;
  navigateFrame(frame, page, site);
  frame.addEventListener('load', () => {
    navigateFrame(frame, page, site);
    if (state.active === site.name) errorBox.hidden = true;
  });
  return frame;
}

function ensureFrame(page, site, replace = false) {
  const key = frameKey(page);
  const existing = frames.get(key);
  const generationChanged = existing
    && existing.dataset.generation !== (page.runtime?.generation ?? '');
  if (existing && !replace && !generationChanged) {
    navigateFrame(existing, page, site);
    return existing;
  }
  const frame = newFrame(page, site);
  if (!frame) return null;
  if (existing) existing.replaceWith(frame); else framesRoot.append(frame);
  frames.set(key, frame);
  return frame;
}

function openBuild(page, siteName) {
  if (page.runtime?.type !== 'module-federation') return;
  const users = buildUsers.get(page.name) ?? new Set();
  if (users.has(siteName)) return;
  const firstUser = users.size === 0;
  users.add(siteName);
  buildUsers.set(page.name, users);
  if (!firstUser) return;
  void fetch(`/api/pages/${encodeURIComponent(page.name)}/open`, { method: 'POST' })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.ok === false) throw new Error(payload.message || `HTTP ${response.status}`);
      receivePageBuild(payload.page);
    })
    .catch(() => buildUsers.delete(page.name));
}

function activeMount(site) {
  const id = state.activeMounts.get(site.name) ?? site.defaultMount;
  return site.mounts.find((mount) => mount.id === id)
    ?? site.mounts.find((mount) => mount.id === site.defaultMount);
}

function useDefaultSiteContent() {
  defaultSiteContent.append(siteNavigation, framesRoot);
  defaultSiteContent.hidden = false;
  for (const host of siteHosts.values()) host.root.hidden = true;
}

async function ensureSiteHost(site) {
  const runtime = site.runtime;
  if (!runtime || runtime.buildStatus !== 'ready' || !runtime.generation
    || !runtime.remoteEntryUrl || !runtime.mfManifestUrl) {
    useDefaultSiteContent();
    return;
  }
  const existing = siteHosts.get(site.name);
  if (existing?.generation === runtime.generation) {
    existing.root.hidden = false;
    existing.mounted.outlet.append(siteNavigation, framesRoot);
    defaultSiteContent.hidden = true;
    for (const [name, host] of siteHosts) if (name !== site.name) host.root.hidden = true;
    return;
  }
  if (mountingSites.has(site.name)) return mountingSites.get(site.name);
  const mounting = (async () => {
    useDefaultSiteContent();
    existing?.mounted.dispose();
    existing?.root.remove();
    const root = document.createElement('div');
    root.className = 'site-host';
    root.dataset.site = site.name;
    siteHostsRoot.append(root);
    const vueRuntimeUrl = new URL('vendor/vue.js', new URL(runtime.mfManifestUrl, location.origin)).href;
    const vue = await import(vueRuntimeUrl);
    const mounted = await mountFederatedSite({
      siteName: site.name,
      generation: runtime.generation,
      expose: runtime.expose,
      lifecycle: runtime.lifecycle,
      remoteEntryUrl: runtime.remoteEntryUrl,
      mfManifestUrl: runtime.mfManifestUrl,
      origin: location.origin,
      root,
      vue,
    });
    siteHosts.set(site.name, { generation: runtime.generation, root, mounted });
    if (state.active === site.name) {
      mounted.outlet.append(siteNavigation, framesRoot);
      defaultSiteContent.hidden = true;
      root.hidden = false;
    } else {
      root.hidden = true;
    }
  })().finally(() => mountingSites.delete(site.name));
  mountingSites.set(site.name, mounting);
  return mounting;
}

function openSiteBuild(site) {
  if (!site.runtime || siteBuildUsers.has(site.name)) return;
  siteBuildUsers.add(site.name);
  void fetch(`/api/sites/${encodeURIComponent(site.name)}/open`, { method: 'POST' })
    .catch(() => siteBuildUsers.delete(site.name));
}

function activate(name, options = {}) {
  if (name === HOME_TAB) {
    state.active = HOME_TAB; home.hidden = false; siteNavigation.hidden = true;
    useDefaultSiteContent();
    for (const frame of frames.values()) frame.hidden = true;
    persist(); render(); document.title = '工作台首页 · AI CLI Workspace'; errorBox.hidden = true;
    if (options.push !== false && location.pathname !== HOME_URL) {
      history.pushState({ site: HOME_TAB }, '', HOME_URL);
    }
    return;
  }
  const site = state.sites.get(name);
  if (!site || site.status !== 'ready') return;
  const requestedMount = options.mountId
    ? site.mounts.find((mount) => mount.id === options.mountId)
    : undefined;
  const mount = requestedMount ?? activeMount(site);
  if (!mount) return;
  const page = state.pages.get(mount.pageName);
  if (!page || page.status !== 'ready') return;
  state.activeMounts.set(site.name, mount.id);
  if (!state.tabs.includes(name)) state.tabs.push(name);
  openBuild(page, site.name);
  openSiteBuild(site);
  const frame = ensureFrame(page, site);
  state.active = name; home.hidden = true; siteNavigation.hidden = false;
  useDefaultSiteContent();
  void ensureSiteHost(site).catch((error) => {
    if (state.active !== site.name) return;
    errorBox.hidden = false;
    errorBox.querySelector('p').textContent = String(error?.message || error);
  });
  const key = frameKey(page);
  for (const [frameIdentity, pageFrame] of frames) pageFrame.hidden = frameIdentity !== key;
  persist(); render(); document.title = `${mount.label} · ${site.navigation.label}`;
  errorBox.hidden = Boolean(frame);
  if (!frame) {
    errorBox.querySelector('p').textContent = page.runtime?.buildStatus === 'error'
      ? (page.runtime.diagnostics?.[0]?.message ?? 'Vue Page 构建失败')
      : 'Vue Page 正在构建…';
  }
  if (options.push !== false && location.pathname !== mount.url) {
    history.pushState({ site: name, mount: mount.id }, '', mount.url);
  }
  requestAnimationFrame(() =>
    tabsRoot.querySelector(`[data-tab="${CSS.escape(name)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}

function requestedLocation() {
  return requestedSiteLocation(location.pathname, state.sites.values());
}

function closeSiteBuilds(siteName) {
  const site = state.sites.get(siteName);
  if (!site) return;
  if (siteBuildUsers.delete(siteName)) {
    void fetch(`/api/sites/${encodeURIComponent(siteName)}/close`, { method: 'POST' });
  }
  const host = siteHosts.get(siteName);
  if (host) {
    if (state.active === siteName) useDefaultSiteContent();
    host.mounted.dispose();
    host.root.remove();
    siteHosts.delete(siteName);
  }
  for (const pageName of new Set(site.mounts.map((mount) => mount.pageName))) {
    const users = buildUsers.get(pageName);
    if (!users?.delete(siteName)) continue;
    if (users.size) continue;
    buildUsers.delete(pageName);
    void fetch(`/api/pages/${encodeURIComponent(pageName)}/close`, { method: 'POST' });
  }
}

function pruneFrames() {
  const live = new Set();
  for (const siteName of state.tabs) {
    if (siteName === HOME_TAB) continue;
    const site = state.sites.get(siteName);
    for (const mount of site?.mounts ?? []) {
      const page = state.pages.get(mount.pageName);
      if (page) live.add(frameKey(page));
    }
  }
  for (const [key, frame] of frames) {
    if (live.has(key)) continue;
    frame.remove();
    frames.delete(key);
  }
}

function closeTab(name) {
  const next = removeTab(state.tabs, state.active, name);
  if (next.tabs.includes(name)) return;
  closeSiteBuilds(name);
  state.tabs = next.tabs;
  pruneFrames();
  activate(next.active);
}

function closeRange(mode) {
  const next = closeTabRange(state.tabs, state.active, mode);
  for (const siteName of next.removed) closeSiteBuilds(siteName);
  state.tabs = next.tabs; pruneFrames(); closeOverlays(); activate(next.active);
}

function renderTabs() {
  tabsRoot.replaceChildren();
  for (const name of state.tabs) {
    const site = name === HOME_TAB
      ? { description: '所有工作区站点', navigation: { label: '工作台首页' } }
      : state.sites.get(name);
    if (!site) continue;
    const tab = document.createElement('div');
    tab.className = `tab${name === state.active ? ' active' : ''}${name === HOME_TAB ? ' home-tab' : ''}`;
    tab.dataset.tab = name;
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'tab-label';
    label.textContent = site.navigation.label; label.title = site.description;
    label.addEventListener('click', () => activate(name)); tab.append(label);
    if (name !== HOME_TAB) {
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'tab-close'; close.textContent = '×';
      close.setAttribute('aria-label', `关闭${site.navigation.label}`);
      close.addEventListener('click', () => closeTab(name)); tab.append(close);
    }
    tabsRoot.append(tab);
  }
  const index = state.tabs.indexOf(state.active);
  previousButton.disabled = index <= 0;
  nextButton.disabled = index < 0 || index >= state.tabs.length - 1;
}

function appendSiteGroups(root, itemClass) {
  root.replaceChildren();
  for (const sites of navigationGroups([...state.sites.values()])) {
    const section = document.createElement('section');
    section.className = itemClass === 'home-page' ? 'home-group' : 'menu-group';
    const heading = document.createElement('h2');
    heading.textContent = sites[0].navigation.groupLabel; section.append(heading);
    for (const site of sites) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${itemClass}${site.name === state.active ? ' active' : ''}`;
      const label = document.createElement('strong'); label.textContent = site.navigation.label;
      const description = document.createElement('span'); description.textContent = site.description;
      button.append(label, description);
      button.addEventListener('click', () => { activate(site.name); closeOverlays(); });
      section.append(button);
    }
    root.append(section);
  }
}

function renderSiteNavigation() {
  siteNavigation.replaceChildren();
  const site = state.sites.get(state.active);
  if (!site) return;
  const current = activeMount(site);
  for (const mount of site.mounts.filter((candidate) => candidate.visible)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `site-page-link${mount.id === current?.id ? ' active' : ''}`;
    button.textContent = mount.label;
    button.addEventListener('click', () => activate(site.name, { mountId: mount.id }));
    siteNavigation.append(button);
  }
}

function renderOverflow() {
  overflowTabs.replaceChildren();
  for (const name of state.tabs) {
    const site = name === HOME_TAB
      ? { navigation: { label: '工作台首页' } }
      : state.sites.get(name);
    if (!site) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `overflow-tab${name === state.active ? ' active' : ''}`;
    button.textContent = site.navigation.label;
    button.addEventListener('click', () => { activate(name); closeOverlays(); });
    overflowTabs.append(button);
  }
  const index = state.tabs.indexOf(state.active);
  closeLeftButton.disabled = index <= 1;
  closeRightButton.disabled = index < 0 || index >= state.tabs.length - 1;
  closeAllButton.disabled = state.tabs.length <= 1;
}

function render() {
  renderTabs();
  appendSiteGroups(menuGroups, 'menu-item');
  appendSiteGroups(homeGroups, 'home-page');
  renderSiteNavigation();
  renderOverflow();
}

function receivePageBuild(page) {
  if (!page?.name || !state.pages.has(page.name)) return;
  for (const candidate of projectSharedPageBuild(state.pages.values(), page)) {
    state.pages.set(candidate.name, candidate);
  }
  const site = state.sites.get(state.active);
  const mount = site && activeMount(site);
  const activePage = mount && state.pages.get(mount.pageName);
  if (site && activePage) {
    const frame = ensureFrame(activePage, site);
    if (frame) {
      const key = frameKey(activePage);
      for (const [identity, candidate] of frames) candidate.hidden = identity !== key;
    }
    errorBox.hidden = Boolean(frame);
  }
  render();
}

function listenForBuilds() {
  buildEvents = new EventSource('/api/page-build-events');
  buildEvents.addEventListener('page-build', (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    receivePageBuild(payload?.page);
  });
}

function listenForSiteBuilds() {
  siteBuildEvents = new EventSource('/api/site-build-events');
  siteBuildEvents.addEventListener('site-build', (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    const site = payload?.site;
    if (!site?.name || !state.sites.has(site.name)) return;
    state.sites.set(site.name, site);
    if (state.active === site.name) void ensureSiteHost(site);
  });
}

function setSessionState(payload) {
  const connected = Boolean(payload.lockedTargetId);
  sessionButton.dataset.connected = String(connected);
  sessionStatus.textContent = connected ? '已连接' : '未连接';
  sessionTargets.replaceChildren();
  for (const target of payload.targets ?? []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `session-target${target.targetId === payload.lockedTargetId
      && target.scopeId === payload.lockedScopeId ? ' active' : ''}`;
    button.textContent = target.label;
    button.addEventListener('click', async () => {
      sessionStatus.textContent = '连接中…';
      const response = await fetch('/api/agent/bind', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetId: target.targetId, scopeId: target.scopeId || '' }),
      });
      const body = await response.json();
      if (!response.ok || body.ok === false) throw new Error(body.message || `HTTP ${response.status}`);
      await loadSession();
    });
    sessionTargets.append(button);
  }
  if (!(payload.targets ?? []).length) {
    const empty = document.createElement('p');
    empty.className = 'session-empty';
    empty.textContent = '当前 workspace 没有可用会话';
    sessionTargets.append(empty);
  }
}

async function loadSession() {
  try {
    const response = await fetch('/api/agent/targets');
    const payload = await response.json();
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `HTTP ${response.status}`);
    setSessionState(payload);
  } catch (error) {
    sessionButton.dataset.connected = 'false';
    sessionStatus.textContent = String(error?.message || error);
  }
}

async function start() {
  const [pageResponse, siteResponse] = await Promise.all([fetch('/api/pages'), fetch('/api/sites')]);
  const [pagePayload, sitePayload] = await Promise.all([pageResponse.json(), siteResponse.json()]);
  if (!pageResponse.ok || pagePayload.ok === false) throw new Error(pagePayload.message || `HTTP ${pageResponse.status}`);
  if (!siteResponse.ok || sitePayload.ok === false) throw new Error(sitePayload.message || `HTTP ${siteResponse.status}`);
  for (const page of pagePayload.pages ?? []) state.pages.set(page.name, page);
  for (const site of sitePayload.sites ?? []) state.sites.set(site.name, site);
  listenForBuilds();
  listenForSiteBuilds();
  const requested = requestedLocation();
  if (location.pathname !== HOME_URL && !requested) throw new Error(`Site route is unavailable: ${location.pathname}`);
  const restored = reconcileTabs(storedTabs(), [...state.sites.values()], requested?.siteName ?? '');
  state.tabs = restored.tabs;
  if (requested) state.activeMounts.set(requested.siteName, requested.mountId);
  activate(restored.active, { push: false, mountId: requested?.mountId });
  await loadSession();
}

menuButton.addEventListener('click', () => openOverlay(menu, menuButton));
menuClose.addEventListener('click', closeOverlays);
previousButton.addEventListener('click', () => activate(activateAdjacent(state.tabs, state.active, -1)));
nextButton.addEventListener('click', () => activate(activateAdjacent(state.tabs, state.active, 1)));
overflowButton.addEventListener('click', () => openOverlay(overflowPanel, overflowButton));
closeLeftButton.addEventListener('click', () => closeRange('left'));
closeRightButton.addEventListener('click', () => closeRange('right'));
closeAllButton.addEventListener('click', () => closeRange('all'));
sessionButton.addEventListener('click', async () => { await loadSession(); openOverlay(sessionPanel, sessionButton); });
sessionClose.addEventListener('click', closeOverlays);
backdrop.addEventListener('click', closeOverlays);
addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlays(); });
addEventListener('message', (event) => {
  if (event.data?.type === 'codument.session-required') openOverlay(sessionPanel, sessionButton);
  if (event.data?.type !== 'codument.page.route-change') return;
  const site = state.sites.get(state.active);
  const mount = site?.mounts.find((candidate) => candidate.pageName === event.data.pageName);
  if (site && mount && location.pathname !== mount.url) {
    history.replaceState({ site: site.name, mount: mount.id }, '', mount.url);
  }
});
addEventListener('popstate', () => {
  const requested = requestedLocation();
  activate(requested?.siteName ?? HOME_TAB, { push: false, mountId: requested?.mountId });
});

export const shellReady = start();
shellReady.catch((error) => {
  home.hidden = true;
  siteNavigation.hidden = true;
  for (const frame of frames.values()) frame.hidden = true;
  errorBox.hidden = false;
  errorBox.querySelector('p').textContent = String(error?.message || error);
});
