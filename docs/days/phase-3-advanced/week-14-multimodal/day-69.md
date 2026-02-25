# Day 69 — Image Generation

> 🎯 **DAY GOAL:** Add image creation capabilities to Lunar — generate images from text prompts using free/local tools

---

## 📚 CONCEPT 1: Image Generation Options

### WHAT — Free Ways to Generate Images

```
IMAGE GENERATION MODELS:
┌─────────────────────────────────────────────────────────┐
│ Model              │ Where     │ Cost │ Quality │ Speed  │
├────────────────────┼───────────┼──────┼─────────┼────────┤
│ Stable Diffusion   │ Local     │ Free │ ★★★★★  │ 10-60s │
│ FLUX.1 schnell     │ Local     │ Free │ ★★★★★  │ 5-30s  │
│ Gemini Imagen      │ API       │ Free*│ ★★★★★  │ 3-10s  │
│ Pollinations.ai    │ API       │ Free │ ★★★★   │ 5-15s  │
│ DALL-E 3           │ API       │ Paid │ ★★★★★  │ 5-15s  │
└─────────────────────────────────────────────────────────┘

* Gemini free tier includes limited image generation

FOR LUNAR (zero-cost):
  Option 1: Pollinations.ai — Completely free API, no key needed
  Option 2: Stable Diffusion via ComfyUI — Local, free, needs GPU
  Option 3: Gemini Imagen — Free tier
```

---

## 🔨 HANDS-ON: Build Image Generation

### Step 1: Generation Provider Interface (10 minutes)

Create `packages/agent/src/image-gen/types.ts`:

```typescript
export interface ImageGenRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  style?: string;
}

export interface ImageGenResult {
  imageBuffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  model: string;
  durationMs: number;
  revisedPrompt?: string;  // Some models improve your prompt
}

export interface ImageGenProvider {
  name: string;
  generate(request: ImageGenRequest): Promise<ImageGenResult>;
  isAvailable(): Promise<boolean>;
}
```

### Step 2: Pollinations Provider — No API Key! (20 minutes)

Create `packages/agent/src/image-gen/pollinations.ts`:

```typescript
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
```

### Step 3: Stable Diffusion via ComfyUI (15 minutes)

Create `packages/agent/src/image-gen/comfyui.ts`:

```typescript
import type { ImageGenProvider, ImageGenRequest, ImageGenResult } from './types.js';

/**
 * ComfyUI — Local Stable Diffusion / FLUX
 * 
 * Setup:
 *   git clone https://github.com/comfyanonymous/ComfyUI
 *   cd ComfyUI && pip install -r requirements.txt
 *   python main.py --listen
 *   # Download models to ComfyUI/models/checkpoints/
 */
export class ComfyUIProvider implements ImageGenProvider {
  name = 'comfyui';
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8188') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(request: ImageGenRequest): Promise<ImageGenResult> {
    const start = Date.now();

    // ComfyUI uses a workflow format
    const workflow = this.buildWorkflow(request);

    // Queue the prompt
    const queueRes = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    const { prompt_id } = await queueRes.json() as { prompt_id: string };

    // Poll for completion
    const imageBuffer = await this.waitForResult(prompt_id);

    return {
      imageBuffer,
      mimeType: 'image/png',
      model: 'stable-diffusion-local',
      durationMs: Date.now() - start,
    };
  }

  private buildWorkflow(request: ImageGenRequest): Record<string, any> {
    return {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: request.seed || Math.floor(Math.random() * 2**32),
          steps: request.steps || 20,
          cfg: 7.0,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1.0,
          model: ['4', 0],
          positive: ['6', 0],
          negative: ['7', 0],
          latent_image: ['5', 0],
        },
      },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: request.width || 1024, height: request.height || 1024, batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: request.prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: request.negativePrompt || 'bad quality, blurry', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'lunar', images: ['8', 0] } },
    };
  }

  private async waitForResult(promptId: string, timeoutMs = 120_000): Promise<Buffer> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/history/${promptId}`);
      const data = await res.json() as any;

      if (data[promptId]?.outputs?.['9']?.images?.[0]) {
        const image = data[promptId].outputs['9'].images[0];
        const imgRes = await fetch(
          `${this.baseUrl}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`
        );
        return Buffer.from(await imgRes.arrayBuffer());
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('ComfyUI generation timed out');
  }
}
```

### Step 4: Image Gen Tool + Manager (10 minutes)

Create `packages/agent/src/image-gen/manager.ts`:

```typescript
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
```

---

## ✅ CHECKLIST

- [ ] ImageGen provider interface (prompt → image buffer)
- [ ] Pollinations provider (free, no API key)
- [ ] ComfyUI provider (local Stable Diffusion)
- [ ] ImageGen manager with fallback
- [ ] Agent tool `generate_image` defined
- [ ] Output as base64 for channel delivery

---

## 💡 KEY TAKEAWAY

**Image generation is now free and accessible. Pollinations.ai requires zero setup — just call the URL with your prompt. For local generation, ComfyUI runs Stable Diffusion or FLUX on your GPU. The pattern is the same as everything else in Lunar: provider interface → manager with fallback → tool for the agent. Lunar can now both understand images (Day 66-67) AND create them.**

---

**Next → [Day 70: Multimodal Integration + Week 14 Wrap](day-70.md)**
