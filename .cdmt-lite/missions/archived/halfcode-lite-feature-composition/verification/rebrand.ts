/** Explicit, repeatable package-identity migration. Historical assets and installs are excluded. */
import {existsSync, lstatSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
const upstream = '/Users/kongweixian/infra-dev/halfcode-lite/halfcode-lite';
const consumer = '/Users/kongweixian/infra-dev/depa-codument/project';
const apply = process.argv.includes('--apply');
const roots = [upstream, consumer];
const names = new Set<string>();
for (const root of roots) for (const dir of readdirSync(join(root, 'packages'))) {
  const file = join(root, 'packages', dir, 'package.json');
  if (!existsSync(file)) continue;
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  for (const name of [manifest.name, ...Object.keys({...manifest.dependencies, ...manifest.devDependencies})]) {
    if (/^halfcode-(?:cli|app)-lite-/.test(name)) names.add(name);
  }
}
const replacements = [...names].sort((a,b)=>b.length-a.length).map(name => [name, name.replace(/^halfcode-(?:cli|app)-lite-/, 'halfcode-lite-')]);
const changes: string[] = [];
function transform(text: string, file: string) {
  // These carry frozen semantic identities/history, not package import metadata.
  if (file.endsWith('/test/fixtures/legacy-resource-locks.json')) return text;
  const semanticLines = new Map<string,string>();
  text=text.split('\n').map((line,index)=>{
    if ((file.endsWith('/src/resource.ts') || file.endsWith('/src/resource-contracts.ts') || file.endsWith('/test/compatibility.test.ts'))
      && !/\b(from|import|export\s+\{)/.test(line) && /halfcode-(?:app|cli)-lite/.test(line)) {
      const token=`__PRESERVED_SEMANTIC_LINE_${index}__`;semanticLines.set(token,line);return token;
    }
    return line;
  }).join('\n');
  for (const [before, after] of replacements) text = text.replaceAll(before, after);
  // Canonical public import. The existing scoped wrapper keeps its own name until consumers retire it.
  if (!file.endsWith('/packages/skill-app-contract/package.json') || file.startsWith(consumer)) {
    text = text.replaceAll('@halfcode-app-lite/skill-app-contract', 'halfcode-lite-skill-app-contract')
      .replaceAll('@halfcode-cli-lite/skill-app-contract', 'halfcode-lite-skill-app-contract');
  }
  text = text.replaceAll('/infra-dev/halfcode-cli/halfcode-cli-lite', '/infra-dev/halfcode-lite/halfcode-lite');
  text = text.replaceAll('Halfcode App Lite', 'Halfcode Lite').replaceAll('Halfcode CLI Lite', 'Halfcode Lite');
  // Exact product/bin identity; do not rename demo/FQN identities as a side effect.
  text = text.replace(/\bhalfcode-(?:cli|app)-lite(?![-\w/.])/g, 'halfcode-lite');
  text = text.replaceAll('.halfcode-app-lite/', '.halfcode-lite/').replaceAll('.halfcode-cli-lite/', '.halfcode-lite/');
  text = text.replaceAll("'halfcode-app-lite-'", "'halfcode-lite-'").replaceAll("'halfcode-cli-lite-'", "'halfcode-lite-'");
  for(const [token,line] of semanticLines)text=text.replace(token,line);
  return text;
}
function visit(root: string, dir = root) {
  for (const name of readdirSync(dir)) {
    if (['node_modules','.git','dist','.depa-analysis','.cdmt-lite','codument','coverage','.cache','.codex','.agents','.claude','.halfcode-app-lite','.halfcode-cli-lite'].includes(name)) continue;
    const file = join(dir, name), stat = lstatSync(file);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {visit(root,file);continue;}
    if (!/\.(?:ts|tsx|js|mjs|cjs|json|md|yaml|yml|html|xnl|vue|sh)$/.test(name)) continue;
    const before=readFileSync(file,'utf8'), after=transform(before,file);
    if(before!==after) {changes.push(file);if(apply)writeFileSync(file,after);}
  }
}
for(const root of roots)visit(root);
if(apply) for(const name of readdirSync(join(upstream,'packages'))) {
  const next=name.replace(/^halfcode-app-lite-/, 'halfcode-lite-');
  if(next!==name){const dest=join(upstream,'packages',next);if(existsSync(dest))throw new Error(`Rename collision ${dest}`);renameSync(join(upstream,'packages',name),dest);}
}
console.log(JSON.stringify({apply, files:changes.length, roots, changed:changes.map(file=>relative('/Users/kongweixian/infra-dev',file))},null,2));
