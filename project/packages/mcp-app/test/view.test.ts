import { describe, expect, test } from 'bun:test';
import { buildMcpAppAgentMessage, buildMcpAppHtml } from '../src';

describe('hybrid MCP App view', () => {
  test('builds the same minimal Agent instruction contract without a session selector', () => {
    const message = buildMcpAppAgentMessage({
      hostSkill: 'codument',
      sopFqn: 'Codument.Demo.SOP.GoogleSearch',
      pageName: 'google-search',
      targetRef: 'page_target_exact',
    });
    expect(message).toBe([
      '请使用 codument skill 处理来自业务页面的结构化指令。',
      'action: Codument.Demo.SOP.GoogleSearch',
      'page: google-search',
      'targetRef: page_target_exact',
    ].join('\n'));
    expect(message).not.toContain('query:');
    expect(message).not.toContain('SOP:');
    expect(message).not.toContain('page-workflow');
  });

  test('appends one canonical typed input line with bounded JSON data', () => {
    const message = buildMcpAppAgentMessage({
      hostSkill: 'codument',
      sopFqn: 'Codument.Demo.SOP.OpenDataExport',
      pageName: 'open-data-export',
      targetRef: 'page_target_exact',
      input: { startYear: 2000, entityCodes: ['USA', 'CHN'], chartSlug: 'life-expectancy' },
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['chartSlug', 'entityCodes', 'startYear'],
        properties: {
          chartSlug: { const: 'life-expectancy' },
          entityCodes: { type: 'array', items: { type: 'string' } },
          startYear: { type: 'integer' },
        },
      },
    });
    expect(message.split('\n').slice(0, 4)).toEqual([
      '请使用 codument skill 处理来自业务页面的结构化指令。',
      'action: Codument.Demo.SOP.OpenDataExport',
      'page: open-data-export',
      'targetRef: page_target_exact',
    ]);
    expect(message.split('\n')[4]).toBe('input: {"chartSlug":"life-expectancy","entityCodes":["USA","CHN"],"startYear":2000}');
    expect(() => buildMcpAppAgentMessage({
      hostSkill: 'codument',
      sopFqn: 'Action',
      pageName: 'page',
      targetRef: 'target',
      input: { unknown: true },
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    })).toThrow('input schema');
    expect(() => buildMcpAppAgentMessage({
      hostSkill: 'codument',
      sopFqn: 'Action',
      pageName: 'page',
      targetRef: 'target',
      input: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: { nested: true } } } } } } } } },
      inputSchema: true,
    })).toThrow('depth');
    expect(() => buildMcpAppAgentMessage({
      hostSkill: 'codument',
      sopFqn: 'Action',
      pageName: 'page',
      targetRef: 'target',
      input: { value: 'x'.repeat(9000) },
      inputSchema: true,
    })).toThrow('bytes');
  });

  test('emits a business-neutral MCP App bridge that stages page state before ui/message', () => {
    const html = buildMcpAppHtml([
      "globalThis.__AI_CLI_PAGE_VIEWS__ = { 'google-search': { mount() { return { renderRun() {} }; } } };",
    ]);
    expect(html).toContain('<!doctype html>');
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toContain('agent-target');
    expect(html).toContain('page_target_update');
    expect(html.indexOf('page_target_update')).toBeLessThan(html.indexOf("request('ui/message'"));
    expect(html).toContain('hostCapabilities.message');
    expect(html).toContain("missing.push('ui/message')");
    expect(html).toContain('ui/notifications/tool-result');
    expect(html).toContain('page_target_get');
    expect(html).toContain('__AI_CLI_PAGE_VIEWS__');
    expect(html).toContain('pageView.mount');
    expect(html).toContain('controller.renderRun');
    expect(html).toContain('target.agentMessage');
    expect(html).not.toContain('function agentMessage');
    expect(html).not.toContain('id="query"');
    expect(html).not.toContain('{ query }');
  });
});
