import { execFile } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface STTProvider {
  name: string;
  transcribe(audioBuffer: Buffer, format: string): Promise<{
    text: string;
    language?: string;
    durationMs: number;
  }>;
}

/**
 * Local Whisper STT using whisper.cpp
 * 
 * Setup:
 *   brew install whisper-cpp   (macOS)
 *   # or build from source: https://github.com/ggerganov/whisper.cpp
 *   # Download model: whisper-cpp-download-ggml-model base.en
 */
export class WhisperSTT implements STTProvider {
  name = 'whisper';
  private modelPath: string;
  private binaryPath: string;

  constructor(options: { modelPath?: string; binaryPath?: string } = {}) {
    this.modelPath = options.modelPath || 'models/ggml-base.en.bin';
    this.binaryPath = options.binaryPath || 'whisper-cpp';
  }

  async transcribe(audioBuffer: Buffer, format: string = 'ogg'): Promise<{
    text: string;
    language?: string;
    durationMs: number;
  }> {
    const start = Date.now();
    const tempId = randomUUID();
    const inputPath = join(tmpdir(), `whisper-${tempId}.${format}`);
    const wavPath = join(tmpdir(), `whisper-${tempId}.wav`);

    try {
      // Save audio to temp file
      writeFileSync(inputPath, audioBuffer);

      // Convert to WAV (Whisper needs 16kHz WAV)
      await this.convertToWav(inputPath, wavPath);

      // Run whisper
      const text = await this.runWhisper(wavPath);

      return {
        text: text.trim(),
        language: 'en',
        durationMs: Date.now() - start,
      };
    } finally {
      // Cleanup
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(wavPath)) unlinkSync(wavPath);
    }
  }

  private convertToWav(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // ffmpeg converts any audio to 16kHz mono WAV
      execFile('ffmpeg', [
        '-i', input,
        '-ar', '16000',    // 16kHz sample rate
        '-ac', '1',         // Mono
        '-y',               // Overwrite
        output,
      ], (error) => {
        if (error) reject(new Error(`ffmpeg conversion failed: ${error.message}`));
        else resolve();
      });
    });
  }

  private runWhisper(wavPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this.binaryPath, [
        '-m', this.modelPath,
        '-f', wavPath,
        '--no-timestamps',
        '--output-txt',
      ], (error, stdout) => {
        if (error) reject(new Error(`Whisper failed: ${error.message}`));
        else resolve(stdout);
      });
    });
  }
}

/**
 * Gemini STT — send audio directly to Gemini API
 */
export class GeminiSTT implements STTProvider {
  name = 'gemini-stt';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer: Buffer, format: string = 'ogg'): Promise<{
    text: string;
    language?: string;
    durationMs: number;
  }> {
    const start = Date.now();
    const mimeType = format === 'ogg' ? 'audio/ogg' : `audio/${format}`;
    const base64 = audioBuffer.toString('base64');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: 'Transcribe this audio. Return ONLY the transcribed text, nothing else.' },
          ],
        }],
      }),
    });

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      text: text.trim(),
      durationMs: Date.now() - start,
    };
  }
}
