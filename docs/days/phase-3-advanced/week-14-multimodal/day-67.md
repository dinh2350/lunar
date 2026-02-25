# Day 67 — Image Understanding + OCR

> 🎯 **DAY GOAL:** Build practical image tools — describe photos, extract text from screenshots (OCR), and analyze charts

---

## 📚 CONCEPT 1: Types of Image Understanding

### WHAT — What Vision Models Can Do

```
IMAGE UNDERSTANDING TASKS:
┌────────────────────────────────────────────────────┐
│ 1. DESCRIPTION  — "What's in this image?"          │
│    Input: Photo → Output: "A sunset over ocean"    │
│                                                     │
│ 2. OCR          — "Read the text in this image"    │
│    Input: Screenshot → Output: Code text extracted  │
│                                                     │
│ 3. ANALYSIS     — "What does this chart show?"     │
│    Input: Bar chart → Output: "Sales grew 15%..."  │
│                                                     │
│ 4. COMPARISON   — "What's different?"              │
│    Input: Two images → Output: Differences listed   │
│                                                     │
│ 5. EXTRACTION   — "Extract the data"               │
│    Input: Table image → Output: JSON / CSV data     │
└────────────────────────────────────────────────────┘
```

### WHY — Real User Scenarios

```
TELEGRAM USER:
  📷 [sends screenshot of error message]
  "What's wrong with my code?"
  → Lunar reads error text → finds solution in memory → responds

DISCORD USER:
  📷 [sends photo of whiteboard]
  "Can you summarize what's on this whiteboard?"
  → Lunar extracts text → organizes into bullets → responds
```

---

## 🔨 HANDS-ON: Build Image Tools

### Step 1: Image Analysis Tool (20 minutes)

Create `packages/agent/src/vision/tools.ts`:

```typescript
import type { VisionManager } from './manager.js';
import type { VisionInput } from './types.js';

/**
 * Describe what's in an image
 */
export function createDescribeImageTool(vision: VisionManager) {
  return {
    name: 'describe_image',
    description: 'Describe the contents of an image in detail',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image to describe' },
        focus: { type: 'string', description: 'What to focus on (optional)', default: '' },
      },
      required: ['imageUrl'],
    },
    execute: async (args: { imageUrl: string; focus?: string }) => {
      const prompt = args.focus
        ? `Describe this image, focusing on: ${args.focus}`
        : 'Describe this image in detail. Include objects, colors, text, and overall scene.';

      const image: VisionInput = {
        type: 'url',
        data: args.imageUrl,
        mimeType: 'image/jpeg',
      };

      const result = await vision.analyze({ prompt, images: [image] });
      return result.content;
    },
  };
}

/**
 * Extract text from an image (OCR)
 */
export function createOCRTool(vision: VisionManager) {
  return {
    name: 'read_image_text',
    description: 'Extract and read all text visible in an image (OCR)',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image to read text from' },
      },
      required: ['imageUrl'],
    },
    execute: async (args: { imageUrl: string }) => {
      const image: VisionInput = {
        type: 'url',
        data: args.imageUrl,
        mimeType: 'image/png',
      };

      const result = await vision.analyze({
        prompt: `Extract ALL text visible in this image. Maintain the original formatting as much as possible. 
If it's code, preserve the code formatting.
If it's a table, format as a table.
If it's a form, list field names and values.
Output ONLY the extracted text, nothing else.`,
        images: [image],
        options: { temperature: 0.1 }, // Low temp for accuracy
      });

      return result.content;
    },
  };
}

/**
 * Analyze a chart or graph
 */
export function createChartAnalysisTool(vision: VisionManager) {
  return {
    name: 'analyze_chart',
    description: 'Analyze a chart, graph, or diagram and explain what it shows',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the chart/graph' },
        question: { type: 'string', description: 'Specific question about the chart', default: '' },
      },
      required: ['imageUrl'],
    },
    execute: async (args: { imageUrl: string; question?: string }) => {
      const image: VisionInput = {
        type: 'url',
        data: args.imageUrl,
        mimeType: 'image/png',
      };

      const prompt = args.question
        ? `Analyze this chart and answer: ${args.question}`
        : `Analyze this chart/graph:
