import { describe, expect, test } from 'bun:test';
import {
  HOME_TAB, activateAdjacent, closeTabRange, navigationGroups, projectSharedPageBuild,
  reconcileTabs, removeTab, requestedSiteLocation,
} from '../../src/templates/web/page-shell-state.js';

const page = (name, group, order, visible = true, status = 'ready', groupLabel = group) => ({
  name, status, navigation: { label: name, group, groupLabel, order, icon: null, visible },
});

describe('workspace Page Shell state helpers', () => {
  test('always keeps the built-in home before unique ready tabs', () => {
    expect(reconcileTabs(['a', 'stale', 'a'], [page('a', 'one', 1), page('b', 'one', 2)], 'b')).toEqual({
      tabs: [HOME_TAB, 'a', 'b'], active: 'b',
    });
    expect(reconcileTabs([], [page('a', 'one', 1)], '')).toEqual({ tabs: [HOME_TAB], active: HOME_TAB });
  });

  test('home is not closable and closing active tabs chooses a stable neighbor', () => {
    expect(removeTab([HOME_TAB, 'a', 'b'], 'a', 'a')).toEqual({ tabs: [HOME_TAB, 'b'], active: 'b' });
    expect(removeTab([HOME_TAB, 'b'], 'b', 'b')).toEqual({ tabs: [HOME_TAB], active: HOME_TAB });
    expect(removeTab([HOME_TAB], HOME_TAB, HOME_TAB)).toEqual({ tabs: [HOME_TAB], active: HOME_TAB });
  });

  test('switches adjacent tabs and bulk closes ranges without removing home', () => {
    const tabs = [HOME_TAB, 'a', 'b', 'c'];
    expect(activateAdjacent(tabs, 'b', -1)).toBe('a');
    expect(activateAdjacent(tabs, 'b', 1)).toBe('c');
    expect(activateAdjacent(tabs, HOME_TAB, -1)).toBe(HOME_TAB);
    expect(closeTabRange(tabs, 'b', 'left')).toEqual({ tabs: [HOME_TAB, 'b', 'c'], active: 'b', removed: ['a'] });
    expect(closeTabRange(tabs, 'b', 'right')).toEqual({ tabs: [HOME_TAB, 'a', 'b'], active: 'b', removed: ['c'] });
    expect(closeTabRange(tabs, 'b', 'all')).toEqual({ tabs: [HOME_TAB], active: HOME_TAB, removed: ['a', 'b', 'c'] });
  });

  test('groups only visible ready pages in group label and declared order', () => {
    const groups = navigationGroups([
      page('second', 'rules', 20, true, 'ready', 'Rules'),
      page('hidden', 'rules', 5, false, 'ready', 'Rules'),
      page('first', 'rules', 10, true, 'ready', 'Rules'),
      page('failed', 'reports', 1, true, 'error', 'Reports'),
      page('report', 'reports', 30, true, 'ready', 'Reports'),
    ]);
    expect(groups.map((items) => items.map((item) => item.name))).toEqual([['report'], ['first', 'second']]);
  });

  test('resolves a legacy Page entry URL through an explicit Site mount', () => {
    const sites = [{
      name: 'demo', implicit: false,
      mounts: [{ id: 'live', path: '/live', pageName: 'live-vue-dashboard' }],
    }];
    expect(requestedSiteLocation('/pages/live-vue-dashboard/', sites)).toEqual({
      siteName: 'demo', mountId: 'live',
    });
    expect(requestedSiteLocation('/sites/demo/live/', sites)).toEqual({
      siteName: 'demo', mountId: 'live',
    });
  });

  test('projects one PageBundle build receipt to every Page sharing its build identity', () => {
    const idle = (name, sourceRoute) => ({
      name, sourceRoute,
      runtime: { type: 'module-federation', buildIdentity: 'Demo.Bundle', buildStatus: 'idle', generation: null },
    });
    const pages = [idle('overview', '/'), idle('live', '/live'), { name: 'static' }];
    const ready = {
      ...pages[1],
      runtime: { type: 'module-federation', buildIdentity: 'Demo.Bundle', buildStatus: 'ready', generation: 'g-1' },
    };
    expect(projectSharedPageBuild(pages, ready)).toEqual([
      { ...pages[0], runtime: ready.runtime },
      ready,
      pages[2],
    ]);
  });

  test('never projects a build receipt across PageBundle build identities', () => {
    const pages = [
      { name: 'alpha-home', runtime: { buildIdentity: 'Bundle.Alpha', buildStatus: 'idle', generation: null } },
      { name: 'alpha-detail', runtime: { buildIdentity: 'Bundle.Alpha', buildStatus: 'idle', generation: null } },
      { name: 'beta-home', runtime: { buildIdentity: 'Bundle.Beta', buildStatus: 'ready', generation: 'g-beta' } },
    ];
    const built = {
      ...pages[0], runtime: { buildIdentity: 'Bundle.Alpha', buildStatus: 'ready', generation: 'g-alpha' },
    };
    expect(projectSharedPageBuild(pages, built)).toEqual([
      built,
      { ...pages[1], runtime: built.runtime },
      pages[2],
    ]);
  });
});
