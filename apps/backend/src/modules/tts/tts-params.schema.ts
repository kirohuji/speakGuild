import { TtsSchema } from './tts.types';

export const TTS_PARAMS_SCHEMA: TtsSchema[] = [
  {
    provider: 'minimax',
    models: [
      'speech-2.8-hd',
      'speech-2.8-turbo',
      'speech-2.6-hd',
      'speech-2.6-turbo',
      'speech-02-hd',
      'speech-02-turbo',
      'speech-01-hd',
      'speech-01-turbo',
    ].map((model) => ({
      model,
      label: model,
      requiresVoiceId: false,
      fields: [
        { key: 'speed', label: 'Speed', type: 'number' as const, min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
        { key: 'vol', label: 'Volume', type: 'number' as const, min: 0, max: 10, step: 0.1, defaultValue: 1 },
        { key: 'pitch', label: 'Pitch', type: 'number' as const, min: -12, max: 12, step: 1, defaultValue: 0 },
        {
          key: 'emotion',
          label: 'Emotion',
          type: 'select' as const,
          defaultValue: 'auto',
          options: [
            { label: 'Auto', value: 'auto' },
            { label: 'Happy', value: 'happy' },
            { label: 'Sad', value: 'sad' },
            { label: 'Angry', value: 'angry' },
            { label: 'Fearful', value: 'fearful' },
            { label: 'Disgusted', value: 'disgusted' },
            { label: 'Surprised', value: 'surprised' },
            { label: 'Neutral', value: 'neutral' },
            { label: 'Calm', value: 'calm' },
            { label: 'Fluent', value: 'fluent' },
          ],
        },
        {
          key: 'language_boost',
          label: 'Language boost',
          type: 'select' as const,
          defaultValue: 'auto',
          options: [
            { label: 'Auto', value: 'auto' },
            { label: 'Chinese', value: 'Chinese' },
            { label: 'Chinese, Yue', value: 'Chinese,Yue' },
            { label: 'English', value: 'English' },
            { label: 'Japanese', value: 'Japanese' },
            { label: 'Korean', value: 'Korean' },
            { label: 'Spanish', value: 'Spanish' },
            { label: 'French', value: 'French' },
            { label: 'German', value: 'German' },
          ],
        },
        {
          key: 'format',
          label: 'Audio format',
          type: 'select' as const,
          defaultValue: 'mp3',
          options: [
            { label: 'MP3', value: 'mp3' },
            { label: 'WAV', value: 'wav' },
            { label: 'FLAC', value: 'flac' },
          ],
        },
        {
          key: 'sample_rate',
          label: 'Sample rate',
          type: 'select' as const,
          defaultValue: 32000,
          options: [
            { label: '16000', value: '16000' },
            { label: '24000', value: '24000' },
            { label: '32000', value: '32000' },
            { label: '44100', value: '44100' },
          ],
        },
        {
          key: 'bitrate',
          label: 'Bitrate',
          type: 'select' as const,
          defaultValue: 128000,
          options: [
            { label: '64000', value: '64000' },
            { label: '128000', value: '128000' },
            { label: '256000', value: '256000' },
          ],
        },
        { key: 'channel', label: 'Channel', type: 'number' as const, min: 1, max: 2, step: 1, defaultValue: 1 },
        {
          key: 'output_format',
          label: 'Response format',
          type: 'select' as const,
          defaultValue: 'hex',
          options: [
            { label: 'Hex', value: 'hex' },
            { label: 'URL', value: 'url' },
          ],
        },
        { key: 'subtitle_enable', label: 'Subtitle', type: 'boolean' as const, defaultValue: false },
        {
          key: 'subtitle_type',
          label: 'Subtitle type',
          type: 'select' as const,
          defaultValue: 'sentence',
          options: [
            { label: 'Sentence', value: 'sentence' },
            { label: 'Word', value: 'word' },
          ],
        },
      ],
    })),
  },
  {
    provider: 'cartesia',
    models: [
      {
        model: 'sonic-3',
        label: 'Sonic 3',
        requiresVoiceId: true,
        fields: [
          { key: 'speed', label: 'Speed', type: 'number' as const, min: 0.6, max: 1.5, step: 0.1, defaultValue: 1 },
          { key: 'volume', label: 'Volume', type: 'number' as const, min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
          {
            key: 'emotion',
            label: 'Emotion',
            type: 'select' as const,
            defaultValue: 'neutral',
            options: [
              { label: 'Neutral', value: 'neutral' },
              { label: 'Excited', value: 'excited' },
              { label: 'Content', value: 'content' },
              { label: 'Sad', value: 'sad' },
              { label: 'Angry', value: 'angry' },
              { label: 'Scared', value: 'scared' },
            ],
          },
        ],
      },
    ],
  },
];

export function sanitizeTtsParams(
  provider: string,
  model: string,
  params?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  if (!params) return {};
  const schema = TTS_PARAMS_SCHEMA.find((s) => s.provider === provider);
  const modelSchema = schema?.models.find((m) => m.model === model);
  if (!modelSchema) return {};

  const result: Record<string, string | number | boolean> = {};
  for (const field of modelSchema.fields) {
    const raw = params[field.key];
    if (raw === undefined || raw === null || raw === '') continue;

    if (field.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      if (field.min !== undefined && n < field.min) continue;
      if (field.max !== undefined && n > field.max) continue;
      result[field.key] = n;
    } else if (field.type === 'boolean') {
      if (typeof raw === 'boolean') result[field.key] = raw;
      else if (raw === 'true') result[field.key] = true;
      else if (raw === 'false') result[field.key] = false;
    } else if (field.type === 'select') {
      const s = String(raw);
      const option = field.options?.find((o) => o.value === s);
      if (!option) continue;
      const defaultValueType = typeof field.defaultValue;
      result[field.key] = defaultValueType === 'number' ? Number(s) : s;
    } else {
      result[field.key] = String(raw);
    }
  }
  return result;
}
