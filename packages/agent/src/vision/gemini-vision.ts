import type { VisionProvider, VisionRequest, VisionResponse, VisionInput } from './types.js';

export class GeminiVisionProvider implements VisionProvider {
  name = 'gemini-vision';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(request: VisionRequest): Promise<VisionResponse> {
    const start = Date.now();

    // Build multimodal content parts
    const parts: any[] = [];

    // Add images
    for (const img of request.images) {
      const base64 = await this.toBase64(img);
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: base64,
        },
      });
    }

    // Add text prompt
    parts.push({ text: request.prompt });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: request.options?.maxTokens || 500,
          temperature: request.options?.temperature || 0.3,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini vision error: ${err}`);
    }

    const data = await response.json() as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      content,
      tokensUsed: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
      model: this.model,
      durationMs: Date.now() - start,
    };
  }

  private async toBase64(input: VisionInput): Promise<string> {
    if (input.type === 'base64') return input.data as string;
    if (input.type === 'buffer') return Buffer.from(input.data as Buffer).toString('base64');
    if (input.type === 'url') {
      const res = await fetch(input.data as string);
      const buffer = await res.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    }
    throw new Error(`Unknown input type: ${input.type}`);
  }
}
