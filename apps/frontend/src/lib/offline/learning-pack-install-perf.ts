/**
 * Learning-pack install performance probe.
 *
 * Captures stage timings (download → SQLite → deferred index), DeviceInfo
 * samples (CPU / memory / thermal / storage) on Capacitor, and prints one
 * copy-pasteable console report when the session ends.
 *
 * Enabled only in Capacitor live-reload (`CAP_LIVE_RELOAD_URL` / isDevHost).
 * Production native builds and plain web are no-ops.
 */

import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { DeviceInfo, type DeviceInfoSnapshot } from '@capgo/capacitor-device-info'
import { isDevHost } from '@/lib/dev-host'

/** Safari / WebView console filter: use this exact token. */
export const PACK_INSTALL_PERF_PREFIX = '[MANYU_PACK_PERF]'

const LAST_REPORT_KEY = 'manyu.pack-install-perf.last'
const MONITOR_INTERVAL_MS = 2000

function perfLog(message: string, data?: unknown) {
  if (data === undefined) console.log(`${PACK_INSTALL_PERF_PREFIX} ${message}`)
  else console.log(`${PACK_INSTALL_PERF_PREFIX} ${message}`, data)
}

export type PackInstallPerfKind = 'install' | 'update' | 'delta' | 'materialize'

export interface PackInstallPerfMark {
  label: string
  atMs: number
  sinceStartMs: number
  deltaMs: number
  extra?: Record<string, unknown>
}

export interface PackInstallPerfDeviceSample {
  atMs: number
  label?: string
  cpuUsagePercent?: number | null
  cpuCores?: number
  memUsedPercent?: number
  appUsedMB?: number
  appLimitMB?: number
  systemUsedMB?: number
  systemTotalMB?: number
  lowMemory?: boolean
  pressure?: string
  thermalState?: string
  lowPowerMode?: boolean
  storageFreeMB?: number
  storageUsedPercent?: number
  deviceMemUsedMB?: number
}

export interface PackInstallPerfReport {
  version: 1
  kind: PackInstallPerfKind
  packId: string
  platform: string
  isNative: boolean
  startedAt: string
  finishedAt: string
  totalMs: number
  totalSec: number
  ok: boolean
  errorMessage?: string
  marks: PackInstallPerfMark[]
  stageMs: Record<string, number>
  deviceSamples: PackInstallPerfDeviceSample[]
  deviceSummary?: {
    sampleCount: number
    cpuUsagePercent?: { min: number; max: number; avg: number }
    appUsedMB?: { min: number; max: number; avg: number }
    memUsedPercent?: { min: number; max: number; avg: number }
    thermalStates: string[]
    sawLowMemory: boolean
    pressures: string[]
  }
  extras: Record<string, unknown>
}

function bytesToMB(bytes?: number | null): number | undefined {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return undefined
  return Math.round((bytes / 1048576) * 10) / 10
}

function isEnabled(): boolean {
  // CAP_LIVE_RELOAD_URL → WebView loads Vite DEV → isDevHost.
  return isDevHost
}

function summarizeNumeric(values: Array<number | null | undefined>): { min: number; max: number; avg: number } | undefined {
  const nums = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (nums.length === 0) return undefined
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const avg = Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10
  return { min, max, avg }
}

function toDeviceSample(snapshot: DeviceInfoSnapshot, atMs: number, label?: string): PackInstallPerfDeviceSample {
  return {
    atMs: Math.round(atMs),
    label,
    cpuUsagePercent: snapshot.cpu?.usagePercent ?? null,
    cpuCores: snapshot.cpu?.cores,
    memUsedPercent: snapshot.memory?.usedPercent,
    appUsedMB: bytesToMB(snapshot.memory?.appUsedBytes),
    appLimitMB: bytesToMB(snapshot.memory?.appLimitBytes),
    systemUsedMB: bytesToMB(snapshot.memory?.usedBytes),
    systemTotalMB: bytesToMB(snapshot.memory?.totalBytes),
    lowMemory: snapshot.memory?.lowMemory,
    pressure: snapshot.memory?.pressure,
    thermalState: snapshot.thermalState,
    lowPowerMode: snapshot.lowPowerMode,
    storageFreeMB: bytesToMB(snapshot.storage?.freeBytes),
    storageUsedPercent: snapshot.storage?.usedPercent,
  }
}

async function readCapacitorDeviceMemUsedMB(): Promise<number | undefined> {
  try {
    const info = await Device.getInfo()
    return bytesToMB(info.memUsed)
  } catch {
    return undefined
  }
}

function buildStageMs(marks: PackInstallPerfMark[]): Record<string, number> {
  const stageMs: Record<string, number> = {}
  for (const mark of marks) stageMs[mark.label] = mark.deltaMs
  return stageMs
}

