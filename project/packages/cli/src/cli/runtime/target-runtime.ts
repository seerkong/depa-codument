import type { ClientFetch } from '../effects/browser-provider';

type TargetGlobal = typeof globalThis & { client_fetch?: ClientFetch };

let clientFetchTail: Promise<void> = Promise.resolve();

export async function runWithClientFetch<T>(
  clientFetch: ClientFetch,
  callback: () => T | Promise<T>,
): Promise<T> {
  const run = clientFetchTail.then(
    () => runWithInjectedClientFetch(clientFetch, callback),
    () => runWithInjectedClientFetch(clientFetch, callback),
  );
  clientFetchTail = run.then(() => undefined, () => undefined);
  return run;
}

async function runWithInjectedClientFetch<T>(
  clientFetch: ClientFetch,
  callback: () => T | Promise<T>,
): Promise<T> {
  const target = globalThis as TargetGlobal;
  const previous = Object.getOwnPropertyDescriptor(target, 'client_fetch');
  Object.defineProperty(target, 'client_fetch', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: clientFetch,
  });
  try {
    return await callback();
  } finally {
    if (previous) Object.defineProperty(target, 'client_fetch', previous);
    else Reflect.deleteProperty(target, 'client_fetch');
  }
}
