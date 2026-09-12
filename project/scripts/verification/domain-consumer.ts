import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { command, workspaceClosure } from './consumer';
import { createHash } from 'node:crypto';
import { openReleaseRegistry, releaseSetDigest, type ReleaseSet } from './release-set';

/** A separate consumer: the generic Notes CLI must remain domain-free. */
export async function verifyDomainCoreConsumer(root: string): Promise<void> {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'domain-public-consumer-')));
  try {
    const archives = path.join(temporary, 'archives');
    const consumer = path.join(temporary, 'consumer');
    fs.mkdirSync(archives); fs.mkdirSync(consumer);
    const release = process.env.CODUMENT_VERIFY_RELEASE_SET;
    if (!release) throw new Error('UNVERIFIED: set CODUMENT_VERIFY_RELEASE_SET to a prepared immutable release directory');
    const dependencies: Record<string, string> = {};
    const set: ReleaseSet = { format: 'halfcode-local-release-set/v1', artifacts: [] };
    for (const directory of workspaceClosure(root, ['domain-contract', 'domain-logic', 'domain-support', 'domain-capsule'])) {
      const workspace = path.join(root, 'packages', directory);
      const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'package.json'), 'utf8'));
      const archive = path.join(temporary, directory + '.tgz');
      await command(['pm', 'pack', '--ignore-scripts', '--filename', archive], workspace);
      const bytes = fs.readFileSync(archive);
      const file = createHash('sha256').update(bytes).digest('hex') + '.tgz';
      fs.writeFileSync(path.join(archives, file), bytes);
      set.artifacts.push({ name: manifest.name, version: manifest.version, file, role: 'product',
        integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') });
      dependencies[manifest.name] = manifest.version;
    }
    fs.writeFileSync(path.join(archives, 'release-set.json'), JSON.stringify({ set, digest: releaseSetDigest(set) }));
    const registry = await openReleaseRegistry(path.resolve(release), [archives]);
    try {
      fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'codument-domain-consumer', private: true, type: 'module', dependencies }));
      await command(['install', '--save-text-lockfile', '--ignore-scripts', '--registry', registry.url, '--cache-dir', path.join(temporary, 'registry-cache')], consumer);
    } finally { await registry.close(); }
    fs.writeFileSync(path.join(consumer, 'index.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createDomainOwner} from 'depa-codument-domain-capsule';
import {createFileVerificationRuntime,createFileLifecycleRepository,readXnlRegistrySources} from 'depa-codument-domain-support';
import {transitionLifecycleResource,indexXnlRegistry,serializeXnlForest,mergeXnlNodes,patchLifecycleSource,createValidatedLifecycleSourceCodec,validateBehaviorTree,proposeBehaviorMutation,validateDecisionSources,readDecisionRecords,projectDecisionFrontier} from 'depa-codument-domain-logic';
import {CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS} from 'depa-codument-domain-contract/resources';
import {CODUMENT_RESOURCE_READER_REGISTRATIONS} from 'depa-codument-domain-logic/resources';
import {createHostResourceContractRuntime} from 'halfcode-cli-lite-skill-app-support/resources/host-resource-contracts';
import {createWorkspaceResourceCatalog} from 'halfcode-cli-lite-skill-app-support/resources/workspace-resource-catalog';
const root=path.join(process.cwd(),'workspace');
const directory='codument/tracks/active/example',file=directory+'/track.xnl';
await fs.mkdir(path.join(root,directory),{recursive:true});
const metadata='envelopeVersion="halfcode.resource-envelope/v1" specVersion=1';
await fs.writeFile(path.join(root,file),'<!-- authored authority --> <Track #example '+metadata+' {status="in_progress" goal="Verify public packages" description="Exercise the real owner" created_at="2026-09-05T12:00:00Z" updated_at="2026-09-05T12:00:00Z"} (<Ports {scope="track"}><TaskSpace #TS (<SubNodes [<TaskGroup #G1 {status="ACTIVE"} (<SubNodes [<Task #T1 {status="ACTIVE"}>]>)>]>)>)>');
for(const name of ['proposal.md','design.md'])await fs.writeFile(path.join(root,directory,name),'# Owned document');
await fs.writeFile(path.join(root,'source.txt'),'v1');
const at='2026-09-05T12:00:00.000Z';
let output='';
const lifecycleCodec=createValidatedLifecycleSourceCodec({file,profileNames:[],strict:true});
const repository=createFileLifecycleRepository({workspaceRoot:root,resourceDirectory:'codument'},{codec:lifecycleCodec,archiveName:update=>at.slice(0,10)+'-'+update.id});
const verification=createFileVerificationRuntime({workspaceRoot:root,env:process.env},{
  locateTrack:async id=>repository.load({kind:'track',id},{includeArchived:true}),
  clock:{nowIso:()=>at},output:{write:bytes=>{output+=new TextDecoder().decode(bytes);}},
});
const owner=createDomainOwner({verification,clock:{nowIso:()=>at},repository});
try{
  const request={type:'task-complete',kind:'track',id:'example',taskId:'T1',command:[process.execPath,'-e','console.log("actual verification")'],captureOutput:true} as const;
  const first=await owner.apply(request);
  const written=await fs.readFile(path.join(root,file),'utf8');
  if(first.to!=='DONE'||first.verification?.reused!==false||!output.includes('actual verification')||!written.includes('status="DONE"')||!written.startsWith('<!-- authored authority -->'))throw Error('Completion did not verify and commit actual authored bytes');
  let invalidPort=false;try{lifecycleCodec.inspect(written.replace('scope="track"','scope="mission"'),'track');}catch(error){invalidPort=String(error).includes('track.ports.scope');}
  if(!invalidPort)throw Error('Packed semantic lifecycle gate was bypassed');
  const reused=await owner.verify({track:'example',command:request.command,captureOutput:true});
  if(!reused.reused)throw Error('Receipt reuse lost');
  const fresh=await owner.verify({track:'example',command:request.command,captureOutput:true,fresh:true});
  if(fresh.reused)throw Error('Fresh verification bypassed');
  await fs.writeFile(path.join(root,'source.txt'),'v2');
  if((await owner.verify({track:'example',command:request.command,captureOutput:true})).reused)throw Error('Source change did not invalidate evidence');
  if(transitionLifecycleResource(await repository.load({kind:'track',id:'example'},{includeArchived:false}),'completed',at).to!=='completed')throw Error('Pure lifecycle export unavailable');
  let failed=false;
  try{await owner.apply({...request,command:[process.execPath,'-e','process.exit(7)']});}catch{failed=true;}
  if(!failed||await fs.readFile(path.join(root,file),'utf8')!==written)throw Error('Failed verifier committed state');
  await owner.apply({type:'task-transition',kind:'track',id:'example',taskId:'T1',status:'ACTIVE'});
  const editedCommand=[process.execPath,'-e','const p='+JSON.stringify(file)+'; await Bun.write(p,(await Bun.file(p).text())+"<!-- verifier edit -->");'];
  let stale=false;try{await owner.apply({...request,command:editedCommand});}catch(error){stale=String(error).includes('source changed');}
  const edited=await fs.readFile(path.join(root,file),'utf8');
  if(!stale||!edited.endsWith('<!-- verifier edit -->')||!edited.includes('status="ACTIVE"'))throw Error('Verification-time source edit was overwritten');
}finally{await owner.close();}
let rejected=false;try{await owner.ready('example');}catch{rejected=true;}
if(!rejected)throw Error('Closed owner admitted work');
const registryRoot=path.join(root,'codument/decisions');
await fs.mkdir(path.join(registryRoot,'nested'),{recursive:true});
const original='<!-- keep original --> <decision #policy { unknown = { value = [1 true] } } [<decision #policy.child { status = "accepted" }>]> <decision #second>';
await fs.writeFile(path.join(registryRoot,'nested/forest.xnl'),original);
const registry=indexXnlRegistry(await readXnlRegistrySources(registryRoot),{registryName:'decision'},{shouldIndex:node=>node.tag==='decision'});
if(!registry.ready||registry.index.size!==3||registry.index.get('policy.child')?.owner.file!=='nested/forest.xnl'||registry.sources.get('nested/forest.xnl')!==original)throw Error('Recursive registry source/owner fidelity lost');
const nodes=registry.files.get('nested/forest.xnl');
const merged=mergeXnlNodes([],nodes,nodes);
if(merged.conflicts.length||merged.merged.size!==2||!serializeXnlForest([...merged.merged.values()],{textMarkerFactory:()=> 'TEST'}).includes('unknown'))throw Error('Packed conservative merge lost fields');
const builtinRoot=path.join(root,'builtin-app');
await fs.mkdir(path.join(builtinRoot,'track'),{recursive:true});
await fs.writeFile(path.join(builtinRoot,'manifest.xnl'),'<SkillApp #Codument.Consumer.App '+metadata+' (<Catalogs [<Catalog #tracks {resourceKind="Track" root="vfs://./track/" shape="directory" entry="track.xnl" scope="root"}> ]>)>');
await fs.writeFile(path.join(builtinRoot,'track/track.xnl'),'<Track #example '+metadata+' {status="in_progress"} (<TaskSpace #TS (<SubNodes [<Task #T1 {status="ACTIVE"}> ]>)>)>');
for(const file of ['proposal.md','design.md'])await fs.writeFile(path.join(builtinRoot,'track',file),'# Owned document');
const contracts=createHostResourceContractRuntime({registrations:[CODUMENT_RESOURCE_CONTRACT_REGISTRATIONS,CODUMENT_RESOURCE_READER_REGISTRATIONS]});
const catalog=createWorkspaceResourceCatalog(builtinRoot,[{root:'.',scope:'root',origin:'consumer'}],contracts);
const builtinSnapshot=await catalog.snapshot();
if(!builtinSnapshot.ready||(await catalog.list('Track'))[0].readerValue.kind!=='Track')throw Error('Built-in Kind admission failed: '+JSON.stringify(builtinSnapshot.diagnostics));
if((await fs.readdir(builtinRoot,{recursive:true})).some(file=>String(file).includes('KindDefinition')))throw Error('Kinds copied into App');
await fs.unlink(path.join(builtinRoot,'track/design.md'));
if((await catalog.snapshot()).ready)throw Error('Built-in requiredFiles was not enforced');
const patchSource='<!-- untouched --> <Track #patch '+metadata+' {status="in_progress"} (<Description ?D>literal <Task #fake> <!-- preserved --></?D>)>';
const patchBefore=indexXnlRegistry(new Map([['track.xnl',patchSource]]),{registryName:'Track'}).files.get('track.xnl')[0];
const patchAfter=structuredClone(patchBefore);patchAfter.attributes.gap_round=3;
const patched=patchLifecycleSource(patchSource,patchBefore,patchAfter);
if(!patched.startsWith('<!-- untouched -->')||!patched.includes('literal <Task #fake> <!-- preserved -->')||!patched.includes('"gap_round" = 3'))throw Error('Packed lifecycle source patch lost bytes');
const behaviorSource='<Behavior #cli.contract '+metadata+' {opaque={value=[1 true]}} (<Requirements [<Requirement #R1 (<Statement ?>Keep behavior.</?>)>]>)>';
const behaviorRoot=content=>indexXnlRegistry(new Map([['behavior.xnl',content]]),{registryName:'Behavior'}).files.get('behavior.xnl')[0];
const behaviorBefore=behaviorRoot(behaviorSource),behaviorAfter=behaviorRoot(behaviorSource.replace('Keep behavior.','Updated behavior.'));
const behaviorProposal=proposeBehaviorMutation(behaviorBefore,behaviorAfter);
if(validateBehaviorTree(behaviorBefore,'behavior.xnl').length||!behaviorProposal.mutations.length||JSON.stringify(behaviorProposal.root)!==JSON.stringify(behaviorAfter)||JSON.stringify(behaviorBefore).includes('Updated behavior.'))throw Error('Packed Behavior proposal lost complete tree semantics');
const decisionSources=new Map([['owner/root.xnl','<decision #root '+metadata+' {status="accepted"}>'],['other/child.xnl','<decision #child '+metadata+' {status="resolved" depends_on=["decision://root"]}>']]);
if(validateDecisionSources(decisionSources).length)throw Error('Packed cross-file Decision validation failed');
decisionSources.set('other/child.xnl','<decision #child '+metadata+' {status="pending" depends_on=["decision://root"]}>');
if(projectDecisionFrontier(decisionSources)[0]?.id!=='child')throw Error('Packed Decision frontier lost logical URI dependencies');
decisionSources.set('owner/root.xnl','<decision #root '+metadata+' {status="accepted" depends_on=["child"]}>');
if(!validateDecisionSources(decisionSources).some(finding=>finding.message.includes('contains a cycle')))throw Error('Packed Decision dependency cycle was not detected');
if(readDecisionRecords(nodes).length!==3)throw Error('Packed Decision forest read model lost nested decisions');
console.log(JSON.stringify({actualVerifier:true,receiptReuse:true,fresh:true,sourceInvalidation:true,failedCompletionBlocked:true,recursiveRegistry:true,conservativeMerge:true,builtinKind:true,noKindCopies:true,requiredFiles:true,sourcePreservingPatch:true,sourceCompareAndSwap:true,semanticLifecycle:true,behaviorProposal:true,decisionValidation:true,decisionFrontier:true,repository:'production-filesystem',productionRepository:true,fullDomain:'UNVERIFIED'}));
`);
    const result = JSON.parse(await command(['index.ts'], consumer));
    if (!result.actualVerifier || !result.failedCompletionBlocked || !result.productionRepository || !result.sourceCompareAndSwap || !result.semanticLifecycle || !result.behaviorProposal || !result.decisionValidation || !result.decisionFrontier) throw new Error('Domain core consumer missing evidence');
    for (const name of Object.keys(dependencies)) {
      const installed = path.join(consumer, 'node_modules', name);
      if (!fs.realpathSync(installed).startsWith(temporary + path.sep)) throw new Error('Domain consumer escaped fixture');
      const manifest = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
      if (Object.values(manifest.dependencies ?? {}).some((version) => String(version).startsWith('workspace:'))) throw new Error('Unresolved domain tarball dependency');
    }
    console.log(JSON.stringify({ scope: 'domain-core', packages: Object.keys(dependencies), packed: true,
      releaseDigest: registry.digest, productDigests: registry.productDigests, transitiveOverrides: false, registryStoppedBeforeRuntime: true, ...result }));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
