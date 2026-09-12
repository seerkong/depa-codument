import type { DataElementNode } from 'xnl-core';
import type { HistoricalCompletionView } from 'depa-codument-domain-contract';
import { digestCanonical } from 'halfcode-cli-lite-skill-app-contract/resource';
import { attr } from './validation-tree';

const BASIS = 'legacy-declared/v1';
const FIELDS = ['completion_basis', 'completion_source_path', 'completion_source_fingerprint', 'completion_body_digest'];
export function hasHistoricalCompletion(root: DataElementNode): boolean {
  return FIELDS.some(field => field in (root.attributes ?? {}));
}
function archived(path: string): boolean {
  return /(?:^|\/)codument\/(?:tracks\/archived|archive)\/.+\/(?:track\.(?:xnl|xml)|plan\.xml)$/u.test(path)
    && !path.split('/').some(part => part === '..' || part === '.');
}
function bodyDigest(root: DataElementNode): string {
  const value = structuredClone(root);
  for (const field of FIELDS) delete value.attributes?.[field];
  return digestCanonical(value);
}

/** Called only at the legacy-envelope migration boundary, not by scaffolds. */
export function recordHistoricalCompletion(root: DataElementNode, path: string, source: string): DataElementNode {
  if (hasHistoricalCompletion(root)) throw new Error('Legacy source already carries reserved completion provenance; review required.');
  if (root.tag !== 'Track' || attr(root, 'status') !== 'completed' || !archived(path)) return root;
  const value = structuredClone(root);
  value.attributes = { ...value.attributes, completion_basis: BASIS, completion_source_path: path,
    completion_source_fingerprint: digestCanonical({ source }), completion_body_digest: bodyDigest(root) };
  return value;
}

/** A content binding, not a signature or proof of historical verification. */
export function historicalCompletion(root: DataElementNode, file: string): HistoricalCompletionView | undefined {
  if (!hasHistoricalCompletion(root)) return undefined;
  if (root.tag !== 'Track' || attr(root, 'status') !== 'completed' || !archived(file)
    || attr(root, 'completion_basis') !== BASIS || !archived(attr(root, 'completion_source_path') ?? '')
    || !/^sha256:[a-f0-9]{64}$/u.test(attr(root, 'completion_source_fingerprint') ?? '')
    || attr(root, 'completion_body_digest') !== bodyDigest(root)) {
    throw new Error('Historical completion provenance is invalid, moved outside archive or changed; current verification is not established.');
  }
  return { basis: BASIS, currentVerification: 'not-reverified' as const,
    sourcePath: attr(root, 'completion_source_path')!, sourceFingerprint: attr(root, 'completion_source_fingerprint')! };
}
