import {expect,test} from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';

test('controller interruption prevents correction and all later process executions',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'depa-interruption-'));
  try {
    const module=path.join(import.meta.dir,'runtime.ts');
    const source=`import {execute,ExecutionInterrupted} from ${JSON.stringify(module)};
      setTimeout(()=>process.kill(process.pid,'SIGTERM'),150);
      let canceled=false;
      try{await execute({argv:['/bin/sleep','30'],cwd:${JSON.stringify(root)},env:process.env,log:${JSON.stringify(path.join(root,'initial.log'))}})}catch(e){canceled=e instanceof ExecutionInterrupted}
      if(!canceled)process.exit(2);
      try{await execute({argv:['/usr/bin/touch',${JSON.stringify(path.join(root,'forbidden'))}],cwd:${JSON.stringify(root)},env:process.env,log:${JSON.stringify(path.join(root,'retry.log'))}});process.exit(3)}catch(e){if(!(e instanceof ExecutionInterrupted))process.exit(4)};
      console.log('interrupted-no-retry');`;
    const result=spawnSync(process.execPath,['-e',source],{encoding:'utf8',timeout:10000});
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('interrupted-no-retry');
    expect(fs.existsSync(path.join(root,'forbidden'))).toBe(false);
    expect(fs.existsSync(path.join(root,'retry.log'))).toBe(false);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
},15000);
