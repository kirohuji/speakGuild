/**
 * =============================================================================
 * Warmup Pipeline — AI 批量生成 Prompt 模板
 * =============================================================================
 *
 * 用于「学习内容 / 编辑话题 / 知识点练习」→「全部 AI 生成」按钮。
 * 前端收集材料缺口后调用 POST /practice-ai/generate-warmup-pipeline，
 * 后端 english-practice-ai.service.ts 使用此 prompt 调用 DeepSeek API 一次性生成补齐所有题组。
 *
 * ─── Prompt 结构约定 ───────────────────────────────────────────────────────
 *
 * 此文件包含两部分，职责严格分离：
 *   PART A — System Prompt（全局不变规则：角色、题型定义、质量基准、输出约束）
 *   PART B — User Prompt（本轮动态数据：话题/难度/已有内容摘要/材料缺口/当前结构状态）
 *
 * 原则：
 *   - System Prompt 只写"永远成立"的规则，不出现任何一次性的数据。
 *   - User Prompt 只写"这一轮"的数据，不重复 System 中的规则。
 *   - 结构目标（静态基准）在 System；当前达成状态（差额计算）在 User。
 *   - 提示（hint）写作规则与单题「生成提示」共用 drill-hints.prompt.ts，保证风格一致。
 *
 * =============================================================================
 */

import { DRILL_HINT_WRITING_RULES } from './drill-hints.prompt';

// ═══════════════════════════════════════════════════════════════════════════
// PART A: System Prompt
// ═══════════════════════════════════════════════════════════════════════════

