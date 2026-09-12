import { expect, test } from 'bun:test';
import { COMMANDS, rootHelp } from '../../src/cli/command-registry';
import { CODUMENT_OPERATION_ROUTES } from 'depa-codument-product-capsule/global-guidance';

test('the actual help and dispatch tree exposes all operations without replacing native commands', async () => {
  for (const route of CODUMENT_OPERATION_ROUTES) {
    expect(rootHelp()).toContain(route.command);
    const command = COMMANDS.find(item => item.name === route.command)!;
    expect(command.execution).toEqual({ placement: 'local', runtimeProfile: 'basic' });
    const result = await command.run!(command.schema!.parse(['test-target'], [route.command], {} as never));
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ status: 'guidance', arguments: ['test-target'], operation: { fqn: route.fqn } });
  }
  expect(COMMANDS.find(item => item.name === 'migrate')!.children?.length).toBeGreaterThan(0);
  expect(COMMANDS.find(item => item.name === 'validate')!.execution?.runtimeProfile).not.toBe('basic');
  expect(new Set(COMMANDS.map(item => item.name)).size).toBe(COMMANDS.length);
});
