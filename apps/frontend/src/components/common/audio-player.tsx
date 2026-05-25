import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  FastForward, Rewind, RepeatIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { AudioWaveform, type AudioWaveformHandle } from './audio-waveform'
import type { TtsWordTimestamp } from '@/lib/tts-api'

// -------- 常量 --------
const NS = 1_000_000_000
const SENTENCE_END_RE = /[.!?。！？；;:]$/
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5]
const LONG_PRESS_MS = 450
const SENTENCE_LOOP_GAP_MS = 2000
const LOOP_EPSILON_NS = 80_000_000

// -------- 工具函数 --------
function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) return '00:00'
  const w = Math.floor(s)
  return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`
}

function normalizeWords(words?: TtsWordTimestamp[] | null) {
  if (!words?.length) return []
  return [...words]
    .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0))
    .map((w) => ({ ...w, start_time: Math.max(0, w.start_time ?? 0) }))
}

function findActiveWord(words: TtsWordTimestamp[], currentTime: number) {
  if (!words.length) return -1
  const ns = Math.floor(currentTime * NS)
  let lo = 0, hi = words.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (words[mid].start_time <= ns) { ans = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return ans
}

function buildSentenceStarts(words: TtsWordTimestamp[]) {
  if (!words.length) return []
  const s = [0]
  for (let i = 0; i < words.length - 1; i++) {
    if (SENTENCE_END_RE.test(words[i].text)) s.push(i + 1)
  }
  return [...new Set(s)].sort((a, b) => a - b)
}

type Sentence = {
  index: number
  startWordIndex: number
  startTimeNs: number
  endTimeNs: number
  text: string
  words: TtsWordTimestamp[]
}

function buildSentences(words: TtsWordTimestamp[]): Sentence[] {
  if (!words.length) return []
  const starts = buildSentenceStarts(words)
  return starts.map((si, i) => {
    const endExclusive = starts[i + 1] ?? words.length
    const sw = words.slice(si, endExclusive)
    if (!sw.length) return null
    const endNs = words[endExclusive]?.start_time ?? sw[0].start_time + 2 * NS
    return {
      index: i, startWordIndex: si,
      startTimeNs: sw[0].start_time,
      endTimeNs: endNs,
      text: sw.map((w) => w.text).join(' '),
      words: sw,
    }
  }).filter(Boolean) as Sentence[]
}

function prependSpace(cur: string, prev?: string) {
  if (!prev) return false
  if (/^[,.;:!?%)}\]，。！？；：]/.test(cur)) return false
  if (/^[''](?:s|d|m|re|ve|ll|t)\b/i.test(cur)) return false
  if (/^['')）\]}]/.test(cur)) return false
  if (/^[(\[{"']$/.test(prev)) return false
  return true
}

function clean(t: string) {
  return t.replace(/^[^A-Za-z0-9\u00C0-\u024F']+|[^A-Za-z0-9\u00C0-\u024F']+$/g, '').trim()
}

// -------- 组件 Props --------
type AudioPlayerProps = {
  audioUrl: string
  wordTimestamps?: TtsWordTimestamp[] | null
  audioProvider?: string | null
  className?: string
  /** compact=true 时句子区默认折叠，适合嵌入卡片内使用 */
  compact?: boolean
}

export function AudioPlayer({
  audioUrl, wordTimestamps, audioProvider, className, compact = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveRef  = useRef<AudioWaveformHandle | null>(null)
  const loopTimerRef = useRef<number | null>(null)
  const loopPendingRef = useRef(false)
  const longPressRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const loopSegRef = useRef(0)
  const loopOnRef = useRef(false)
  const durRef = useRef(0)
  const seekFnRef = useRef<(t: number) => void>(() => {})

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showWords, setShowWords] = useState(true)
  const [loopOn, setLoopOn] = useState(false)
  const [loopSeg, setLoopSeg] = useState(0)
  const [sentencesOpen, setSentencesOpen] = useState(!compact)

  useEffect(() => { loopOnRef.current  = loopOn  }, [loopOn])
  useEffect(() => { loopSegRef.current = loopSeg }, [loopSeg])
  useEffect(() => { durRef.current = duration }, [duration])

  const words     = useMemo(() => normalizeWords(wordTimestamps), [wordTimestamps])
  const sentences = useMemo(() => buildSentences(words), [words])
  const sentStarts = useMemo(() => buildSentenceStarts(words), [words])
  const activeWord = useMemo(() => findActiveWord(words, currentTime), [words, currentTime])
  const activeSent = useMemo(() => {
    if (!sentences.length) return -1
    const ns = Math.floor(currentTime * NS)
    const idx = sentences.findIndex((s, i) =>
      ns >= s.startTimeNs && (ns < s.endTimeNs || i === sentences.length - 1))
    return idx
  }, [currentTime, sentences])

  const sentencesRef = useRef<Sentence[]>([])
  useEffect(() => { sentencesRef.current = sentences }, [sentences])

  // Seek helper
  const seekTo = (t: number) => {
    const el = audioRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(durRef.current || el.duration || 0, t))
    el.currentTime = clamped
    setCurrentTime(clamped)
    waveRef.current?.syncProgress(clamped)
    loopPendingRef.current = false
    if (loopTimerRef.current) { clearTimeout(loopTimerRef.current); loopTimerRef.current = null }
  }
  seekFnRef.current = seekTo

  // Reset on URL change
  useEffect(() => {
    setDuration(0); setCurrentTime(0); setIsPlaying(false)
    setLoopOn(false); setLoopSeg(0); loopPendingRef.current = false
    if (loopTimerRef.current) { clearTimeout(loopTimerRef.current); loopTimerRef.current = null }
    const el = audioRef.current
    if (el) { el.load() }
  }, [audioUrl])

  // Playback rate sync
  useEffect(() => {
    const el = audioRef.current
    if (el) el.playbackRate = playbackRate
  }, [playbackRate, audioUrl])

  // Loop off cleanup
  useEffect(() => {
    if (!loopOn) {
      loopPendingRef.current = false
      if (loopTimerRef.current) { clearTimeout(loopTimerRef.current); loopTimerRef.current = null }
    }
  }, [loopOn])

  // Auto-scroll active sentence
  const lyricRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!lyricRef.current || activeSent < 0) return
    const el = lyricRef.current.querySelector<HTMLElement>(`[data-si="${activeSent}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeSent])

  // Cleanup on unmount
  useEffect(() => () => {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current)
    if (longPressRef.current) clearTimeout(longPressRef.current)
  }, [])

  const togglePlay = async () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) await el.play()
    else { el.pause(); loopPendingRef.current = false }
  }

  const jumpBy = (d: number) => seekTo(currentTime + d)

  const jumpToSentence = (dir: 'prev' | 'next') => {
    if (!sentStarts.length) return
    const ci = activeWord >= 0 ? activeWord : findActiveWord(words, currentTime)
    if (dir === 'prev') {
      const prev = [...sentStarts].reverse().find((i) => i < Math.max(ci, 0))
      const ti = prev ?? 0
      seekTo((words[ti]?.start_time ?? 0) / NS)
      if (loopOn) {
        const si = sentences.findIndex((s) => ti >= s.startWordIndex && ti < s.startWordIndex + s.words.length)
        if (si >= 0) setLoopSeg(si)
      }
    } else {
      const next = sentStarts.find((i) => i > ci)
      if (next === undefined) return
      seekTo((words[next]?.start_time ?? 0) / NS)
      if (loopOn) {
        const si = sentences.findIndex((s) => next >= s.startWordIndex && next < s.startWordIndex + s.words.length)
        if (si >= 0) setLoopSeg(si)
      }
    }
  }

  const hasWords = words.length > 0

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {/* Lyrics + waveform + controls: flat, no card wrapping */}

      {/* Lyrics — collapsible section */}
      {sentencesOpen && (
        <div ref={lyricRef} className="px-1 py-2">
          {sentences.length ? (
            <div className="space-y-1">
              {sentences.map((s, idx) => (
                <div
                  key={`${s.startTimeNs}-${idx}`}
                  data-si={idx}
                  className={cn(
                    'rounded-lg px-2 py-1 text-sm leading-6 transition-all cursor-pointer',
                    idx === activeSent
                      ? 'bg-primary/8 font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground/80',
                    loopOn && loopSeg === idx && 'ring-1 ring-inset ring-primary/50',
                  )}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => {
                      seekTo(s.startTimeNs / NS)
                      if (loopOn) setLoopSeg(idx)
                    }}
                  >
                    {showWords ? (
                      <span className="whitespace-normal">
                        {s.words.map((w, wi) => {
                          const gi = s.startWordIndex + wi
                          const isActive = gi === activeWord
                          const sp = prependSpace(w.text, s.words[wi - 1]?.text)
                          return (
                            <span
                              key={`${w.start_time}-${wi}`}
                              className={cn(
                                'rounded px-0.5 transition-colors',
                                isActive && 'bg-yellow-300 text-black dark:bg-yellow-400',
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                seekTo(w.start_time / NS)
                              }}
                              onPointerDown={() => {
                                if (longPressRef.current) clearTimeout(longPressRef.current)
                                longPressRef.current = window.setTimeout(() => {
                                  seekTo(w.start_time / NS)
                                }, LONG_PRESS_MS)
                              }}
                              onPointerUp={() => {
                                if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
                              }}
                              onPointerLeave={() => {
                                if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
                              }}
                            >
                              {sp ? ` ${w.text}` : w.text}
                            </span>
                          )
                        })}
                      </span>
                    ) : (
                      <span>{s.text}</span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-xs text-muted-foreground">
              {audioProvider === 'minimax'
                ? 'MiniMax 暂不支持词级时间戳'
                : '该音频暂无词级时间戳'}
            </div>
          )}
        </div>
      )}

      {/* Options row */}
      {hasWords && (
        <div className="flex flex-wrap gap-4 border-t border-border/40 px-1 py-1.5 text-xs text-muted-foreground">
          {sentences.length > 0 && (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={() => setSentencesOpen((v) => !v)}
            >
              <RepeatIcon className="size-3" />
              {sentencesOpen ? '收起歌词' : '展开歌词'}
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" className="accent-primary" checked={showWords}
              onChange={(e) => setShowWords(e.target.checked)} />
            逐词高亮
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" className="accent-primary" checked={loopOn}
              onChange={(e) => {
                const on = e.target.checked
                setLoopOn(on)
                if (on && sentences.length > 0)
                  setLoopSeg(Math.max(0, Math.min(activeSent, sentences.length - 1)))
              }} />
            <RepeatIcon className="size-3" />
            单句循环
          </label>
        </div>
      )}

        {/* Time row */}
        <div className="flex justify-between px-1 pt-1 text-[11px] tabular-nums text-muted-foreground">
          <span>{fmt(currentTime)}</span>
          <span>{duration > 0 ? fmt(duration) : '--:--'}</span>
        </div>

        {/* Waveform */}
        <div className="py-1">
          <AudioWaveform
            ref={waveRef}
            audioUrl={audioUrl}
            durationSeconds={duration}
            onSeek={(t) => seekTo(t)}
            onReady={(d) => setDuration((p) => p > 0 ? p : d)}
          />
        </div>

        {/* Scrubber */}
        <input
          type="range"
          className="h-1 w-full cursor-pointer accent-primary"
          min={0} max={duration || 0} step={0.05}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => seekTo(Number(e.target.value))}
        />

        {/* Controls */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => jumpBy(-10)}>
            <Rewind className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasWords}
            onClick={() => jumpToSentence('prev')}>
            <SkipBack className="size-3.5" />
          </Button>
          <Button size="icon" className="h-9 w-9 rounded-full shadow-sm"
            onClick={() => void togglePlay()}>
            {isPlaying
              ? <Pause className="size-4" />
              : <Play className="size-4 translate-x-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasWords}
            onClick={() => jumpToSentence('next')}>
            <SkipForward className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => jumpBy(10)}>
            <FastForward className="size-3.5" />
          </Button>

          {/* Speed inline */}
          <div className="ml-auto flex items-center gap-1">
            {PLAYBACK_RATES.map((r) => (
              <button key={r} type="button"
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] transition-colors',
                  playbackRate === r
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                onClick={() => setPlaybackRate(r)}>
                {r}x
              </button>
            ))}
          </div>
        </div>

      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onPlay={() => { setIsPlaying(true); isPlayingRef.current = true }}
        onPause={() => { setIsPlaying(false); isPlayingRef.current = false }}
        onEnded={() => {
          setIsPlaying(false); isPlayingRef.current = false
          setCurrentTime(0); waveRef.current?.syncProgress(0)
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          if (Number.isFinite(el.duration)) setDuration(el.duration)
          el.playbackRate = playbackRate
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime
          setCurrentTime(t)
          waveRef.current?.syncProgress(t)

          const segs = sentencesRef.current
          if (!loopOnRef.current || !segs.length) return
          if (!isPlayingRef.current || loopPendingRef.current) return
          const seg = segs[loopSegRef.current]
          if (!seg) return
          const tNs = Math.floor(t * NS)
          const dur = durRef.current
          const effEnd = Math.min(seg.endTimeNs, dur > 0 ? Math.floor(dur * NS) : seg.endTimeNs)
          if (tNs < effEnd - LOOP_EPSILON_NS) return

          loopPendingRef.current = true
          e.currentTarget.pause()
          if (loopTimerRef.current) clearTimeout(loopTimerRef.current)
          const startSec = seg.startTimeNs / NS
          loopTimerRef.current = window.setTimeout(() => {
            loopTimerRef.current = null
            seekFnRef.current(startSec)
            void audioRef.current?.play().finally(() => { loopPendingRef.current = false })
          }, SENTENCE_LOOP_GAP_MS)
        }}
        className="hidden"
      />
    </div>
  )
}
