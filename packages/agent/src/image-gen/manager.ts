import type { ImageGenProvider, ImageGenRequest, ImageGenResult } from './types.js';

export class ImageGenManager {
  private providers: ImageGenProvider[] = [];

  addProvider(provider: ImageGenProvider): void {
    this.providers.push(provider);
  }

  async generate(request: ImageGenRequest): Promise<ImageGenResult> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          const result = await provider.generate(request);
          console.log(`[ImageGen] ${provider.name}: ${result.imageBuffer.length} bytes, ${result.durationMs}ms`);
          return result;
        }
      } catch (error) {
        console.warn(`[ImageGen] ${provider.name} failed:`, error);
      }
    }
    throw new Error('No image generation provider available');
  }
}

// Tool definition for agent
export function createImageGenTool(manager: ImageGenManager) {
  return {
    name: 'generate_image',
    description: 'Generate an image from a text description',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed description of the image to generate' },
        style: { type: 'string', description: 'Art style (e.g., photorealistic, anime, watercolor)', default: 'photorealistic' },
        width: { type: 'number', description: 'Image width in pixels', default: 1024 },
        height: { type: 'number', description: 'Image height in pixels', default: 1024 },
      },
      required: ['prompt'],
    },
    execute: async (args: { prompt: string; style?: string; width?: number; height?: number }) => {
      const styledPrompt = args.style
        ? `${args.prompt}, ${args.style} style`
        : args.prompt;

      const result = await manager.generate({
        prompt: styledPrompt,
        width: args.width,
        height: args.height,
      });

      // Return as base64 for sending via channels
      return {
        type: 'image',
        base64: result.imageBuffer.toString('base64'),
        mimeType: result.mimeType,
        model: result.model,
      };
    },
  };
}
