import {readFileSync,writeFileSync} from 'node:fs';
import ts from '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite/node_modules/typescript/lib/typescript.js';
for(const root of ['/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite','/Users/kongweixian/infra-dev/depa-codument/project']){
 const file=`${root}/packages/cli/src/cli/command-registry.ts`;let source=readFileSync(file,'utf8');
 const start=source.indexOf("  group('ConfigurationProfile',"),end=source.indexOf('  ...createBrowserWebApiCommands',start);
 if(start<0||end<0)throw Error('Configuration command boundary missing');
 source=source.slice(0,start)+`  ...createResourceKindCommands<CommandRuntime>({bin:BIN,bind:bindResourceFeature,kind:'ConfigurationProfile',summary:kindSummary('ConfigurationProfile'),exampleFqn:'Example.ConfigurationProfile.Personal'}),
  ...createResourceKindCommands<CommandRuntime>({bin:BIN,bind:bindResourceFeature,kind:'DatabaseConnection',summary:kindSummary('DatabaseConnection'),exampleFqn:'Example.Database.LocalCache'}),
`+source.slice(end);
 source=source.replace('createResourceCommands, createSopCommands','createResourceCommands, createSopCommands, createResourceKindCommands');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 const edits:{start:number;end:number}[]=[];
 for(const node of ast.statements){
  if(ts.isFunctionDeclaration(node)&&['leaf','group','valueOption'].includes(node.name?.text??''))edits.push({start:node.getStart(ast),end:node.end});
  if(ts.isInterfaceDeclaration(node)&&node.name.text==='RegistryOption')edits.push({start:node.getStart(ast),end:node.end});
  if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='jsonOption'))edits.push({start:node.getStart(ast),end:node.end});
 }
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+source.slice(edit.end);
 for(const name of ['CATALOG','PAGE_CATALOG','LOCAL_FUNCTION','BROWSER','SERVE_CLIENT','SERVE_MANAGER','MCP'])if((source.match(new RegExp('\\b'+name+'\\b','g'))??[]).length===1)source=source.replace(new RegExp('^const '+name+' = .*;\\n','m'),'');
 for(const name of ['createArgvSchema','type CommandOption','type CommandRun'])source=source.replace(new RegExp('^  '+name+',\\n','m'),'');
 if(root.endsWith('/project'))source="import {valueOption,type RegistryOption} from 'halfcode-lite-cli-host-logic';\n"+source;
 source=source.replace(/\n{3,}/g,'\n\n');
 writeFileSync(file,source);
}
