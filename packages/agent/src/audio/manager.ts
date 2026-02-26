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
