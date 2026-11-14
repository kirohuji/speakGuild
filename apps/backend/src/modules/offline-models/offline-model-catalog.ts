import { BadRequestException } from '@nestjs/common';
export const OFFLINE_MODEL_QUEUE = 'offline-models';
export const OFFLINE_MODEL_JOB = 'offline-model-prepare';
const embeddingFiles = ['config.json', 'tokenizer.json', 'tokenizer_config.json'];
const whisperFiles = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];
export const OFFLINE_MODEL_CATALOG = [
  ...['tiny', 'base', 'small'].map(size => ({ variantId: `${size}-en-q8`, purpose: 'stt', label: `Whisper ${size[0].toUpperCase() + size.slice(1)} EN`, modelId: `Xenova/whisper-${size}.en`, dtype: 'q8', files: whisperFiles })),
  ...[['q8', 'model_quantized.onnx'], ['fp16', 'model_fp16.onnx'], ['fp32', 'model.onnx']].map(([dtype, file]) => ({ variantId: dtype, purpose: 'embedding', label: `MiniLM · ${dtype.toUpperCase()}`, modelId: 'Xenova/all-MiniLM-L6-v2', dtype, files: [...embeddingFiles, `onnx/${file}`] })),
];
export function modelPreset(variantId: string) {
  const preset = OFFLINE_MODEL_CATALOG.find(item => item.variantId === variantId);
  if (!preset) throw new BadRequestException('不支持的离线模型型号');
  return preset;
}
export interface ModelResourceFile { path: string; assetId: string; size: number; sha256: string }
export function validateModelContents(path: string, data: Buffer, purpose?: string) {
  if (!data.length) throw new BadRequestException(`文件为空：${path}`);
  if (path.endsWith('.json')) {
    if (data.length > 8 * 1024 * 1024) throw new BadRequestException(`配置文件过大：${path}`);
    let json: any;
    try { json = JSON.parse(data.toString('utf8')); } catch { throw new BadRequestException(`JSON 格式错误：${path}`); }
    if (!json || typeof json !== 'object' || Array.isArray(json) || json.error) throw new BadRequestException(`配置文件无效：${path}`);
    if (path === 'config.json' && purpose && json.model_type !== (purpose === 'stt' ? 'whisper' : 'bert')) throw new BadRequestException('模型配置与所选用途不一致');
    if (path === 'config.json' && typeof json.model_type !== 'string') throw new BadRequestException('config.json 缺少 model_type');
    if (path === 'tokenizer.json' && !json.model) throw new BadRequestException('tokenizer.json 缺少分词器定义');
  } else if (data.length < 1024 * 1024) throw new BadRequestException(`权重文件不完整：${path}`);
}
export function validateResourceManifest(preset: ReturnType<typeof modelPreset>, files: ModelResourceFile[]) {
  if (files.length !== preset.files.length || new Set(files.map(file => file.path)).size !== files.length) throw new BadRequestException('模型文件清单不完整或包含重复项');
  if (files.reduce((sum, file) => sum + file.size, 0) > 900 * 1024 * 1024) throw new BadRequestException('模型资源总量超过 900 MB');
  for (const path of preset.files) {
    const file = files.find(item => item.path === path);
    if (!file || !file.assetId || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size <= 0) throw new BadRequestException(`模型文件缺失或校验信息无效：${path}`);
  }
}
