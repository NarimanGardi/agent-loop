import type { CompletionRequest, CompletionResponse, Message, Provider } from '../src';

export interface AnthropicOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

/**
 * A minimal Anthropic (Claude) Provider. Anthropic's Messages API is shaped
 * differently from OpenAI's — a top-level `system`, and tool calls/results as
 * content blocks — which is the point: the same agent-loop interface maps onto
 * a structurally different API with a bit of adapter code.
 */
export function anthropicProvider(options: AnthropicOptions): Provider {
  const { apiKey, model = 'claude-sonnet-4-6', maxTokens = 1024, baseUrl = 'https://api.anthropic.com/v1' } = options;

  return {
    async complete({ messages, tools }: CompletionRequest): Promise<CompletionResponse> {
      const { system, messages: anthropicMessages } = toAnthropic(messages);

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: anthropicMessages,
          tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as AnthropicResponse;

      const toolUses = data.content.filter((block) => block.type === 'tool_use');

      if (toolUses.length > 0) {
        return {
          kind: 'tool_calls',
          toolCalls: toolUses.map((block) => ({ id: block.id, name: block.name, arguments: block.input })),
        };
      }

      const text = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return { kind: 'message', content: text };
    },
  };
}

/** Map agent-loop messages to Anthropic's `system` + content-block format. */
function toAnthropic(messages: Message[]): { system?: string; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const out: AnthropicMessage[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      system = message.content;
      continue;
    }

    if (message.role === 'user') {
      out.push({ role: 'user', content: message.content });
      continue;
    }

    if (message.role === 'assistant') {
      if (message.toolCalls && message.toolCalls.length > 0) {
        const blocks: AnthropicBlock[] = [];
        if (message.content) blocks.push({ type: 'text', text: message.content });
        for (const call of message.toolCalls) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments });
        }
        out.push({ role: 'assistant', content: blocks });
      } else {
        out.push({ role: 'assistant', content: message.content ?? '' });
      }
      continue;
    }

    // Tool result. Anthropic wants all results for a turn in one user message,
    // so merge into the previous block array when there is one.
    const block: AnthropicBlock = { type: 'tool_result', tool_use_id: message.toolCallId, content: message.content };
    const last = out[out.length - 1];

    if (last !== undefined && last.role === 'user' && Array.isArray(last.content)) {
      last.content.push(block);
    } else {
      out.push({ role: 'user', content: [block] });
    }
  }

  return { system, messages: out };
}

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicBlock[];
}

interface AnthropicResponse {
  content: AnthropicBlock[];
}
