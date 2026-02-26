import { execFile } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: { voice?: string; speed?: number }): Promise<Buffer>;
}

/**
 * Edge TTS — Microsoft's free text-to-speech
 * 
 * Setup:
 *   pip install edge-tts
 *   # or: npm install edge-tts (Node.js port)
 * 
 * Voices:
 *   en-US-GuyNeural (male, natural)
 *   en-US-JennyNeural (female, natural)
 *   en-GB-SoniaNeural (British female)
 *   en-AU-NatashaNeural (Australian female)
 */
export class EdgeTTS implements TTSProvider {
  name = 'edge-tts';

  async synthesize(text: string, options: { voice?: string; speed?: number } = {}): Promise<Buffer> {
    const voice = options.voice || 'en-US-GuyNeural';
    const rate = options.speed ? `${options.speed > 0 ? '+' : ''}${options.speed}%` : '+0%';
    const outputPath = join(tmpdir(), `tts-${randomUUID()}.mp3`);

    try {
      await new Promise<void>((resolve, reject) => {
        execFile('edge-tts', [
          '--voice', voice,
          '--rate', rate,
          '--text', text,
          '--write-media', outputPath,
        ], (error) => {
          if (error) reject(new Error(`Edge TTS failed: ${error.message}`));
          else resolve();
        });
      });

      return readFileSync(outputPath);
    } finally {
      if (existsSync(outputPath)) unlinkSync(outputPath);
    }
  }
}

/**
 * Piper TTS — Fast local neural TTS
 * 
 * Setup:
 *   # Download from https://github.com/rhasspy/piper/releases
 *   # Download a voice model from https://huggingface.co/rhasspy/piper-voices
 */
export class PiperTTS implements TTSProvider {
  name = 'piper';
  private binaryPath: string;
  private modelPath: string;

  constructor(options: { binaryPath?: string; modelPath?: string } = {}) {
    this.binaryPath = options.binaryPath || 'piper';
    this.modelPath = options.modelPath || 'models/en_US-lessac-medium.onnx';
  }

  async synthesize(text: string, options: { voice?: string; speed?: number } = {}): Promise<Buffer> {
    const outputPath = join(tmpdir(), `piper-${randomUUID()}.wav`);

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = execFile(this.binaryPath, [
          '--model', options.voice || this.modelPath,
          '--output_file', outputPath,
        ], (error) => {
          if (error) reject(error);
          else resolve();
        });

        // Pipe text to stdin
        proc.stdin?.write(text);
        proc.stdin?.end();
      });

      return readFileSync(outputPath);
    } finally {
      if (existsSync(outputPath)) unlinkSync(outputPath);
    }
  }
}
