import { Injectable } from '@nestjs/common';

/**
 * 输出能力等级评估服务
 *
 * 等级定义:
 * - L1 能说一句: 能说简单单句，但容易卡住
 * - L2 能说清楚: 能回答日常问题，有简单原因
 * - L3 能说完整: 能说 30~60 秒，有原因和例子
 * - L4 能自然交流: 能处理真实生活场景对话
 * - L5 能深入表达: 能讨论观点和抽象话题
 */
@Injectable()
export class OutputLevelService {
  readonly LEVEL_DESCRIPTIONS: Record<string, string> = {
    L1: '能说一句',
    L2: '能说清楚',
    L3: '能说完整',
    L4: '能自然交流',
    L5: '能深入表达',
  };

  /**
   * 根据各维度评分综合评定输出等级
   */
  evaluateLevel(dimensions: {
    answerLength: number;
    grammarAccuracy: number;
    chunkUsage: number;
    logicCompleteness: number;
    naturalness: number;
    fluency: number;
    retellAbility?: number;
  }): { level: string; description: string } {
    const avg =
      (dimensions.answerLength +
        dimensions.grammarAccuracy +
        dimensions.chunkUsage +
        dimensions.logicCompleteness +
        dimensions.naturalness +
        dimensions.fluency) /
      6;

    if (avg >= 9) return { level: 'L5', description: this.LEVEL_DESCRIPTIONS.L5 };
    if (avg >= 7) return { level: 'L4', description: this.LEVEL_DESCRIPTIONS.L4 };
    if (avg >= 5) return { level: 'L3', description: this.LEVEL_DESCRIPTIONS.L3 };
    if (avg >= 3) return { level: 'L2', description: this.LEVEL_DESCRIPTIONS.L2 };
    return { level: 'L1', description: this.LEVEL_DESCRIPTIONS.L1 };
  }

  /**
   * 获取当前等级的提升建议
   */
  getAdvice(level: string): string {
    const advice: Record<string, string> = {
      L1: '建议从「日常社交」话题开始练习，重点掌握基础句型。先做到能用简单句回答，不追求复杂表达。',
      L2: '可以尝试 L1/L2 难度的场景练习。建议增加回答长度，练习加入简单原因（because...）。多跟读和遮挡复述。',
      L3: '你的基础不错！建议挑战「留学生活」和「旅行英语」场景。尝试使用更丰富的连接词和具体例子。',
      L4: '可以开始挑战剧本模式和 L3/L4 场景。建议关注表达的自然度和高级 chunk 的使用。',
      L5: '建议尝试学术挑战场景和探索模式自由对话。关注观点深度和表达的灵活性。',
    };
    return advice[level] ?? '继续练习，稳步提升！';
  }
}
