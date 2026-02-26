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
