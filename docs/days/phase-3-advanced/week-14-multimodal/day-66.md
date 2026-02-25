# Day 66 — Vision API Fundamentals

> 🎯 **DAY GOAL:** Understand multimodal AI — how LLMs process images — and build image analysis into Lunar

---

## 📚 CONCEPT 1: What Is Multimodal AI?

### WHAT — Simple Definition

**Multimodal AI = Models that understand multiple types of input: text + images + audio + video. Instead of just reading text, the model can "see" images and "hear" audio.**

```
TRADITIONAL LLM (text only):
  Input:  "What's in this image?"
  Output: "I can't see images."

MULTIMODAL LLM (text + vision):
  Input:  "What's in this image?" + [photo of a cat]
  Output: "A orange tabby cat sitting on a windowsill."

MODELS WITH VISION:
  ✅ Gemini Pro Vision   (free tier — 15 RPM)
  ✅ GPT-4 Vision        (paid — $0.01/image)
  ✅ Llama 3.2 Vision    (local via Ollama — free!)
  ✅ LLaVA               (local via Ollama — free!)
  ✅ Moondream           (local, tiny 1.8B — free!)
```

### WHY for Lunar

```
LUNAR + VISION USE CASES:
  1. "What's in this photo?" → Describe uploaded images
  2. "Read this screenshot" → OCR / extract text from images
  3. "Analyze this chart"   → Understand graphs and data
  4. "What's this error?"   → Read error screenshots
  5. "Is this safe?"        → Content moderation

WHERE IMAGES COME FROM:
  Telegram → User sends photo → grammY provides file URL
  Discord  → User attaches image → discord.js provides URL
  WebChat  → User uploads file → base64 or URL
```

### 🔗 NODE.JS ANALOGY

```javascript
// Traditional API: accepts only JSON text
app.post('/api/chat', express.json());

// Multimodal API: accepts text + files
app.post('/api/chat', upload.single('image'), (req, res) => {
  const text = req.body.message;
  const image = req.file;         // Image buffer
  const response = model.generate({ text, image });
  res.json({ response });
});

// Same concept — extending input types!
```

---

## 🔨 HANDS-ON: Build Vision Support

### Step 1: Vision Provider Interface (15 minutes)

Create `packages/agent/src/vision/types.ts`:

```typescript
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
```

### Step 2: Ollama Vision Provider (20 minutes)

Create `packages/agent/src/vision/ollama-vision.ts`:

```typescript
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
```

### Step 3: Gemini Vision Provider (20 minutes)

Create `packages/agent/src/vision/gemini-vision.ts`:

```typescript
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
```

### Step 4: Vision Manager with Fallback (10 minutes)

Create `packages/agent/src/vision/manager.ts`:

```typescript
import type { VisionProvider, VisionRequest, VisionResponse } from './types.js';

export class VisionManager {
  private providers: VisionProvider[] = [];

  addProvider(provider: VisionProvider): void {
    this.providers.push(provider);
  }

  /**
   * Analyze image(s) — tries providers in order until one works
   */
  async analyze(request: VisionRequest): Promise<VisionResponse> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          const result = await provider.analyze(request);
          console.log(`[Vision] ${provider.name}: ${result.tokensUsed} tokens, ${result.durationMs}ms`);
          return result;
        }
      } catch (error) {
        console.warn(`[Vision] ${provider.name} failed:`, error);
        continue;
      }
    }
    throw new Error('No vision provider available');
  }
}
```

---

## ✅ CHECKLIST

- [ ] Understand multimodal = text + images (+ audio + video)
- [ ] VisionInput supports URL, base64, and Buffer
- [ ] Ollama vision provider (local, free)
- [ ] Gemini vision provider (free tier)
- [ ] VisionManager tries providers in fallback order
- [ ] Images converted to base64 for API calls
- [ ] Response includes tokens used + latency

---

## 💡 KEY TAKEAWAY

**Multimodal AI lets Lunar "see" images. Two free options: Ollama (fully local, llama3.2-vision or moondream) and Gemini (free API tier). The architecture is the same as text LLMs — provider interface with fallback. Images are sent as base64 alongside the text prompt. This unlocks powerful features: screenshot analysis, photo descriptions, chart reading, and content moderation.**

---

**Next → [Day 67: Image Understanding + OCR](day-67.md)**
