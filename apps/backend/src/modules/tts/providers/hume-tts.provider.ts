import { Injectable } from '@nestjs/common';
import { HumeClient } from 'hume';
import { TtsProvider } from './tts-provider';
import { TtsGenerateInput, TtsGenerateResult } from '../tts.types';

type HumeVoiceProvider = 'HUME_AI' | 'CUSTOM_VOICE';

function getAudioFormat(format: unknown): { type: 'mp3' | 'wav' } {
  return format === 'wav' ? { type: 'wav' } : { type: 'mp3' };
}

function getVoice(input: TtsGenerateInput) {
  const rawVoice = input.voiceId?.trim();
  const voiceName = rawVoice || 'Ava Song';
  const voiceProvider = input.params?.voice_provider === 'CUSTOM_VOICE' ? 'CUSTOM_VOICE' : 'HUME_AI';
  const voiceKind = input.params?.voice_kind === 'id' ? 'id' : 'name';
  return voiceKind === 'id'
    ? { id: voiceName, provider: voiceProvider as HumeVoiceProvider }
    : { name: voiceName, provider: voiceProvider as HumeVoiceProvider };
}

@Injectable()
export class HumeTtsProvider extends TtsProvider {
  readonly provider = 'hume';

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const apiKey = input.apiKey?.trim() || process.env.HUME_API_KEY?.trim();
    if (!apiKey) throw new Error('HUME_API_KEY is not set');

    const transcript = input.text.length > 5000 ? input.text.slice(0, 5000) : input.text;
    const version = input.model === '1' ? '1' : '2';
    const format = getAudioFormat(input.params?.format);
    const speed = typeof input.params?.speed === 'number' ? input.params.speed : undefined;
    const trailingSilence = typeof input.params?.trailing_silence === 'number' ? input.params.trailing_silence : undefined;
    const temperature = typeof input.params?.temperature === 'number' ? input.params.temperature : undefined;
    const description = typeof input.params?.description === 'string' && input.params.description.trim()
      ? input.params.description.trim()
      : undefined;

    const client = new HumeClient({ apiKey });
    const result = await client.tts.synthesizeJson(
      {
        version,
        format,
        numGenerations: 1,
        stripHeaders: true,
        ...(temperature !== undefined ? { temperature } : {}),
        utterances: [
          {
            text: transcript,
            voice: getVoice(input),
            ...(description ? { description } : {}),
            ...(speed !== undefined ? { speed } : {}),
            ...(trailingSilence !== undefined ? { trailingSilence } : {}),
          },
        ],
      },
      { timeoutInSeconds: 180 },
    );

    const generation = result.generations[0];
    if (!generation?.audio) throw new Error('Hume TTS response contains empty audio');

    return {
      audioBuffer: Buffer.from(generation.audio, 'base64'),
      fileExtension: format.type,
      mimeType: format.type === 'wav' ? 'audio/wav' : 'audio/mpeg',
      wordTimestamps: null,
    };
  }
}
