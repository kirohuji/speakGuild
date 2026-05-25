import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { TtsProvider } from './tts-provider';
import { TtsGenerateInput, TtsGenerateResult } from '../tts.types';

@Injectable()
export class MinimaxTtsProvider extends TtsProvider {
  readonly provider = 'minimax';

  private guessVoiceId(text: string): string {
    const hasCJK = /[\u4E00-\u9FFF]/.test(text);
    return hasCJK ? 'female-chengshu' : 'English_Trustworthy_Man';
  }

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const apiKey = process.env.MINIMAX_API_KEY?.trim();
    if (!apiKey) throw new Error('MINIMAX_API_KEY is not set');

    const transcript = input.text.length > 10000 ? input.text.slice(0, 10000) : input.text;
    const voiceId = input.voiceId || this.guessVoiceId(transcript);
    const speed = typeof input.params?.speed === 'number' ? input.params.speed : 1;
    const vol   = typeof input.params?.vol   === 'number' ? input.params.vol   : 1;
    const pitch = typeof input.params?.pitch === 'number' ? input.params.pitch : 0;

    const res = await axios.post(
      'https://api.minimaxi.com/v1/t2a_v2',
      {
        model: input.model,
        text: transcript,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: { voice_id: voiceId, speed, vol, pitch },
        audio_setting: { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 180000,
      },
    );

    const statusCode = res?.data?.base_resp?.status_code;
    const audioHex   = res?.data?.data?.audio as string | undefined;

    if (statusCode !== 0) {
      throw new Error(`MiniMax TTS failed: status_code=${statusCode}, msg=${res?.data?.base_resp?.status_msg}`);
    }
    if (!audioHex) throw new Error('MiniMax response contains empty audio');

    return {
      audioBuffer: Buffer.from(audioHex, 'hex'),
      fileExtension: 'mp3',
      mimeType: 'audio/mpeg',
      wordTimestamps: null,
    };
  }
}
