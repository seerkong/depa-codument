import {expect,test} from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createRun,loadRun,sha} from './runtime';
import {productProfile,productGuidance,installedSkillRoot} from './product-profile';
import {implementationHandoff} from './handoff';

test('product identities are explicit, unknown profiles fail, default never infers legacy',()=>{
  expect(productProfile().command).toBe('depa-codument');
  expect(productProfile('legacy').command).toBe('codument');
  expect(()=>productProfile('guess')).toThrow('Unknown');
  const root=fs.mkdtempSync('/tmp/depa-codument-profile-unit-');
  const candidate=path.join(root,'codument');fs.copyFileSync('/usr/bin/true',candidate);
  expect(()=>createRun(candidate,'unit','current')).toThrow('Legacy binary rejected');
  const run=createRun(candidate,'unit','legacy');
  expect(path.basename(run.bin)).toBe('codument');
  expect(sha(run.bin)).toBe(sha(candidate));
  expect(fs.readFileSync(path.join(run.root,'bin/depa-codument'),'utf8')).toContain('exit 89');
  expect(loadRun(run.root,candidate,'unit').product?.id).toBe('legacy');
  expect(installedSkillRoot(productProfile('legacy'),run.workspace,'global')).toBe(path.join(run.workspace,'.agents/skills'));
});
test('routing changes tool identities only and retains common acceptance',()=>{
  const legacy=productGuidance(productProfile('legacy'),'/workspace');
  expect(legacy).toContain('codument-plan-track');
  expect(legacy).toContain('business requirements, interface contracts, hooks and independent acceptance remain unchanged');
  expect(legacy).toContain('Do not upgrade');
  expect(implementationHandoff([],'codument')).toContain('read the exact recorded track.xnl');
  expect(implementationHandoff([],'codument')).not.toContain('run codument track context');
  expect(implementationHandoff([],'codument')).not.toContain('run depa-codument');
});
