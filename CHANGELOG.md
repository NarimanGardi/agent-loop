# Changelog

## v0.2.0

- Add lifecycle hooks — `onStep`, `onToolCall`, `onToolResult` — to observe the
  loop (logging, progress UI, tracing). All are awaited if they return a promise.
- Add an Anthropic provider example (`examples/anthropic.ts`) alongside OpenAI,
  showing the same `Provider` interface mapped onto a structurally different API.

## v0.1.0

- Initial release: the `Agent` tool-loop, `Tool` / `Provider` types, `defineTool`,
  and a typechecked OpenAI example.