export const WARMUP_PIPELINE_SYSTEM_PROMPT = `You are an ESL exercise planner and generator for Chinese learners.
Generate a compact set of warmup exercise groups in ONE JSON response.

Exercise group types:
1. chunk_substitution
   Fields: type, title, chunk, chunkMeaning, direction("zh_to_en"|"en_to_zh"), kind("word"|"chunk"), items[]
   Items (zh_to_en): {zh: "中文题干", answer: "English answer", hint: "提示"}
   Items (en_to_zh): {en: "English prompt", answer: "中文答案", hint: "提示"}
   NEVER mix: if direction=zh_to_en, ALL items use {zh, answer}. If direction=en_to_zh, ALL items use {en, answer}.
2. vocab_sentence_building
   Fields: type, title, vocabWord, vocabMeaning, direction("zh_to_en"), patterns[{chunk, items[]}]
   Items follow same direction rule as above.
3. pattern_drill
   Fields: type, title, pattern, patternMeaning, direction("zh_to_en"|"en_to_zh"), items[]
   Items follow same direction rule as above.
4. sentence_decomposition
   Fields: type, title, sourceText, sourceKind("vocab"|"chunk"|"pattern"), fullSentence, fullSentenceZh, levels[]
   Levels: [{level:1-N, label:"加对象"|"加程度"|"加方式"|"加时间"|"加地点"|"加原因"|"完整句", en:"English at this level", zh:"Chinese translation", highlight:"newly added element text", hint:"Chinese hint"}]

   ── Progressive decomposition rules (CRITICAL) ──
   - ALL levels decompose the SAME fullSentence, from simple to complete. Never generate different sentences per level.
   - Level count (N) should be 3-5, adapting to the sentence's actual grammar structure. Do NOT force 5 levels if the sentence is simple — 3 well-chosen levels are better than 5 forced ones.
   - DO NOT rigidly follow a fixed "L1 skeleton → L2 object → L3 degree → L4 time/place → L5 full" formula.
     Instead, ANALYZE the sentence and decide the most natural decomposition path:
     * Identify the core clause (subject + verb + essential complement).
     * Identify the modifiers: objects, adverbs, time phrases, place phrases, manner, reason, etc.
     * Layer them in order of grammatical distance from the core: the innermost modifier first, the outermost last.
     * Some sentences are verb+object heavy — expand objects before adverbs.
     * Some sentences are location/time heavy — expand those before manner.
     * The last level is ALWAYS the full original sentence.
   - Each level's English MUST be a strict substring or close variant of the previous level plus ONE new element. The progression must be visible: L1 ⊂ L2 ⊂ ... ⊂ L(N-1) ⊂ LN (full).
   - "highlight" field: the exact text added at THIS level compared to the previous level.
   - "zh" field: Chinese translation of THIS level's English (also progressive, not the same every level).
   - "label" field: short Chinese label describing what was added at this level, e.g., "加对象", "加方式", "加时间", "加地点", "加原因", "完整句".
   - "hint" field: guides the learner on what to add at THIS level. Hints build upon each other — each hint references the specific element being added at this step.

   ── Good decomposition example ──
   Full: "I went to the store with my friend yesterday to buy some milk."
   L1: "I went to the store." → label:"核心句" highlight:"" hint:"先说出主语和核心动作，去了哪里？"
   L2: "I went to the store to buy some milk." → label:"加目的" highlight:"to buy some milk" hint:"去商店做什么？加上目的。"
   L3: "I went to the store with my friend to buy some milk." → label:"加伴随" highlight:"with my friend" hint:"和谁一起去的？加上伴随。"
   L4 (full): "I went to the store with my friend yesterday to buy some milk." → label:"完整句" highlight:"yesterday" hint:"什么时候去的？加上时间，形成完整句。"

   ── Bad example (DO NOT do this) ──
   Full: "She is happy because she passed the exam."
   L1: "She is." (incomplete — subject+verb alone is ungrammatical here)
   Better: L1: "She is happy." → L2: "She is happy because she passed the exam."

## ══ VOCABULARY TIER SYSTEM (核心词 vs 扩展词) ══

The material pool labels each vocabulary word with its tier:
- **[core]**   — Core word (核心词): directly semantically related to the topic title. MUST be covered first.
- **[ext]**    — Extension word (扩展词): not directly related to the topic, but fits the sentence patterns well for practice. Cover AFTER all core words are covered.
- **[carry]**  — Carry-over word (前序复用词): a core word from an earlier topic in the SAME learning package. These help with spaced repetition. Lowest priority — cover only after [core] and [ext] words.

Priority order when choosing which words to cover:
  1. [core] words with count=0 (missing, highest priority)
  2. [ext] words with count=0 (missing)
  3. [core] words with count<2 (under-covered)
  4. [carry] words with count=0 (missing, nice-to-have)
  5. [ext] words with count<2 (under-covered)

A word is "covered" when it appears as the target word (chunk/vocabWord/pattern) in at least one exercise group.

## ══ CUMULATIVE DESIGN (累加式设计) ══

This learning package uses cumulative design: later topics can reuse core words from earlier topics as extension words ([carry] tier).
When you see [carry] words in the material pool, they are from earlier topics in the same package.
- You MAY use them to enrich exercises if the primary [core] and [ext] words are already well-covered.
- Using [carry] words increases repetition which aids long-term retention.
- But NEVER use a [carry] word at the expense of a missing [core] word.

## ══ LEARNING PACK SEQUENCE CONSTRAINTS (CRITICAL) ══

This exercise belongs to a learning pack inside an ordered pack group. Later packs in the group contain knowledge points the learner has NOT studied yet:

- **FORBIDDEN MATERIALS (MUST NOT appear anywhere)**: Never use these words/chunks/patterns in any exercise, example sentence, prompt, hint, or answer. They belong to LATER learning packs — using them leaks future knowledge points and breaks the learning sequence.
- **REVIEW MATERIALS (nice-to-have)**: These are knowledge points from EARLIER packs. You MAY reuse them in example sentences as spaced repetition, but do NOT treat them as new teaching targets.
- Difficulty: generate exercises at the stated target difficulty level. Choose vocabulary and sentence complexity accordingly.

## ══ SENTENCE PATTERN DRIVEN WORD ALLOCATION ══

Each sentence pattern has "slots" that certain word types can fill:

| Pattern | Slot Type | Words That Fit |
|---------|-----------|----------------|
| I am ___ | profession/name/adjective | student, teacher, doctor, Li Ming, happy, tall |
| It is ___ | color/size/thing | red, big, a book, on the table |
| I want ___ | food/drink/thing | coffee, water, a pen, to go home |
| I like ___ | any noun/gerund | music, coffee, reading, swimming |
| Can you ___? | verb | help, speak, go, come |
| There is/are ___ | quantity + noun | a book, two pens, many people |
| I ___ every ___ | verb + time | study every day, eat every morning |

When assigning words to patterns, match the word's semantic category to the pattern's slot type. A food word like "apple" belongs in "I want ___" or "I like ___", NOT in "I am ___" or "It is ___ (color)".

Rules:
- Return ONLY valid JSON: { "pipeline": [...] }
- Do not include ids; frontend will assign ids.
- Generate MULTIPLE groups of the same type when there are many missing materials — do NOT stop at the minimum. For example, if 5 vocab words are missing, generate 2-3 separate chunk_substitution groups (each targeting different words), not just one.
- Each group should target a DIFFERENT material (word/chunk/pattern). Do not put all missing materials into one giant group.
- Use missing materials preferentially, but choose exercise types naturally and vary them.
- Mix types: do not generate only chunk_substitution groups. Include at least one pattern_drill, one vocab_sentence_building, and varied combinations.
- IMPORTANT — en_to_zh comprehension check: Always include at least 2 en_to_zh items (chunk_substitution with direction="en_to_zh"). These confirm the learner can read/hear English and understand it — not just produce it. Use natural English sentences, not textbook examples.
- Avoid homogeneous output and near-duplicate sentences.
- Keep each group compact: 2-4 translation items per group, 2-3 pattern groups for vocab_sentence_building, 3-5 progressive levels for sentence_decomposition (L1 ⊂ L2 ⊂ ... ⊂ LN, same sentence, incremental, N adapts to sentence complexity).
- CRITICAL: Every group MUST have at least 2 items — never generate a group with only 1 item (that creates a "single-item section" which is invalid). If you can only fill 1 item for a material, combine it with another material in the same group.
- STRUCTURE TARGETS (aim for these, not just the minimum):
  * Total practice items: 8-15 (ideal range). Below 6 is a hard failure.
  * Total groups (steps): 3-5 (ideal range). More than 5 is acceptable only if all materials are covered.
  * zh_to_en output items: at least 3 (output activation, step 1 priority).
  * en_to_zh comprehension items: at least 2 (input check — confirms reading/listening understanding).
  * pattern_drill items: at least 2 (structural output training — ensures learner can use sentence patterns flexibly).
  * Zero single-item groups: every group 2+ items.
- PIPELINE ORDERING (the pipeline array is an ordered sequence — position matters):
  * The FIRST group(s) MUST be zh_to_en chunk_substitution — these are the warmup opener that activates the learner's English output. Like "中译英替换" in the UI, this is step 1 of the warmup flow.
  * Follow with en_to_zh comprehension check groups — after producing English, confirm understanding.
  * Then pattern_drill or vocab_sentence_building groups for deeper practice.
  * Sentence decomposition (if any) goes last as the consolidation exercise.
  * Do NOT put en_to_zh or decomposition before zh_to_en. The order is: output activation → input check → structure drill → consolidation.
${DRILL_HINT_WRITING_RULES}
- PIPELINE ORDERING (the pipeline array is an ordered sequence — position matters):
- For en_to_zh, put English prompt in "en" and Chinese answer in "answer". Do NOT include a "zh" field on en_to_zh items.
- For zh_to_en, put Chinese prompt in "zh" and English answer in "answer". Do NOT include an "en" field on zh_to_en items.
- CRITICAL: Every item in a group must follow the group's direction. If direction="zh_to_en", ALL items use {zh, answer} — never mix {en, answer} items into a zh_to_en group, and never include both zh and en on the same item. Direction mixing within one group is invalid.
- Make sure generated English actually uses the target material or clearly demonstrates the source pattern.
- IMPORTANT: Review the PREVIOUSLY GENERATED ITEMS section below. Do NOT generate the same exercises again. Instead, fix gaps: if previous items were too short, make them richer; if they were too similar, vary the scenarios; if a material was covered poorly, cover it better this time.`;

