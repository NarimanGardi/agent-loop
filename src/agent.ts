import type { Message, Provider, Tool, ToolCall, ToolSpec } from './types';

export interface AgentOptions {
  provider: Provider;
  tools?: Tool[];
  system?: string;
  /** Max provider round-trips before giving up. Default 10. */
  maxSteps?: number;
}

export interface AgentResult {
  /** The assistant's final text answer. */
  text: string;
  /** How many provider round-trips it took. */
  steps: number;
  /** The full history, including tool calls and their results. */
  messages: Message[];
}

export class MaxStepsExceededError extends Error {
  constructor(
    public readonly steps: number,
    public readonly messages: Message[],
  ) {
    super(`Agent did not finish within ${steps} steps`);
    this.name = 'MaxStepsExceededError';
  }
}

/**
 * The whole agent: ask the provider, run any tools it calls, feed the results
 * back, repeat until it returns a final answer (or maxSteps is hit).
 */
export class Agent {
  private readonly provider: Provider;
  private readonly tools: Map<string, Tool>;
  private readonly toolSpecs: ToolSpec[];
  private readonly system?: string;
  private readonly maxSteps: number;

  constructor(options: AgentOptions) {
    const tools = options.tools ?? [];
    this.provider = options.provider;
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    this.toolSpecs = tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
    this.system = options.system;
    this.maxSteps = options.maxSteps ?? 10;
  }

  async run(prompt: string): Promise<AgentResult> {
    const messages: Message[] = [];
    if (this.system !== undefined) messages.push({ role: 'system', content: this.system });
    messages.push({ role: 'user', content: prompt });

    for (let step = 1; step <= this.maxSteps; step++) {
      const response = await this.provider.complete({ messages, tools: this.toolSpecs });

      if (response.kind === 'message') {
        messages.push({ role: 'assistant', content: response.content });
        return { text: response.content, steps: step, messages };
      }

      messages.push({ role: 'assistant', content: null, toolCalls: response.toolCalls });

      for (const call of response.toolCalls) {
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: await this.runTool(call),
        });
      }
    }

    throw new MaxStepsExceededError(this.maxSteps, messages);
  }

  /** Run one tool. Unknown tools and thrown errors come back as text the model can recover from. */
  private async runTool(call: ToolCall): Promise<string> {
    const tool = this.tools.get(call.name);

    if (tool === undefined) {
      return `Error: unknown tool "${call.name}"`;
    }

    try {
      return await tool.execute(call.arguments);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
