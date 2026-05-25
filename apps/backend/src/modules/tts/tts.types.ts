export type TtsWordTimestamp = {
  text: string;
  start_time: number; // 纳秒
  end_time?: number;  // 纳秒
};

export type TtsGenerateInput = {
  id: string;
  text: string;
  model: string;
  voiceId?: string | null;
  params?: Record<string, unknown>;
};

export type TtsGenerateResult = {
  audioBuffer: Buffer;
  fileExtension: 'mp3' | 'wav';
  mimeType: string;
  wordTimestamps: TtsWordTimestamp[] | null;
};

export type TtsParamSchemaField = {
  key: string;
  label: string;
  type: 'number' | 'string' | 'select' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
};

export type TtsProviderModelSchema = {
  model: string;
  label: string;
  requiresVoiceId: boolean;
  fields: TtsParamSchemaField[];
};

export type TtsSchema = {
  provider: string;
  models: TtsProviderModelSchema[];
};
