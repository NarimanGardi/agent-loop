import type { Tool } from './types';

/**
 * Identity helper that gives you argument typing when defining a tool inline:
 *
 *   const t = defineTool<{ city: string }>({ ... execute(args) { args.city } })
 */
export function defineTool<A extends Record<string, unknown> = Record<string, unknown>>(
  tool: Tool<A>,
): Tool<A> {
  return tool;
}
