/**
 * =============================================================================
 * Drill Hints — 统一 AI 提示（hint）生成规则
 * =============================================================================
 *
 * 所有生成"提示（hint）"的 AI 调用共用此文件中的规则，保证输出风格一致：
 *
 *   1. 「全部 AI 生成」（generate-warmup-pipeline，批量补齐题组）
 *      → warmup-pipeline.prompt.ts 引用 DRILL_HINT_WRITING_RULES
 *   2. 单题「生成提示」（generate-drills?generateHints=true）
 *      → buildDrillHintsSystemPrompt() 构建 system prompt
 *   3. 各题型 AI 生成（chunk_substitution / vocab_sentence_building /
 *      pattern_drill / sentence_decomposition 生成时内嵌 hint）
 *      → DRILL_HINT_OUTPUT_REQUIREMENT 内嵌到输出指令
 *
 * 核心原则：
 *   - 提示必须具体、可操作，告诉学习者先判断什么信息、再怎样组织句子；
 *   - 不能泄露英语答案、答案中的连续英文片段或目标表达本身；
 *   - 禁止泛化套话（"用目标词造句"等）；
 *   - 中文 12~32 字，引导学习者"往哪个方向想"但不直接给答案。
 *
 * =============================================================================
 */

/** 提示写作规则（system prompt 片段，所有生成点共用） */
export const DRILL_HINT_WRITING_RULES = `## ══ HINT WRITING RULES (CRITICAL — every item MUST have a specific, helpful hint) ══
- A hint is a TWO-STEP micro-coaching cue: (1) identify the communicative intent / key role in the Chinese situation, then (2) choose the sentence structure or slot. It is NOT a paraphrase of the answer.
- chunk_substitution (zh_to_en): point to who is speaking, what they want to achieve, and whether the expression belongs at the start/end of a complete sentence. Do NOT reveal the target English chunk.
  Good: "先确定你是在追问原因，再补成一句完整的问句。"
- chunk_substitution (en_to_zh): point to the speaker's intent and tone, then guide natural Chinese rather than word-by-word translation.
- pattern_drill: point to which Chinese information fills the variable slot and what grammar form the slot needs (person / thing / action / time). Do NOT write the completed English pattern.
  Good: "先找出要做的动作，把它放进“想要”的动作位置。"
- vocab_sentence_building: point to the relationship between the target meaning, scenario, and sentence role. Do NOT state an English collocation from the answer.
  Good: "先说清在酒店要办什么事，再把核心动作放进完整句。"
- sentence_decomposition: each level guides exactly what NEW element to add (object, degree, manner, time, place, reason) and never repeats the completed level.
- NEVER include the answer, the target English expression, or ANY sequence of 2+ English words copied from the answer.
- NEVER use generic hints like "用目标词造句", "注意语法", "参考句型", "按照提示完成句子".
- Hints are Chinese, 12-32 characters, concrete and actionable.`;

/** 题型生成时的内嵌 hint 要求（user prompt 片段，追加到 JSON 输出指令后） */
export const DRILL_HINT_OUTPUT_REQUIREMENT = `Every item MUST include a "hint" field following the HINT WRITING RULES: Chinese 12-32 chars, concrete two-step coaching, no English answer/target expression/2-word answer fragment, and never generic advice.`;

/**
 * 所有中英互译题（批量、单题生成与润色）共用的题目契约。
 * 题干只描述“用户要完成的交际任务”，答案才是完整的目标语言输出；提示只负责搭脚手架。
 */
export const DRILL_TRANSLATION_ITEM_CONTRACT = `## ══ TRANSLATION ITEM CONTRACT (NON-NEGOTIABLE) ══
- zh_to_en: "zh" is a natural Chinese communicative situation/question only. "answer" is ONE complete, natural English sentence (a complete question is allowed) that solves that situation and uses the assigned target material.
- en_to_zh: "en" is ONE complete natural English sentence. "answer" is its natural Chinese meaning. Never put the English prompt in "zh".
- Keep the three layers separate: prompt = what the learner must say; answer = reference output; hint = how to reason. Never place the answer or target English expression in the prompt or hint.
- Do not make a fragment-only exercise. If the target is a short chunk, embed it in a complete, realistic sentence or question. Example: target "What's going on?" can be used in the complete answer "You look worried. What's going on?"; the Chinese prompt describes the situation, while the hint only guides the learner to ask about the reason.
- The answer must contain the assigned word/chunk or instantiate the fixed part of the assigned pattern. Do not silently replace it with a synonym.
- zh must be Chinese-dominant and en/English answer must be English-dominant. Do not mix directions or return both zh and en in one item.`;

/**
 * 构建单题「生成提示」的 system prompt。
 * @param type   题型
 * @param itemCount 需要生成的 hint 数量
 * @param keyword 目标词/句块/句型（用于在规则中强调）
 */
export function buildDrillHintsSystemPrompt(type: string, itemCount: number, keyword?: string): string {
  const targetLine = keyword?.trim() ? `Target word/chunk/pattern: "${keyword.trim()}"\n` : '';
  return `You are an ESL teaching assistant for Chinese learners of English.
For each exercise item below, write ONE specific, helpful teaching hint in Chinese.
Each hint should guide the learner on how to construct the answer without giving it away completely.

${targetLine}${DRILL_HINT_WRITING_RULES}

Exercise type: ${type}
Return exactly ${itemCount} hints.
Return ONLY valid JSON. Do not return markdown, code fences, comments, or extra text.
The JSON schema is exactly:
{ "hints": ["提示1", "提示2"] }

The word JSON must appear in your response only as part of the valid JSON object.`;
}
