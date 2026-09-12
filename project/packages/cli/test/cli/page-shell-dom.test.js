import { afterEach, describe, expect, test } from 'bun:test';

const installed = new Map();
function installGlobal(name, value) {
  installed.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

class FakeElement {
  constructor(tagName, id = '') {
    this.tagName = tagName.toUpperCase(); this.id = id; this.children = []; this.parentElement = null;
    this.listeners = new Map(); this.attributes = new Map(); this.dataset = {}; this.className = '';
    this.hidden = false; this.disabled = false; this.textContent = ''; this.title = ''; this.src = '';
  }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) {
        child.parentElement.children = child.parentElement.children.filter((candidate) => candidate !== child);
      }
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
  replaceWith(next) {
    if (!this.parentElement) return;
    const parent = this.parentElement; const index = parent.children.indexOf(this);
    parent.children[index] = next; next.parentElement = parent; this.parentElement = null;
  }
  addEventListener(type, listener) { const listeners = this.listeners.get(type) ?? []; listeners.push(listener); this.listeners.set(type, listeners); }
  emit(type) { for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  focus() {}
  scrollIntoView() {}
  querySelector(selector) {
    const matches = (element) => {
      if (selector === 'p') return element.tagName === 'P';
      if (selector === 'button') return element.tagName === 'BUTTON';
      const tab = /^\[data-tab="(.+)"\]$/.exec(selector);
      return tab ? element.dataset.tab === tab[1] : false;
    };
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function createDom() {
  const ids = [
    'workspace-menu-button', 'workspace-menu-close', 'workspace-menu', 'workspace-menu-backdrop',
    'workspace-menu-groups', 'workspace-tabs', 'workspace-tab-previous', 'workspace-tab-next',
    'workspace-tab-overflow-button', 'workspace-tab-overflow', 'workspace-tab-overflow-tabs',
    'workspace-close-left', 'workspace-close-right', 'workspace-close-all', 'workspace-session-button',
    'workspace-session', 'workspace-session-close', 'workspace-session-status', 'workspace-session-targets',
    'workspace-home', 'workspace-home-groups', 'workspace-site-pages', 'workspace-site-default-content',
    'workspace-site-hosts', 'workspace-page-frames', 'workspace-page-error',
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement('div', id)]));
  for (const id of ['workspace-menu', 'workspace-tab-overflow', 'workspace-session', 'workspace-home', 'workspace-menu-backdrop']) elements.get(id).hidden = true;
  elements.get('workspace-site-default-content').append(
    elements.get('workspace-site-pages'),
    elements.get('workspace-page-frames'),
  );
  elements.get('workspace-page-error').append(new FakeElement('p'));
  return {
    elements,
    document: {
      title: '',
      querySelector(selector) { return selector.startsWith('#') ? elements.get(selector.slice(1)) ?? null : null; },
      createElement(tagName) { return new FakeElement(tagName); },
    },
  };
}

afterEach(() => {
  for (const [name, descriptor] of installed) descriptor
    ? Object.defineProperty(globalThis, name, descriptor)
    : delete globalThis[name];
  installed.clear();
});

describe('Page Shell DOM lifecycle', () => {
  test('keeps one live iframe per business tab and returns to permanent home after final close', async () => {
    const { document, elements } = createDom();
    const location = { pathname: '/pages/first/' };
    let stored = JSON.stringify(['first', 'second']);
    const pages = ['first', 'second'].map((name, order) => ({
      name, description: `${name} page`, status: 'ready', entryUrl: `/pages/${name}/`,
      navigation: { label: name, group: 'demo', groupLabel: 'Demo', order, icon: null, visible: true },
      ...(name === 'first' ? { runtime: { type: 'module-federation', framework: 'vue', expose: './app', generation: 'g-1', buildStatus: 'ready' } } : {}),
    }));
    const sites = pages.map((page) => ({
      name: page.name,
      description: `${page.name} site`,
      status: 'ready',
      defaultMount: 'page',
      implicit: true,
      entryUrl: `/pages/${page.name}/`,
      navigation: { label: page.name, group: 'demo', groupLabel: 'Demo', order: page.navigation.order, visible: true },
      mounts: [{
        id: 'page', path: '/', pageName: page.name, label: page.name, order: 0, visible: true,
        url: `/pages/${page.name}/`,
      }],
    }));
    let buildEvents;
    class FakeEventSource {
      constructor(url) {
        this.url = url;
        this.listeners = new Map();
        if (url === '/api/page-build-events') buildEvents = this;
      }
      addEventListener(type, listener) { this.listeners.set(type, listener); }
      emit(type, data) { this.listeners.get(type)?.({ data: JSON.stringify(data) }); }
      close() {}
    }
    installGlobal('document', document);
    installGlobal('location', location);
    installGlobal('localStorage', { getItem() { return stored; }, setItem(_key, value) { stored = value; } });
    installGlobal('history', { pushState(_state, _title, pathname) { location.pathname = pathname; } });
    installGlobal('fetch', async (url) => ({
      ok: true,
      status: 200,
      json: async () => url === '/api/pages'
        ? { ok: true, pages }
        : url === '/api/sites'
          ? { ok: true, sites }
          : { ok: true, targets: [], lockedTargetId: '', lockedScopeId: '' },
    }));
    installGlobal('requestAnimationFrame', (callback) => callback());
    installGlobal('CSS', { escape: (value) => value });
    installGlobal('addEventListener', () => {});
    installGlobal('EventSource', FakeEventSource);

    const module = await import(`../../src/templates/web/page-shell.js?test=${Date.now()}`);
    await module.shellReady;

    const frames = elements.get('workspace-page-frames');
    const tabs = elements.get('workspace-tabs');
    expect(frames.children).toHaveLength(1);
    const [firstFrame] = frames.children;
    expect(firstFrame.src).toBe('/page-frame/first/g-1/');
    expect(firstFrame.hidden).toBe(false);
    expect(tabs.children[0].children).toHaveLength(1);
    expect(tabs.children[0].children[0].textContent).toBe('工作台首页');

    buildEvents.emit('page-build', {
      type: 'page.build-ready',
      page: { ...pages[0], runtime: { ...pages[0].runtime, generation: 'g-2' } },
    });
    const refreshedFirstFrame = frames.children[0];
    expect(refreshedFirstFrame).not.toBe(firstFrame);
    expect(refreshedFirstFrame.src).toBe('/page-frame/first/g-2/');
    expect(frames.children).toHaveLength(1);

    tabs.children[2].children[0].emit('click');
    const secondFrame = frames.children[1];
    expect(frames.children).toEqual([refreshedFirstFrame, secondFrame]);
    expect(refreshedFirstFrame.hidden).toBe(true);
    expect(secondFrame.hidden).toBe(false);

    tabs.children[2].children[1].emit('click');
    expect(frames.children).toEqual([refreshedFirstFrame]);
    expect(refreshedFirstFrame.hidden).toBe(false);
    tabs.children[1].children[1].emit('click');
    expect(frames.children).toEqual([]);
    expect(location.pathname).toBe('/workspace/');
    expect(elements.get('workspace-home').hidden).toBe(false);
    expect(tabs.children).toHaveLength(1);
  });
});
