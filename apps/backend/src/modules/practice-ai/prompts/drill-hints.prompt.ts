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
 *   - 提示必须具体、可操作，引用这道题的目标词/句块/句型与上下文；
 *   - 禁止泛化套话（"用目标词造句"等）；
 *   - 中文 10~25 字，引导学习者"往哪个方向想"但不直接给答案。
 *
 * =============================================================================
 */

/** 提示写作规则（system prompt 片段，所有生成点共用） */
export const DRILL_HINT_WRITING_RULES = `## ══ HINT WRITING RULES (CRITICAL — every item MUST have a specific, helpful hint) ══
- chunk_substitution (zh_to_en): Guide how to use the target word/chunk naturally. Point to sentence structure or collocation.
  Example for "I'm late": "想想'迟到'用英语怎么说？主语是 I，后面跟什么？" — NOT "用目标词造句".
- chunk_substitution (en_to_zh): Guide the learner to grasp the core meaning of the English sentence, then produce natural Chinese — never word-by-word translation.
- pattern_drill: Guide how to fill the pattern slot. Point to which Chinese part maps to the slot.
  Example for "I'd like to [verb]": "先确定'想要做'对应句型哪部分，再把'点一杯咖啡'放进去。"
- vocab_sentence_building: Suggest which collocation fits this item. Point to the relationship between vocab and pattern chunk. You may hint at a scenario.
  Example for "check in" with "I'd like to...": "用酒店前台场景，想想办理入住第一句话怎么说。"
- sentence_decomposition: Each level's hint builds on the previous — guide what to ADD at this specific step (object, degree, manner, time, place, reason). The hint MUST reference the actual element being added, not generic advice.
  Example: L1 "先说出主语和核心动词" → L2 "加上宾语，说明做了什么" → L3 "加上目的，为什么做这件事" → L4 "加上时间/地点，形成完整场景".
- NEVER use generic hints like "用目标词造句", "注意语法", "参考句型", "按照提示完成句子". Each hint MUST reference the SPECIFIC word/chunk and context.
- Hints in Chinese, 10-25 characters, actionable.`;

/** 题型生成时的内嵌 hint 要求（user prompt 片段，追加到 JSON 输出指令后） */
export const DRILL_HINT_OUTPUT_REQUIREMENT = `Every item MUST include a "hint" field: a specific, actionable Chinese hint (10-25 chars) that references THIS item's target word/pattern and context. Never use generic hints like "用目标词造句" or "注意语法".`;

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
