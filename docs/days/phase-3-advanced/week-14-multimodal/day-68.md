# Day 68 — Audio Processing (Speech-to-Text + TTS)

> 🎯 **DAY GOAL:** Add voice capabilities to Lunar — transcribe voice messages (STT) and generate spoken responses (TTS)

---

## 📚 CONCEPT 1: Voice = STT + TTS

### WHAT — Simple Definition

```
VOICE PIPELINE:
  🎤 User speaks    →  STT  →  Text  →  Lunar  →  Text  →  TTS  →  🔊 Spoken reply
     (voice msg)       ↑         │                    │        ↑       (audio file)
                       │         │                    │        │
              Speech-to-Text     └──── Agent Loop ────┘   Text-to-Speech

STT OPTIONS (free):
  ✅ Whisper (OpenAI model, run locally via whisper.cpp / node)
  ✅ Gemini (understands audio natively)
  ✅ Web Speech API (browser only)

TTS OPTIONS (free):
  ✅ Piper TTS (local, fast, many voices)
  ✅ Coqui TTS (local, high quality)
  ✅ Edge TTS (Microsoft, free API)
  ✅ Web Speech API (browser only)
```

### WHY for Lunar

```
VOICE USE CASES:
  1. Telegram → User sends voice message → Lunar transcribes + responds
  2. Discord  → Voice channel → Live transcription
  3. WebChat  → microphone button → voice input
  4. Accessibility → Users who can't type
  
COST: $0 — All local options available!
```

---

## 🔨 HANDS-ON: Build Voice Support

### Step 1: Speech-to-Text with Whisper (25 minutes)

Create `packages/agent/src/audio/stt.ts`:

```typescript
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
```

### Step 2: Text-to-Speech with Edge TTS (20 minutes)

Create `packages/agent/src/audio/tts.ts`:

```typescript
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
```

### Step 3: Audio Manager (10 minutes)

Create `packages/agent/src/audio/manager.ts`:

```typescript
import type { STTProvider } from './stt.js';
import type { TTSProvider } from './tts.js';

export class AudioManager {
  private sttProviders: STTProvider[] = [];
  private ttsProviders: TTSProvider[] = [];

  addSTT(provider: STTProvider): void {
    this.sttProviders.push(provider);
  }

  addTTS(provider: TTSProvider): void {
    this.ttsProviders.push(provider);
  }

  async transcribe(audio: Buffer, format: string = 'ogg'): Promise<string> {
    for (const provider of this.sttProviders) {
      try {
        const result = await provider.transcribe(audio, format);
        console.log(`[STT] ${provider.name}: "${result.text.slice(0, 50)}..." (${result.durationMs}ms)`);
        return result.text;
      } catch (error) {
        console.warn(`[STT] ${provider.name} failed:`, error);
      }
    }
    throw new Error('No STT provider available');
  }

  async speak(text: string, voice?: string): Promise<Buffer> {
    for (const provider of this.ttsProviders) {
      try {
        const audio = await provider.synthesize(text, { voice });
        console.log(`[TTS] ${provider.name}: ${audio.length} bytes`);
        return audio;
      } catch (error) {
        console.warn(`[TTS] ${provider.name} failed:`, error);
      }
    }
    throw new Error('No TTS provider available');
  }
}
```

---

## ✅ CHECKLIST

- [ ] STT provider interface defined
- [ ] Whisper STT (local, via whisper.cpp)
- [ ] Gemini STT (free API, audio input)
- [ ] TTS provider interface defined
- [ ] Edge TTS (free Microsoft voices)
- [ ] Piper TTS (local, fast)
- [ ] AudioManager with fallback for both STT and TTS
- [ ] Audio converted to correct format (16kHz WAV for Whisper)

---

## 💡 KEY TAKEAWAY

**Voice = STT (speech-to-text) + TTS (text-to-speech). Both can be 100% free: Whisper locally for STT, Edge TTS or Piper for TTS. The pattern is identical to vision: provider interface → manager with fallback → integrate with channels. Voice messages from Telegram/Discord are just audio buffers — transcribe to text, run through Lunar's agent loop, then optionally synthesize the response back to speech.**

---

**Next → [Day 69: Image Generation](day-69.md)**
