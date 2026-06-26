# agent-loop

A tiny, zero-dependency, provider-agnostic **agent tool-loop** for TypeScript.
The whole thing is one small class: ask an LLM, run the tools it asks for, feed
the results back, repeat until it answers. Bring your own model.

I built an AI-agent workshop ([Atelier](https://gardi.dev/projects/atelier))
where agents do real work on a git repo — and wrote the agent loop from scratch
rather than reaching for an SDK. This is that core, pulled out and generalized:
no framework, no provider lock-in, nothing to learn but one interface.

## Install

```bash
npm i agent-loop
```

## Use it

Define some tools, plug in a provider, and run:

```ts
import { Agent } from 'agent-loop';
import type { Tool } from 'agent-loop';

const getWeather: Tool<{ city: string }> = {
  name: 'get_weather',
  description: 'Get the current weather for a city.',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
  execute: async ({ city }) => `It's 24°C and clear in ${city}.`,
};

const agent = new Agent({
  provider: openai, // see "Plug in a model" below
  tools: [getWeather],
  system: 'You are a concise assistant.',
});

const result = await agent.run('What should I wear in Erbil today?');
console.log(result.text);   // the final answer
console.log(result.steps);  // how many round-trips it took
```

## How it works

`run()` is the entire loop:

1. Send the conversation + tool specs to the provider.
2. If the provider returns a **message**, that's the answer — return it.
3. If it returns **tool calls**, run each tool and append the results.
4. Go back to step 1 (up to `maxSteps`, default 10).

Unknown tools and thrown errors are handed back to the model as text, so it can
recover instead of crashing the loop.

## Plug in a model

There's one interface to implement — map your LLM's tool-calling API to a
`CompletionResponse`:

```ts
import type { Provider } from 'agent-loop';

const openai: Provider = {
  async complete({ messages, tools }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: toOpenAiMessages(messages), // small adapter you write
        tools: tools.map((t) => ({ type: 'function', function: t })),
      }),
    });

    const { choices } = await res.json();
    const message = choices[0].message;

    if (message.tool_calls?.length) {
      return {
        kind: 'tool_calls',
        toolCalls: message.tool_calls.map((c: any) => ({
          id: c.id,
          name: c.function.name,
          arguments: JSON.parse(c.function.arguments),
        })),
      };
    }

    return { kind: 'message', content: message.content };
  },
};
```

The same shape works for Anthropic, Gemini, Ollama, or anything else — it's just
"messages + tools in, message-or-tool-calls out."

## Limitations

Deliberately small. Worth knowing:

- **No streaming.** `run()` resolves once, with the final text.
- **One run per call.** Multi-turn chat is yours to drive (keep calling `run`,
  or hold the returned `messages`).
- **No retries / rate-limit handling.** Wrap your `Provider` for that.
- **No argument validation.** Tools receive whatever the model sends; validate
  inside `execute` if you need to.

## Development

```bash
npm install
npm test        # vitest
npm run build   # tsup → dist (esm + cjs + d.ts)
```

## License

MIT — see [LICENSE](LICENSE).