function buildDeviceSummary(samples: PackInstallPerfDeviceSample[]): PackInstallPerfReport['deviceSummary'] {
  if (samples.length === 0) return undefined
  return {
    sampleCount: samples.length,
    cpuUsagePercent: summarizeNumeric(samples.map((sample) => sample.cpuUsagePercent)),
    appUsedMB: summarizeNumeric(samples.map((sample) => sample.appUsedMB)),
    memUsedPercent: summarizeNumeric(samples.map((sample) => sample.memUsedPercent)),
    thermalStates: [...new Set(samples.map((sample) => sample.thermalState).filter(Boolean) as string[])],
    sawLowMemory: samples.some((sample) => sample.lowMemory),
    pressures: [...new Set(samples.map((sample) => sample.pressure).filter(Boolean) as string[])],
  }
}

function printReport(report: PackInstallPerfReport) {
  const lines = [
    `${PACK_INSTALL_PERF_PREFIX} ========== REPORT START ==========`,
    `${PACK_INSTALL_PERF_PREFIX} kind=${report.kind} packId=${report.packId}`,
    `${PACK_INSTALL_PERF_PREFIX} platform=${report.platform} native=${report.isNative}`,
    `${PACK_INSTALL_PERF_PREFIX} ok=${report.ok} total=${report.totalSec}s (${report.totalMs}ms)`,
    `${PACK_INSTALL_PERF_PREFIX} started=${report.startedAt}`,
    `${PACK_INSTALL_PERF_PREFIX} finished=${report.finishedAt}`,
  ]
  if (report.errorMessage) lines.push(`${PACK_INSTALL_PERF_PREFIX} error=${report.errorMessage}`)

  lines.push(`${PACK_INSTALL_PERF_PREFIX} --- stages (ms) ---`)
  for (const mark of report.marks) {
    const extra = mark.extra ? ` ${JSON.stringify(mark.extra)}` : ''
    lines.push(`${PACK_INSTALL_PERF_PREFIX}   ${mark.label}: +${mark.deltaMs}ms (Σ${mark.sinceStartMs}ms)${extra}`)
  }

  if (report.deviceSummary) {
    const d = report.deviceSummary
    lines.push(`${PACK_INSTALL_PERF_PREFIX} --- device samples ---`)
    lines.push(`${PACK_INSTALL_PERF_PREFIX}   count=${d.sampleCount}`)
    if (d.cpuUsagePercent) {
      lines.push(`${PACK_INSTALL_PERF_PREFIX}   cpu%= min ${d.cpuUsagePercent.min} / avg ${d.cpuUsagePercent.avg} / max ${d.cpuUsagePercent.max}`)
    }
    if (d.appUsedMB) {
      lines.push(`${PACK_INSTALL_PERF_PREFIX}   appMB= min ${d.appUsedMB.min} / avg ${d.appUsedMB.avg} / max ${d.appUsedMB.max}`)
    }
    if (d.memUsedPercent) {
      lines.push(`${PACK_INSTALL_PERF_PREFIX}   sysMem%= min ${d.memUsedPercent.min} / avg ${d.memUsedPercent.avg} / max ${d.memUsedPercent.max}`)
    }
    if (d.thermalStates.length) lines.push(`${PACK_INSTALL_PERF_PREFIX}   thermal=${d.thermalStates.join(',')}`)
    if (d.pressures.length) lines.push(`${PACK_INSTALL_PERF_PREFIX}   pressure=${d.pressures.join(',')}`)
    lines.push(`${PACK_INSTALL_PERF_PREFIX}   lowMemory=${d.sawLowMemory}`)
  }

  if (Object.keys(report.extras).length > 0) {
    lines.push(`${PACK_INSTALL_PERF_PREFIX} --- extras ---`)
    lines.push(`${PACK_INSTALL_PERF_PREFIX}   ${JSON.stringify(report.extras)}`)
  }

  lines.push(`${PACK_INSTALL_PERF_PREFIX} --- JSON (copy this block to share) ---`)
  lines.push(`${PACK_INSTALL_PERF_PREFIX} ${JSON.stringify(report)}`)
  lines.push(`${PACK_INSTALL_PERF_PREFIX} ========== REPORT END ==========`)

  // Single string so Safari console copy is one shot; every line has the filter token.
  console.log(lines.join('\n'))
}

export class PackInstallPerfSession {
  readonly enabled: boolean
  readonly kind: PackInstallPerfKind
  readonly packId: string
  private readonly t0: number
  private readonly startedAt: string
  private lastMarkAt: number
  private readonly marks: PackInstallPerfMark[] = []
  private readonly deviceSamples: PackInstallPerfDeviceSample[] = []
  private extras: Record<string, unknown> = {}
  private listener: PluginListenerHandle | null = null
  private monitoring = false
  private finished = false

  private constructor(kind: PackInstallPerfKind, packId: string, enabled: boolean) {
    this.kind = kind
    this.packId = packId
    this.enabled = enabled
    this.t0 = performance.now()
    this.lastMarkAt = this.t0
    this.startedAt = new Date().toISOString()
  }

