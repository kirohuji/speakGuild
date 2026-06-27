import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileAssetGroup, TtsProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TtsProviderFactory } from './tts-provider.factory';
import { SttProviderFactory } from './stt/stt-provider.factory';
import { TTS_PARAMS_SCHEMA, sanitizeTtsParams } from './tts-params.schema';
import { SynthesizeAssetDto, SynthesizeTextDto } from './dto/synthesize.dto';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { AiModelService } from '../ai-model/ai-model.service';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: TtsProviderFactory,
    private readonly sttFactory: SttProviderFactory,
    private readonly fileAssetsService: FileAssetsService,
    private readonly aiModel: AiModelService,
  ) {}

  getParamsSchema() {
    return TTS_PARAMS_SCHEMA;
  }

  /** 用户录音 → STT 转写，返回文本 + 词时间戳 + 音频 COS URL */
  async transcribeRecording(
    audioBuffer: Buffer,
    originalname: string,
    language?: string,
    temperature?: number,
    enableTimestamps?: boolean,
    providerOverride?: string,
    inferenceUrlOverride?: string,
    timeoutMsOverride?: number,
    tencentSecretIdOverride?: string,
    tencentSecretKeyOverride?: string,
    tencentRegionOverride?: string,
  ): Promise<{
    audioBase64: string;
    mimeType: string;
    text: string | null;
    wordTimestamps: Array<{ text: string; start_time: number; end_time?: number }> | null;
    audioUrl: string | null;
  }> {
    const ext = path.extname(originalname).replace('.', '') || 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4',
      ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg',
    };
    const mimeType = mimeMap[ext] ?? 'audio/webm';
    const audioBase64 = audioBuffer.toString('base64');

    // 通过工厂获取 STT 供应商（优先 DB ai_provider 表，其次环境变量，默认 whisper）
    const sttConfig = await this.aiModel.getSttConfig();
    const sttProvider = this.sttFactory.getProvider(providerOverride || sttConfig.provider);

    const result = await sttProvider.transcribe({
      audioBuffer,
      mimeType,
      fileName: originalname,
      language,
      temperature: temperature ?? sttConfig.temperature,
      enableTimestamps: enableTimestamps ?? sttConfig.enableTimestamps,
      inferenceUrl: inferenceUrlOverride || sttConfig.inferenceUrl,
      timeoutMs: timeoutMsOverride ?? sttConfig.timeoutMs,
      tencentSecretId: tencentSecretIdOverride || sttConfig.tencentSecretId,
      tencentSecretKey: tencentSecretKeyOverride || sttConfig.tencentSecretKey,
      tencentRegion: tencentRegionOverride || sttConfig.tencentRegion,
    });

    // 转写成功后，将用户录音保存到 COS，方便后续回放
    let audioUrl: string | null = null;
    if (result.text) {
      try {
        const asset = await this.fileAssetsService.createAssetFromBuffer({
          buffer: audioBuffer,
          filename: originalname,
          mimeType,
          group: 'user_recording' as FileAssetGroup,
        });
        const signed = await this.fileAssetsService.getPrivateUrlByAssetId(asset.id);
        audioUrl = (signed as any).url ?? null;
        this.logger.log(`User recording saved to COS: ${asset.id}`);
      } catch (e) {
        this.logger.warn(`Failed to save user recording to COS: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { audioBase64, mimeType, audioUrl, ...result };
  }
  async synthesizeText(dto: SynthesizeTextDto) {
    const providerConfig = await this.aiModel.getTtsConfig(dto.provider);
    const model = dto.model?.trim() || providerConfig.model;
    const apiKey = dto.apiKey?.trim() || providerConfig.apiKey;
    const baseUrl = dto.baseUrl?.trim() || providerConfig.baseUrl;
    const groupId = dto.groupId?.trim() || providerConfig.groupId;
    const sanitizedParams = sanitizeTtsParams(dto.provider, model, dto.params);
    const provider = this.factory.getProvider(dto.provider);
    const result = await provider.generateAudio({
      id: `ephemeral-${randomUUID()}`,
      text: dto.text.trim(),
      model,
      voiceId: dto.voiceId,
      params: sanitizedParams,
      apiKey,
      baseUrl,
      groupId,
    });
    return {
      mimeType: result.mimeType,
      audioBase64: result.audioBuffer.toString('base64'),
      wordTimestamps: result.wordTimestamps,
    };
  }

  async synthesizeAsset(dto: SynthesizeAssetDto) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('合成文本不能为空');

    const providerConfig = await this.aiModel.getTtsConfig(dto.provider);
    const model = dto.model?.trim() || providerConfig.model;
    const apiKey = dto.apiKey?.trim() || providerConfig.apiKey;
    const baseUrl = dto.baseUrl?.trim() || providerConfig.baseUrl;
    const groupId = dto.groupId?.trim() || providerConfig.groupId;
    const sanitizedParams = sanitizeTtsParams(dto.provider, model, dto.params);
    const provider = this.factory.getProvider(dto.provider);
    const configHash = this.buildConfigHash(dto.provider, model, dto.voiceId, sanitizedParams, text);
    const generatedId = `story-line-${configHash}-${randomUUID()}`;

    const result = await provider.generateAudio({
      id: generatedId,
      text,
      model,
      voiceId: dto.voiceId,
      params: sanitizedParams,
      apiKey,
      baseUrl,
      groupId,
    });

    const asset = await this.fileAssetsService.createAssetFromBuffer({
      buffer: result.audioBuffer,
      filename: `${generatedId}.${result.fileExtension}`,
      mimeType: result.mimeType,
      group: FileAssetGroup.tts,
    });

    const bizType = dto.bizType?.trim() || 'tts_story_line';
    const bizId = dto.bizId?.trim() || configHash;
    await this.fileAssetsService.createSystemReference(asset.id, bizType, bizId);

    const signed = await this.fileAssetsService.getPrivateUrlByAssetId(asset.id);
    return {
      assetId: asset.id,
      url: signed.url,
      expiresInSeconds: signed.expiresInSeconds,
      mimeType: result.mimeType,
      wordTimestamps: result.wordTimestamps,
      provider: dto.provider,
      model,
      voiceId: dto.voiceId ?? null,
      configHash,
    };
  }

  private buildConfigHash(
    provider: string,
    model: string,
    voiceId?: string,
    params?: Record<string, unknown>,
    textType?: string,
  ): string {
    const key = JSON.stringify({
      provider,
      model,
      voiceId: voiceId ?? null,
      textType: textType ?? 'answer',
      params: params ? JSON.stringify(Object.keys(params).sort().reduce((acc, k) => ({ ...acc, [k]: params[k] }), {})) : null,
    });
    return createHash('sha1').update(key).digest('hex');
  }
}
