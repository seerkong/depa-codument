import type { CommandResult } from 'halfcode-lite-cli-contract';

/** Original Codument emits raw domain JSON, not the generic Host result envelope. */
export function formatCodumentDomainResult(result: CommandResult, json = false): string {
  if (result.render === 'none') return '';
  if (json && 'domainJsonText' in result && typeof result.domainJsonText === 'string') return result.domainJsonText;
  const value = 'domainOutput' in result ? result.domainOutput : result.data;
  const output = json ? JSON.stringify(value, null, 2) : result.message ?? '';
  return output ? output + '\n' : '';
}
