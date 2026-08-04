import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileAssetGroup } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TtsProviderFactory } from './tts-provider.factory';
import { SttProviderFactory } from './stt/stt-provider.factory';
import { TTS_PARAMS_SCHEMA, sanitizeTtsParams } from './tts-params.schema';
import { SynthesizeAssetDto, SynthesizeTextDto } from './dto/synthesize.dto';
import { FileAssetsService } from '../file-assets/file-assets.service';
import { AiModelService } from '../ai-model/ai-model.service';
import { SttWordTimestamp } from './stt/stt.types';

// ─── Sentence Segmentation ───────────────────────────────────

/** Output format: one segment per sentence, all timestamps in milliseconds */
export interface ListeningTranscriptSegment {
  text: string;
  translation?: string;
  startMs: number;
  endMs: number;
  words?: Array<{ token: string; startMs: number; endMs: number }>;
}

/**
 * Group word-level timestamps (nanoseconds) into sentence-level segments.
 * Splits on sentence-ending punctuation: . ! ? 。 ！ ？
 * Also splits on explicit newline characters in the text.
 * Converts nanoseconds → milliseconds.
 *
 * Words are joined into readable sentences with proper spacing:
 * - Space between words
 * - No space before punctuation (. , ! ? ; : etc.)
 * - Opening quotes/parentheses get space before, no space after
 */
export function segmentWordsIntoSentences(
  wordTimestamps: SttWordTimestamp[],
): ListeningTranscriptSegment[] {
  if (!wordTimestamps?.length) return [];

  const NS_TO_MS = 1_000_000;
  const SENTENCE_END_PUNCT = /[.!?。！？]$/;
  // Characters that should attach to the previous word (no leading space)
  const ATTACH_LEFT = /^[.,!?;:)\]}'"%\u3002\uff0c\u3001\uff1b\uff1a\u201d\u2019]$/;

  const segments: ListeningTranscriptSegment[] = [];
  let currentWords: SttWordTimestamp[] = [];

  const toMs = (ns: number) => Math.floor(ns / NS_TO_MS);

  /**
   * Join word tokens into a readable English sentence.
   * Adds spaces between words except before punctuation.
   */
  const joinWords = (words: SttWordTimestamp[]): string => {
    if (words.length === 0) return '';
    let result = words[0].text;
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1].text;
      const curr = words[i].text;
      // No space if current word is punctuation that attaches left,
      // or if previous word was an opening quote/paren
      const prevOpens = /[(\["'\u201c\u2018]$/.test(prev);
      if (ATTACH_LEFT.test(curr) || prevOpens) {
        result += curr;
      } else {
        result += ' ' + curr;
      }
    }
    return result.trim();
  };

  const flushSegment = () => {
    if (currentWords.length === 0) return;
    const text = joinWords(currentWords);
    if (!text || !/[a-zA-Z0-9\u4e00-\u9fff]/.test(text)) {
      currentWords = [];
      return;
    }
    const startNs = currentWords[0].start_time;
    const lastWord = currentWords[currentWords.length - 1];
    const endNs = lastWord.end_time ?? lastWord.start_time;
    const segStartMs = toMs(startNs);
    const segEndMs = Math.max(toMs(endNs), segStartMs + 1);
    segments.push({
      text,
      startMs: segStartMs,
      endMs: segEndMs,
      words: currentWords.map((w) => {
        const wStart = toMs(w.start_time);
        const wEndRaw = toMs(w.end_time ?? w.start_time);
        // Ensure endMs > startMs (minimum 1ms duration) to pass validation
        const wEnd = Math.max(wEndRaw, wStart + 1);
        return { token: w.text, startMs: wStart, endMs: wEnd };
      }),
    });
    currentWords = [];
  };

  for (let i = 0; i < wordTimestamps.length; i++) {
    const w = wordTimestamps[i];
    currentWords.push(w);

    const wordText = w.text.trim();
    if (SENTENCE_END_PUNCT.test(wordText) || wordText === '\n' || wordText === '') {
      flushSegment();
    }
  }

  // Flush remaining words
  flushSegment();

  // Merge very short segments (single punctuation-only) into previous
  return segments.filter((s) => s.text.length > 0 && /[a-zA-Z0-9\u4e00-\u9fff]/.test(s.text));
}

/**
 * Run word timestamps through whisper, return word-level timestamps in nanosecond precision.
 */
