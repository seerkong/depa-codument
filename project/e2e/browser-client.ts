/** One transport command, not an application test. Args are authored by the AI. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const [configPath,raw]=process.argv.slice(2);
if(!configPath || !raw) throw Error('Usage: bun browser-client.ts <connection.json> <JSON {op,args,id?}>');
const config=JSON.parse(readFileSync(configPath,'utf8'));
// Source quotations are data: @file avoids shell interpolation of quotes/backticks.
const request=JSON.parse(raw.startsWith('@') ? readFileSync(raw.slice(1),'utf8') : raw); request.id ??= randomUUID();
const response=await fetch(config.endpoint+'/command',{method:'POST',headers:{authorization:`Bearer ${config.token}`,'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(35000)});
const value=await response.json();console.log(JSON.stringify(value,null,2));
process.exitCode=response.ok && (value as {status:string}).status!=='error' ? 0 : 1;
