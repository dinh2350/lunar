# Day 70 — Multimodal Integration + Week 14 Wrap

> 🎯 **DAY GOAL:** Wire all multimodal capabilities together: vision + audio + image gen working as agent tools. Wrap Phase 3.

---

## 📚 CONCEPT: The Multimodal Agent

```
LUNAR MULTIMODAL ARCHITECTURE:
┌─────────────────────────────────────────────────────────────┐
│                    LUNAR AGENT ENGINE                         │
│                                                              │
│  Tools:                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐         │
│  │ 👁️ Vision    │ │ 🎤 Audio    │ │ 🎨 Image Gen  │         │
│  │             │ │             │ │               │         │
│  │ describe    │ │ transcribe  │ │ generate      │         │
│  │ ocr         │ │ speak       │ │               │         │
│  │ analyze     │ │             │ │               │         │
│  │ extract     │ │             │ │               │         │
│  └──────┬──────┘ └──────┬──────┘ └───────┬───────┘         │
│         │               │                │                   │
│  ┌──────▼───────────────▼────────────────▼───────┐          │
│  │              Multimodal Router                 │          │
│  │  Input has image? → Vision pipeline            │          │
│  │  Input has audio? → STT → Text pipeline        │          │
│  │  Output needs image? → Image Gen pipeline      │          │
│  │  Output needs audio? → TTS pipeline            │          │
│  └────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔨 HANDS-ON: Multimodal Router

### Step 1: Unified Input Handler (20 minutes)

Create `packages/agent/src/multimodal/router.ts`:

```typescript
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
```

### Step 2: Channel Adapter (Telegram Example) (15 minutes)

```typescript
// How Telegram bot uses multimodal router

import type { MultimodalRouter } from './router.js';
import type { Context } from 'grammy';

export function setupTelegramMultimodal(
  router: MultimodalRouter,
  agentHandle: (text: string) => Promise<string>,
) {
  return {
    // Handle text messages
    async onText(ctx: Context) {
      const input = { text: ctx.message?.text || '' };
      const processedText = await router.processInput(input);
      const response = await agentHandle(processedText);
      const output = await router.processOutput(response);
      await ctx.reply(output.text);
    },

    // Handle photo messages
    async onPhoto(ctx: Context) {
      const photos = ctx.message?.photo || [];
      const largest = photos[photos.length - 1]; // Highest resolution
      
      // Get file URL from Telegram
      const file = await ctx.api.getFile(largest.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

      const input = {
        text: ctx.message?.caption || 'What is in this image?',
        images: [{ data: fileUrl, mimeType: 'image/jpeg' }],
      };

      const processedText = await router.processInput(input);
      const response = await agentHandle(processedText);
      const output = await router.processOutput(response);

      if (output.images?.length) {
        await ctx.replyWithPhoto(new InputFile(output.images[0].data));
      }
      await ctx.reply(output.text);
    },

    // Handle voice messages
    async onVoice(ctx: Context) {
      const voice = ctx.message?.voice;
      if (!voice) return;

      const file = await ctx.api.getFile(voice.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
      const audioRes = await fetch(fileUrl);
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

      const input = { audio: { data: audioBuffer, format: 'ogg' } };
      const processedText = await router.processInput(input);
      const response = await agentHandle(processedText);
      const output = await router.processOutput(response, { voiceReply: true });

      if (output.audio) {
        await ctx.replyWithVoice(new InputFile(output.audio.data));
      } else {
        await ctx.reply(output.text);
      }
    },
  };
}
```

---

## 📋 Week 14 Summary

### What We Built

| Day | Topic | Key Output |
|-----|-------|------------|
| 66 | Vision fundamentals | VisionProvider, Ollama + Gemini providers |
| 67 | Image understanding + OCR | describe, OCR, chart, data extraction tools |
| 68 | Audio (STT + TTS) | Whisper STT, Edge TTS, Piper TTS |
| 69 | Image generation | Pollinations (free), ComfyUI (local) |
| 70 | Multimodal integration | MultimodalRouter, channel adapters |

### Architecture

```
packages/agent/src/
├── vision/
│   ├── types.ts             # VisionInput, VisionProvider
│   ├── ollama-vision.ts     # Local vision (Llama 3.2 Vision)
│   ├── gemini-vision.ts     # Gemini free tier
│   ├── manager.ts           # Fallback manager
│   ├── tools.ts             # describe, OCR, chart, extract
│   └── telegram-handler.ts  # Telegram image handling
├── audio/
│   ├── stt.ts               # WhisperSTT, GeminiSTT
│   ├── tts.ts               # EdgeTTS, PiperTTS
│   └── manager.ts           # Audio manager
├── image-gen/
│   ├── types.ts             # ImageGenRequest/Result
│   ├── pollinations.ts      # Free API (no key!)
│   ├── comfyui.ts           # Local Stable Diffusion
│   └── manager.ts           # Gen manager + tool
└── multimodal/
    └── router.ts            # Input/output processing
```

---

## 📋 Phase 3 Complete! Summary

### Phase 3: Advanced Features (Weeks 9-14)

| Week | Topic | Key Result |
|------|-------|------------|
| 9 | Control UI | Next.js dashboard with chat, memory, settings |
| 10 | Advanced Eval | A/B testing, regression, custom metrics, golden sets |
| 11 | Safety | Input/output guards, PII detection, tool sandboxing |
| 12 | Sub-agents | Coordinator + specialists, recovery, circuit breakers |
| 13 | Fine-tuning | QLoRA via Unsloth, data pipeline, model registry |
| 14 | Multimodal | Vision, audio, image gen, unified router |

---

## ✅ PHASE 3 CHECKLIST

- [ ] Control UI with chat, memory browser, settings
- [ ] Advanced eval: A/B tests, regression, golden sets
- [ ] Safety: input guards, PII detection, output guards, tool sandboxing
- [ ] Sub-agents: coordinator, specialists, retry/fallback/circuit breaker
- [ ] Fine-tuning: data pipeline → QLoRA → export → Ollama
- [ ] Multimodal: vision (understand) + audio (STT/TTS) + image gen (create)
- [ ] All features use provider pattern with fallbacks
- [ ] Everything works at $0 cost (local + free APIs)

---

## 💡 KEY TAKEAWAY

**Phase 3 transformed Lunar from a basic agent into a production-ready platform. The pattern is consistent everywhere: define an interface → implement providers → wrap in a manager with fallbacks. This makes every capability (vision, audio, image gen, sub-agents) pluggable and resilient. Phase 4 will polish everything and prepare for launch.**

---

## ❓ SELF-CHECK QUESTIONS

1. How does the multimodal router decide what to do with mixed input (text + image + audio)?
2. Why do we convert all non-text inputs to text before sending to the agent?
3. What's the fallback chain for vision (if Ollama is down)?
4. How would you add video support to this architecture?
5. What's the difference between Phase 3 Lunar and Phase 2 Lunar?

---

**Next → [Phase 4: Polish & Launch](../../phase-4-launch/week-15-testing/day-71.md)**
