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
