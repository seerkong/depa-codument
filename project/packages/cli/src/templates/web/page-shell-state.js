export const HOME_TAB = '__workspace_home__';

export function requestedSiteLocation(pathname, sites) {
  const siteList = [...sites];
  const siteMatch = /^\/sites\/([a-z0-9][a-z0-9-]*)(\/.*)?$/.exec(pathname);
  if (siteMatch) {
    const site = siteList.find((candidate) => candidate.name === siteMatch[1]);
    const route = siteMatch[2] || '/';
    const normalized = route.length > 1 && route.endsWith('/') ? route.slice(0, -1) : route;
    const mount = site?.mounts.find((candidate) => candidate.path === normalized);
    return site && mount ? { siteName: site.name, mountId: mount.id } : undefined;
  }
  const pageName = /^\/pages\/([a-z0-9][a-z0-9-]*)(?:\/|$)/.exec(pathname)?.[1];
  if (!pageName) return undefined;
  const matches = siteList.flatMap((site) => site.mounts
    .filter((mount) => mount.pageName === pageName)
    .map((mount) => ({ site, mount })));
  const match = matches.find(({ site }) => site.implicit) ?? matches[0];
  return match ? { siteName: match.site.name, mountId: match.mount.id } : undefined;
}

export function projectSharedPageBuild(pages, builtPage) {
  if (!builtPage?.name) return [...pages];
  const identity = builtPage.runtime?.buildIdentity;
  return pages.map((candidate) => {
    if (candidate.name === builtPage.name) return builtPage;
    if (!identity || candidate.runtime?.buildIdentity !== identity) return candidate;
    return { ...candidate, runtime: builtPage.runtime };
  });
}

export function reconcileTabs(stored, pages, requested) {
  const ready = new Set(pages.filter((page) => page.status === 'ready').map((page) => page.name));
  const restored = [...new Set(Array.isArray(stored) ? stored : [])].filter((name) => ready.has(name));
  const tabs = [HOME_TAB, ...restored];
  if (ready.has(requested) && !tabs.includes(requested)) tabs.push(requested);
  return { tabs, active: ready.has(requested) ? requested : HOME_TAB };
}

export function removeTab(tabs, active, removed) {
  if (removed === HOME_TAB) return { tabs: [...tabs], active };
  const index = tabs.indexOf(removed);
  if (index < 0) return { tabs: [...tabs], active };
  const remaining = tabs.filter((name) => name !== removed);
  if (active !== removed) return { tabs: remaining, active };
  return { tabs: remaining, active: remaining[Math.min(index, remaining.length - 1)] ?? HOME_TAB };
}

export function activateAdjacent(tabs, active, direction) {
  const index = tabs.indexOf(active);
  if (index < 0) return HOME_TAB;
  return tabs[Math.max(0, Math.min(tabs.length - 1, index + Math.sign(direction)))] ?? HOME_TAB;
}

export function closeTabRange(tabs, active, mode) {
  const activeIndex = tabs.indexOf(active);
  const business = tabs.filter((name) => name !== HOME_TAB);
  let removed = [];
  if (mode === 'all') removed = business;
  else if (activeIndex >= 0 && mode === 'left') removed = tabs.slice(1, activeIndex).filter((name) => name !== HOME_TAB);
  else if (activeIndex >= 0 && mode === 'right') removed = tabs.slice(activeIndex + 1).filter((name) => name !== HOME_TAB);
  const removedSet = new Set(removed);
  const remaining = tabs.filter((name) => !removedSet.has(name));
  return {
    tabs: remaining.length ? remaining : [HOME_TAB],
    active: removedSet.has(active) ? HOME_TAB : active,
    removed,
  };
}

export function navigationGroups(pages) {
  const visible = pages.filter((page) => page.status === 'ready' && page.navigation.visible);
  visible.sort((left, right) => left.navigation.groupLabel.localeCompare(right.navigation.groupLabel)
    || left.navigation.order - right.navigation.order
    || left.navigation.label.localeCompare(right.navigation.label));
  const groups = new Map();
  for (const page of visible) {
    const group = groups.get(page.navigation.group) ?? [];
    group.push(page);
    groups.set(page.navigation.group, group);
  }
  return [...groups.values()];
}