  static async begin(kind: PackInstallPerfKind, packId: string): Promise<PackInstallPerfSession> {
    const session = new PackInstallPerfSession(kind, packId, isEnabled())
    if (!session.enabled) return session

    session.mark('session_start', {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
    })

    if (Capacitor.isNativePlatform()) {
      try {
        session.listener = await DeviceInfo.addListener('deviceInfoUpdate', (sample) => {
          if (session.finished) return
          session.deviceSamples.push(toDeviceSample(sample, performance.now() - session.t0))
        })
        await DeviceInfo.startMonitoring({
          intervalMs: MONITOR_INTERVAL_MS,
          emitImmediately: true,
        })
        session.monitoring = true
      } catch (error) {
        perfLog('DeviceInfo monitoring unavailable', error)
      }

      const memUsedMB = await readCapacitorDeviceMemUsedMB()
      if (typeof memUsedMB === 'number') {
        session.deviceSamples.push({
          atMs: 0,
          label: 'capacitor_device_memUsed',
          deviceMemUsedMB: memUsedMB,
          appUsedMB: memUsedMB,
        })
      }

      try {
        const snap = await DeviceInfo.getInfo()
        session.deviceSamples.push(toDeviceSample(snap, 0, 'start_snapshot'))
      } catch {
        // Already warned if monitoring failed.
      }
    }

    return session
  }

  mark(label: string, extra?: Record<string, unknown>) {
    if (!this.enabled || this.finished) return
    const now = performance.now()
    const row: PackInstallPerfMark = {
      label,
      atMs: Math.round(now),
      sinceStartMs: Math.round(now - this.t0),
      deltaMs: Math.round(now - this.lastMarkAt),
      extra,
    }
    this.marks.push(row)
    this.lastMarkAt = now
    perfLog(`${label} +${row.deltaMs}ms (Σ${row.sinceStartMs}ms)`, extra ?? undefined)
  }

  /** Time an async SQLite / IO section and record its duration. */
  async measure<T>(label: string, work: () => Promise<T>, extra?: Record<string, unknown>): Promise<T> {
    if (!this.enabled || this.finished) return work()
    const started = performance.now()
    try {
      const result = await work()
      this.mark(label, {
        ...extra,
        elapsedMs: Math.round(performance.now() - started),
      })
      return result
    } catch (error) {
      this.mark(`${label}:error`, {
        ...extra,
        elapsedMs: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  setExtra(key: string, value: unknown) {
    if (!this.enabled) return
    this.extras[key] = value
  }

  mergeExtras(extra: Record<string, unknown>) {
    if (!this.enabled) return
    Object.assign(this.extras, extra)
  }

  async finish(ok: boolean, error?: unknown): Promise<PackInstallPerfReport | null> {
    if (!this.enabled) return null
    if (this.finished) return null
    this.finished = true

    if (Capacitor.isNativePlatform()) {
      try {
        const snap = await DeviceInfo.getInfo()
        this.deviceSamples.push(toDeviceSample(snap, performance.now() - this.t0, 'end_snapshot'))
      } catch {
        // ignore
      }
      const memUsedMB = await readCapacitorDeviceMemUsedMB()
      if (typeof memUsedMB === 'number') {
        this.deviceSamples.push({
          atMs: Math.round(performance.now() - this.t0),
          label: 'capacitor_device_memUsed_end',
          deviceMemUsedMB: memUsedMB,
          appUsedMB: memUsedMB,
        })
      }
    }

    await this.stopMonitoring()

    const totalMs = Math.round(performance.now() - this.t0)
    const report: PackInstallPerfReport = {
      version: 1,
      kind: this.kind,
      packId: this.packId,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      totalMs,
      totalSec: Math.round((totalMs / 1000) * 10) / 10,
      ok,
      errorMessage: error
        ? (error instanceof Error ? error.message : String(error))
        : undefined,
      marks: this.marks,
      stageMs: buildStageMs(this.marks),
      deviceSamples: this.deviceSamples,
      deviceSummary: buildDeviceSummary(this.deviceSamples),
      extras: this.extras,
    }

    try {
      ;(window as any).__MANYU_PACK_INSTALL_PERF__ = report
      window.localStorage.setItem(LAST_REPORT_KEY, JSON.stringify(report))
    } catch {
      // Diagnostics must never break install.
    }

    printReport(report)
    return report
  }

  private async stopMonitoring() {
    if (!this.monitoring) {
      await this.listener?.remove().catch(() => undefined)
      this.listener = null
      return
    }
    try {
      await DeviceInfo.stopMonitoring()
    } catch {
      // ignore
    }
    try {
      await this.listener?.remove()
    } catch {
      // ignore
    }
    this.listener = null
    this.monitoring = false
  }
}

export function getLastPackInstallPerfReport(): PackInstallPerfReport | null {
  try {
    const fromWindow = (window as any).__MANYU_PACK_INSTALL_PERF__
    if (fromWindow?.version === 1) return fromWindow as PackInstallPerfReport
    const raw = window.localStorage.getItem(LAST_REPORT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PackInstallPerfReport
  } catch {
    return null
  }
}
