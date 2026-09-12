import itemsList from './items-list.js';

export function run_web_api(fqn, input) {
  if (fqn !== 'Example.OpenCli.Items.List') throw new Error(`Unknown fixture FQN: ${fqn}`);
  return itemsList(input);
}
