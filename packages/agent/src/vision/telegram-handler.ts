import type { VisionManager } from './manager.js';
import type { VisionInput } from './types.js';

/**
 * Handle image messages from Telegram
 * 
 * Telegram sends photos as file_id → need to get file URL first
 */
export class TelegramImageHandler {
  private vision: VisionManager;
  private botToken: string;

  constructor(vision: VisionManager, botToken: string) {
    this.vision = vision;
    this.botToken = botToken;
  }

  /**
   * Get Telegram file URL from file_id
   */
  async getFileUrl(fileId: string): Promise<string> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`
    );
    const data = await res.json() as any;

    if (!data.ok) throw new Error(`Telegram getFile failed: ${data.description}`);

    return `https://api.telegram.org/file/bot${this.botToken}/${data.result.file_path}`;
  }

  /**
   * Process a photo message
   */
  async handlePhoto(
    fileId: string,
    caption?: string,
  ): Promise<string> {
    const url = await this.getFileUrl(fileId);

    const image: VisionInput = {
      type: 'url',
      data: url,
      mimeType: 'image/jpeg',
    };

    const prompt = caption || 'Describe this image and any relevant details.';

    const result = await this.vision.analyze({
      prompt,
      images: [image],
    });

    return result.content;
  }

  /**
   * Process a document (image file sent as document)
   */
  async handleDocument(
    fileId: string,
    mimeType: string,
    caption?: string,
  ): Promise<string | null> {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!imageTypes.includes(mimeType)) return null;

    return this.handlePhoto(fileId, caption);
  }
}