// ═══════════════════════════════════════════════════════════════════════════
// PART B: User Prompt（由 buildWarmupPipelineUserPrompt 在运行时构建）
// ═══════════════════════════════════════════════════════════════════════════
//
// User Prompt 只承载本轮动态数据（话题/难度/已有内容摘要/材料缺口/当前结构状态），
// 不再重复 System Prompt 中的规则。结构目标（静态基准）在 System，当前达成状态在 User。
//
// =============================================================================

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Build the user prompt from the template (used in the service)
// ═══════════════════════════════════════════════════════════════════════════

export interface WarmupPipelinePromptInput {
  topicTitle: string;
  difficulty: string;
  previousSummary: string;
  totalMissing: number;
  /** 后序包知识点（禁止出现在任何题目/例句/提示中） */
  forbiddenMaterials: string[];
  /** 前序包知识点（仅允许作为复习复现） */
  reviewMaterials: string[];
  structure: {
    totalItems: number;
    steps: number;
    zhToEnItems: number;
    enToZhItems: number;
    patternItems: number;
    expansionUnits: number;
  };
  materials: {
    /** 核心词 (count=0) */
    missingCoreVocabs: Array<{ word: string; meaning?: string }>;
    /** 扩展词 (count=0) */
    missingExtVocabs: Array<{ word: string; meaning?: string }>;
    /** 前序复用词 (count=0) */
    missingCarryVocabs: Array<{ word: string; meaning?: string }>;
    /** 缺失句块 */
    missingChunks: Array<{ text: string; meaning?: string }>;
    /** 缺失句型 */
    missingPatterns: Array<{ pattern: string; meaning?: string }>;
    /** 完整单词池（含 tier 标签 + used/missing 状态） */
    vocabPoolSummary: string;
    /** 完整句块池 */
    chunkPoolSummary: string;
    /** 完整句型池 */
    patternPoolSummary: string;
  };
}

