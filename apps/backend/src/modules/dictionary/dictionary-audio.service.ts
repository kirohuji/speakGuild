import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';
import { FileAssetGroup } from '@prisma/client';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { EnttsTtsProvider } from '../tts/providers/entts-tts.provider';
import { AiModelService } from '../ai-model/ai-model.service';

export type DictionaryAccent = 'uk' | 'us';
export type VoiceGender = 'female' | 'male';

export interface GenerateEnttsAudioOptions {
  bizType?: string;
  bizId?: string;
  filenamePrefix?: string;
}

const EXTERNAL_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const EXTERNAL_AUDIO_RETRY_ATTEMPTS = 3;
const EXTERNAL_AUDIO_TIMEOUT_MS = 8_000;

function waitForRetry(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

@Injectable()
export class DictionaryAudioService {
  constructor(
    private readonly fileAssets: FileAssetsService,
    private readonly entts: EnttsTtsProvider,
    private readonly aiModel: AiModelService,
  ) {}

  async generate(
    text: string,
    type: DictionaryAccent,
    gender: VoiceGender,
    options?: GenerateEnttsAudioOptions,
  ) {
    const content = text.trim();
    if (!content) throw new BadGatewayException('ENTTS 文本不能为空');
    const providerConfig = await this.aiModel.getTtsConfig('entts');
    const result = await this.entts.generateAudio({
      id: options?.bizId || content,
      text: content,
      model: 'standard',
      voiceId: `en-${type === 'uk' ? 'gb' : 'us'}-${gender}`,
      params: { accent: type, gender },
      baseUrl: providerConfig.baseUrl,
    });
    const filenamePrefix = (options?.filenamePrefix || content)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'audio';
    const bizType = options?.bizType || 'dictionary_pronunciation_audio';
    const bizId = options?.bizId || `${content}:${type}`;
    const asset = await this.fileAssets.createAssetFromBuffer({
      buffer: result.audioBuffer,
      filename: `${filenamePrefix}-${type}-${gender}.${result.fileExtension}`,
      mimeType: result.mimeType,
      group: FileAssetGroup.tts,
    });
    await this.fileAssets.createSystemReference(asset.id, bizType, bizId);
    return this.fileAssets.getAssetReference(asset.id);
  }

  /** Copy a legacy remote pronunciation file into the managed COS asset library. */
  async importExternalAudio(sourceUrl: string, filenamePrefix: string, bizId: string) {
    let url: URL;
    try {
      url = new URL(sourceUrl);
    } catch {
      throw new BadGatewayException('旧音频地址无效');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadGatewayException('旧音频地址必须使用 HTTP 或 HTTPS');
    }

    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= EXTERNAL_AUDIO_RETRY_ATTEMPTS; attempt += 1) {
      try {
        // dictionaryapi.dev and Wikimedia can intermittently return 5xx or
        // time out from server-side networks. Retry only transient failures;
        // a 4xx other than 429 is a permanent source problem.
        const candidate = await fetch(url, { signal: AbortSignal.timeout(EXTERNAL_AUDIO_TIMEOUT_MS) });
        if (candidate.ok) {
          response = candidate;
          break;
        }
        if (candidate.body) await candidate.body.cancel().catch(() => undefined);
        if (candidate.status < 500 && candidate.status !== 429) {
          throw new BadGatewayException(`旧音频返回 HTTP ${candidate.status}`);
        }
        lastError = new Error(`HTTP ${candidate.status}`);
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        lastError = error;
      }
      if (attempt < EXTERNAL_AUDIO_RETRY_ATTEMPTS) {
        await waitForRetry(500 * attempt);
      }
    }
    if (!response) {
      const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
      throw new BadGatewayException(`旧音频下载失败（已重试 ${EXTERNAL_AUDIO_RETRY_ATTEMPTS} 次）：${message}`);
    }
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > EXTERNAL_AUDIO_MAX_BYTES) throw new BadGatewayException('旧音频文件过大');
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (!mimeType.startsWith('audio/') || buffer.length === 0 || buffer.length > EXTERNAL_AUDIO_MAX_BYTES) {
      throw new BadGatewayException('旧音频未返回有效的音频文件');
    }
    const extension = mimeType.includes('mpeg') ? 'mp3'
      : mimeType.includes('wav') ? 'wav'
        : mimeType.includes('ogg') ? 'ogg'
          : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'audio';
    const asset = await this.fileAssets.createAssetFromBuffer({
      buffer,
      filename: `${filenamePrefix}.${extension}`,
      mimeType,
      group: FileAssetGroup.tts,
    });
    await this.fileAssets.createSystemReference(asset.id, 'dictionary_pronunciation_audio', bizId);
    return { assetId: asset.id, url: this.fileAssets.getAssetReference(asset.id) };
  }
}
