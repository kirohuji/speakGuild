// ──────────────────────────────────────────────
// 异步任务耗时测量工具
//
// 用于关键异步任务（OTA 检查、同步、SQLite、Pixi 初始化）的耗时日志。
// 超过阈值的任务会输出 console.warn，方便定位卡顿来源。
//
// 用法:
//   import { measure } from '@/lib/perf/measure'
//   const result = await measure('offlineSync', () => offlineSyncService.sync(userId))
// ──────────────────────────────────────────────

const SLOW_TASK_THRESHOLD_MS = 300;

interface MeasureResult<T> {
  result: T;
  durationMs: number;
}

/**
 * 测量一个异步任务的耗时。
 * 如果耗时超过 SLOW_TASK_THRESHOLD_MS (300ms)，输出 warning 日志。
 */
export async function measure<T>(
  name: string,
  task: () => Promise<T>,
): Promise<MeasureResult<T>> {
  const startedAt = performance.now();
  try {
    const result = await task();
    const duration = Math.round(performance.now() - startedAt);
    if (duration > SLOW_TASK_THRESHOLD_MS) {
      console.warn(`[perf] ⚠️ "${name}" took ${duration}ms (threshold: ${SLOW_TASK_THRESHOLD_MS}ms)`);
    }
    return { result, durationMs: duration };
  } catch (error) {
    const duration = Math.round(performance.now() - startedAt);
    if (duration > SLOW_TASK_THRESHOLD_MS) {
      console.warn(`[perf] ⚠️ "${name}" failed after ${duration}ms`, error);
    }
    throw error;
  }
}

/**
 * 同步版本的耗时测量（用于非 async 函数）
 */
export function measureSync<T>(name: string, task: () => T): MeasureResult<T> {
  const startedAt = performance.now();
  const result = task();
  const duration = Math.round(performance.now() - startedAt);
  if (duration > SLOW_TASK_THRESHOLD_MS) {
    console.warn(`[perf] ⚠️ "${name}" (sync) took ${duration}ms`);
  }
  return { result, durationMs: duration };
}
