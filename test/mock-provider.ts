import type { CompletionRequest, CompletionResponse, Provider } from '../src/types';

/** A provider that replays a fixed, scripted sequence of responses. */
export class MockProvider implements Provider {
  private index = 0;
  public readonly requests: CompletionRequest[] = [];

  constructor(private readonly script: CompletionResponse[]) {}

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.requests.push(request);

    const response = this.script[this.index++];

    if (response === undefined) {
      throw new Error('MockProvider ran out of scripted responses');
    }

    return response;
  }
}