1. What type of chart is it? (bar, line, pie, etc.)
2. What data does it show?
3. What are the key trends or insights?
4. What are the approximate values for key data points?`;

      const result = await vision.analyze({
        prompt,
        images: [image],
        options: { temperature: 0.2 },
      });

      return result.content;
    },
  };
}

/**
 * Extract structured data from image (table, form, receipt)
 */
export function createDataExtractionTool(vision: VisionManager) {
  return {
    name: 'extract_data',
    description: 'Extract structured data (tables, forms, receipts) from an image as JSON',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image' },
        dataType: {
          type: 'string',
          enum: ['table', 'form', 'receipt', 'auto'],
          description: 'Type of data to extract',
          default: 'auto',
        },
      },
      required: ['imageUrl'],
    },
    execute: async (args: { imageUrl: string; dataType?: string }) => {
      const image: VisionInput = {
        type: 'url',
        data: args.imageUrl,
        mimeType: 'image/png',
      };

      const typePrompts: Record<string, string> = {
        table: 'Extract data from this table as a JSON array of objects. Each row is one object.',
        form: 'Extract all form fields and values as a JSON object. Use field labels as keys.',
        receipt: 'Extract receipt data: store name, date, items (name, quantity, price), subtotal, tax, total. Return as JSON.',
        auto: 'Extract all structured data from this image. Return as JSON.',
      };

      const result = await vision.analyze({
        prompt: `${typePrompts[args.dataType || 'auto']}\n\nReturn ONLY valid JSON, no other text.`,
        images: [image],
        options: { temperature: 0.1 },
      });

      // Try to parse JSON from response
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.stringify(JSON.parse(jsonMatch[0]), null, 2);
        }
      } catch {
        // Return raw text if JSON parsing fails
      }
      return result.content;
    },
  };
}

/**
 * Register all vision tools
 */
export function registerVisionTools(vision: VisionManager) {
  return [
    createDescribeImageTool(vision),
    createOCRTool(vision),
    createChartAnalysisTool(vision),
    createDataExtractionTool(vision),
  ];
}
```

### Step 2: Channel Integration — Telegram Images (15 minutes)

Create `packages/agent/src/vision/telegram-handler.ts`:

```typescript
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
```

### Step 3: Integration with Agent Loop (10 minutes)

```typescript
// In your agent loop, detect when user sends an image:

async function processUserMessage(message: {
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
}) {
  // If message has an image, describe it first
  if (message.imageUrl || message.imageBase64) {
    const visionInput: VisionInput = message.imageUrl
      ? { type: 'url', data: message.imageUrl, mimeType: 'image/jpeg' }
      : { type: 'base64', data: message.imageBase64!, mimeType: 'image/jpeg' };

    const description = await visionManager.analyze({
      prompt: message.text || 'Describe this image.',
      images: [visionInput],
    });

    // Add image description to conversation context
    return {
      role: 'user',
      content: `[User sent an image: ${description.content}]\n\n${message.text || ''}`,
    };
  }

  return { role: 'user', content: message.text || '' };
}
```

---

## ✅ CHECKLIST

- [ ] 4 vision tools: describe, OCR, chart analysis, data extraction
- [ ] OCR with low temperature for accuracy
- [ ] Chart analysis with structured output
- [ ] Data extraction attempts JSON parsing
- [ ] Telegram image handler (file_id → URL → analyze)
- [ ] Document handler checks MIME type
- [ ] Agent loop integration (image → description → context)

---

## 💡 KEY TAKEAWAY

**Vision tools transform Lunar from text-only to truly multimodal. Four key tools: describe (general), OCR (text extraction), chart analysis (data insights), and data extraction (structured JSON output). The integration pattern: receive image from channel → convert to base64/URL → send to vision provider → inject description into conversation context. This works with Telegram, Discord, and WebChat.**

---

**Next → [Day 68: Audio Processing](day-68.md)**
