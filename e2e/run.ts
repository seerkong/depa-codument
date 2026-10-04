/** Pre-refactor product, current shared acceptance. No global/source fallback. */
if (process.argv.some(arg=>arg==='--product'||arg.startsWith('--product='))) throw new Error('Root e2e fixes product=legacy; use project/e2e for current');
process.env.E2E_PRODUCT_PROFILE='legacy';
await import('../project/e2e/run');
