import * as fs from 'node:fs';
import * as path from 'node:path';
import { files, type CommandExecution, type Run } from './runtime';

/** Producer obligations match the bounded observer below; no business criterion is added. */
export const REVIEW_EXECUTION_GUIDANCE =
  'Before returning PASS, run at least one test/build/typecheck command in its own separate exec call and obtain exit 0. ' +
  'That evidence call must not contain heredocs, loops, conditionals, pipes, or unrelated diagnostic commands. Environment assignments and quoted venv executable paths are supported. ' +
  'If tests pass but a later command in a combined call fails, rerun the test alone: a failed combined call is not successful execution evidence. Other diagnostic calls may be more complex. ' +
  'Inspect dependency files before installation: editable or local-path entries must not build the original read-only delivery; install them only from an exact temporary copy.\n';

/** Use the selected native thread's argv, not the CLI's shell-display rendering. */
export function readNativeExecutions(run: Run, threadId: string | undefined): CommandExecution[] {
  if (!threadId) return [];
  const result: CommandExecution[] = [];
  const seen = new Set<string>();
  for (const file of files(path.join(run.home, '.codex/sessions')).filter(file => file.endsWith('.jsonl') && path.basename(file).includes(threadId))) {
    const events = fs.readFileSync(file, 'utf8').split('\n').flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    if (!events.some(event => event.type === 'session_meta' && event.payload?.id === threadId)) continue;
    for (const event of events) {
      const payload = event.payload, item = payload?.item;
      if (event.type !== 'event_msg' || payload?.type !== 'item_completed' || payload.thread_id !== threadId || item?.type !== 'CommandExecution') continue;
      if (typeof item.id !== 'string' || seen.has(item.id) || !Array.isArray(item.command) || !item.command.length || !item.command.every((part: unknown) => typeof part === 'string')) continue;
      seen.add(item.id);
      result.push({command: item.command.join(' '), argv: item.command, exitCode: Number.isInteger(item.exit_code) ? item.exit_code : null});
    }
  }
  return result;
}

/** Bounded lexical observation, never shell evaluation. Control flow is unsupported. */
function simpleCommands(source: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [], word = '', quote = '', escaped = false;
  function endWord() { if (word) words.push(word); word = ''; }
  function endCommand() { endWord(); if (words.length) commands.push(words); words = []; }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (escaped) { if (char !== '\n') word += char; escaped = false; continue; }
    if (quote === "'") { if (char === quote) quote = ''; else word += char; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '`') return [];
    if (char === '$' && source[i + 1] === '(') {
      let depth = 1, nestedQuote = '', end = i + 2;
      for (; end < source.length && depth; end++) {
        const inner = source[end]!;
        if (inner === '\\') { end++; continue; }
        if (nestedQuote) { if (inner === nestedQuote) nestedQuote = ''; continue; }
        if (inner === '"' || inner === "'") nestedQuote = inner;
        else if (inner === '(') depth++;
        else if (inner === ')') depth--;
      }
      if (depth || nestedQuote) return [];
      word += '$()'; i = end - 1; continue;
    }
    if (quote) { if (char === quote) quote = ''; else word += char; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(' || char === ')' || source.slice(i, i + 2) === '<<' || source.slice(i, i + 2) === '||') return [];
    if (char === '#' && !word) { while (i + 1 < source.length && source[i + 1] !== '\n') i++; continue; }
    if (char === '&') { if (source[++i] !== '&') return []; endCommand(); continue; }
    if (char === ';' || char === '\n') { endCommand(); continue; }
    if (/\s/.test(char)) { endWord(); continue; }
    if (char === '|') { endWord(); words.push('|'); continue; }
    word += char;
  }
  if (quote || escaped) return [];
  endCommand();
  const controls = new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'until', 'do', 'done', 'case', 'esac', 'function', '!', '{', '}']);
  return commands.some(command => controls.has(command[0]!)) ? [] : commands;
}

function isTestInvocation(input: readonly string[]): boolean {
  const args = [...input];
  if (args.includes('|')) return false;
  if (/(?:^|\/)env$/.test(args[0] ?? '')) args.shift();
  while (/^[A-Za-z_]\w*=/.test(args[0] ?? '')) args.shift();
  const executable = args.shift() ?? '';
  if (executable.includes('$()') || executable.includes('`')) return false;
  const name = /(?:^|\/)(bun|npm|pnpm|node|python(?:3(?:\.\d+)?)?|pytest)$/.exec(executable)?.[1];
  if (name === 'pytest') return true;
  if (name?.startsWith('python')) return args[0] === '-m' && args[1] === 'pytest';
  if (name === 'node') return args[0] === '--test';
  if (name && ['bun', 'npm', 'pnpm'].includes(name)) return ['test', 'build', 'typecheck'].includes(args[0] === 'run' ? args[1] ?? '' : args[0] ?? '');
  return false;
}

/** Presence in a successful observed execution block; not proof of test semantics. */
export function isExecutedTestCommand(command: string | readonly string[]): boolean {
  if (Array.isArray(command)) {
    if (/^\/(?:usr\/)?bin\/(?:zsh|bash|sh)$/.test(command[0] ?? '') && /^-l?c$/.test(command[1] ?? '') && command.length === 3) return simpleCommands(command[2]!).some(isTestInvocation);
    return isTestInvocation(command);
  }
  const text = command as string;
  const shell = /^\/(?:usr\/)?bin\/(?:zsh|bash|sh) -l?c (['"])([\s\S]*)\1$/.exec(text.trim());
  return simpleCommands(shell ? shell[2]! : text).some(isTestInvocation);
}
