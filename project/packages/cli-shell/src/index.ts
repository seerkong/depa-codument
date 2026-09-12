import { createCodumentDomainHost, type CodumentDomainBindings } from 'depa-codument-product-capsule';
import { parseShellArgs, runCli, type ShellEffects, type ShellInvocation } from 'halfcode-cli-lite-cli-host-shell';
import { formatCodumentDomainResult } from './output';
export { formatCodumentDomainResult } from './output';

/** This internal slice does not register or bypass the three paused product commands. */
export async function runCodumentDomainCli(invocation: ShellInvocation, effects: ShellEffects,
  bindings: (root: string) => CodumentDomainBindings): Promise<number> {
  const { json } = parseShellArgs(invocation.args);
  const host = createCodumentDomainHost(root => ({ ...bindings(root), json }));
  try { return await runCli({ ...host, async dispatch(args, root) {
    const result = await host.dispatch(args, root);
    effects.output.write(formatCodumentDomainResult(result, json));
    return { ...result, render: 'none' };
  } }, invocation, effects); }
  finally { await host.dispose(); }
}
