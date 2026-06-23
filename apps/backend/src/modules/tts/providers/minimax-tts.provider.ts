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

  private buildEndpoint(baseUrl?: string | null, groupId?: string | null): string {
    const raw = baseUrl?.trim() || process.env.MINIMAX_BASE_URL?.trim() || 'https://api.minimax.io';
    const trimmed = raw.replace(/\/$/, '');
    const endpoint = trimmed.endsWith('/v1/t2a_v2') ? trimmed : `${trimmed}/v1/t2a_v2`;
    const resolvedGroupId = groupId?.trim() || process.env.MINIMAX_GROUP_ID?.trim();
    if (!resolvedGroupId) return endpoint;
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}GroupId=${encodeURIComponent(resolvedGroupId)}`;
  }

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const apiKey = input.apiKey?.trim() || process.env.MINIMAX_API_KEY?.trim();
    if (!apiKey) throw new Error('MINIMAX_API_KEY is not set');

    const transcript = input.text.length > 10000 ? input.text.slice(0, 10000) : input.text;
    const voiceId = input.voiceId || this.guessVoiceId(transcript);
    const speed = typeof input.params?.speed === 'number' ? input.params.speed : 1;
    const vol   = typeof input.params?.vol   === 'number' ? input.params.vol   : 1;
    const pitch = typeof input.params?.pitch === 'number' ? input.params.pitch : 0;
    const emotion = typeof input.params?.emotion === 'string' && input.params.emotion !== 'auto'
      ? input.params.emotion
      : undefined;
    const languageBoost = typeof input.params?.language_boost === 'string' ? input.params.language_boost : 'auto';
    const outputFormat = typeof input.params?.output_format === 'string' ? input.params.output_format : 'hex';
    const sampleRate = typeof input.params?.sample_rate === 'number' ? input.params.sample_rate : 32000;
    const bitrate = typeof input.params?.bitrate === 'number' ? input.params.bitrate : 128000;
    const format = typeof input.params?.format === 'string' ? input.params.format : 'mp3';
    const channel = typeof input.params?.channel === 'number' ? input.params.channel : 1;
    const subtitleEnable = input.params?.subtitle_enable === true;
    const subtitleType = typeof input.params?.subtitle_type === 'string' ? input.params.subtitle_type : 'sentence';

    const res = await axios.post(
      this.buildEndpoint(input.baseUrl, input.groupId),
      {
        model: input.model,
        text: transcript,
        stream: false,
        language_boost: languageBoost,
        output_format: outputFormat,
        voice_setting: { voice_id: voiceId, speed, vol, pitch, ...(emotion ? { emotion } : {}) },
        audio_setting: { format, sample_rate: sampleRate, bitrate, channel },
        subtitle_enable: subtitleEnable,
        ...(subtitleEnable ? { subtitle_type: subtitleType } : {}),
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 180000,
      },
    );

    const statusCode = res?.data?.base_resp?.status_code;
    const audioPayload = res?.data?.data?.audio as string | undefined;

    if (statusCode !== 0) {
      throw new Error(`MiniMax TTS failed: status_code=${statusCode}, msg=${res?.data?.base_resp?.status_msg}`);
    }
    if (!audioPayload) throw new Error('MiniMax response contains empty audio');

    let audioBuffer: Buffer;
    if (outputFormat === 'url') {
      const audioRes = await axios.get<ArrayBuffer>(audioPayload, { responseType: 'arraybuffer', timeout: 180000 });
      audioBuffer = Buffer.from(audioRes.data);
    } else {
      audioBuffer = Buffer.from(audioPayload, 'hex');
    }

    return {
      audioBuffer,
      fileExtension: format === 'wav' ? 'wav' : format === 'flac' ? 'flac' : 'mp3',
      mimeType: format === 'wav' ? 'audio/wav' : format === 'flac' ? 'audio/flac' : 'audio/mpeg',
      wordTimestamps: null,
    };
  }
}
