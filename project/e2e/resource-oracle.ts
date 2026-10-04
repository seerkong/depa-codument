import assert from 'node:assert/strict';
import { indexXnlRegistry, inspectLifecycleIdentity, isDataElement, lifecycleSourceCodec, readStableNodeId } from 'depa-codument-domain-logic';
import type { ProductProfileId } from './product-profile';

type Element = ReturnType<typeof lifecycleSourceCodec.inspect>['root'];
/** Observe the selected version's envelope; never migrate the tested product. */
export function resourceIdentity(source: string, kind: 'track'|'mission', product: ProductProfileId = 'current') {
  if (product === 'current') return inspectLifecycleIdentity(source,kind);
  const registry=indexXnlRegistry(new Map([['resource.xnl',source]]),{registryName:'e2e-legacy-envelope'}, {shouldIndex:()=>false});
  const nodes=registry.files.get('resource.xnl')??[];
  const root=nodes[0];
  const tag=kind==='track'?'Track':'Mission';
  assert.ok(registry.ready && nodes.length===1 && isDataElement(root) && root.tag===tag,
    'Legacy lifecycle requires exactly one unambiguous root');
  const id=readStableNodeId(root);
  assert.ok(id,'Legacy lifecycle requires a stable root ID');
  assert.equal(root.metadata.apiVersion,'codument.tech/v1alpha1','Unsupported legacy lifecycle API');
  assert.equal(String(root.metadata.version),'1','Unsupported legacy lifecycle version');
  assert.ok(!('envelopeVersion' in root.metadata) && !('specVersion' in root.metadata),'Mixed lifecycle envelopes');
  return {id,root};
}
/** Reuse the public syntax codec, but keep acceptance decisions in this oracle. */
export function resourceRoot(source: string, kind: 'track'|'mission', product: ProductProfileId = 'current') {
  if(product==='legacy') {
    const {root}=resourceIdentity(source,kind,product);
    // Full root/task validity belongs to the selected binary's strict validator.
    for(const field of ['gap_round','revision']) {
      const value=root.attributes?.[field];
      assert.ok(value===undefined || typeof value==='number' && Number.isSafeInteger(value) && value>=0,
        `Invalid legacy lifecycle ${field}`);
    }
    return root;
  }
  return lifecycleSourceCodec.inspect(source,kind).root;
}

/** A dated archive directory is a location, not the authored resource identity. */
export function trackValidationSelection(relativeDirectory: string, source: string, product: ProductProfileId = 'current') {
  const root = resourceRoot(source,'track',product);
  const id = readStableNodeId(root);
  assert.ok(id, 'Track identity missing');
  const match = /^codument\/tracks\/(active|pending|archived)\/(.+)$/.exec(relativeDirectory);
  assert.ok(match, 'Track is outside an admitted lifecycle directory');
  const archived = match[1] === 'archived';
  if (!archived) assert.equal(match[2],id,'Track directory and authored identity differ');
  return {root,id,archived,selector:archived ? `archived/${match[2]}` : id};
}

function elements(value: unknown): Element[] {
  if(!value || typeof value!=='object') return [];
  if(Array.isArray(value)) return value.flatMap(elements);
  const self=(value as {kind?:string}).kind==='DataElement' ? [value as Element] : [];
  return [...self,...Object.values(value).flatMap(elements)];
}

/** CLI-owned round state and the terminal report override a model's delivered claim. */
export function exhaustedGapReason(source: string, kind: 'track'|'mission', reports: readonly string[], product: ProductProfileId = 'current'): string | undefined {
  const root=resourceRoot(source,kind,product);
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
export function assertNestedSelection(rootSources: string[], childSources: string[], product: ProductProfileId = 'current') {
  const roots=rootSources.map(s=>resourceRoot(s,'mission',product));
  const children=childSources.map(s=>resourceRoot(s,'mission',product));
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
