import { Injectable } from '@nestjs/common';

/**
 * AI 任务判断服务
 *
 * 剧本模式下，Ink 脚本驱动 NPC 对话，AI 仅负责判断用户回答质量：
 * - 是否切题
 * - 完成了哪些目标
 * - 使用了哪些 Chunk
 * - 语法问题
 *
 * 此服务封装对 DeepSeek 的调用，返回结构化判断结果。
 * Prompt 模板见 tech plan 第 6.2 节。
 */
@Injectable()
export class ScriptJudgeService {
  buildJudgePrompt(params: {
    sceneTitle: string;
    npcName: string;
    npcRole: string;
    npcPersonality?: string;
    objectives: string[];
    coreChunks: string[];
    lastNpcText: string;
    userTranscript: string;
    completedObjectives: string[];
    usedChunks: string[];
    round: number;
    maxRounds: number;
  }): string {
    const {
      sceneTitle,
      npcName,
      npcRole,
      npcPersonality,
      objectives,
      coreChunks,
      lastNpcText,
      userTranscript,
      completedObjectives,
      usedChunks,
      round,
      maxRounds,
    } = params;

    return `你是一个英语学习剧本中的 NPC 对话裁判。当前剧本关卡：

场景：${sceneTitle}
NPC 角色：${npcName}，${npcRole}
NPC 性格：${npcPersonality ?? '友好、乐于助人'}

任务目标（需用户完成）：
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

核心 Chunk（用户应主动使用）：
${coreChunks.join('\n')}

上一轮 NPC 说的话：${lastNpcText}
用户这一轮的回答（语音转写）：${userTranscript}

已完成的目标：${completedObjectives.join(', ') || '（无）'}
已使用的 Chunk：${usedChunks.join(', ') || '（无）'}
当前对话轮数：${round}/${maxRounds}

请按以下 JSON 格式分析（仅返回 JSON，不要其他文字）：

{
  "isOnTopic": true/false,
  "newlyCompletedObjectives": ["目标1", "目标2"],
  "newlyUsedChunks": ["chunk文本"],
  "needsFollowUp": true/false,
  "followUpReason": "如果 needFollowUp=true，说明缺少什么关键信息",
  "grammarIssues": [
    { "type": "grammar|collocation|chinglish|unnatural", "original": "...", "correction": "..." }
  ],
  "shouldHintChunk": true/false,
  "hintChunkSuggestion": "建议用户使用哪个 Chunk 的提示语",
  "allObjectivesCompleted": true/false,
  "isStuck": true/false,
  "isComplete": true/false
}`;
  }

  parseJudgeResponse(raw: string): any {
    try {
      // Extract JSON from possible markdown code blocks
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch {
      return null;
    }
  }
}
