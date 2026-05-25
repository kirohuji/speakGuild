import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileAssetGroup, TtsProvider } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TtsProviderFactory } from './tts-provider.factory';
import { TTS_PARAMS_SCHEMA, sanitizeTtsParams } from './tts-params.schema';
import { SynthesizeQuestionDto, SynthesizeTextDto } from './dto/synthesize.dto';
import { FileAssetsService } from '../file-assets/file-assets.service';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: TtsProviderFactory,
    private readonly fileAssetsService: FileAssetsService,
  ) {}

  getParamsSchema() {
    return TTS_PARAMS_SCHEMA;
  }

  /** 题目音频：按 (questionId + textType + 配置哈希) 持久化缓存 */
  async synthesizeQuestion(dto: SynthesizeQuestionDto) {
    const question = await this.prisma.questionItem.findUnique({
      where: { id: dto.questionId },
      include: { content: true },
    });
    if (!question) throw new NotFoundException('题目不存在');
    if (!question.content) throw new BadRequestException('题目暂无内容');

    const textType = dto.textType ?? 'answer';
    const text = textType === 'question'
      ? question.content.promptEn?.trim()
      : question.content.answerEn?.trim() || question.content.promptEn?.trim();
    if (!text) throw new BadRequestException('题目英文内容为空');

    const configHash = this.buildConfigHash(dto.provider, dto.model, dto.voiceId, dto.params, textType);

    // 检查缓存
    const existing = await this.prisma.questionAudio.findUnique({
      where: { questionId_configHash: { questionId: dto.questionId, configHash } },
    });
    if (existing) {
      this.logger.log(`Cache hit: questionId=${dto.questionId} provider=${dto.provider}`);
      return {
        id: existing.id,
        mimeType: existing.mimeType,
        wordTimestamps: existing.wordTimestamps,
        cached: true,
      };
    }

    // 生成新音频
    const sanitizedParams = sanitizeTtsParams(dto.provider, dto.model, dto.params);
    const provider = this.factory.getProvider(dto.provider);
    const ephemeralId = `q-${dto.questionId}-${randomUUID()}`;

    this.logger.log(`Generating TTS: questionId=${dto.questionId} textType=${textType} provider=${dto.provider} model=${dto.model}`);
    const result = await provider.generateAudio({
      id: ephemeralId,
      text,
      model: dto.model,
      voiceId: dto.voiceId,
      params: sanitizedParams,
    });

    const fileName = `${ephemeralId}.${result.fileExtension}`;
    const asset = await this.fileAssetsService.createAssetFromBuffer({
      buffer: result.audioBuffer,
      filename: fileName,
      mimeType: result.mimeType,
      group: FileAssetGroup.tts,
    });
    const ttsBizId = this.getTtsBizId(dto.questionId, configHash);
    await this.fileAssetsService.createSystemReference(asset.id, 'tts_question', ttsBizId);

    const record = await this.prisma.questionAudio.create({
      data: {
        questionId: dto.questionId,
        configHash,
        provider: dto.provider as TtsProvider,
        model: dto.model,
        voiceId: dto.voiceId ?? null,
        mimeType: result.mimeType,
        assetId: asset.id,
        wordTimestamps: result.wordTimestamps as any ?? undefined,
      },
    });

    return {
      id: record.id,
      mimeType: record.mimeType,
      wordTimestamps: record.wordTimestamps,
      cached: false,
    };
  }

  /** 用户录音 → Whisper 转写，返回文本 + 词时间戳 + 音频 base64 */
  async transcribeRecording(audioBuffer: Buffer, originalname: string): Promise<{
    audioBase64: string;
    mimeType: string;
    text: string | null;
    wordTimestamps: Array<{ text: string; start_time: number; end_time?: number }> | null;
  }> {
    const ext = path.extname(originalname).replace('.', '') || 'webm';
    const mimeMap: Record<string, string> = {
      webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4',
      ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg',
    };
    const mimeType = mimeMap[ext] ?? 'audio/webm';
    const audioBase64 = audioBuffer.toString('base64');

    const whisperUrl = process.env.WHISPER_INFERENCE_URL?.trim();
    if (!whisperUrl) {
      return { audioBase64, mimeType, text: null, wordTimestamps: null };
    }

    // 保存临时文件供 Whisper 读取
    const tempDir = path.join(process.cwd(), 'uploads', 'tmp', 'recordings');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `${randomUUID()}.${ext}`);
    await fs.writeFile(tempFile, audioBuffer);

    try {
      const result = await this.callWhisper(whisperUrl, tempFile, originalname);
      return { audioBase64, mimeType, text: result.text, wordTimestamps: result.wordTimestamps };
    } finally {
      await fs.unlink(tempFile).catch(() => undefined);
    }
  }

  private async callWhisper(
    url: string,
    audioPath: string,
    fileName: string,
  ): Promise<{ text: string | null; wordTimestamps: Array<{ text: string; start_time: number; end_time?: number }> | null }> {
    const NS = 1_000_000_000;
    try {
      const buf = await fs.readFile(audioPath);
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)]), fileName);
      form.append('response_format', 'verbose_json');
      form.append('temperature', '0.2');
      const language = process.env.WHISPER_LANGUAGE?.trim();
      if (language) form.append('language', language);

      const { default: axios } = await import('axios');
      const { data } = await axios.post<any>(url, form, {
        timeout: Number(process.env.WHISPER_TIMEOUT_MS ?? 300_000),
        validateStatus: (s) => s >= 200 && s < 300,
      });

      if (data?.error) return { text: null, wordTimestamps: null };

      // 展平段落 → 词时间戳
      const wordTimestamps: Array<{ text: string; start_time: number; end_time?: number }> = [];
      const segments: any[] = Array.isArray(data?.segments) ? data.segments : [];
      let fullText = '';
      for (const seg of segments) {
        if (seg.text) fullText += seg.text;
        for (const w of (seg.words ?? [])) {
          const t = (w.word ?? '').trim();
          if (!t || typeof w.start !== 'number') continue;
          wordTimestamps.push({
            text: t,
            start_time: Math.floor(w.start * NS),
            end_time: typeof w.end === 'number' ? Math.floor(w.end * NS) : undefined,
          });
        }
      }

      wordTimestamps.sort((a, b) => a.start_time - b.start_time);
      return {
        text: (data?.text || fullText).trim() || null,
        wordTimestamps: wordTimestamps.length ? wordTimestamps : null,
      };
    } catch (e) {
      this.logger.warn(`Whisper call failed: ${e instanceof Error ? e.message : String(e)}`);
      return { text: null, wordTimestamps: null };
    }
  }
  async synthesizeText(dto: SynthesizeTextDto) {
    const sanitizedParams = sanitizeTtsParams(dto.provider, dto.model, dto.params);
    const provider = this.factory.getProvider(dto.provider);
    const result = await provider.generateAudio({
      id: `ephemeral-${randomUUID()}`,
      text: dto.text.trim(),
      model: dto.model,
      voiceId: dto.voiceId,
      params: sanitizedParams,
    });
    return {
      mimeType: result.mimeType,
      audioBase64: result.audioBuffer.toString('base64'),
      wordTimestamps: result.wordTimestamps,
    };
  }

  async getAudioUrl(id: string) {
    const record = await this.prisma.questionAudio.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!record) throw new NotFoundException('音频不存在');
    const signed = await this.fileAssetsService.getPrivateUrlByAssetId(record.assetId);
    return {
      url: signed.url,
      mimeType: record.mimeType,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  /** 删除某题目的所有缓存音频（TTS 配置变更时调用） */
  async clearQuestionAudioCache(questionId: string) {
    const records = await this.prisma.questionAudio.findMany({ where: { questionId } });
    await Promise.all(records.map((r) =>
      this.fileAssetsService.deleteSystemReference(
        r.assetId,
        'tts_question',
        this.getTtsBizId(questionId, r.configHash),
      ),
    ));
    await this.prisma.questionAudio.deleteMany({ where: { questionId } });
    return { deleted: records.length };
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

  private getTtsBizId(questionId: string, configHash: string) {
    return `${questionId}:${configHash}`;
  }
}
