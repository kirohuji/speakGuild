# 本地 AI 与语音能力方案

> 本文档合并原 `本地STT离线识别方案.md` 和 `transformers-功能总览.md`。目标是统一记录本地 warmup judge、本地 STT、Transformers.js 使用边界和云端兜底策略。

## 一、当前本地 AI 使用情况

当前项目只正式使用 `@huggingface/transformers` 的 feature extraction：

| 项目 | 详情 |
|---|---|
| 功能 | `feature-extraction` |
| 模型 | `Xenova/all-MiniLM-L6-v2`，384 维句子嵌入 |
| 代码位置 | `apps/frontend/src/lib/local-ai/warmup-embedding.worker.ts` |
| 用途 | 对用户答案和参考答案做语义相似度判断 |
| 推理参数 | `extractor(text, { pooling: 'mean', normalize: true })` |
| 量化精度 | 默认 `q8`，可选 `fp16` / `fp32` |
| 运行环境 | Web Worker，浏览器 WebView / Capacitor App |

处理流程：

```text
用户作答
  → Worker 用 MiniLM 算用户答案向量
  → 与参考答案向量做 cosine similarity
  → 结合词面重叠率、目标表达命中率
  → 输出 strong / ok / weak / miss
  → 低置信度 fallback 到云端 DeepSeek
```

设计原则：

- 本地 AI 只做预筛，不做不可解释的最终判定。
- 低置信度自动回退云端。
- 模型健康错误会自动关闭本地 AI 开关。
- 所有本地推理必须在 Web Worker 中运行，避免阻塞 UI。

## 二、Transformers.js 扩展边界

项目可考虑的本地化方向：

| 优先级 | 功能 | 理由 | 模型参考 |
|---|---|---|---|
| 高 | Sentence Similarity | 可能替换当前手写 cosine 流程 | `Xenova/all-MiniLM-L6-v2` |
| 中 | Text-to-text Generation | 小模型做翻译/改写/纠错，减轻云端压力 | `Xenova/LaMini-Flan-T5-77M` |
| 中 | Automatic Speech Recognition | 本地语音转文字，减少 Whisper API 调用 | `Xenova/whisper-tiny` |
| 低 | Text Classification | 判断作文/口语级别 | DistilBERT 类模型 |

约束：

- 移动端本地模型优先控制在 50MB 左右；STT 模型可以更大，但必须用户主动下载。
- 生成式大模型、LLaMA、GPT-2 等不适合当前移动端本地加载。
- 优先使用量化模型；WebGPU 只能作为检测后的加速选项。

## 三、本地 STT 现状

当前语音输入链路主要在：

- `apps/frontend/src/lib/native/vn-voice-input.ts`
- `apps/frontend/src/features/practice/components/practice-answer-input.tsx`
- `apps/frontend/src/features/vn-engine/vn-input-panel.tsx`
- `apps/frontend/src/components/common/voice-recorder.tsx`

现在已有两类能力：

1. **Capacitor 原生语音识别**
   - 依赖 `@capgo/capacitor-speech-recognition`
   - 走系统 speech recognition
   - 支持 partial result
   - 质量和可用性取决于设备、系统语言包、系统权限

2. **录音后上传云端 STT**
   - 原生端可用 `@capgo/capacitor-audio-recorder` 拿音频 blob
   - Web 端可用浏览器录音能力
   - 云端后端已有 Whisper / Tencent STT provider

要新增的是第三类：

3. **本地 STT 模型**
   - 用户提前下载或 Web 首次在线加载模型
   - 录音结束后在本地转写
   - 网络不可用时仍可完成基础语音输入

## 二、设计原则

本地 STT 和本地 warmup judge 保持同一套产品语义：

- **开关控制**：用户明确开启后才优先使用本地 STT。
- **模型可选**：提供轻量 / 中级 / 高质量几个 variant。
- **下载可见**：下载中、下载完成、失败都在 toast 和存储管理中体现。
- **不阻塞体验**：模型下载中不等待本地推理，不报本地超时；在线时直接走云端。
- **失败可兜底**：本地 STT 失败或低置信时，有网络则调用云端 STT。
- **双端统一**：Web / Capacitor 由同一 facade 调用，底层加载路径不同。
- **不要混用系统 speech 与本地 STT 概念**：系统 speech recognition 是原生能力，本地 STT 是应用模型能力。

## 三、用户设置

在 `preferences.store.ts` 增加：

```ts
localSttEnabled: boolean
localSttModelVariant: LocalSttModelVariantId
localSttFallbackToCloud: boolean
```

