import type { VerificationReceipt, VerificationRequest, VerificationRuntime } from 'depa-codument-domain-contract/lifecycle';
import { parseXnl, type ElementNode } from 'xnl-core';
import { children, first } from './validation-tree';
import { isDataElement } from './registry';

/** A command's obligations survive progress writeback, but not goal, source,
 * acceptance, hook, schedule or unknown-extension changes. Not a semantic verdict. */
export function projectTrackVerificationContract(source: string): string {
  try {
    const parsed = parseXnl(source, { textBlockStyle: true });
    const root = parsed.nodes[0];
    if (parsed.warnings?.length || parsed.nodes.length !== 1 || !isDataElement(root) || root.tag !== 'Track') return source;
    const omit = (node: ElementNode, fields: readonly string[]) => {
      if (!node.attributes) return;
      for (const field of fields) delete node.attributes[field];
      if (!Object.keys(node.attributes).length) delete node.attributes;
    };
    omit(root, ['status', 'updated_at', 'gap_round', 'revision', 'commit']);
    const visit = (node: ElementNode) => {
      omit(node, ['status', 'updated_at', 'commit']);
      for (const name of ['Acceptance', 'Gate']) {
        const group = first(node, name);
        if (group) for (const criterion of children(group)) if (criterion.tag === 'Criterion') omit(criterion, ['checked']);
      }
      const group = first(node, 'SubNodes');
      if (group) for (const child of children(group)) if (child.tag === 'Task' || child.tag === 'TaskGroup') visit(child);
    };
    const space = first(root, 'TaskSpace');
    if (space) {
      const group = first(space, 'SubNodes') ?? space;
      for (const node of children(group)) if (node.tag === 'Task' || node.tag === 'TaskGroup') visit(node);
    }
    // Keep raw comment-shaped spans too: they can contain human obligations.
    // Spans inside strings/text merely cause conservative extra invalidation.
    return JSON.stringify({ root, comments: source.match(/<!--[\s\S]*?(?:-->|$)/g) ?? [] });
  } catch { return source; } // Unknown/invalid input cannot gain a lossy normalized cache key.
}

/** Content-addressed receipts are a projection, never authority for task state. */
export async function runTrackVerification(runtime: VerificationRuntime, input: VerificationRequest): Promise<VerificationReceipt> {
  const request = { ...input, command: [...input.command] };
  if (!request.track || request.command.length === 0 || request.command.some((arg) => typeof arg !== 'string') || !request.command[0]) {
    throw new Error('Verification track and command are required.');
  }
  const before = await runtime.workspace.fingerprint(request.track);
  const beforeId = verificationReceiptId(runtime.digest, request.track, request.command, before);
  if (!request.fresh) {
    const cached = await runtime.receipts.read(request.track, beforeId);
    if (matchesVerificationReceipt(cached, request.track, request.command, before, beforeId)) {
      return { ...cached, command: [...cached.command], reused: true };
    }
  }

  let result: { readonly exitCode: number };
  try {
    result = await runtime.execution.run(request.command, request.captureOutput === true);
  } catch (error) {
    throw new Error(`Verification command could not start: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(`Verification command failed with exit code ${result.exitCode}; task state was not changed.`);
  }

  // Preserve the existing post-command observation (e.g. verification may build
  // generated files). --fresh always executes and never consults the cache.
  const fingerprint = await runtime.workspace.fingerprint(request.track);
  const receipt: VerificationReceipt = {
    version: 1,
    id: verificationReceiptId(runtime.digest, request.track, request.command, fingerprint),
    track: request.track,
    cwd: '.',
    command: [...request.command],
    workspace_fingerprint: fingerprint,
    exit_code: 0,
    verified_at: runtime.clock.nowIso(),
    reused: false,
  };
  await runtime.receipts.write(receipt);
  return receipt;
}

export function verificationReceiptId(
  digest: VerificationRuntime['digest'], track: string, command: readonly string[], fingerprint: string,
): string {
  return `vr-${digest.sha256(JSON.stringify({ version: 1, track, cwd: '.', command, fingerprint })).slice(0, 20)}`;
}

export function matchesVerificationReceipt(
  value: unknown, track: string, command: readonly string[], fingerprint: string, id: string,
): value is VerificationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as Partial<VerificationReceipt>;
  return receipt.version === 1 && receipt.id === id && receipt.track === track && receipt.cwd === '.'
    && receipt.workspace_fingerprint === fingerprint && receipt.exit_code === 0
    && typeof receipt.verified_at === 'string' && !!receipt.verified_at && typeof receipt.reused === 'boolean'
    && Array.isArray(receipt.command) && JSON.stringify(receipt.command) === JSON.stringify(command);
}
