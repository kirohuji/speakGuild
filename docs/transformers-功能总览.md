# @huggingface/transformers 功能总览与项目使用现状

> 本文档记录 `@huggingface/transformers` 库的完整功能清单，以及漫语町（ManYu）项目当前的使用情况。
> 用于后续技术选型和功能扩展时的参考。

---

## 一、项目当前使用情况

### 仅使用 1 个功能：Feature Extraction（特征提取）

| 项目 | 详情 |
|---|---|
| **功能** | `feature-extraction` |
| **模型** | `Xenova/all-MiniLM-L6-v2`（384 维句子嵌入） |
| **代码位置** | `apps/frontend/src/lib/local-ai/warmup-embedding.worker.ts` |
| **用途** | 对用户答案和题目参考答案做语义相似度判断（Warmup 本地 AI 判题） |
| **调用方式** | `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype, local_files_only })` |
| **推理参数** | `extractor(text, { pooling: 'mean', normalize: true })` |
| **量化精度** | 默认 `q8`（约 23MB），可选 `fp16` / `fp32` |
| **运行环境** | Web Worker（浏览器 WebView / Capacitor App） |

### 核心处理流程

```
用户作答
  → Worker 用 MiniLM 算用户答案的 384 维向量
  → 跟预热好的题目参考答案向量做 cosine similarity
  → 结合词面重叠率、目标表达命中率
  → 输出 strong / ok / weak / miss 四档评分
  → 低置信度自动 fallback 到云端 DeepSeek
```

---

## 二、Transformers.js 全部功能一览

> 来源：`@huggingface/transformers` 官方文档

### 📝 自然语言处理 (NLP)

| 任务 | 描述 | 支持 | 典型模型 | 项目适用场景 |
|---|---|---|---|---|
| **Feature Extraction** | 提取文本的数值化特征向量 | ✅ | MiniLM, BERT, RoBERTa | 🟢 **已使用** — Warmup 本地判题 |
| Fill-Mask | 预测句子中被遮掩的单词 | ✅ | BERT, RoBERTa | 填空题型自动评分 |
| Question Answering | 根据给定文本回答问题 | ✅ | BERT, RoBERTa | 阅读理解评测 |
| Sentence Similarity | 计算两段文本的语义相似度 | ✅ | MiniLM, MPNet | 语义判题（比 feature-extraction 更直接） |
| Summarization | 生成文档摘要 | ✅ | BART, T5 | 长文本简化 |
| Text Classification | 文本分类/情感分析 | ✅ | BERT, DistilBERT | 作文评分、情感检测 |
| Text Generation | 生成新文本（自回归） | ✅ | GPT-2, LLaMA | ❌ 体积太大，不适合本地 |
| Text-to-text Generation | 输入文本→输出文本 | ✅ | T5, FLAN-T5 | 翻译/改写/纠错（可在本地做） |
| Token Classification | 命名实体识别、词性标注 | ✅ | BERT, RoBERTa | 语法分析 |
| Translation | 机器翻译 | ✅ | NLLB, T5, Marian | 中英实时翻译 |
| Zero-Shot Classification | 零样本分类 | ✅ | BART, DeBERTa | 灵活的分类任务 |

### 🖼️ 计算机视觉 (Vision)

| 任务 | 描述 | 支持 | 项目适用场景 |
|---|---|---|---|
| Background Removal | 移除图片背景 | ✅ | 头像处理 |
| Depth Estimation | 景深估计 | ✅ | — |
| Image Classification | 图像分类 | ✅ | 拍照识物 |
| Image Segmentation | 像素级区域分割 | ✅ | — |
| Image-to-Image | 图像风格转换 | ✅ | — |
| Object Detection | 目标检测 | ✅ | — |
| Image Feature Extraction | 图像特征提取 | ✅ | 图像相似度匹配 |

### 🗣️ 音频处理 (Audio)

| 任务 | 描述 | 支持 | 项目适用场景 |
|---|---|---|---|
| Audio Classification | 音频分类 | ✅ | — |
| **Automatic Speech Recognition (ASR)** | 语音转文字 | ✅ | 🟡 **已在用** — Whisper API（云端）；可考虑本地化 |
| Text-to-Speech / Text-to-Audio | 文字转语音 | ✅ | 🟡 **已在用** — MiniMax/Cartesia（云端）；可考虑本地化 |

### 🐙 多模态 (Multimodal)

| 任务 | 描述 | 支持 | 项目适用场景 |
|---|---|---|---|
| Document Question Answering | 文档图像问答 | ✅ | — |
| Image-to-Text | 图片生成描述（OCR前身） | ✅ | 图片转文本 |
| Zero-Shot Image Classification | 零样本图像分类 | ✅ | — |
| Zero-Shot Object Detection | 零样本目标检测 | ✅ | — |

### 🎮 其他

| 任务 | 描述 | 支持 |
|---|---|---|
| Reinforcement Learning | 强化学习 | ✅ |

---

## 三、与当前架构的关系

### 云端 AI vs 本地 AI 分工

```
┌─────────────────────────────────────────────────┐
│                    云端 AI                       │
│  DeepSeek API                                    │
│  ├── 练习反馈（流式 SSE）                         │
│  ├── AI 纠错反馈                                  │
│  ├── 内容生成                                     │
│  └── Warmup 判题（本地失败时的 fallback）          │
├─────────────────────────────────────────────────┤
│                   本地 AI                        │
│  @huggingface/transformers (MiniLM)              │
│  └── feature-extraction + cosine similarity      │
│      └── Warmup 判题（零延迟、零成本、可离线）     │
└─────────────────────────────────────────────────┘
```

### 关键设计原则

- **本地 AI 只做预筛**，不做最终判断
- 低置信度（confidence < 0.58）自动回退到云端
- 模型健康错误会自动关闭本地 AI 开关
- 所有本地推理在 Web Worker 里跑，不阻塞 UI 线程

---

## 四、潜在扩展方向

根据项目定位（英语输出训练 App），以下功能值得考虑本地化：

| 优先级 | 功能 | 理由 | 模型参考 |
|---|---|---|---|
| ⭐⭐⭐ | **Sentence Similarity** | 比 feature-extraction 更直接地回答"语义是否相似"，可能替换当前的自建 cosine 流程 | `Xenova/all-MiniLM-L6-v2`（同模型，换 pipeline） |
| ⭐⭐ | **Text-to-text Generation** | 小微调模型做翻译/改写/纠错，减轻云端 DeepSeek 压力 | `Xenova/LaMini-Flan-T5-77M`（~300MB） |
| ⭐⭐ | **Automatic Speech Recognition** | 本地化语音转文字，减少 Whisper API 调用 | `Xenova/whisper-tiny`（~150MB） |
| ⭐ | Text Classification | 自动判断作文/口语的级别（初学者/中级/高级） | `Xenova/distilbert-base-uncased-finetuned-sst-2-english`（~260MB） |

---

## 五、关键注意事项

1. **体积限制**：移动端本地模型建议控制在 50MB 以内。LLaMA、GPT-2 等大模型不适合本地加载。
2. **Worker 隔离**：所有模型推理必须在 Web Worker 中运行，防止阻塞主线程 UI。
3. **模型加载开销**：MiniLM 首次加载约 2-3 秒（取决于设备），后续从 IndexedDB 缓存加载约 0.5 秒。
4. **量化策略**：优先使用 `q8` 量化版本，在精度和体积之间取平衡。
5. **WebGPU 加速**：可通过 `device: 'webgpu'` 开启，但需检测浏览器/WebView 支持情况。
