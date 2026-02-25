export interface VisionInput {
  type: 'url' | 'base64' | 'buffer';
  data: string | Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface VisionRequest {
  prompt: string;
  images: VisionInput[];
  options?: {
    maxTokens?: number;
    temperature?: number;
    detail?: 'low' | 'high' | 'auto';  // Image resolution
  };
}

export interface VisionResponse {
  content: string;
  tokensUsed: number;
  model: string;
  durationMs: number;
}

export interface VisionProvider {
  name: string;
  analyze(request: VisionRequest): Promise<VisionResponse>;
  isAvailable(): Promise<boolean>;
}