建议默认：

```ts
localSttEnabled: false
localSttModelVariant: 'tiny'
localSttFallbackToCloud: true
```

设置页展示：

- `使用本地语音识别`
- 开启说明：优先使用本地模型转写，失败或低置信时可切到云端
- 关闭说明：使用系统语音识别或云端 STT

存储管理页展示：

- 本地 STT 模型
- 当前 variant
- 状态：未下载 / 下载中 / 已下载 / 需要重新下载 / Web 首次在线加载
- 占用大小
- 下载 / 删除
- 可选模型列表

## 四、模型选择

模型选择要单独定义，不要复用 warmup judge 的 `MiniLM` variant。

建议新建：

```text
apps/frontend/src/lib/local-stt/
  local-stt-model-manager.ts
  local-stt.service.ts
  local-stt.worker.ts
```

候选 variant 先按产品档位设计，具体模型可以后续实测替换：

| Variant | 定位 | 预期体积 | 适用场景 |
|---|---:|---:|---|
| `tiny` | 轻量 | 30-80 MB | 快速短句、移动端默认 |
| `base` | 中级 | 80-160 MB | 更稳的英文句子 |
| `small` | 高质量 | 250-500 MB | 高配设备，可选下载 |

模型优先考虑：

- Whisper 系列 ONNX / Transformers.js 可运行版本
- 支持英文优先，后续再考虑中文或多语
- Web WASM 可跑
- Native 本地文件路径可加载

注意：STT 模型通常比 embedding 模型大很多，不能默认自动下载。

## 五、存储结构

和 warmup model 类似，用文件系统保存模型文件。

建议目录：

```text
Directory.Data/local-stt-models/<modelId>/
  manyu-manifest.json
  config...
  model...
  tokenizer...
  preprocessor...
```

新增 manager status：

```ts
export interface LocalSttModelStatus {
  nativeAvailable: boolean
  installed: boolean
  health: 'unavailable' | 'ready' | 'missing_files' | 'manifest_missing' | 'manifest_mismatch'
  installing: boolean
  modelId: string
  variantId: LocalSttModelVariantId
  bytes: number
  expectedBytes: number
  updatedAt?: string
  localModelPath?: string
  missingFiles: string[]
  manifestFiles: string[]
}
```

下载流程：

1. 用户点击下载。
2. toast：`本地 STT 模型开始下载`。
3. `installing = true`。
4. 下载模型文件，持续更新进度。
5. 写 manifest。
6. toast：`本地 STT 模型已下载`。
7. 刷新存储管理状态。

下载中判题/识别策略：

```text
如果 localSttEnabled=true 且 STT 模型 installing:
  - 不创建 worker
  - 不等待本地 STT timeout
  - 在线：直接走云端 STT
  - 离线：提示“本地 STT 模型正在下载，离线时暂不可识别”
```

## 六、运行时架构

推荐 facade：

```ts
export interface LocalSttInput {
  audio: Blob
  language?: 'en-US' | 'zh-CN' | string
  prompt?: string
  maxDurationMs?: number
}

export interface LocalSttOutput {
  text: string
  confidence?: number
  segments?: Array<{
    startMs: number
    endMs: number
    text: string
  }>
  fallback: boolean
}

export async function transcribeWithLocalStt(input: LocalSttInput): Promise<LocalSttOutput>
```

worker 负责：

- 加载 STT pipeline / ONNX session
- 接收音频 PCM 或 ArrayBuffer
- 返回 transcript
- 维护内存中的模型实例

主线程负责：

- 录音
- 读取偏好
- 检查模型状态
- Web / Native load config
- fallback 到云端
- toast 和错误处理

## 七、Web 与 Capacitor 差异

### Web

Web 不能通过 Capacitor 文件路径加载 native 模型目录，通常走：

- Transformers.js cache
- IndexedDB / Cache Storage
- 首次在线加载
- 后续浏览器缓存复用

Web status 语义：

```text
nativeAvailable = browser runtime available
installed = browser runtime available
health = ready
bytes = 0 或估算值
```

如果要统计 Web 模型缓存大小，后续需要单独扫 IndexedDB / Cache Storage；第一版可以只显示“浏览器模型缓存”。

### Capacitor

Capacitor 端要支持显式下载：

- `Filesystem`
- `FileTransfer`
- manifest 校验
- `Capacitor.convertFileSrc(rootUri.uri)` 转成本地模型路径

Native load config：

```ts
{
  modelId,
  dtype,
  localModelPath,
  allowRemoteModels: false
}
```