export function buildWarmupPipelineUserPrompt(input: WarmupPipelinePromptInput): string {
  const { topicTitle, difficulty, previousSummary, totalMissing, structure, materials } = input;

  const minItemsNeeded = Math.max(0, 6 - structure.totalItems);
  const minStepsNeeded = Math.max(0, 3 - structure.steps);

  const fmtVocabs = (list: Array<{ word: string; meaning?: string }>) =>
    list.length
      ? list.map((v) => `- ${v.word}${v.meaning ? `: ${v.meaning}` : ''}`).join('\n')
      : '- (none — all covered!)';

  const forbiddenBlock = input.forbiddenMaterials.length
    ? [
        '',
        '## ══ FORBIDDEN MATERIALS (MUST NOT appear anywhere) ══',
        'These knowledge points belong to LATER learning packs. NEVER use them in any exercise, example sentence, prompt, hint, or answer:',
        input.forbiddenMaterials.map((text) => `- ${text}`).join('\n'),
        '',
      ].join('\n')
    : '';

  const reviewBlock = input.reviewMaterials.length
    ? [
        '',
        '## ══ REVIEW MATERIALS (earlier packs, nice-to-have) ══',
        'You MAY reuse these as spaced repetition in example sentences, but do NOT make them new teaching targets:',
        input.reviewMaterials.map((text) => `- ${text}`).join('\n'),
        '',
      ].join('\n')
    : '';

  const difficultyLine = `Target difficulty: ${difficulty}. Match vocabulary and sentence complexity to this level.`;

  return [
    `Topic: ${topicTitle}`,
    difficultyLine,
    previousSummary,
    forbiddenBlock,
    reviewBlock,
    `You need to generate exercises to cover ${totalMissing} missing materials.`,
    'Generate enough groups — do NOT stop at just one group per type.',
    '',
    '## ══ Current State (already generated; targets per System rules) ══',
    '',
    `- Practice items so far: ${structure.totalItems} (need at least ${minItemsNeeded} more to pass the minimum)`,
    `- Groups/steps so far: ${structure.steps} (need at least ${minStepsNeeded} more)`,
    `- zh_to_en output items so far: ${structure.zhToEnItems}`,
    `- en_to_zh comprehension items so far: ${structure.enToZhItems}`,
    `- pattern_drill items so far: ${structure.patternItems}`,
    `- expansion groups so far: ${structure.expansionUnits}`,
    '',
    `IMPORTANT: If ${totalMissing} materials are missing, generate MORE groups than the minimum to cover them. Do not stop at just meeting the floor.`,
    '',
    '## ══ Materials ══',
    '',
    'Select materials following the coverage priority defined in the System rules ([core] count=0 → [ext] count=0 → under-covered → [carry]).',
    '',
    '### Missing Materials (count=0, MUST cover):',
    '',
    '#### Core Words [core] — must cover first:',
    fmtVocabs(materials.missingCoreVocabs),
    '',
    '#### Extension Words [ext] — cover after core:',
    fmtVocabs(materials.missingExtVocabs),
    '',
    '#### Carry-over Words [carry] — nice-to-have (earlier topics in same package):',
    fmtVocabs(materials.missingCarryVocabs),
    '',
    '#### Missing Chunks:',
    materials.missingChunks.length
      ? materials.missingChunks.map((c) => `- ${c.text}${c.meaning ? `: ${c.meaning}` : ''}`).join('\n')
      : '- (none — all covered!)',
    '',
    '#### Missing Sentence Patterns:',
    materials.missingPatterns.length
      ? materials.missingPatterns.map((p) => `- ${p.pattern}${p.meaning ? `: ${p.meaning}` : ''}`).join('\n')
      : '- (none — all covered!)',
    '',
    '## ══ Full Material Pool (for context) ══',
    '',
    '### Vocabulary (with tier tags):',
    materials.vocabPoolSummary || '(none)',
    '',
    '### Chunks:',
    materials.chunkPoolSummary || '(none)',
    '',
    '### Sentence Patterns:',
    materials.patternPoolSummary || '(none)',
  ].join('\n');
}
