import { expect, it } from 'vitest';
import { Agent } from '../src';
import type { Tool, ToolCall } from '../src';
import { MockProvider } from './mock-provider';

const echo: Tool<{ text: string }> = {
  name: 'echo',
  description: 'Echo the input back.',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  execute: (args) => `echo: ${args.text}`,
};

it('fires onStep, onToolCall and onToolResult', async () => {
  const provider = new MockProvider([
    { kind: 'tool_calls', toolCalls: [{ id: '1', name: 'echo', arguments: { text: 'hi' } }] },
    { kind: 'message', content: 'done' },
  ]);

  const steps: number[] = [];
  const calls: ToolCall[] = [];
  const results: string[] = [];

  await new Agent({
    provider,
    tools: [echo],
    onStep: (step) => {
      steps.push(step);
    },
    onToolCall: (call) => {
      calls.push(call);
    },
    onToolResult: (_call, output) => {
      results.push(output);
    },
  }).run('go');

  expect(steps).toEqual([1, 2]);
  expect(calls.map((c) => c.name)).toEqual(['echo']);
  expect(results).toEqual(['echo: hi']);
});

it('awaits async hooks', async () => {
  let done = false;

  await new Agent({
    provider: new MockProvider([{ kind: 'message', content: 'ok' }]),
    onStep: async () => {
      await Promise.resolve();
      done = true;
    },
  }).run('x');

  expect(done).toBe(true);
});
