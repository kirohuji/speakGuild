import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { TtsProvider } from './tts-provider';
import { TtsGenerateInput, TtsGenerateResult } from '../tts.types';

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

function getOutputFormat(value: unknown): { query: string; extension: 'mp3' | 'wav'; mimeType: string } {
  if (value === 'wav_44100') return { query: 'wav_44100', extension: 'wav', mimeType: 'audio/wav' };
  if (value === 'mp3_22050_32') return { query: 'mp3_22050_32', extension: 'mp3', mimeType: 'audio/mpeg' };
  if (value === 'mp3_44100_192') return { query: 'mp3_44100_192', extension: 'mp3', mimeType: 'audio/mpeg' };
  return { query: 'mp3_44100_128', extension: 'mp3', mimeType: 'audio/mpeg' };
}

function getNumberParam(params: Record<string, unknown> | undefined, key: string) {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

@Injectable()
export class ElevenLabsTtsProvider extends TtsProvider {
  readonly provider = 'elevenlabs';

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const apiKey = input.apiKey?.trim() || process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');

    const voiceId = input.voiceId?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
    const baseUrl = input.baseUrl?.trim() || process.env.ELEVENLABS_BASE_URL?.trim() || 'https://api.elevenlabs.io';
    const outputFormat = getOutputFormat(input.params?.output_format);
    const url = `${baseUrl.replace(/\/$/, '')}/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
    const text = input.text.length > 5000 ? input.text.slice(0, 5000) : input.text;

    const stability = getNumberParam(input.params, 'stability');
    const similarityBoost = getNumberParam(input.params, 'similarity_boost');
    const style = getNumberParam(input.params, 'style');
    const speed = getNumberParam(input.params, 'speed');
    const seed = getNumberParam(input.params, 'seed');
    const languageCode = typeof input.params?.language_code === 'string' && input.params.language_code.trim() && input.params.language_code !== 'auto'
      ? input.params.language_code.trim()
      : undefined;
    const applyTextNormalization = typeof input.params?.apply_text_normalization === 'string'
      ? input.params.apply_text_normalization
      : undefined;

    const response = await axios.post<ArrayBuffer>(
      url,
      {
        text,
        model_id: input.model || 'eleven_multilingual_v2',
        ...(languageCode ? { language_code: languageCode } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(applyTextNormalization ? { apply_text_normalization: applyTextNormalization } : {}),
        voice_settings: {
          ...(stability !== undefined ? { stability } : {}),
          ...(similarityBoost !== undefined ? { similarity_boost: similarityBoost } : {}),
          ...(style !== undefined ? { style } : {}),
          ...(speed !== undefined ? { speed } : {}),
          ...(typeof input.params?.use_speaker_boost === 'boolean' ? { use_speaker_boost: input.params.use_speaker_boost } : {}),
        },
      },
      {
        params: {
          output_format: outputFormat.query,
          enable_logging: input.params?.enable_logging === false ? 'false' : 'true',
        },
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: outputFormat.mimeType,
        },
        responseType: 'arraybuffer',
        timeout: 180000,
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );

    const audioBuffer = Buffer.from(response.data);
    if (!audioBuffer.length) throw new Error('ElevenLabs TTS response contains empty audio');

    return {
      audioBuffer,
      fileExtension: outputFormat.extension,
      mimeType: outputFormat.mimeType,
      wordTimestamps: null,
    };
  }
}
