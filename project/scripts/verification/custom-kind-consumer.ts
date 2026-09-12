import * as fs from 'node:fs';
import * as path from 'node:path';

export async function verifyCustomKindConsumer(consumer: string, command: (args: string[], cwd: string) => Promise<string>): Promise<void> {
  fs.writeFileSync(path.join(consumer, 'custom-kind.ts'), `
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {createCommandHost} from 'halfcode-cli-lite-cli-host-capsule';
import {createResourceHostRuntime} from 'halfcode-cli-lite-skill-app-capsule';
import {createHostResourceContractRuntime} from 'halfcode-cli-lite-skill-app-support/resources/host-resource-contracts';
import {createKindSubjectOwner,createKindSpecRevision,digestCanonical} from 'halfcode-cli-lite-skill-app-contract/resource';
import {createArgvSchema} from 'halfcode-cli-lite-cli-host-logic';
import {runCli} from 'halfcode-cli-lite-cli-host-shell';
import {pathRoots} from 'halfcode-cli-lite-cli-host-support';
const root=path.join(process.cwd(),'custom-kind');
await fs.mkdir(path.join(root,'entries'),{recursive:true});
await fs.writeFile(path.join(root,'manifest.xnl'), '<SkillApp #Notes.Custom.App envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 (<Catalogs [<Catalog #entries {resourceKind="Note" shape="single-file" root="vfs://./entries/"}> ]>)>');
const file=path.join(root,'entries/first.xnl');
await fs.writeFile(file,'<Note #Notes.Entry.First envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {title="First"}>');
const owner=createKindSubjectOwner({kind:'Note',subjectFqn:'Notes.ResourceKind.Note',ownerPackageId:'notes-domain-contract',ownerPackageFingerprint:digestCanonical('notes/v1'),sourceShapes:['single-file']});
const revision=createKindSpecRevision({kind:owner.kind,subjectFqn:owner.subjectFqn,specVersion:1,sourceContractFingerprint:owner.sourceContract.sourceContractFingerprint,
  specSchema:{type:'object',required:['properties'],properties:{properties:{type:'object',required:['title'],properties:{title:{type:'string'}},additionalProperties:false}}},
  semanticContract:{semanticValidatorFingerprint:digestCanonical('note-title'),referenceProjectionFingerprint:digestCanonical('note-refs'),compilerInputFingerprint:digestCanonical('note-spec')},stability:'stable'});
const registration={owners:[owner],revisions:[revision],readers:[{readerId:'notes.reader/v1',subjectFqn:owner.subjectFqn,readerSpecVersion:1,contractFingerprint:revision.contractFingerprint,readerImplementationFingerprint:digestCanonical('note-reader'),compatibilityPolicy:'exact',read:spec=>spec.properties}]};
const contracts=createHostResourceContractRuntime({registrations:[registration]});
const config={workspaceRoot:root,sources:[{root:'.',scope:'root',origin:'notes'}],privateDirectory:'.notes'};
const resources=createResourceHostRuntime(config,{resourceContracts:contracts});
const unknown=createResourceHostRuntime(config);
const commandDefinition=(name,run)=>({name,summary:name,usage:[],examples:[],doc:{summary:name,usage:[],examples:[],options:[]},schema:createArgvSchema(name,[],[]),execution:{placement:'local',runtimeProfile:'notes'},run});
const host=createCommandHost({identity:{bin:'notes',displayName:'Independent Notes',version:'1'},commands:[
  {name:'Note',summary:'Notes',usage:[],examples:[],children:[
    commandDefinition('list',async({runtime})=>({code:0,data:{notes:(await runtime.resourceCatalog.list('Note')).map(note=>note.readerValue)}})),
    commandDefinition('validate',async({runtime})=>{const snapshot=await runtime.resourceCatalog.snapshot();return{code:snapshot.ready?0:1,data:{ready:snapshot.ready,diagnostics:snapshot.diagnostics}};}),
  ]},
]},{createRuntime:()=>resources,disposeRuntime:runtime=>runtime.close()});
const output=[];
const effects={roots:pathRoots,output:{write:text=>output.push(JSON.parse(text))}};
try {
  if(await runCli(host,{args:['Note','list','--json'],cwd:root},effects)!==0||output.at(-1).notes[0].title!=='First')throw new Error('Custom Kind list/reader not dispatched');
  if(await runCli(host,{args:['Note','validate','--json'],cwd:root},effects)!==0)throw new Error('Custom Kind validation failed');
  const rejected=await unknown.resourceCatalog.snapshot();
  if(rejected.ready||!rejected.diagnostics.some(d=>d.code==='KIND_DEFINITION_MISSING'))throw new Error('Unknown custom Kind was accepted');
  const conflicting=createKindSubjectOwner({kind:'Note',subjectFqn:owner.subjectFqn,ownerPackageId:'other-notes-contract',ownerPackageFingerprint:digestCanonical('other'),sourceShapes:['single-file']});
  let conflict=false;
  try{createHostResourceContractRuntime({registrations:[registration,{owners:[conflicting],revisions:[]}]});}catch{conflict=true;}
  if(!conflict)throw new Error('Conflicting Kind authority was accepted');
  await fs.writeFile(file,'<Note #Notes.Entry.First envelopeVersion="halfcode.resource-envelope/v1" specVersion=1 {title=42}>');
  if(await runCli(host,{args:['Note','validate','--json'],cwd:root},effects)!==1||!output.at(-1).diagnostics.some(d=>d.code==='WRITER_SCHEMA_INVALID'))throw new Error('Custom Kind writer schema was bypassed');
  if((await fs.readdir(root,{recursive:true})).some(file=>String(file).includes('KindDefinitions')))throw new Error('Custom Kind definitions copied into App');
  console.log(JSON.stringify({customKind:true,cliList:true,cliValidate:true,typedReader:true,unknownRejected:true,conflictRejected:true,noKindCopies:true}));
} finally {await host.dispose();await resources.close();await unknown.close();}
`);
  const result = JSON.parse(await command(['custom-kind.ts'], consumer));
  if (!result.customKind || !result.conflictRejected) throw new Error('Custom Kind consumer did not verify extension authority');
  console.log(JSON.stringify({scope: 'custom-kind-slice', ...result}));
}
