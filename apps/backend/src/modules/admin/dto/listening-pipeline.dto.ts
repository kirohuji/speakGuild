import { IsString, IsOptional, IsIn, IsNotEmpty, MaxLength, IsObject } from 'class-validator';
import { TtsProvider } from '@prisma/client';

/**
 * Flow A: 上传文本 → TTS 合成音频 → (无词时间戳时) Whisper 提取 → 句子分段
 */
export class ListeningPipelineTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text: string;

  @IsIn(['minimax', 'cartesia', 'hume', 'elevenlabs'])
  provider: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  /** TTS 合成后是否强制走 Whisper 提取词时间戳（即使 TTS 已返回时间戳） */
  @IsOptional()
  forceWhisperTimestamps?: boolean;
}
