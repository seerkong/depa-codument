import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import ts from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/node_modules/typescript/lib/typescript.js';
const upstream='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const files:string[]=[];
function scan(root:string){for(const entry of readdirSync(root,{withFileTypes:true})){const p=root+'/'+entry.name;if(entry.isDirectory())scan(p);else if(p.endsWith('.ts'))files.push(p);}}
for(const pkg of ['resource-capsule','resource-bundle-support','local-function-capsule','browser-capsule','page-capsule','serve-capsule','management-capsule'])scan(`${upstream}/packages/${pkg}/src`);
for(const root of [upstream,'/Users/kongweixian/infra-dev/depa-codument/project']){
 for(const name of ['resource-feature','local-function-feature','browser-feature','page-feature','serve-feature','mcp-app-feature','management-feature','command-registry'])files.push(`${root}/packages/cli/src/cli/${name}.ts`);
}
files.push(`${upstream}/packages/cli-host-logic/src/command-builders.ts`,`${upstream}/packages/mcp-app-capsule/src/commands.ts`,`${upstream}/packages/mcp-app-capsule/src/support/stdio-connection.ts`);
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
for(const file of files){const source=readFileSync(file,'utf8');writeFileSync(file,printer.printFile(ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true)));}
console.log(`Formatted ${files.length} touched TypeScript files`);
