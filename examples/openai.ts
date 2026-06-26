import type { CompletionRequest, CompletionResponse, Message, Provider } from '../src';

export interface OpenAiOptions {
  apiKey: string;
  model?: string;
  /** Override for OpenAI-compatible servers (Together, Groq, OpenRouter, Ollama…). */
  baseUrl?: string;
}

/**
 * A minimal OpenAI-compatible Provider — just `fetch`, no SDK. It maps the
 * agent-loop conversation to the Chat Completions wire format and back. Works
 * with OpenAI and anything that mirrors its API.
 */
export function openAiProvider(options: OpenAiOptions): Provider {
  const { apiKey, model = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1' } = options;

  return {
    async complete({ messages, tools }: CompletionRequest): Promise<CompletionResponse> {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(toOpenAiMessage),
          tools: tools.length > 0 ? tools.map((tool) => ({ type: 'function', function: tool })) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as ChatCompletion;
      const message = data.choices[0]?.message;

      if (message?.tool_calls && message.tool_calls.length > 0) {
        return {
          kind: 'tool_calls',
          toolCalls: message.tool_calls.map((call) => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
          })),
        };
      }

      return { kind: 'message', content: message?.content ?? '' };
    },
  };
}

/** Map one agent-loop message to the OpenAI wire format. */
function toOpenAiMessage(message: Message): Record<string, unknown> {
  switch (message.role) {
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };

    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              })),
            }
          : {}),
      };

    default:
      return { role: message.role, content: message.content };
  }
}

interface ChatCompletion {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
}
