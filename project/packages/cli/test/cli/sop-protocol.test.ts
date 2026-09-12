import { describe, expect, test } from 'bun:test';
import { renderSopMermaid } from '../../src/cli/sop/mermaid';
import { projectSopProtocol } from '../../src/cli/sop/protocol';

const CHILDREN = new Set([
  'Demo.SOP.Start',
  'Demo.SOP.Review',
  'Demo.SOP.Retry',
  'Demo.SOP.Merge',
  'Demo.SOP.Cancel',
]);

function typedBody(procedure: string): string {
  return [
    '<input_contract>',
    'A canonical request reference.',
    '</input_contract>',
    '',
    '<preconditions>',
    'The request authority is available.',
    '</preconditions>',
    '',
    procedure,
    '',
    '<effects>',
    'Only effects explicitly owned by the selected Child SOP.',
    '</effects>',
    '',
    '<output_contract>',
    'A stable result reference.',
    '</output_contract>',
    '',
    '<success_criteria>',
    'The result reference can be verified.',
    '</success_criteria>',
  ].join('\n');
}

const VALID_GRAPH = [
  '<procedure format="markdown-step-graph/v1">',
  '',
  '## Entry',
  '',
  '`start`',
  '',
  '## Step `start` — Start request',
  '',
  '### SOP',
  '',
  '`Demo.SOP.Start`',
  '',
  '### Enter when',
  '',
  'The canonical request exists.',
  '',
  '### Input mapping',
  '',
  '- Pass the request reference.',
  '- Preserve multiline Markdown.',
  '',
  '  ~~~markdown',
  '  ### Route `fake` → `missing`',
  '  ~~~',
  '',
  '### Success',
  '',
  'A normalized result exists.',
  '',
  '### Failure',
  '',
  'Record the receipt and stop.',
  '',
  '### Route `needs-review` → `review`',
  '',
  'The result requires review.',
  '',
  '### Route `needs-retry` → `retry`',
  '',
  'The result can be retried.',
  '',
  '### Route `cancelled` → `cancel`',
  '',
  'The user explicitly cancelled.',
  '',
  '## Step `review` — Review result',
  '',
  '### SOP',
  '',
  '`Demo.SOP.Review`',
  '',
  '### Enter when',
  '',
  'Review evidence is available.',
  '',
  '### Input mapping',
  '',
  'Pass only stable references.',
  '',
  '### Success',
  '',
  'Review returns a decision.',
  '',
  '### Failure',
  '',
  'Keep the current step blocked.',
  '',
  '### Route `review-again` → `start`',
  '',
  'The request must be regenerated.',
  '',
  '### Route `review-complete` → `merge`',
  '',
  'The review passed.',
  '',
  '## Step `retry` — Retry safely',
  '',
  '### SOP',
  '',
  '`Demo.SOP.Retry`',
  '',
  '### Enter when',
  '',
  'A retry is explicitly permitted.',
  '',
  '### Input mapping',
  '',
  'Pass the previous receipt.',
  '',
  '### Success',
  '',
  'A new result is available.',
  '',
  '### Failure',
  '',
  'Do not fabricate a result.',
  '',
  '### Route `retry-again` → `retry`',
  '',
  'Another bounded retry is permitted.',
  '',
  '### Route `retry-complete` → `review`',
  '',
  'The retry produced reviewable evidence.',
  '',
  '## Step `merge` — Complete run',
  '',
  '### SOP',
  '',
  '`Demo.SOP.Merge`',
  '',
  '### Enter when',
  '',
  'A valid review decision exists.',
  '',
  '### Input mapping',
  '',
  'Pass the verified result reference.',
  '',
  '### Success',
  '',
  'The final reference is durable.',
  '',
  '### Failure',
  '',
  'Keep the final receipt for diagnosis.',
  '',
  '### End `success`',
  '',
  'Return the stable result reference.',
  '',
  '## Step `cancel` — Record cancellation',
  '',
  '### SOP',
  '',
  '`Demo.SOP.Cancel`',
  '',
  '### Enter when',
  '',
  'A cancellation decision exists.',
  '',
  '### Input mapping',
  '',
  'Pass the decision reference.',
  '',
  '### Success',
  '',
  'Cancellation is durably recorded.',
  '',
  '### Failure',
  '',
  'Do not report an unrecorded cancellation.',
  '',
  '### End `cancelled`',
  '',
  'Return the cancellation reference.',
  '',
  '</procedure>',
].join('\n');

