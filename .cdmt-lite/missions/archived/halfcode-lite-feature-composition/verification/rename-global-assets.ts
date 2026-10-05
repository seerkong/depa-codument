import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const root='/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
function visit(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){
 if(['node_modules','dist','.git','.cdmt-lite','codument'].includes(entry.name))continue;
 const p=dir+'/'+entry.name;if(entry.isDirectory()){visit(p);continue;}
 if(!entry.isFile()||! /\.(ts|js|json|md)$/.test(p))continue;
 const old=readFileSync(p,'utf8');const next=old.replaceAll('agents/global/skills/halfcode-app-lite','agents/global/skills/halfcode-lite').replaceAll('halfcode-app-lite-authoring','halfcode-lite-authoring');
 if(next!==old)writeFileSync(p,next);
}}
visit(root+'/packages');visit(root+'/scripts');
