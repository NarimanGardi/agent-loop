import { Agent } from '../src';
import type { Tool } from '../src';
import { openAiProvider } from './openai';

// A trivial tool. Swap the body for a real API call.
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

const apiKey = process.env.OPENAI_API_KEY;

if (apiKey === undefined) {
  throw new Error('Set OPENAI_API_KEY to run this example.');
}

const agent = new Agent({
  provider: openAiProvider({ apiKey }),
  tools: [getWeather],
  system: 'You are a concise assistant.',
});

const result = await agent.run('What should I wear in Erbil today?');

console.log(result.text);
console.log(`(${result.steps} steps)`);
