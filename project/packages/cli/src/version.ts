import product from '../../../package.json';

// Bun embeds this value in standalone builds; never read the user's workspace manifest.
export const VERSION = product.version;