async function runWhisperForTimestamps(
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string,
  sttFactory: SttProviderFactory,
  language?: string,
): Promise<SttWordTimestamp[]> {
  const sttConfig = {
    provider: 'whisper',
    temperature: 0.2,
    enableTimestamps: true,
    inferenceUrl: process.env.WHISPER_INFERENCE_URL?.trim(),
    timeoutMs: Number(process.env.WHISPER_TIMEOUT_MS ?? 300_000),
    tencentSecretId: undefined as string | undefined,
    tencentSecretKey: undefined as string | undefined,
    tencentRegion: undefined as string | undefined,
  };
  const sttProvider = sttFactory.getProvider('whisper');
  const result = await sttProvider.transcribe({
    audioBuffer,
    mimeType,
    fileName,
    language,
    temperature: sttConfig.temperature,
    enableTimestamps: true,
    inferenceUrl: sttConfig.inferenceUrl,
    timeoutMs: sttConfig.timeoutMs,
  });
  return result.wordTimestamps ?? [];
}

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

  // ─── Listening Pipeline ────────────────────────────────────

  /**
   * Flow A: Article text → TTS synthesis → (optional whisper fallback) → sentence segmentation.
   * Returns: COS audio asset + sentence-level transcript.
   */
  async processListeningFromText(params: {
    text: string;
    provider: string;
    model: string;
    voiceId?: string;
    ttsParams?: Record<string, unknown>;
    forceWhisperTimestamps?: boolean;
  }): Promise<{
    assetId: string;
    url: string;
    mimeType: string;
    transcript: ListeningTranscriptSegment[];
    provider: string;
    model: string;
    voiceId?: string | null;
  }> {
    const { text, provider: providerKey, model, voiceId, ttsParams, forceWhisperTimestamps } = params;

    // 1. TTS synthesis via synthesizeAsset (persists to COS)
    const providerConfig = await this.aiModel.getTtsConfig(providerKey as any);
    const resolvedModel = model?.trim() || providerConfig.model;
    const resolvedApiKey = providerConfig.apiKey;
    const resolvedBaseUrl = providerConfig.baseUrl;
    const resolvedGroupId = providerConfig.groupId;
    const sanitizedParams = sanitizeTtsParams(providerKey as any, resolvedModel, ttsParams ?? {});
    const ttsProvider = this.factory.getProvider(providerKey as any);
    const configHash = this.buildConfigHash(providerKey, resolvedModel, voiceId, sanitizedParams, text);
    const generatedId = `listening-article-${configHash}-${randomUUID()}`;

    this.logger.log(`[Listening Pipeline] Synthesizing article (${text.length} chars) with ${providerKey}/${resolvedModel}`);

    const ttsResult = await ttsProvider.generateAudio({
      id: generatedId,
      text: text.trim(),
      model: resolvedModel,
      voiceId: voiceId ?? undefined,
      params: sanitizedParams,
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl,
      groupId: resolvedGroupId,
    });

    // 2. Save audio to COS
    const asset = await this.fileAssetsService.createAssetFromBuffer({
      buffer: ttsResult.audioBuffer,
      filename: `${generatedId}.${ttsResult.fileExtension}`,
      mimeType: ttsResult.mimeType,
      group: FileAssetGroup.tts,
    });
    const signed = await this.fileAssetsService.getPrivateUrlByAssetId(asset.id);

    // 3. Get word timestamps
    let wordTimestamps = ttsResult.wordTimestamps;

    // If TTS didn't return word timestamps (or force enabled), run whisper
    if ((!wordTimestamps || wordTimestamps.length === 0 || forceWhisperTimestamps) && process.env.WHISPER_INFERENCE_URL?.trim()) {
      this.logger.log(`[Listening Pipeline] Running Whisper for word timestamps (TTS returned ${wordTimestamps?.length ?? 0} timestamps, forceWhisper=${forceWhisperTimestamps})`);
      wordTimestamps = await runWhisperForTimestamps(
        ttsResult.audioBuffer,
        ttsResult.mimeType,
        `${generatedId}.${ttsResult.fileExtension}`,
        this.sttFactory,
        'en',
      );
    }

    // 4. Sentence segmentation
    const transcript = segmentWordsIntoSentences(wordTimestamps ?? []);
    this.logger.log(`[Listening Pipeline] Segmented into ${transcript.length} sentences`);

    return {
      assetId: asset.id,
      url: (signed as any).url,
      mimeType: ttsResult.mimeType,
      transcript,
      provider: providerKey,
      model: resolvedModel,
      voiceId: voiceId ?? null,
    };
  }

  /**
   * Flow B: Uploaded audio file → Whisper STT → sentence segmentation.
   * Audio is saved to COS and transcript is returned.
   */
  async processListeningFromAudio(params: {
    audioBuffer: Buffer;
    fileName: string;
    language?: string;
  }): Promise<{
    assetId: string;
    url: string;
    mimeType: string;
    transcript: ListeningTranscriptSegment[];
  }> {
    const { audioBuffer, fileName, language } = params;

    const ext = path.extname(fileName).replace('.', '') || 'mp3';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4',
      ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg',
    };
    const mimeType = mimeMap[ext] ?? 'audio/mpeg';

    // 1. Save uploaded audio to COS
    const asset = await this.fileAssetsService.createAssetFromBuffer({
      buffer: audioBuffer,
      filename: fileName,
      mimeType,
      group: FileAssetGroup.library,
    });
    const signed = await this.fileAssetsService.getPrivateUrlByAssetId(asset.id);
    this.logger.log(`[Listening Pipeline] Audio saved to COS: ${asset.id}`);

    // 2. Run Whisper for word timestamps
    this.logger.log(`[Listening Pipeline] Running Whisper on uploaded audio (${audioBuffer.length} bytes)`);
    const wordTimestamps = await runWhisperForTimestamps(
      audioBuffer,
      mimeType,
      fileName,
      this.sttFactory,
      language ?? 'en',
    );

    // 3. Sentence segmentation
    const transcript = segmentWordsIntoSentences(wordTimestamps);
    this.logger.log(`[Listening Pipeline] Segmented into ${transcript.length} sentences from uploaded audio`);

    return {
      assetId: asset.id,
      url: (signed as any).url,
      mimeType,
      transcript,
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
