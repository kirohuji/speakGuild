/**
 * STT（语音转文字）统一类型定义
 * 所有供应商的输入/输出都走这个契约
 */

/** 转写请求入参 */
export interface SttTranscribeInput {
  /** 音频原始 Buffer */
  audioBuffer: Buffer
  /** MIME 类型，如 audio/webm */
  mimeType: string
  /** 原始文件名（含扩展名） */
  fileName: string
  /** 可选：指定识别语言（如 zh-CN, en-US），不传则由供应商自行检测 */
  language?: string
}

/** 词级别时间戳 */
export interface SttWordTimestamp {
  text: string
  /** 起始时间，纳秒 */
  start_time: number
  /** 结束时间，纳秒（可选） */
  end_time?: number
}

/** 转写结果 */
export interface SttTranscribeResult {
  /** 转写全文，失败时为 null */
  text: string | null
  /** 词级别时间戳，供应商不支持时为 null */
  wordTimestamps: SttWordTimestamp[] | null
}
