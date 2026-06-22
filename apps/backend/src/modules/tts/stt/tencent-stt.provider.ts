import { Injectable, Logger } from '@nestjs/common';
import { createHmac, createHash } from 'node:crypto';
import { SttProvider } from './stt-provider';
import { SttTranscribeInput, SttTranscribeResult } from './stt.types';

// ---------------------------------------------------------------------------
// 腾讯云 API 3.0 TC3-HMAC-SHA256 签名工具
// ---------------------------------------------------------------------------

interface TencentApiParams {
  secretId: string
  secretKey: string
  service: string   // e.g. 'asr'
  action: string    // e.g. 'SentenceRecognition'
  version: string   // e.g. '2019-06-14'
  region: string    // e.g. 'ap-guangzhou'
  payload: Record<string, any>
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * 构建腾讯云 API 3.0 签名并发送请求
 * 详见：https://cloud.tencent.com/document/api/1093/35644
 */
async function callTencentApi(params: TencentApiParams): Promise<any> {
  const { secretId, secretKey, service, action, version, region, payload } = params;

  const endpoint = `${service}.tencentcloudapi.com`;
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payloadStr = JSON.stringify(payload);

  // ---- 步骤 1：拼接规范请求串 ----
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${endpoint}\n` +
    `x-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = sha256Hex(payloadStr);
  const canonicalRequest =
    `${httpRequestMethod}\n` +
    `${canonicalUri}\n` +
    `${canonicalQueryString}\n` +
    `${canonicalHeaders}\n` +
    `${signedHeaders}\n` +
    `${hashedRequestPayload}`;

  // ---- 步骤 2：拼接待签名字符串 ----
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign =
    `${algorithm}\n` +
    `${timestamp}\n` +
    `${credentialScope}\n` +
    `${hashedCanonicalRequest}`;

  // ---- 步骤 3：计算签名 ----
  const kDate = hmacSha256(`TC3${secretKey}`, date);
  const kService = hmacSha256(kDate, service);
  const kSigning = hmacSha256(kService, 'tc3_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  // ---- 步骤 4：拼接 Authorization ----
  const authorization =
    `${algorithm} ` +
    `Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  // ---- 发送请求 ----
  const { default: axios } = await import('axios');
  const { data } = await axios.post(`https://${endpoint}`, payloadStr, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Host': endpoint,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
      'Authorization': authorization,
    },
    timeout: 120_000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return data;
}

// ---------------------------------------------------------------------------
// 腾讯云一句话识别 Provider
// ---------------------------------------------------------------------------

/**
 * 支持的音频格式 → VoiceFormat 映射
 * 腾讯云 SentenceRecognition 支持的格式：
 * wav, pcm, ogg-opus, speex, silk, mp3, m4a, aac, amr
 */
const VOICE_FORMAT_MAP: Record<string, string> = {
  wav: 'wav',
  mp3: 'mp3',
  mpeg: 'mp3',
  m4a: 'm4a',
  mp4: 'm4a',
  aac: 'aac',
  ogg: 'ogg-opus',
  opus: 'ogg-opus',
  webm: 'ogg-opus',   // WebM 通常是 Opus 编码，映射到 ogg-opus
};

/** 腾讯云一句话识别返回结构 */
interface TencentAsrResponse {
  Response?: {
    Result?: string
    Error?: { Code: string; Message: string }
    RequestId?: string
  }
}

@Injectable()
export class TencentSttProvider extends SttProvider {
  readonly provider = 'tencent';
  private readonly logger = new Logger(TencentSttProvider.name);

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const secretId = process.env.TENCENT_SECRET_ID?.trim();
    const secretKey = process.env.TENCENT_SECRET_KEY?.trim();

    if (!secretId || !secretKey) {
      this.logger.warn('TENCENT_SECRET_ID or TENCENT_SECRET_KEY not configured');
      return { text: null, wordTimestamps: null };
    }

    // 推断语音格式
    const ext = input.fileName.split('.').pop()?.toLowerCase() ?? '';
    const voiceFormat = VOICE_FORMAT_MAP[ext] ?? VOICE_FORMAT_MAP[input.mimeType.split('/')[1]] ?? 'ogg-opus';
    const audioBase64 = input.audioBuffer.toString('base64');

    // 推断引擎类型（优先使用请求传入的语言，否则回退到环境变量）
    const lang = (input.language?.trim() || process.env.STT_LANGUAGE?.trim() || process.env.WHISPER_LANGUAGE?.trim() || 'en').toLowerCase();
    const engSerViceType = lang === 'zh' || lang === 'zh-cn' ? '16k_zh' : '16k_en';

    const payload = {
      ProjectId: 0,
      SubServiceType: 2,           // 一句话识别
      EngSerViceType: engSerViceType,
      SourceType: 1,               // 原始音频数据（base64）
      VoiceFormat: voiceFormat,
      Data: audioBase64,
      DataLen: input.audioBuffer.length,
      // UsrAudioKey: undefined,   // 可选：用户音频标识
    };

    try {
      const data = await callTencentApi({
        secretId,
        secretKey,
        service: 'asr',
        action: 'SentenceRecognition',
        version: '2019-06-14',
        region: process.env.TENCENT_REGION?.trim() || 'ap-guangzhou',
        payload,
      }) as TencentAsrResponse;

      if (data?.Response?.Error) {
        this.logger.warn(
          `Tencent ASR error: ${data.Response.Error.Code} - ${data.Response.Error.Message}`,
        );
        return { text: null, wordTimestamps: null };
      }

      const text = data?.Response?.Result?.trim() || null;
      if (!text) {
        this.logger.warn('Tencent ASR returned empty result');
      }

      return {
        text,
        // 一句话识别 API 不返回词级别时间戳，需用录音文件识别 API（CreateRecTask）
        wordTimestamps: null,
      };
    } catch (e) {
      this.logger.warn(`Tencent ASR call failed: ${e instanceof Error ? e.message : String(e)}`);
      return { text: null, wordTimestamps: null };
    }
  }
}
