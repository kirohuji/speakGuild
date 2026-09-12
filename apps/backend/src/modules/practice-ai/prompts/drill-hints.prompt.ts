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
 *   - 可以给一个关键词、带空格的句型骨架或不完整句块；不能泄露完整答案或完整目标表达；
 *   - 禁止泛化套话（"用目标词造句"等）；
 *   - 中文 18~56 字，让学习者看完就知道先说什么、再补哪类信息；不直接给答案。
 *
 * =============================================================================
 */

/** 提示写作规则（system prompt 片段，所有生成点共用） */
export const DRILL_HINT_WRITING_RULES = `## ══ HINT WRITING RULES (CRITICAL — every item MUST be immediately answerable) ══
- zh_to_en is a TRANSLATION exercise, not an open-ended speaking scenario. A hint must expose a usable but incomplete foothold: identify the exact Chinese sentence elements to translate AND give one of: a single English keyword, a masked sentence skeleton, or a masked partial chunk. It is NOT a paraphrase of the answer.
- Every hint MUST contain a usable English foothold. Within one batch, deliberately rotate these hint forms: “关键词：word；…”, “句型线索：Word ___；…”, and “句块线索：word ___；…”. Do not repeatedly begin with “先译出”; do not return a Chinese-only paraphrase of the task.
- The learner must be able to infer a translation plan after reading it. Prefer concrete guidance such as “关键词：reschedule；把‘改期’作主要动作，再补新的日期”; never merely tell them to “think about the context”.
- chunk_substitution (zh_to_en): point to the exact Chinese clause(s) and whether the translation is a statement, question, request, or reply. You MAY show the first word plus “___”, but MUST NOT reveal the complete target English chunk.
  Good: "句块线索：put ___；先说清想推迟的事情，再补时间。"
- chunk_substitution (en_to_zh): identify the English sentence's purpose and tone, then guide natural Chinese translation rather than word-by-word translation.
- pattern_drill: identify the exact Chinese content that fills each variable slot and its grammar form (person / thing / base action / time / place). You MAY show an incomplete skeleton with “___”; do NOT write the completed English pattern.
  Good: "句型线索：Would ___ …?；把邀请的动作原形放进空位。"
- vocab_sentence_building: name a concrete scenario and tell the learner which sentence role the target meaning plays (action, object, reason, result, etc.). You MAY state the single target word, but do NOT state an English collocation from the answer.
- sentence_decomposition: each level must state exactly which NEW element to add (object, degree, manner, time, place, reason) and where it attaches; never repeat the completed level.
- NEVER include the answer, the complete target English expression, or ANY sequence of 2+ English words copied from the answer. One English word is allowed. A masked scaffold may show at most three English words and must contain “___” or “…”.
- NEVER use generic hints like "用目标词造句", "注意语法", "参考句型", "按照提示完成句子", "结合语境", "想想要表达什么".
- Hints are Chinese-led, 18-56 characters, concrete and actionable. Each one must contain an explicit information target AND an explicit sentence-building action.`;

/** 题型生成时的内嵌 hint 要求（user prompt 片段，追加到 JSON 输出指令后） */
export const DRILL_HINT_OUTPUT_REQUIREMENT = `Every item MUST include a "hint" field following the HINT WRITING RULES: Chinese-led 18-56 chars, explicit information target plus sentence-building action, one English keyword OR a masked scaffold is allowed, but never the answer, a complete multi-word target expression, or a 2-word answer fragment.`;

/**
 * 所有中英互译题（批量、单题生成与润色）共用的题目契约。
 * 题干是答案的准确源语言翻译；提示只负责搭脚手架，不能把题干改写成场景描述。
 */
export const DRILL_TRANSLATION_ITEM_CONTRACT = `## ══ TRANSLATION ITEM CONTRACT (NON-NEGOTIABLE) ══
- zh_to_en: "zh" is the accurate, natural Chinese translation of "answer". "answer" is ONE complete, natural English sentence (a complete question is allowed) using the assigned target material. They must express the SAME meaning.
- en_to_zh: "en" is ONE complete natural English sentence. "answer" is its natural Chinese meaning. Never put the English prompt in "zh".
- Never use a scenario, a communicative task, a lead-in, or a loose paraphrase as zh_to_en "zh". Bad: zh="你看到朋友在等车，想邀请他一起走，先问一句要不要一起。" + answer="The bus is coming. Shall we go?". Good: zh="公交车来了。我们走吗？" + that same answer.
- Keep the three layers separate: prompt = exact source sentence to translate; answer = reference translation; hint = how to reason. Never place the answer or target English expression in the prompt or hint.
- SEMANTIC-FIRST ITEM DESIGN: Before writing each item, determine what the assigned material actually means and what grammatical role it has: a word, a fixed phrase, an open frame that still needs a complement, a complete statement, a question, a response, etc. Then choose one ordinary situation in which a native speaker would genuinely use THAT expression, and write the most natural utterance for that intention. Do not apply a fixed expansion template across materials.
- Every answer must be pragmatically coherent by itself. The target must carry the main meaning; any surrounding words must be required by its grammar or directly support its specific intention. Do not manufacture a question for the listener to answer, a generic invitation, or an unrelated setting merely to make an item longer. For example, "Shall we?" needs an action before its question mark ("Shall we start the movie now?"); "Cheer up." can be encouragement ("Cheer up — you can try again tomorrow."); and "What a nice day it is!" can naturally lead to an outdoor plan. These are illustrations of semantic fit, not reusable templates. Bad: "Shall we? The movie is about to start." Bad: "Had a rough day? Want to get coffee?" for target "Cheer up.".
- PAIRWISE SEMANTIC CHECK: before returning each pair, compare actor, action/state, object, modifiers, tense/aspect, modality, negation, quantity, and question/statement intent. The source and answer must match on every applicable point. Never add or omit a proposition on either side.
- The ENGLISH side must contain the assigned word/chunk or instantiate the fixed part of the assigned pattern: for zh_to_en this is "answer"; for en_to_zh this is "en". Do not silently replace it with a synonym. Preserve a short chunk as one continuous phrase. When the assigned material is itself a full sentence, retain it as the anchor of the turn or preserve its words and grammar in order in one natural clause.
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
