import { Injectable } from '@nestjs/common';

/**
 * XP 计算服务
 *
 * 定义所有行为的 XP 奖励值：
 * - 完成一次练习: +10
 * - 完成一次录音回答: +5
 * - 成功复述一个 Chunk: +5
 * - 通关一个剧本关卡: +30
 * - 连续打卡: +20
 * - 主动使用新 Chunk: +10
 */
@Injectable()
export class XpCalculatorService {
  readonly XP_PRACTICE_COMPLETE = 10;
  readonly XP_RECORDING_DONE = 5;
  readonly XP_RETELL_CHUNK = 5;
  readonly XP_SCRIPT_PASS = 30;
  readonly XP_STREAK = 20;
  readonly XP_NEW_CHUNK_OUTPUT = 10;

  /** 根据等级计算升级所需 XP (简单公式: 100 * level) */
  xpForLevel(level: number): number {
    return 100 * level;
  }

  /** 根据当前 XP 计算等级 */
  calculateLevel(totalXp: number): number {
    let level = 1;
    let xpNeeded = this.xpForLevel(level);
    let remaining = totalXp;
    while (remaining >= xpNeeded) {
      remaining -= xpNeeded;
      level++;
      xpNeeded = this.xpForLevel(level);
    }
    return level;
  }
}
