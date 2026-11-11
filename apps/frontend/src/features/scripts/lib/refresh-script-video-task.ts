import { scriptCommunityApi } from '@/features/scripts/api/script-community-api'
import { useGlobalTaskStore } from '@/stores/global-task.store'

export function workIdFromScriptVideoTaskId(taskId: string) {
  return taskId.startsWith('script-video:') ? taskId.slice('script-video:'.length) : ''
}

export type ScriptVideoTaskCopy = {
  ready: string
  canceled: string
  failed: string
  generating: string
  timedOut: string
}

/** Apply one renderStatus snapshot onto the global video task store. */
export async function refreshScriptVideoTask(
  taskId: string,
  copy: ScriptVideoTaskCopy,
  options?: { progressFallback?: number; markTimedOutIfStillRunning?: boolean },
) {
  const workId = workIdFromScriptVideoTaskId(taskId)
  if (!workId) return
  const updateGlobalTask = useGlobalTaskStore.getState().updateTask
  try {
    const result = await scriptCommunityApi.renderStatus(workId)
    const progress = result.task?.progress ?? options?.progressFallback ?? 0
    if (result.task?.status === 'completed' || (result.work.status === 'ready' && Boolean(result.work.videoAssetId))) {
      updateGlobalTask(taskId, { status: 'done', progress: 100, stepLabel: copy.ready, error: undefined })
      return 'done' as const
    }
    if (result.work.status === 'failed' || result.task?.status === 'failed' || result.task?.status === 'canceled') {
      updateGlobalTask(taskId, {
        status: 'error',
        progress,
        stepLabel: result.task?.status === 'canceled' ? copy.canceled : copy.failed,
        error: result.work.renderError || result.task?.errorMessage || undefined,
      })
      return 'error' as const
    }
    if (options?.markTimedOutIfStillRunning) {
      updateGlobalTask(taskId, {
        status: 'error',
        progress,
        stepLabel: copy.timedOut,
        error: copy.timedOut,
      })
      return 'error' as const
    }
    updateGlobalTask(taskId, {
      progress,
      stepLabel: result.task?.currentStep || copy.generating,
    })
    return 'running' as const
  } catch (error) {
    console.warn('[script-video] task status refresh failed', { workId, error })
    return 'error' as const
  }
}

export async function refreshRunningScriptVideoTasks(copy: ScriptVideoTaskCopy) {
  const running = useGlobalTaskStore.getState().tasks.filter(
    (task) => task.kind === 'script_video' && task.status === 'running',
  )
  await Promise.all(running.map((task) => refreshScriptVideoTask(task.id, copy, {
    progressFallback: task.progress,
  })))
}
