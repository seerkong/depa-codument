import * as fs from 'node:fs';
import * as path from 'node:path';
import { assertTemporary, files } from './runtime';

const root=assertTemporary(process.argv[2]!);
for(const file of files(path.join(root,'home/.codex/sessions')).filter(f=>f.endsWith('.jsonl'))){
  const rows=fs.readFileSync(file,'utf8').trim().split('\n').slice(-8).flatMap(line=>{
    try {
      const event=JSON.parse(line);
      return [{ timestamp:event.timestamp,type:event.type,payloadType:event.payload?.type,tool:event.payload?.name,usage:event.payload?.info?.total_token_usage }];
    } catch { return []; }
  });
  console.log(JSON.stringify({file,rows}));
}
