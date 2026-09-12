import assert from 'node:assert/strict';
import { lifecycleSourceCodec, readStableNodeId, indexKnowledgeSources, validateKnowledgeIndex, knowledgeArchiveOwnerFile, proposeArchiveBehaviors, indexXnlRegistry } from 'depa-codument-domain-logic';

type Element = ReturnType<typeof lifecycleSourceCodec.inspect>['root'];
/** Reuse the public syntax codec, but keep acceptance decisions in this oracle. */
export function resourceRoot(source: string, kind: 'track'|'mission') {
  return lifecycleSourceCodec.inspect(source,kind).root;
}

/** A dated archive directory is a location, not the authored resource identity. */
export function trackValidationSelection(relativeDirectory: string, source: string) {
  const root = resourceRoot(source,'track');
  const id = readStableNodeId(root);
  assert.ok(id, 'Track identity missing');
  const match = /^codument\/tracks\/(active|pending|archived)\/(.+)$/.exec(relativeDirectory);
  assert.ok(match, 'Track is outside an admitted lifecycle directory');
  const archived = match[1] === 'archived';
  if (!archived) assert.equal(match[2],id,'Track directory and authored identity differ');
  return {root,id,archived,selector:archived ? `archived/${match[2]}` : id};
}

export function validateArchivedKnowledge(sources: ReadonlyMap<string,string>, family: 'modeling'|'engineering') {
  assert.ok(sources.size > 0, `Missing archived ${family} deltas`);
  const findings = validateKnowledgeIndex(indexKnowledgeSources(sources,family,'deltas'));
  assert.equal(findings.filter(f => f.severity === 'error').length,0,`Archived ${family} delta errors: ${JSON.stringify(findings)}`);
  return findings;
}
function semanticJson(value: unknown): string {
  return JSON.stringify(value, (_key,item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().filter(key => !(item.kind === 'TextElement' && key === 'textMarker')).map(key => [key,item[key]]));
  });
}

/** Fresh-app delivery snapshots must be present in their actual promoted owner. */
export function assertPromotedKnowledge(deltas: ReadonlyMap<string,string>, canonical: ReadonlyMap<string,string>, family: 'modeling'|'engineering'): void {
  validateArchivedKnowledge(deltas,family);
  const expected = indexKnowledgeSources(deltas,family,'deltas');
  const actual = indexKnowledgeSources(canonical,family);
  assert.ok(actual.ready, 'Invalid promoted knowledge registry');
  assert.ok(expected.registry.index.size > 0, 'Empty archived knowledge cannot prove delivery');
  for (const [id,member] of expected.registry.index) {
    const promoted = actual.registry.index.get(id);
    assert.ok(promoted, `Archived ${family} member ${id} was not promoted`);
    assert.equal(promoted.file,knowledgeArchiveOwnerFile(member.file,family),'Promoted knowledge owner mismatch');
    assert.equal(semanticJson(promoted.node),semanticJson(member.node),`Promoted ${family} member ${id} differs from delivered snapshot`);
  }
}

export function assertPromotedBehaviors(patches: ReadonlyMap<string,string>, canonical: ReadonlyMap<string,string>): void {
  assert.ok(patches.size > 0 && canonical.size > 0, 'Missing behavior promotion sources');
  // These fresh application cases author Upsert delivery patches. Reapplying
  // them must not change any semantic fact. Non-idempotent historical mutations
  // require baseline-aware verification rather than an unqualified PASS here.
  const proposal = proposeArchiveBehaviors({canonicalSources:canonical,patchSources:patches});
  for (const [file,source] of proposal.updates) {
    assert.ok(canonical.has(file),`Behavior ${file} was not promoted`);
    const parse = (text: string) => indexXnlRegistry(new Map([[file,text]]),{registryName:'e2e-behavior'},{shouldIndex:()=>false});
    const before = parse(canonical.get(file)!); const after = parse(source);
    assert.ok(before.ready && after.ready,'Invalid promoted Behavior source');
    assert.equal(semanticJson(before.files.get(file)),semanticJson(after.files.get(file)),`Behavior ${file} does not contain its archived delivery`);
  }
}
function elements(value: unknown): Element[] {
  if(!value || typeof value!=='object') return [];
  if(Array.isArray(value)) return value.flatMap(elements);
  const self=(value as {kind?:string}).kind==='DataElement' ? [value as Element] : [];
  return [...self,...Object.values(value).flatMap(elements)];
}