function project(
  profile: 'freeform' | 'typed-leaf' | 'typed-pipeline',
  markdown: string,
  availableSopFqns: ReadonlySet<string> = CHILDREN,
) {
  return projectSopProtocol({
    fqn: 'Demo.SOP.Pipeline',
    profile,
    markdown,
    availableSopFqns,
  });
}

describe('SOP authoring profiles', () => {
  test('does not infer typed blocks or a graph from freeform Markdown', () => {
    const result = project('freeform', typedBody(VALID_GRAPH));
    expect(result).toEqual({ diagnostics: [], semanticBlocks: undefined, graph: undefined });
  });

  test('keeps a typed-leaf procedure as opaque multiline Markdown', () => {
    const procedure = [
      '<procedure>',
      '1. Call the service.',
      '',
      '   ```markdown',
      '   <effects>this fenced tag is an example</effects>',
      '   ```',
      '2. Verify the receipt.',
      '</procedure>',
    ].join('\n');
    const result = project('typed-leaf', typedBody(procedure));
    expect(result.diagnostics).toEqual([]);
    expect(result.graph).toBeUndefined();
    expect(result.semanticBlocks?.procedure.markdown).toContain('```markdown');
    expect(result.semanticBlocks?.procedure.markdown).toContain('Verify the receipt.');
  });

  test.each([
    ['missing', typedBody(VALID_GRAPH).replace(/<effects>[\s\S]*?<\/effects>\n\n/u, ''), 'SOP_TYPED_BLOCK_MISSING'],
    ['empty', typedBody(VALID_GRAPH).replace('A stable result reference.', '   '), 'SOP_TYPED_BLOCK_EMPTY'],
    ['duplicate', `${typedBody(VALID_GRAPH)}\n<input_contract>\nagain\n</input_contract>`, 'SOP_TYPED_BLOCK_DUPLICATE'],
    ['out-of-order', typedBody(VALID_GRAPH).replace(/<preconditions>[\s\S]*?<\/preconditions>\n\n/u, '') + '\n<preconditions>\nlate\n</preconditions>', 'SOP_TYPED_BLOCK_ORDER'],
  ])('rejects %s typed semantic blocks', (_name, markdown, code) => {
    expect(project('typed-pipeline', markdown).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, fqn: 'Demo.SOP.Pipeline', line: expect.any(Number) }),
    ]));
  });
});

