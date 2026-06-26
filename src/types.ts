/** A single tool call the model wants to make. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** A message in the running conversation. */
export type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

/** A tool the agent can call. `execute` returns the result the model sees. */
export interface Tool<A extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema describing the arguments. */
  parameters: Record<string, unknown>;
  execute(args: A): string | Promise<string>;
}

/** The tool shape sent to the provider (everything except `execute`). */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompletionRequest {
  messages: Message[];
  tools: ToolSpec[];
}

/** What a provider returns: either a final message, or tool calls to run. */
export type CompletionResponse =
  | { kind: 'message'; content: string }
  | { kind: 'tool_calls'; toolCalls: ToolCall[] };

/**
 * The one thing you implement to plug in an LLM. Map your provider's
 * chat/tool-calling API to a CompletionResponse and you're done.
 */
export interface Provider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
