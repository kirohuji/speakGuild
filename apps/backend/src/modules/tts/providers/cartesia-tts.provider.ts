import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { TtsProvider } from './tts-provider';
import { TtsGenerateInput, TtsGenerateResult, TtsWordTimestamp } from '../tts.types';

const CARTESIA_VERSION = '2026-04-02';
const NS_PER_SEC = 1_000_000_000;

function sanitizeContextId(v: string) {
  return v.replace(/[^A-Za-z0-9_-]/g, '-');
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(32, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

@Injectable()
export class CartesiaTtsProvider extends TtsProvider {
  readonly provider = 'cartesia';

  async generateAudio(input: TtsGenerateInput): Promise<TtsGenerateResult> {
    const apiKey = process.env.CARTESIA_API_KEY?.trim();
    if (!apiKey) throw new Error('CARTESIA_API_KEY is not set');
    if (!input.voiceId) throw new Error('Cartesia requires voiceId');

    const sampleRate = 44100;
    const url = `wss://api.cartesia.ai/tts/websocket?api_key=${encodeURIComponent(apiKey)}&cartesia_version=${encodeURIComponent(CARTESIA_VERSION)}`;

    return new Promise<TtsGenerateResult>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Cartesia-Version': CARTESIA_VERSION },
      });

      const audioChunks: Buffer[] = [];
      const wordTimestamps: TtsWordTimestamp[] = [];
      const keySet = new Set<string>();
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        ws.close();
        reject(err);
      };

      ws.on('open', () => {
        ws.send(JSON.stringify({
          model_id: input.model,
          context_id: sanitizeContextId(input.id),
          transcript: input.text,
          voice: { mode: 'id', id: input.voiceId },
          output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: sampleRate },
          add_timestamps: true,
          generation_config: {
            ...(typeof input.params?.speed === 'number' ? { speed: input.params.speed } : {}),
            ...(typeof input.params?.volume === 'number' ? { volume: input.params.volume } : {}),
            ...(typeof input.params?.emotion === 'string' ? { emotion: input.params.emotion } : {}),
          },
        }));
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, any>;

          if (msg.type === 'chunk') {
            const b64 = msg.data || msg.audio;
            if (b64) audioChunks.push(Buffer.from(b64, 'base64'));
            return;
          }

          if (msg.type === 'timestamps') {
            const wts = msg.word_timestamps as { words?: string[]; start?: number[]; end?: number[] } | undefined;
            if (wts?.words?.length && wts.start?.length) {
              wts.words.forEach((word, i) => {
                const st = Math.floor((wts.start![i] ?? 0) * NS_PER_SEC);
                const et = wts.end?.[i] !== undefined ? Math.floor((wts.end[i] ?? 0) * NS_PER_SEC) : undefined;
                const key = `${word}|${st}|${et ?? ''}`;
                if (keySet.has(key)) return;
                keySet.add(key);
                wordTimestamps.push({ text: word, start_time: st, end_time: et });
              });
            }
            return;
          }

          if (msg.type === 'error') {
            fail(new Error(msg.message || msg.error || 'Cartesia error'));
            return;
          }

          if (msg.type === 'done' || msg.done) {
            if (settled) return;
            settled = true;
            ws.close();
            const pcm = Buffer.concat(audioChunks);
            if (!pcm.length) { reject(new Error('Cartesia empty audio')); return; }
            wordTimestamps.sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
            resolve({
              audioBuffer: pcmToWav(pcm, sampleRate),
              fileExtension: 'wav',
              mimeType: 'audio/wav',
              wordTimestamps: wordTimestamps.length ? wordTimestamps : null,
            });
          }
        } catch (e) {
          fail(e instanceof Error ? e : new Error(String(e)));
        }
      });

      ws.on('error', (e) => fail(e));
      ws.on('close', () => { if (!settled) fail(new Error('Cartesia ws closed unexpectedly')); });
    });
  }
}
