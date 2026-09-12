import type { DataElementNode } from 'xnl-core';
import type { KnowledgeFamily } from 'depa-codument-domain-contract';

/** Called only for a participating delta family. An absent base is valid for
 * its first registry; it cannot silently turn an existing registry into add/add. */
export function selectKnowledgeArchiveBaseline(track: DataElementNode, family: KnowledgeFamily, currentSources: ReadonlyMap<string, string>): {kind: 'empty'} | {kind: 'git'; commit: string} {
  if (track.tag !== 'Track' || !['modeling', 'engineering'].includes(family)) throw new Error('Knowledge archive baseline requires a Track and known family.');
  const field = `${family}_base_commit`;
  const commit = track.attributes?.[field];
  if (commit === undefined || commit === '') {
    if (currentSources.size) throw new Error(`Track has ${family} deltas but no ${field}; recreate or migrate the Track baseline before archive.`);
    return {kind: 'empty'};
  }
  if (typeof commit !== 'string' || !commit.trim() || /[\x00-\x20\x7f]/.test(commit) || commit.startsWith('-')) throw new Error(`Invalid ${field}; retain source for review.`);
  return {kind: 'git', commit};
}
