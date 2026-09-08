import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileAssetGroup } from '@prisma/client';
import { FileAssetsService } from '../file-assets/file-assets.service';

export type DictionaryAccent = 'uk' | 'us';
export type VoiceGender = 'female' | 'male';

const ENTTS_BASE_URL = 'https://www.entts.com';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_PLAYER_HTML_BYTES = 100 * 1024;

const ENTTS_ACCENTS: Record<DictionaryAccent, Record<VoiceGender, string>> = {
  uk: { female: 'enukf', male: 'enuk' },
  us: { female: 'enf', male: 'en' },
};

export interface GenerateEnttsAudioOptions {
  bizType?: string;
  bizId?: string;
  filenamePrefix?: string;
}

@Injectable()
export class DictionaryAudioService {
  constructor(
    private readonly config: ConfigService,
    private readonly fileAssets: FileAssetsService,
  ) {}

  async generate(
    text: string,
    type: DictionaryAccent,
    gender: VoiceGender,
    options?: GenerateEnttsAudioOptions,
  ) {
    const content = text.trim();
    if (!content) throw new BadGatewayException('ENTTS 文本不能为空');

    const baseUrl = new URL(this.config.get<string>('ENTTS_BASE_URL')?.trim() || ENTTS_BASE_URL);
    const playerUrl = new URL('/api/post/', baseUrl);
    const form = new URLSearchParams({
      content,
      accent: ENTTS_ACCENTS[type][gender],
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
    const buffer = Buffer.from(await response.arrayBuffer());
    const upstreamMimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (!upstreamMimeType.startsWith('audio/') || buffer.length === 0 || buffer.length > MAX_AUDIO_BYTES) {
      const providerMessage = upstreamMimeType.startsWith('text/')
        ? buffer.toString('utf8').trim().slice(0, 120)
        : '';
      throw new BadGatewayException(
        providerMessage ? `ENTTS 生成失败：${providerMessage}` : 'ENTTS 未返回有效音频',
      );
    }

    // ENTTS currently labels its MP3 response as audio/x-wav, so trust the
    // file signature before the response header.
    const isMp3 = buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    const isWav = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const isOgg = buffer.subarray(0, 4).toString('ascii') === 'OggS';
    const mimeType = isMp3 ? 'audio/mpeg'
      : isWav ? 'audio/wav'
        : isOgg ? 'audio/ogg'
          : upstreamMimeType;
    const extension = isMp3 ? 'mp3'
      : isWav ? 'wav'
        : isOgg ? 'ogg'
          : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'audio';
    const filenamePrefix = (options?.filenamePrefix || content)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'audio';
    const bizType = options?.bizType || 'dictionary_pronunciation_audio';
    const bizId = options?.bizId || `${content}:${type}`;
    const asset = await this.fileAssets.createAssetFromBuffer({
      buffer,
      filename: `${filenamePrefix}-${type}-${gender}.${extension}`,
      mimeType,
      group: FileAssetGroup.tts,
    });
    await this.fileAssets.createSystemReference(asset.id, bizType, bizId);
    return this.fileAssets.getAssetReference(asset.id);
  }
}
