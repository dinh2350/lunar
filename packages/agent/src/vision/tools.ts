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
