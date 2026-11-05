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
 *   4. AI 润色 / 质量校验 / 例句拓展 同样遵守本规则
 *
 * 核心原则：
 *   - 标题/题组已标明目标词块或句型；提示只点句子里「非目标」的支撑信息；
 *   - 不要写「关键词：」「句块线索：」等标签，也不要重复目标本身；
 *   - 提示尽量短，直接给可用落点（如 just / finally / on time）；
 *   - 不能泄露完整答案或完整目标表达。
 *
 * =============================================================================
 */

/** 提示写作规则（system prompt 片段，所有生成点共用） */
export const DRILL_HINT_WRITING_RULES = `## ══ HINT WRITING RULES (CRITICAL) ══
The group title / chunk / pattern / vocabWord already tells the learner WHAT to practise.
Hints must tip the OTHER parts of the sentence — never restating the target.

Good examples when target is "get to work":
- zh "我通常九点到公司。" → hint: usually；at nine
- zh "因为堵车，我没能按时到办公室。" → hint: couldn't；on time；because of the traffic
Good examples when target is "get a message from him":
- zh "我刚收到他的消息。" → hint: just
- zh "我终于有机会见到她了。" → hint: finally

Bad (DO NOT do this):
- 句块线索：get to work；补上时间。
- 关键词：get；先译出核心动作。
- 结构迁移 get to [place]
Any hint that mainly repeats the target material is invalid.

Format:
- Compact tips only. Prefer short English footholds for non-target words/phrases.
- Separate multiple tips with Chinese semicolon "；".
- Do NOT prefix with 关键词： / 句块线索： / 句型线索： / 搭配： / 结构：.
- Do NOT write long coaching sentences like 「通常」用 usually or “先译出…再补…”.
- Allowed short Chinese labels when useful: 过去式 / 两句祈使 / 祈使句 / 分三句.
- For en_to_zh: tip the non-obvious English bits that affect Chinese wording (but / once / yet / this afternoon), not the target chunk itself.
- For sentence_decomposition: tip only what to ADD at THIS level (补上昨天 / 补上因为堵车), never the full English of the level.
- NEVER include the complete target expression, the full answer, or a 2+ word fragment copied from the target material.
- Keep each hint short: typically 1-40 characters. One tip is enough when one non-target element matters; 2-4 tips when several matter.`;

/** 题型生成时的内嵌 hint 要求（user prompt 片段，追加到 JSON 输出指令后） */
export const DRILL_HINT_OUTPUT_REQUIREMENT = `Every item MUST include a "hint" field following the HINT WRITING RULES: tip ONLY non-target supporting elements (e.g. usually；at nine / just / couldn't；on time). No 关键词：/句块线索： labels, no restating the target, no full answer leak.`;

/**
 * 所有中英互译题（批量、单题生成与润色）共用的题目契约。
 * 题干是答案的准确源语言翻译；提示只负责点非目标支撑信息。
 */
export const DRILL_TRANSLATION_ITEM_CONTRACT = `## ══ TRANSLATION ITEM CONTRACT (NON-NEGOTIABLE) ══
- zh_to_en: "zh" is the accurate, natural Chinese translation of "answer". "answer" is ONE complete, natural English sentence (a complete question is allowed) using the assigned target material. They must express the SAME meaning.
- en_to_zh: "en" is ONE complete natural English sentence. "answer" is its natural Chinese meaning. Never put the English prompt in "zh".
- Never use a scenario, a communicative task, a lead-in, or a loose paraphrase as zh_to_en "zh". Bad: zh="你看到朋友在等车，想邀请他一起走，先问一句要不要一起。" + answer="The bus is coming. Shall we go?". Good: zh="公交车来了。我们走吗？" + that same answer.
- Keep the three layers separate: prompt = exact source sentence to translate; answer = reference translation; hint = non-target footholds only. Never place the answer or target English expression in the hint.
- SEMANTIC-FIRST ITEM DESIGN: Before writing each item, determine what the assigned material actually means and what grammatical role it has: a word, a fixed phrase, an open frame that still needs a complement, a complete statement, a question, a response, etc. Then choose one ordinary situation in which a native speaker would genuinely use THAT expression, and write the most natural utterance for that intention. Do not apply a fixed expansion template across materials.
- Every answer must be pragmatically coherent by itself. The target must carry the main meaning; any surrounding words must be required by its grammar or directly support its specific intention. Do not manufacture a question for the listener to answer, a generic invitation, or an unrelated setting merely to make an item longer.
- PAIRWISE SEMANTIC CHECK: before returning each pair, compare actor, action/state, object, modifiers, tense/aspect, modality, negation, quantity, and question/statement intent. The source and answer must match on every applicable point. Never add or omit a proposition on either side.
- The ENGLISH side must contain the assigned word/chunk or instantiate the fixed part of the assigned pattern: for zh_to_en this is "answer"; for en_to_zh this is "en". Do not silently replace it with a synonym. Preserve a short chunk as one continuous phrase. When the assigned material is itself a full sentence, retain it as the anchor of the turn or preserve its words and grammar in order in one natural clause.
- TYPE / DIRECTION RICHNESS: when generating multiple groups or a pipeline, include both zh_to_en production and en_to_zh comprehension where natural; vary exercise types by teaching value (chunk_substitution, pattern_drill, vocab_sentence_building, sentence_decomposition) instead of stacking only one type or only one direction.
- zh must be Chinese-dominant and en/English answer must be English-dominant. Do not mix directions or return both zh and en in one item.`;

/**
 * 构建单题「生成提示」的 system prompt。
 * @param type   题型
 * @param itemCount 需要生成的 hint 数量
 * @param keyword 目标词/句块/句型（用于在规则中强调）
 */
export function buildDrillHintsSystemPrompt(type: string, itemCount: number, keyword?: string): string {
  const targetLine = keyword?.trim()
    ? `Target word/chunk/pattern: "${keyword.trim()}"\nThis target is ALREADY known from the group title. Do NOT tip it again. Tip only the other supporting words in each sentence.\n`
    : '';
  return `You are an ESL teaching assistant for Chinese learners of English.
For each exercise item below, write ONE compact teaching hint.

${targetLine}${DRILL_HINT_WRITING_RULES}

Exercise type: ${type}
Return exactly ${itemCount} hints.
Return ONLY valid JSON. Do not return markdown, code fences, comments, or extra text.
The JSON schema is exactly:
{ "hints": ["提示1", "提示2"] }

The word JSON must appear in your response only as part of the valid JSON object.`;
}
