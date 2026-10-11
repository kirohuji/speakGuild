const LATEST_DOWNLOAD_FAILURE_KEY = 'manyu.learning-pack.latest-download-failure.v1'

export interface LearningPackDownloadDiagnostic {
  occurredAt: string
  packId: string
  title: string
  stage?: string
  connectionType?: string
  error: {
    name?: string
    message: string
    stack?: string
    code?: string
  }
}

function errorDetails(error: unknown): LearningPackDownloadDiagnostic['error'] {
  if (error instanceof Error) {
    const extended = error as Error & { code?: unknown }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: typeof extended.code === 'string' ? extended.code : undefined,
    }
  }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

/** Keeps the latest native download failure available to an administrator after the toast disappears. */
export function recordLearningPackDownloadFailure(params: Omit<LearningPackDownloadDiagnostic, 'occurredAt' | 'error'> & { error: unknown }) {
  const diagnostic: LearningPackDownloadDiagnostic = {
    occurredAt: new Date().toISOString(),
    packId: params.packId,
    title: params.title,
    stage: params.stage,
    connectionType: params.connectionType,
    error: errorDetails(params.error),
  }
  try {
    window.localStorage.setItem(LATEST_DOWNLOAD_FAILURE_KEY, JSON.stringify(diagnostic))
  } catch {
    // Diagnostics must never affect the actual download failure handling.
  }
  return diagnostic
}

export function getLatestLearningPackDownloadFailure(): LearningPackDownloadDiagnostic | null {
  try {
    const raw = window.localStorage.getItem(LATEST_DOWNLOAD_FAILURE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LearningPackDownloadDiagnostic>
    if (!parsed.occurredAt || !parsed.packId || !parsed.title || !parsed.error?.message) return null
    return parsed as LearningPackDownloadDiagnostic
  } catch {
    return null
  }
}
