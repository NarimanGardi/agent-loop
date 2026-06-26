import { expect, it } from 'vitest';
import { Agent, MaxStepsExceededError } from '../src';
import type { Tool } from '../src';
import { MockProvider } from './mock-provider';

const echo: Tool<{ text: string }> = {
  name: 'echo',
  description: 'Echo the input back.',
  parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  execute: (args) => `echo: ${args.text}`,
};

it('returns the final message when the provider stops calling tools', async () => {
  const agent = new Agent({ provider: new MockProvider([{ kind: 'message', content: 'Hello!' }]) });

  const result = await agent.run('hi');

  expect(result.text).toBe('Hello!');
  expect(result.steps).toBe(1);
});

it('runs a tool call and feeds the result back', async () => {
  const provider = new MockProvider([
    { kind: 'tool_calls', toolCalls: [{ id: '1', name: 'echo', arguments: { text: 'hi' } }] },
    { kind: 'message', content: 'done' },
  ]);

  const result = await new Agent({ provider, tools: [echo] }).run('say hi');

  expect(result.text).toBe('done');
  expect(result.steps).toBe(2);

  const toolMessage = result.messages.find((m) => m.role === 'tool');
  expect(toolMessage?.content).toBe('echo: hi');
});

it('reports an unknown tool back to the model instead of throwing', async () => {
  const provider = new MockProvider([
    { kind: 'tool_calls', toolCalls: [{ id: '1', name: 'nope', arguments: {} }] },
    { kind: 'message', content: 'recovered' },
  ]);

  const result = await new Agent({ provider, tools: [echo] }).run('x');

  expect(result.messages.find((m) => m.role === 'tool')?.content).toContain('unknown tool');
  expect(result.text).toBe('recovered');
});

it('catches a thrown tool error and returns it in-band', async () => {
  const boom: Tool = {
    name: 'boom',
    description: 'Always throws.',
    parameters: { type: 'object' },
    execute: () => {
      throw new Error('kaboom');
    },
  };
  const provider = new MockProvider([
    { kind: 'tool_calls', toolCalls: [{ id: '1', name: 'boom', arguments: {} }] },
    { kind: 'message', content: 'ok' },
  ]);

  const result = await new Agent({ provider, tools: [boom] }).run('x');

  expect(result.messages.find((m) => m.role === 'tool')?.content).toContain('kaboom');
});

it('passes the system prompt and tool specs to the provider', async () => {
  const provider = new MockProvider([{ kind: 'message', content: 'hi' }]);

  await new Agent({ provider, tools: [echo], system: 'You are terse.' }).run('go');

  expect(provider.requests[0]?.messages[0]).toEqual({ role: 'system', content: 'You are terse.' });
  expect(provider.requests[0]?.tools[0]?.name).toBe('echo');
});

it('throws MaxStepsExceededError when the model never stops', async () => {
  const provider = new MockProvider(
    Array.from({ length: 5 }, () => ({
      kind: 'tool_calls' as const,
      toolCalls: [{ id: '1', name: 'echo', arguments: { text: 'x' } }],
    })),
  );

  await expect(new Agent({ provider, tools: [echo], maxSteps: 3 }).run('loop')).rejects.toBeInstanceOf(
    MaxStepsExceededError,
  );
});
