import type { VisionProvider, VisionRequest, VisionResponse, VisionInput } from './types.js';

export class OllamaVisionProvider implements VisionProvider {
  name = 'ollama-vision';
  private baseUrl: string;
  private model: string;

  constructor(options: { baseUrl?: string; model?: string } = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'llama3.2-vision:11b'; // or 'moondream'
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json() as { models: Array<{ name: string }> };
      return data.models.some(m => m.name.includes(this.model.split(':')[0]));
    } catch {
      return false;
    }
  }

  async analyze(request: VisionRequest): Promise<VisionResponse> {
    const start = Date.now();

    // Convert images to base64 for Ollama
    const images = await Promise.all(
      request.images.map(img => this.toBase64(img))
    );

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        images,
        stream: false,
        options: {
          num_predict: request.options?.maxTokens || 500,
          temperature: request.options?.temperature || 0.3,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama vision error: ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      content: data.response,
      tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      model: this.model,
      durationMs: Date.now() - start,
    };
  }

  private async toBase64(input: VisionInput): Promise<string> {
    if (input.type === 'base64') return input.data as string;

    if (input.type === 'buffer') {
      return Buffer.from(input.data as Buffer).toString('base64');
    }

    if (input.type === 'url') {
      const res = await fetch(input.data as string);
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }

    throw new Error(`Unknown input type: ${input.type}`);
  }
}
