import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { PracticeSession, TopicDetail } from '@/features/practice/api/english-practice-api'
import {
  characterMatchesSpeaker,
  compilePracticeInk,
  parseVnTags,
} from '@/features/practice/lib/practice-session-utils'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { useVnTagVisuals } from '@/features/vn-engine/use-vn-tag-visuals'
import { VnPlayer, type VnPlayerHandle, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { isPlayableMediaUrl } from '@/features/vn-engine/vn-media-url'
import { resolveUserRecordingPlaybackUrl } from '@/features/vn-engine/user-recording-url'
import type { InstalledAssetMap } from '@/lib/offline/installed-pack-media'
import { practiceRepository } from '@/lib/offline'

type ReplayLine = VnPlayerLine & {
  tags?: string[]
  turn?: NonNullable<PracticeSession['turns']>[number]
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return normalizeTags(parsed)
    } catch {
      return [raw.trim()]
    }
  }
  return []
}

/**
 * Learning-pack dialogue practice replay.
 * Re-drives Ink for NPC tags (TTS + #bg) like ScriptRecordVnReplay, and maps
 * stored turn.userAudioUrl onto user lines.
 */
export function PracticeDialogueVnReplay({
  session,
  topicDetail,
  packageId,
  vnPlayerRef,
  endedActions,
  renderTurnFeedback,
  renderTurnFeedbackChat,
}: {
  session: PracticeSession
  topicDetail: TopicDetail | null
  packageId: string
  vnPlayerRef?: RefObject<VnPlayerHandle | null>
  endedActions?: ReactNode
  renderTurnFeedback?: (turn: NonNullable<PracticeSession['turns']>[number]) => ReactNode
  renderTurnFeedbackChat?: (turn: NonNullable<PracticeSession['turns']>[number]) => ReactNode
}) {
  const { t } = useTranslation()
  const [inkJson, setInkJson] = useState<Record<string, any> | null>(null)
  const [rawAssetMap, setRawAssetMap] = useState<InstalledAssetMap | null>(null)
  const [prepReady, setPrepReady] = useState(false)
  const [prepFailed, setPrepFailed] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [combined, setCombined] = useState<ReplayLine[]>([])
  const [replayReady, setReplayReady] = useState(false)
  const userAnswerCursor = useRef(0)
  const syncedInkCountRef = useRef(0)
  const sequenceRef = useRef<ReplayLine[]>([])
  const drivingRef = useRef(false)

  const turns = session.turns ?? []
  const userAnswers = useMemo(() => turns.map((turn) => turn.userText), [turns])

  useEffect(() => {
    let cancelled = false
    setInkJson(null)
    setRawAssetMap(null)
    setPrepReady(false)
    setPrepFailed(false)
    setLineIndex(0)
    setCombined([])
    setReplayReady(false)
    userAnswerCursor.current = 0
    syncedInkCountRef.current = 0
    sequenceRef.current = []

    void (async () => {
      try {
        const topicId = session.topicId
        const inkRecord = topicDetail?.inkScript
          ?? (topicDetail?.topic.inkScriptId && topicId
            ? await practiceRepository.getTopicInk(topicId)
            : null)
        if (cancelled) return

        const compiled = compilePracticeInk(
          (inkRecord as { inkSource?: string | null } | null)?.inkSource ?? topicDetail?.inkScript?.inkSource,
          (inkRecord as { inkJson?: any } | null)?.inkJson ?? topicDetail?.inkScript?.inkJson,
        )
        setInkJson(compiled)
        setRawAssetMap(
          (inkRecord as { assetMap?: InstalledAssetMap | null } | null)?.assetMap
            ?? (topicDetail?.inkScript as { assetMap?: InstalledAssetMap | null } | undefined)?.assetMap
            ?? null,
        )
        setPrepReady(true)
      } catch (error) {
        console.warn('[practice-dialogue-replay] ink prepare failed', error)
        if (!cancelled) {
          setInkJson(null)
          setRawAssetMap(null)
          setPrepFailed(true)
          setPrepReady(true)
        }
      }
    })()

    return () => { cancelled = true }
  }, [session.topicId, topicDetail])

  const {
    lines: storyLines,
    choices: storyChoices,
    isEnded: storyEnded,
    isWaiting: storyWaiting,
    advanceStory,
    handleChoice,
    resumeAfterInput,
  } = useInkStory(inkJson)

  const { mediaReady, assetMap: resolvedAssetMap, scene: resolvedScene } = useInstalledVnMedia({
    packageId,
    revision: `${session.topicId}:${packageId}:${prepReady ? '1' : '0'}`,
    rawAssetMap,
    rawScene: topicDetail?.scene,
  })
  const activeScene = (resolvedScene as TopicDetail['scene'] | null) ?? topicDetail?.scene

  const appendInkLines = () => {
    if (storyLines.length <= syncedInkCountRef.current) return
    const next = storyLines.slice(syncedInkCountRef.current).map((line) => {
      const parsed = parseVnTags(line.tags, resolvedAssetMap)
      return {
        speaker: line.speaker,
        text: line.text,
        translation: parsed.translation,
        audioUrl: isPlayableMediaUrl(parsed.audio) ? parsed.audio : undefined,
        tags: line.tags,
      } satisfies ReplayLine
    })
    sequenceRef.current = [...sequenceRef.current, ...next]
    syncedInkCountRef.current = storyLines.length
  }

  const finishReplay = () => {
    appendInkLines()
    setCombined(sequenceRef.current)
    setReplayReady(true)
  }

  // Drive Ink chronologically: flush NPC lines as they appear, insert user turns at waits.
  useEffect(() => {
    if (!prepReady || !mediaReady || replayReady || drivingRef.current) return

    if (!inkJson) {
      const fallbackSpeaker = activeScene?.title || 'NPC'
      setCombined(turns.flatMap((turn) => {
        const tags = normalizeTags(turn.tags)
        const parsed = parseVnTags(tags, resolvedAssetMap)
        return [
          {
            speaker: parsed.speaker || fallbackSpeaker,
            text: turn.npcText,
            translation: parsed.translation,
            audioUrl: isPlayableMediaUrl(parsed.audio) ? parsed.audio : undefined,
            tags,
          },
          {
            speaker: t('learning.speakerMe'),
            text: turn.userText,
            isUser: true,
            audioUrl: resolveUserRecordingPlaybackUrl(turn.userAudioUrl),
            turn,
          },
        ]
      }))
      setReplayReady(true)
      return
    }

    if (storyEnded) {
      finishReplay()
      return
    }

    drivingRef.current = true
    try {
      appendInkLines()

      if (storyWaiting) {
        const answer = userAnswers[userAnswerCursor.current]
        const turn = turns[userAnswerCursor.current]
        if (answer === undefined) {
          drivingRef.current = false
          finishReplay()
          return
        }
        userAnswerCursor.current += 1
        sequenceRef.current = [
          ...sequenceRef.current,
          {
            speaker: t('learning.speakerMe'),
            text: answer,
            isUser: true,
            audioUrl: resolveUserRecordingPlaybackUrl(turn?.userAudioUrl),
            turn,
          },
        ]
        resumeAfterInput(answer)
        queueMicrotask(() => {
          advanceStory()
          drivingRef.current = false
        })
        return
      }

      if (storyChoices.length > 0) {
        const answer = userAnswers[userAnswerCursor.current]
        const turn = turns[userAnswerCursor.current]
        const matched = answer
          ? storyChoices.findIndex((choice) => choice.text.trim() === answer.trim())
          : -1
        if (answer !== undefined) {
          userAnswerCursor.current += 1
          sequenceRef.current = [
            ...sequenceRef.current,
            {
              speaker: t('learning.speakerMe'),
              text: answer,
              isUser: true,
              audioUrl: resolveUserRecordingPlaybackUrl(turn?.userAudioUrl),
              turn,
            },
          ]
        }
        handleChoice(matched >= 0 ? matched : 0)
        drivingRef.current = false
        return
      }

      advanceStory()
      drivingRef.current = false
    } catch (error) {
      console.error('[practice-dialogue-replay] ink drive failed', error)
      drivingRef.current = false
      finishReplay()
    }
  }, [
    activeScene?.title,
    advanceStory,
    handleChoice,
    inkJson,
    mediaReady,
    prepReady,
    replayReady,
    resolvedAssetMap,
    resumeAfterInput,
    storyChoices,
    storyEnded,
    storyLines,
    storyWaiting,
    t,
    turns,
    userAnswers,
  ])

  const activeTags = useMemo(() => {
    if (!replayReady || combined.length === 0) return [] as string[]
    const cursor = Math.min(lineIndex, combined.length - 1)
    for (let i = cursor; i >= 0; i--) {
      const line = combined[i]
      if (!line.isUser && line.tags?.length) return line.tags
    }
    // Fallback: waiting-state tags stored on the turn (may include bg).
    for (let i = cursor; i >= 0; i--) {
      const tags = normalizeTags(combined[i]?.turn?.tags)
      if (tags.length) return tags
    }
    return []
  }, [combined, lineIndex, replayReady])

  const vnVisual = useVnTagVisuals({
    currentTags: activeTags,
    mediaReady: prepReady && mediaReady && replayReady,
    assetMap: resolvedAssetMap,
    sceneBackgroundUrl: activeScene?.backgroundUrl,
    isWaiting: false,
    initialBackgroundUrl: activeScene?.backgroundUrl,
  })

  const characters = useMemo(
    () => activeScene?.characters ?? [],
    [activeScene],
  )
  const currentLine = useMemo(() => {
    if (!replayReady) return null
    if (lineIndex >= combined.length) return null
    return combined[lineIndex] ?? null
  }, [combined, lineIndex, replayReady])
  const currentCharacter = useMemo(() => {
    const speaker = vnVisual.speaker
      || (currentLine?.speaker && !currentLine.isUser ? currentLine.speaker : undefined)
    return characters.find((character) => characterMatchesSpeaker(character as any, speaker))
      || (characters.length === 1 ? characters[0] : undefined)
  }, [characters, currentLine, vnVisual.speaker])

  const expressionMap = useMemo(() => {
    if (!currentCharacter?.expressions || typeof currentCharacter.expressions !== 'object') return {}
    return currentCharacter.expressions as Record<string, string | { spriteUrl?: string; avatarUrl?: string }>
  }, [currentCharacter?.expressions])
  const currentState = vnVisual.expression ? expressionMap[vnVisual.expression] : expressionMap.default
  const stateSpriteUrl = typeof currentState === 'string' ? currentState : currentState?.spriteUrl
  const stateAvatarUrl = typeof currentState === 'object' ? currentState?.avatarUrl : undefined
  const currentSpriteUrl = currentCharacter
    ? stateSpriteUrl || currentCharacter.spriteBaseUrl || undefined
    : undefined
  const currentAvatarUrl = currentLine?.isUser
    ? undefined
    : stateAvatarUrl || currentCharacter?.avatarUrl || undefined
  const spritePosition = (vnVisual.position || currentCharacter?.defaultPosition || 'center') as 'left' | 'center' | 'right'

  const isEnded = replayReady && combined.length > 0 && lineIndex >= combined.length
  const history = combined.slice(0, Math.min(lineIndex, combined.length))
  const feedbackTurn = currentLine?.turn

  if (prepFailed && !topicDetail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{t('profile.reviewLoadFailed')}</p>
      </div>
    )
  }

  if (!prepReady || !mediaReady || !replayReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm">{t('common.loading')}</p>
      </div>
    )
  }

  if (combined.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{t('profile.reviewNoReplay')}</p>
      </div>
    )
  }

  return (
    <VnPlayer
      ref={vnPlayerRef}
      className="h-full max-w-none rounded-none border-none"
      stageClassName="min-h-0"
      showUserInputOverride
      hideChatTopBar
      offlineOnly={Boolean(packageId)}
      backgroundUrl={vnVisual.backgroundUrl}
      backgroundFit={vnVisual.backgroundFit}
      currentLine={isEnded ? null : currentLine}
      history={history}
      currentSpriteUrl={currentSpriteUrl}
      spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
      spritePosition={spritePosition}
      currentAvatarUrl={currentAvatarUrl}
      currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
      isEnded={isEnded}
      onAdvance={() => setLineIndex((current) => Math.min(current + 1, combined.length))}
      inputFeedback={feedbackTurn && renderTurnFeedback ? renderTurnFeedback(feedbackTurn) : null}
      inputFeedbackChat={feedbackTurn && renderTurnFeedbackChat ? renderTurnFeedbackChat(feedbackTurn) : null}
      showHistoryButton={false}
      endedActions={endedActions}
    />
  )
}
