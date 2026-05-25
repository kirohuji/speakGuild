import { TtsSchema } from './tts.types';

export const TTS_PARAMS_SCHEMA: TtsSchema[] = [
  {
    provider: 'minimax',
    models: [
      'speech-2.8-hd',
      'speech-2.8-turbo',
      'speech-02-hd',
      'speech-02-turbo',
      'speech-01-hd',
      'speech-01-turbo',
    ].map((model) => ({
      model,
      label: model,
      requiresVoiceId: false,
      fields: [
        { key: 'speed', label: '语速', type: 'number' as const, min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
        { key: 'pitch', label: '音高', type: 'number' as const, min: -12, max: 12, step: 0.5, defaultValue: 0 },
        { key: 'vol',   label: '音量', type: 'number' as const, min: 0.1, max: 2,  step: 0.1, defaultValue: 1 },
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
          { key: 'speed',   label: '语速', type: 'number' as const, min: 0.6, max: 1.5, step: 0.1, defaultValue: 1 },
          { key: 'volume',  label: '音量', type: 'number' as const, min: 0.5, max: 2,   step: 0.1, defaultValue: 1 },
          {
            key: 'emotion', label: '情绪', type: 'select' as const, defaultValue: 'neutral',
            options: [
              { label: 'Neutral', value: 'neutral' },
              { label: 'Excited', value: 'excited' },
              { label: 'Content', value: 'content' },
              { label: 'Sad',     value: 'sad'     },
              { label: 'Angry',   value: 'angry'   },
              { label: 'Scared',  value: 'scared'  },
            ],
          },
        ],
      },
    ],
  },
];

/** 验证并过滤参数，只允许 schema 中定义的合法字段和值范围 */
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
      if (field.options?.some((o) => o.value === s)) result[field.key] = s;
    } else {
      result[field.key] = String(raw);
    }
  }
  return result;
}