## 八、语音输入优先级

建议统一成一个 `voice-transcription.service.ts`：

```text
用户点麦克风
  -> 录音
  -> stop 后拿 audio blob
  -> transcribeVoiceInput(blob)
```

`transcribeVoiceInput` 内部优先级：

```text
if localSttEnabled:
  if model installing:
    online -> cloud STT
    offline -> error
  try local STT
    if success and confidence ok -> return local text
    if failed/low confidence and online and fallback enabled -> cloud STT
    if offline -> return local result or error

else if nativeSpeechRecognitionEnabled and platform supports system speech:
  use system speech recognition path

else:
  record audio -> cloud STT
```

这里有一个产品决策：

- 如果用户打开 `localSttEnabled`，是否还优先系统 speech recognition？

建议答案：不要。  
本地 STT 开启后优先应用自己的本地模型；系统 speech recognition 作为另一个设置项，避免用户以为“本地模型”在工作，实际走了系统服务。

## 九、云端兜底

云端 STT 入口应该保持现有后端 provider：

- Whisper
- Tencent STT

本地失败兜底条件：

```text
localSttEnabled=true
online=true
fallbackToCloud=true
以下任一满足：
  - 本地模型未安装
  - 本地模型下载中
  - worker load failed
  - transcription timeout
  - confidence below threshold
  - transcript empty
```

toast 建议：

- 普通用户：少提示，只在失败/下载状态提示。
- Admin：显示具体路径，例如 `本地 STT 低置信，已切到云端转写`。

## 十、存储管理

在 `MobileStorageView` 的“本地 AI 模型”区可以拆成两个 section：

```text
本地 AI 模型
  - 知识点判题模型
  - 判题向量缓存
  - 本地 STT 模型
```

本地 STT 模型行展示：

```text
本地 STT 模型
tiny · 已下载 · 78.2 MB
[下载/删除] [展开]
```

展开内容：

- variant 列表
- 当前运行端：Web / Capacitor
- 存储位置
- 文件列表摘要
- 缺失文件
- 最近更新时间

清除行为：

- 删除 STT 模型只删除 `local-stt-models/<modelId>`。
- 不清除录音历史。
- 如果本地 STT 开关开启，删除后自动关闭或显示不可用。

## 十一、和 warmup judge 的关系

本地 STT 与本地 judge 是两层：

```text
语音 -> STT -> 文本 -> warmup judge
```

两者不能混在一个 worker：

- STT 模型大，生命周期长
- embedding 模型小，缓存 reference embedding
- 资源释放策略不同
- 错误兜底不同

但 UI 和存储管理可以复用同一套设计语言。

## 十二、第一阶段实现范围

建议第一阶段只做最小闭环：

1. 新增 preference：
   - `localSttEnabled`
   - `localSttModelVariant`
   - `localSttFallbackToCloud`

2. 新增模型 manager：
   - `getStatus`
   - `getLoadConfig`
   - `download`
   - `remove`

3. 新增 worker：
   - `load`
   - `transcribe`

4. 新增 facade：
   - `transcribeVoiceInput`

5. 改 `PracticeAnswerInput`：
   - stop recording 后走统一 STT service
   - local enabled 时优先 local STT
   - fallback cloud

6. 改存储管理：
   - STT 模型状态
   - 下载 / 删除
   - variant 选择

7. 保留原生系统 speech recognition 作为独立开关，不默认和本地 STT 混用。

## 十三、需要实测的问题

实现前必须选型并实测：

- Web WASM 能否稳定加载该 STT 模型。
- iOS / Android 本地路径能否被 Transformers.js 正确读取。
- 录音格式是否需要转 PCM / 16kHz。
- 模型加载时间和内存峰值。
- 10 秒音频转写耗时。
- Web fp16 / quantized 模型是否踩 ONNX Runtime graph optimization bug。
- 浏览器 tab 后台时 worker 是否被挂起。

## 十四、推荐兜底策略

最终用户体验建议：

```text
本地 STT 可用且模型 ready:
  先本地识别
  结果为空/低置信/异常:
    在线 -> 云端识别
    离线 -> 提示重试

本地 STT 模型下载中:
  在线 -> 云端识别
  离线 -> 提示下载中，不进入本地超时

本地 STT 未安装:
  在线 -> 云端识别，并提示可下载本地模型
  离线 -> 提示需要下载模型
```

这样和当前本地 warmup judge 的策略一致：本地能力优先，但不让本地模型状态拖垮主流程。
