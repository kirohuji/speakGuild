import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SttProvider } from './stt-provider';
import { SttTranscribeInput, SttTranscribeResult } from './stt.types';

@Injectable()
export class WhisperSttProvider extends SttProvider {
  readonly provider = 'whisper';
  private readonly logger = new Logger(WhisperSttProvider.name);
  private readonly NS = 1_000_000_000;

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    const whisperUrl = process.env.WHISPER_INFERENCE_URL?.trim();
    if (!whisperUrl) {
      this.logger.warn('WHISPER_INFERENCE_URL not configured, skipping transcription');
      return { text: null, wordTimestamps: null };
    }

    const ext = path.extname(input.fileName).replace('.', '') || 'webm';
    const tempDir = path.join(process.cwd(), 'uploads', 'tmp', 'recordings');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `${randomUUID()}.${ext}`);
    await fs.writeFile(tempFile, input.audioBuffer);

    try {
      return await this.callWhisper(whisperUrl, tempFile, input);
    } finally {
      await fs.unlink(tempFile).catch(() => undefined);
    }
  }

  private async callWhisper(url: string, audioPath: string, input: SttTranscribeInput): Promise<SttTranscribeResult> {
    try {
      const buf = await fs.readFile(audioPath);
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)]), input.fileName);
      // 时间戳控制：enableTimestamps 默认 true，关闭时用 json 格式更快
      const enableTimestamps = input.enableTimestamps !== false;
      form.append('response_format', enableTimestamps ? 'verbose_json' : 'json');
      form.append('temperature', String(input.temperature ?? 0.2));
      // 优先使用请求传入的 language，否则回退到环境变量
      const lang = input.language?.trim() || process.env.WHISPER_LANGUAGE?.trim();
      if (lang) form.append('language', lang);

      const { default: axios } = await import('axios');
      const { data } = await axios.post<any>(url, form, {
        timeout: Number(process.env.WHISPER_TIMEOUT_MS ?? 300_000),
        validateStatus: (s) => s >= 200 && s < 300,
      });

      if (data?.error) return { text: null, wordTimestamps: null };

      // 展平段落 → 词时间戳
      const wordTimestamps: SttTranscribeResult['wordTimestamps'] = [];
      const segments: any[] = Array.isArray(data?.segments) ? data.segments : [];
      let fullText = '';
      for (const seg of segments) {
        if (seg.text) fullText += seg.text;
        for (const w of seg.words ?? []) {
          const t = (w.word ?? '').trim();
          if (!t || typeof w.start !== 'number') continue;
          wordTimestamps!.push({
            text: t,
            start_time: Math.floor(w.start * this.NS),
            end_time: typeof w.end === 'number' ? Math.floor(w.end * this.NS) : undefined,
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
}
