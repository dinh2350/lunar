import type { ImageGenProvider, ImageGenRequest, ImageGenResult } from './types.js';

/**
 * Pollinations.ai — Completely free image generation
 * No API key, no signup, no rate limits (reasonable use)
 * Uses FLUX and Stable Diffusion models
 * 
 * API: https://image.pollinations.ai/prompt/{prompt}
 */
export class PollinationsProvider implements ImageGenProvider {
  name = 'pollinations';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('https://image.pollinations.ai/', { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(request: ImageGenRequest): Promise<ImageGenResult> {
    const start = Date.now();

    // Build URL with parameters
    const params = new URLSearchParams({
      width: String(request.width || 1024),
      height: String(request.height || 1024),
      nologo: 'true',
      enhance: 'true',  // AI-enhances the prompt
    });

    if (request.seed) params.set('seed', String(request.seed));
    if (request.negativePrompt) {
      params.set('negative', request.negativePrompt);
    }

    const encodedPrompt = encodeURIComponent(request.prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Pollinations error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    return {
      imageBuffer,
      mimeType: 'image/jpeg',
      model: 'pollinations-flux',
      durationMs: Date.now() - start,
    };
  }
}
