import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsProvider } from './tts-provider';
import { TtsGenerateInput, TtsGenerateResult } from '../tts.types';

export type EnttsAccent = 'uk' | 'us';
export type EnttsGender = 'female' | 'male';

const DEFAULT_ENTTS_BASE_URL = 'https://www.entts.com';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_PLAYER_HTML_BYTES = 100 * 1024;

const ENTTS_VOICES: Record<EnttsAccent, Record<EnttsGender, string>> = {
  uk: { female: 'enukf', male: 'enuk' },
  us: { female: 'enf', male: 'en' },
};

const VOICE_ID_MAP: Record<string, { accent: EnttsAccent; gender: EnttsGender }> = {
  'en-gb-female': { accent: 'uk', gender: 'female' },
  'en-gb-male': { accent: 'uk', gender: 'male' },
  'en-us-female': { accent: 'us', gender: 'female' },
  'en-us-male': { accent: 'us', gender: 'male' },
  enukf: { accent: 'uk', gender: 'female' },
  enuk: { accent: 'uk', gender: 'male' },
  enf: { accent: 'us', gender: 'female' },
  en: { accent: 'us', gender: 'male' },
};

@Injectable()
export class EnttsTtsProvider extends TtsProvider {
  readonly provider = 'entts';

  constructor(private readonly config: ConfigService) {
    super();
  }

  private resolveVoice(input: TtsGenerateInput) {
    const requestedVoice = input.voiceId?.trim().toLowerCase();
    if (requestedVoice && VOICE_ID_MAP[requestedVoice]) return VOICE_ID_MAP[requestedVoice];

    const accent = input.params?.accent === 'uk' ? 'uk' : 'us';
    const gender = input.params?.gender === 'male' ? 'male' : 'female';
    return { accent, gender } as const;
  }

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const content = input.text.trim();
    if (!content) throw new BadGatewayException('ENTTS 文本不能为空');

    const { accent, gender } = this.resolveVoice(input);
    const configuredBaseUrl = input.baseUrl?.trim()
      || this.config.get<string>('ENTTS_BASE_URL')?.trim()
      || DEFAULT_ENTTS_BASE_URL;
    const baseUrl = new URL(configuredBaseUrl);
    const playerUrl = new URL('/api/post/', baseUrl);
    const form = new URLSearchParams({
      content,
      accent: ENTTS_VOICES[accent][gender],
      speed: '0',
    });

    let playerResponse: Response;
    try {
      playerResponse = await fetch(playerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`ENTTS 请求失败：${message}`);
    }
    if (!playerResponse.ok) throw new BadGatewayException(`ENTTS 返回 HTTP ${playerResponse.status}`);

    const playerHtml = await playerResponse.text();
    if (Buffer.byteLength(playerHtml) > MAX_PLAYER_HTML_BYTES) {
      throw new BadGatewayException('ENTTS 播放器响应过大');
    }
    const encodedAudioPath = playerHtml.match(/<source[^>]+src=["']([^"']*audio\.php[^"']*)["']/i)?.[1];
    if (!encodedAudioPath) throw new BadGatewayException('ENTTS 未返回临时音频地址');
    const audioUrl = new URL(encodedAudioPath.replace(/&amp;/g, '&'), baseUrl);
    if (audioUrl.origin !== baseUrl.origin) throw new BadGatewayException('ENTTS 返回了非预期的音频地址');

    let response: Response;
    try {
      response = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(`ENTTS 音频下载失败：${message}`);
    }
    if (!response.ok) throw new BadGatewayException(`ENTTS 音频返回 HTTP ${response.status}`);

    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_AUDIO_BYTES) throw new BadGatewayException('ENTTS 返回的音频过大');
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const upstreamMimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (!upstreamMimeType.startsWith('audio/') || audioBuffer.length === 0 || audioBuffer.length > MAX_AUDIO_BYTES) {
      const providerMessage = upstreamMimeType.startsWith('text/')
        ? audioBuffer.toString('utf8').trim().slice(0, 120)
        : '';
      throw new BadGatewayException(providerMessage ? `ENTTS 生成失败：${providerMessage}` : 'ENTTS 未返回有效音频');
    }

    const isMp3 = audioBuffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (audioBuffer.length >= 2 && audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0);
    const isWav = audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF';
    if (!isMp3 && !isWav) throw new BadGatewayException('ENTTS 返回了不支持的音频格式');

    return {
      audioBuffer,
      fileExtension: isMp3 ? 'mp3' : 'wav',
      mimeType: isMp3 ? 'audio/mpeg' : 'audio/wav',
      wordTimestamps: null,
    };
  }
}
