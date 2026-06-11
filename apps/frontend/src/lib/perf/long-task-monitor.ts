// ──────────────────────────────────────────────
// Long Task Monitor — 主线程长任务监控
//
// 用于 Capacitor 端卡顿问题定位。
// 仅在开发构建中启用，生产环境不打包。
//
// 用法:
//   import { installLongTaskMonitor } from '@/lib/perf/long-task-monitor'
//   installLongTaskMonitor()
// ──────────────────────────────────────────────

const LONG_TASK_THRESHOLD_MS = 200;

interface LongTaskEntry {
  duration: number;
  startTime: number;
  route: string;
}

const recordedTasks: LongTaskEntry[] = [];
const MAX_RECORDED = 50;

/**
 * 安装长任务监控器。
 * 在支持 PerformanceObserver 的环境中监听 >200ms 的主线程阻塞。
 * 部分旧 WebView 不支持 'longtask' entry type，会自动降级。
 */
export function installLongTaskMonitor() {
  if (typeof PerformanceObserver === 'undefined') {
    console.log('[perf] PerformanceObserver not available, long task monitor disabled');
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_THRESHOLD_MS) {
          const task: LongTaskEntry = {
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
            route: location.hash || location.pathname || '/',
          };

          recordedTasks.push(task);
          if (recordedTasks.length > MAX_RECORDED) {
            recordedTasks.shift();
          }

          console.warn(
            `[perf] ⚠️ Long task detected: ${task.duration}ms ` +
            `(started at ${task.startTime}ms, route: ${task.route})`,
          );
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    console.log('[perf] Long task monitor installed ✅ (threshold:', LONG_TASK_THRESHOLD_MS, 'ms)');
  } catch (err) {
    // 部分 WebView 不支持 longtask，忽略即可
    console.log('[perf] Long task monitor not supported in this environment');
  }
}

/** 获取最近记录的长任务列表（用于调试面板） */
export function getRecentLongTasks(): readonly LongTaskEntry[] {
  return recordedTasks;
}
