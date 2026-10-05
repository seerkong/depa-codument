import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {openReleaseRegistry} from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/scripts/fixtures/release-set';
const release = process.argv[2];
if (!release) throw new Error('install-candidate.ts RELEASE_SET');
const root = '/Users/kongweixian/infra-dev/depa-codument/project';
const registry = await openReleaseRegistry(release);
const versions = new Map(registry.set.artifacts.filter(p=>p.role==='shared').map(p=>[p.name,p.version]));
try {
  const manifests=new Map<string,string>();
  for (const file of [join(root,'package.json'), ...readdirSync(join(root,'packages')).map(d=>join(root,'packages',d,'package.json'))].filter(existsSync)) {
    const p=JSON.parse(readFileSync(file,'utf8')); let changed=false;
    for(const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies']) for(const name of Object.keys(p[key]??{})) {
      if(!name.startsWith('halfcode-lite-'))continue;
      const version=versions.get(name);if(!version)throw new Error(`Missing candidate ${name}`);
      if(p[key][name]!==version){p[key][name]=version;changed=true;}
    }
    if(changed)writeFileSync(file,JSON.stringify(p,null,2)+'\n');
    manifests.set(file,readFileSync(file,'utf8'));
  }
  // Candidate versions are immutable. A new API/content candidate receives a new prerelease.
  const proc=Bun.spawn([process.execPath,'install','--ignore-scripts','--no-cache','--registry',registry.url],{cwd:root,stdout:'inherit',stderr:'inherit'});
  const code=await proc.exited;
  // bun update may add explicitly selected transitive packages at the root. Preserve the product DAG.
  for(const [file,contents] of manifests)writeFileSync(file,contents);
  if(code===0){
    const sync=Bun.spawn([process.execPath,'install','--ignore-scripts','--registry',registry.url],{cwd:root,stdout:'inherit',stderr:'inherit'});
    if(await sync.exited!==0)throw new Error('Candidate lock synchronization failed');
  }
  console.log(JSON.stringify({code,registry:registry.url,digest:registry.digest,requests:registry.requests.length}));
  process.exitCode=code;
} finally {registry.close();}