/** CLI-owned round state and the terminal report override a model's delivered claim. */
export function exhaustedGapReason(source: string, kind: 'track'|'mission', reports: readonly string[]): string | undefined {
  const root=resourceRoot(source,kind);
  const round=root.attributes?.gap_round;
  if (!Number.isInteger(round) || Number(round)<1) return;
  const blockers=elements(root).filter(node=>node.tag==='GapLoop' && node.attributes?.on_exhausted==='block'
    && Number.isInteger(node.attributes?.max_rounds) && Number(round)>=Number(node.attributes?.max_rounds));
  if (!blockers.length) return;
  const verdicts=reports.map(text=>{
    const section=text.split(/^##\s+(?:Verdict|结论|判定)\s*$/m).at(-1)!;
    return /(?:^|\n)\s*(?:status:\s*)?(?:`|\*\*)?(NO_GAP|FIX_APPLIED|BLOCKED)(?:`|\*\*)?(?=\s|[—:.-]|$)/m.exec(section)?.[1];
  });
  if (verdicts.length >= blockers.length && verdicts.every(verdict=>verdict==='NO_GAP')) return;
  if (blockers.length>1 || verdicts.length>1) return 'Harness unsupported: multiple exhausted GapLoop scopes need scope-bound terminal evidence; mixed or missing reports cannot be called a business block or PASS';
  return `${kind} ${readStableNodeId(root)}: gap_round=${round} reached configured on_exhausted=block; terminal round verdict=${verdicts.join(',') || 'missing/ambiguous'}. No automatic outer retry is allowed.`;
}
export function assertNestedSelection(rootSources: string[], childSources: string[]) {
  const roots=rootSources.map(s=>resourceRoot(s,'mission'));
  const children=childSources.map(s=>resourceRoot(s,'mission'));
  const root=roots.find(r=>elements(r).some(e=>e.tag==='MissionLink'));
  assert.ok(root,'Missing root Mission');
  assert.equal(root.attributes?.status,'completed','Root delivery must be completed');
  const all=elements(root);
  const links=all.filter(e=>e.tag==='MissionLink');
  assert.ok(links.length>0);
  for(const link of links){
    assert.equal(link.attributes?.completion_mode,'selected-tasks');
    const child=children.find(c=>readStableNodeId(c)===link.attributes?.mission_ref);
    assert.ok(child,'MissionLink must resolve to actual child');
    assert.equal(child.attributes?.status,'active','Child backlog must remain autonomous');
    const parents=elements(child).filter(e=>e.tag==='ParentMission');
    assert.equal(parents.length,1);
    assert.equal(parents[0]!.attributes?.mission_ref,readStableNodeId(root));
    assert.equal(parents[0]!.attributes?.link_ref,readStableNodeId(link));
    const selected=elements(link).filter(e=>e.tag==='TaskRef');
    assert.ok(selected.length>0,'Selected delivery cannot be empty');
    const tasks=elements(child).filter(e=>e.tag==='Task');
    for(const ref of selected){
      const task=tasks.find(t=>readStableNodeId(t)===(ref.attributes?.ref ?? ref.attributes?.task_ref));
      assert.ok(task,'Selected child Task must exist');
      assert.equal(task.attributes?.status,'DONE','Selected child Task is not done');
      assert.equal(elements(task).filter(e=>e!==task && (e.tag==='Task'||e.tag==='TaskGroup')).length,0,'Selected Task must be a leaf');
    }
    assert.ok(tasks.some(t=>!['DONE','ABANDONED','SUPERSEDED'].includes(String(t.attributes?.status))),'Child must retain genuine unfinished work');
  }
  assert.ok(all.some(e=>e.tag==='TrackLink' && e.attributes?.project_ref && e.attributes?.mission_ref && e.attributes?.track_ref),'Explicit cross-layer TrackLink required');
}
