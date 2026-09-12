let bundledRuntime: Promise<Uint8Array> | undefined;

async function buildRuntime(): Promise<Uint8Array> {
  const entry = Bun.resolveSync('@module-federation/runtime', import.meta.dir);
  const result = await Bun.build({
    entrypoints: [entry],
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'none',
    define: {
      FEDERATION_OPTIMIZE_NO_REMOTE: 'false',
      'process.env.NODE_ENV': '"production"',
    },
  });
  if (!result.success || !result.outputs[0]) {
    throw new Error(`Unable to bundle the official Module Federation browser runtime: ${result.logs.map((item) => item.message).join('; ')}`);
  }
  return new Uint8Array(await result.outputs[0].arrayBuffer());
}

export function moduleFederationBrowserRuntime(): Promise<Uint8Array> {
  return bundledRuntime ??= buildRuntime();
}
