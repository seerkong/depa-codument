import { describe, expect, test } from 'bun:test';
import { defineLocalFunction as authorLocalFunction } from 'depa-codument-skill-app-contract/host';
import {
  admitHostResourceDescriptor,
  isHostResourceDefinition,
} from '../../src/cli/resources/definitions';

const schema = Object.freeze({ type: 'object', additionalProperties: false });

describe('package contract admission', () => {
  test('converts a portable app descriptor into a Host-owned branded definition', () => {
    const descriptor = authorLocalFunction({
      fqn: 'Test.Contract.LocalFunction.Echo', operation: 'query',
      inputSchema: schema, configSchema: schema, outputSchema: schema,
      runtimeCapabilities: [], handler: (_runtime, input) => input,
    });
    expect(isHostResourceDefinition(descriptor)).toBe(false);
    const admitted = admitHostResourceDescriptor(descriptor);
    expect(isHostResourceDefinition(admitted)).toBe(true);
    expect(admitted).toMatchObject({ kind: 'LocalFunction', fqn: descriptor.fqn });
  });

  test('rejects an incompatible protocol and runtime-invalid descriptor', () => {
    expect(() => admitHostResourceDescriptor({
      protocolVersion: '1', kind: 'LocalFunction', fqn: 'Test.Contract.LocalFunction.Legacy',
    })).toThrow('protocol');
    expect(() => admitHostResourceDescriptor({
      protocolVersion: '2', kind: 'LocalFunction', fqn: 'invalid', operation: 'query',
      inputSchema: schema, configSchema: schema, outputSchema: schema,
      runtimeCapabilities: [], handler: () => null,
    })).toThrow('FQN');
  });
});
