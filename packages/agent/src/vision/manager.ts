import type { VisionProvider, VisionRequest, VisionResponse } from './types.js';

export class VisionManager {
  private providers: VisionProvider[] = [];

  addProvider(provider: VisionProvider): void {
    this.providers.push(provider);
  }

  /**
   * Analyze image(s) — tries providers in order until one works
   */
  async analyze(request: VisionRequest): Promise<VisionResponse> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          const result = await provider.analyze(request);
          console.log(`[Vision] ${provider.name}: ${result.tokensUsed} tokens, ${result.durationMs}ms`);
          return result;
        }
      } catch (error) {
        console.warn(`[Vision] ${provider.name} failed:`, error);
        continue;
      }
    }
    throw new Error('No vision provider available');
  }
}
