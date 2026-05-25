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
}
