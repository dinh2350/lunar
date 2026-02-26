import type { VisionManager } from '../vision/manager.js';
import type { AudioManager } from '../audio/manager.js';
import type { ImageGenManager } from '../image-gen/manager.js';

export interface MultimodalInput {
  text?: string;
  images?: Array<{
    data: Buffer | string;  // Buffer or URL
    mimeType: string;
  }>;
  audio?: {
    data: Buffer;
    format: string;  // 'ogg', 'mp3', 'wav'
  };
}

export interface MultimodalOutput {
  text: string;
  images?: Array<{
    data: Buffer;
    mimeType: string;
  }>;
  audio?: {
    data: Buffer;
    format: string;
  };
}

export class MultimodalRouter {
  constructor(
    private vision: VisionManager,
    private audio: AudioManager,
    private imageGen: ImageGenManager,
  ) {}

  /**
   * Process multimodal input into text for the agent
   */
  async processInput(input: MultimodalInput): Promise<string> {
    const parts: string[] = [];

    // 1. Transcribe audio → text
    if (input.audio) {
      const transcript = await this.audio.transcribe(input.audio.data, input.audio.format);
      parts.push(`[Voice message]: ${transcript}`);
    }

    // 2. Describe images → text
    if (input.images && input.images.length > 0) {
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        const description = await this.vision.analyze({
          prompt: 'Describe this image concisely.',
          images: [{
            type: typeof img.data === 'string' ? 'url' : 'buffer',
            data: img.data,
            mimeType: img.mimeType as any,
          }],
        });
        parts.push(`[Image ${i + 1}]: ${description.content}`);
      }
    }

    // 3. Add text
    if (input.text) {
      parts.push(input.text);
    }

    return parts.join('\n\n');
  }

  /**
   * Process agent output — generate images/audio if needed
   */
  async processOutput(
    text: string,
    options: { voiceReply?: boolean; voice?: string } = {},
  ): Promise<MultimodalOutput> {
    const output: MultimodalOutput = { text };

    // Check if agent generated an image (via tool call result)
    const imageMatch = text.match(/\[generated_image:(.*?)\]/);
    if (imageMatch) {
      const base64 = imageMatch[1];
      output.images = [{
        data: Buffer.from(base64, 'base64'),
        mimeType: 'image/png',
      }];
      output.text = text.replace(/\[generated_image:.*?\]/, '').trim();
    }

    // Generate voice reply if requested
    if (options.voiceReply) {
      output.audio = {
        data: await this.audio.speak(output.text, options.voice),
        format: 'mp3',
      };
    }

    return output;
  }
}
