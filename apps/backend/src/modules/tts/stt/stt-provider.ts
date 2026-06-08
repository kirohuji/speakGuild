import { SttTranscribeInput, SttTranscribeResult } from './stt.types';

/**
 * STT 供应商抽象基类
 * 所有语音识别供应商必须继承此类
 */
export abstract class SttProvider {
  /** 供应商标识，如 'whisper' / 'tencent' */
  abstract readonly provider: string;

  /**
   * 转写音频
   * @returns 转写结果；失败时应返回 { text: null, wordTimestamps: null } 而非抛异常
   */
  abstract transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult>;
}