describe('markdown-step-graph/v1 parser and validator', () => {
  test('preserves multiline fields, ignores fenced headings, retains spans and freezes the graph deeply', () => {
    const result = project('typed-pipeline', typedBody(VALID_GRAPH));
    expect(result.diagnostics).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.graph)).toBe(true);
    expect(Object.isFrozen(result.graph?.steps)).toBe(true);
    expect(Object.isFrozen(result.graph?.steps[0]?.exit)).toBe(true);
    expect(result.graph).toMatchObject({
      format: 'markdown-step-graph/v1',
      entry: 'start',
      steps: [
        {
          id: 'start',
          title: 'Start request',
          childSopFqn: 'Demo.SOP.Start',
          inputMapping: {
            markdown: expect.stringContaining('### Route `fake` → `missing`'),
            span: expect.objectContaining({ startLine: expect.any(Number), endLine: expect.any(Number) }),
          },
          exit: { kind: 'routes', routes: expect.any(Array) },
        },
        expect.objectContaining({ id: 'review' }),
        expect.objectContaining({ id: 'retry' }),
        expect.objectContaining({ id: 'merge', exit: expect.objectContaining({ kind: 'end', status: 'success' }) }),
        expect.objectContaining({ id: 'cancel', exit: expect.objectContaining({ kind: 'end', status: 'cancelled' }) }),
      ],
    });
  });

  test.each([
    ['wrapper format', typedBody(VALID_GRAPH.replace('markdown-step-graph/v1', 'markdown-step-graph/v2')), 'MSG001', CHILDREN],
    ['duplicate Entry', typedBody(VALID_GRAPH.replace('## Step `start`', '## Entry\n\n`start`\n\n## Step `start`')), 'MSG002', CHILDREN],
    ['invalid Step ID', typedBody(VALID_GRAPH.replaceAll('`start`', '`Start`')), 'MSG003', CHILDREN],
    ['duplicate Route ID', typedBody(VALID_GRAPH.replace('`retry-complete`', '`retry-again`')), 'MSG003', CHILDREN],
    ['missing fixed field', typedBody(VALID_GRAPH.replace(/### Success\n\nA normalized result exists\.\n\n/u, '')), 'MSG004', CHILDREN],
    ['invalid Child SOP field', typedBody(VALID_GRAPH.replace('`Demo.SOP.Start`', 'Demo.SOP.Start')), 'MSG005', CHILDREN],
    ['unknown target', typedBody(VALID_GRAPH.replace('→ `review`', '→ `missing`')), 'MSG006', CHILDREN],
    ['Route and End together', typedBody(VALID_GRAPH.replace('### Route `cancelled` → `cancel`', '### End `failure`\n\nFailed.\n\n### Route `cancelled` → `cancel`')), 'MSG007', CHILDREN],
    ['invalid End status', typedBody(VALID_GRAPH.replace('### End `cancelled`', '### End `aborted`')), 'MSG008', CHILDREN],
    ['unreachable Step', typedBody(VALID_GRAPH.replace('### Route `cancelled` → `cancel`\n\nThe user explicitly cancelled.\n\n', '')), 'MSG009', CHILDREN],
    ['unknown H3', typedBody(VALID_GRAPH.replace('### Success\n\nA normalized result exists.', '### Unknown\n\nNo schema guessing.\n\n### Success\n\nA normalized result exists.')), 'MSG010', CHILDREN],
    ['overlong title', typedBody(VALID_GRAPH.replace('Start request', 'x'.repeat(81))), 'MSG011', CHILDREN],
    ['unresolved Child SOP', typedBody(VALID_GRAPH), 'MSG102', new Set(['Demo.SOP.Start'])],
  ])('fails closed for %s', (_name, markdown, code, available) => {
    const diagnostics = project('typed-pipeline', markdown, available).diagnostics;
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, fqn: 'Demo.SOP.Pipeline', line: expect.any(Number), endLine: expect.any(Number) }),
    ]));
    expect(JSON.stringify(diagnostics)).not.toContain(process.cwd());
  });
});

describe('deterministic Mermaid projection', () => {
  test('renders branch, merge, cycle, self-loop and terminals byte-for-byte', () => {
    const graph = project('typed-pipeline', typedBody(VALID_GRAPH)).graph;
    if (!graph) throw new Error('expected a valid graph');
    const expected = [
      'flowchart TD',
      '  g_start([Start])',
      '  g_end_success([Success])',
      '  g_end_cancelled([Cancelled])',
      '  s_start["start<br/>Start request"]',
      '  s_review["review<br/>Review result"]',
      '  s_retry["retry<br/>Retry safely"]',
      '  s_merge["merge<br/>Complete run"]',
      '  s_cancel["cancel<br/>Record cancellation"]',
      '',
      '  g_start --> s_start',
      '  s_start -->|needs-review| s_review',
      '  s_start -->|needs-retry| s_retry',
      '  s_start -->|cancelled| s_cancel',
      '  s_review -->|review-again| s_start',
      '  s_review -->|review-complete| s_merge',
      '  s_retry -->|retry-again| s_retry',
      '  s_retry -->|retry-complete| s_review',
      '  s_merge -->|end: success| g_end_success',
      '  s_cancel -->|end: cancelled| g_end_cancelled',
      '',
    ].join('\n');
    expect(renderSopMermaid(graph)).toBe(expected);
    expect(renderSopMermaid(graph)).toBe(renderSopMermaid(graph));
  });

  test('only admits stable IDs and an escaped display title into Mermaid syntax', () => {
    const injected = VALID_GRAPH.replace('Start request', 'Safe "title" <script> click style %%{init: bad}%%');
    const graph = project('typed-pipeline', typedBody(injected)).graph;
    if (!graph) throw new Error('expected a valid graph');
    const mermaid = renderSopMermaid(graph);
    expect(mermaid).toContain('Safe &quot;title&quot; &lt;script&gt; click style &#37;&#37;{init: bad}&#37;&#37;');
    expect(mermaid).not.toContain('<script>');
    expect(mermaid).not.toContain('%%{init: bad}%%');
    expect(mermaid).not.toContain('The canonical request exists.');
    expect(mermaid).not.toMatch(/\n\s*(?:click|style)\s+/u);
  });
});
