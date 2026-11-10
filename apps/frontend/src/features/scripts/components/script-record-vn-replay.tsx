import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  characterMatchesSpeaker,
  parseVnTags,
} from '@/features/practice/lib/practice-session-utils'
import { type ScriptPracticeRecord } from '@/features/scripts/api/script-community-api'
import {
  prepareStoryVnEntry,
  type PreparedStoryVnEntry,
} from '@/features/vn-engine/prepare-story-vn-entry'
import { useInkStory } from '@/features/vn-engine/use-ink-story'
import { useInstalledVnMedia } from '@/features/vn-engine/use-installed-vn-media'
import { useVnTagVisuals } from '@/features/vn-engine/use-vn-tag-visuals'
import { VnPlayer, type VnPlayerLine } from '@/features/vn-engine/vn-player'
import { isPlayableMediaUrl } from '@/features/vn-engine/vn-media-url'
import { resolveUserRecordingPlaybackUrl } from '@/features/vn-engine/user-recording-url'

type ReplayLine = VnPlayerLine & { tags?: string[] }

/**
 * Practice-record VN replay.
 * Reuses the live theatre entry path (prepareStoryVnEntry → installed media →
 * Ink drive → useVnTagVisuals → character sprites). User text/answers come from
 * the saved snapshot; NPC tags/media are recovered by re-driving Ink. User
 * recordings are remapped from resultSnapshot.recordingAssets onto audioUrl.
 */
export function ScriptRecordVnReplay({
  record,
  onClose,
}: {
  record: ScriptPracticeRecord
  onClose: () => void
}) {
  const { t } = useTranslation()
  const packageId = record.episode.scene.id
  const episodeId = record.episodeId
  const [prepared, setPrepared] = useState<PreparedStoryVnEntry | null>(null)
  const [prepFailed, setPrepFailed] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [userTurns, setUserTurns] = useState<VnPlayerLine[]>([])
  const [replayReady, setReplayReady] = useState(false)
  const userAnswerCursor = useRef(0)
  const drivingRef = useRef(false)

  const userAnswers = useMemo(
    () => (record.resultSnapshot?.dialogue ?? []).filter((line) => line.isUser).map((line) => line.text),
    [record.resultSnapshot?.dialogue],
  )

  useEffect(() => {
    let alive = true
    setPrepared(null)
    setPrepFailed(false)
    setLineIndex(0)
    setUserTurns([])
    setReplayReady(false)
    userAnswerCursor.current = 0
    void prepareStoryVnEntry({ packageId, episodeId })
      .then((entry) => {
        if (alive) setPrepared(entry)
      })
      .catch((error) => {
        console.error('[vn-record] prepareStoryVnEntry failed', { packageId, episodeId, error })
        if (alive) setPrepFailed(true)
      })
    return () => { alive = false }
  }, [packageId, episodeId, record.id])

  const story = useInkStory(prepared?.data.inkScript.inkJson ?? null)
  const {
    lines: storyLines,
    choices: storyChoices,
    isEnded: storyEnded,
    isWaiting: storyWaiting,
    advanceStory,
    handleChoice,
    resumeAfterInput,
  } = story
  const { mediaReady, assetMap: resolvedAssetMap, scene: resolvedScene } = useInstalledVnMedia({
    packageId: prepared?.packageId ?? packageId,
    revision: episodeId,
    rawAssetMap: prepared?.data.inkScript.assetMap,
    rawScene: prepared?.data.scene,
    preparedAssetMap: prepared?.assetMap,
    preparedScene: prepared?.scene,
  })

  // Drive Ink to completion with the recorded answers ? same continue/input
  // contract as the live ScriptPlayer, just automated for reconstruction.
  useEffect(() => {
    if (!prepared || !mediaReady || replayReady || drivingRef.current) return
    if (storyEnded) {
      setReplayReady(true)
      return
    }

    drivingRef.current = true
    try {
      if (storyWaiting) {
        const answer = userAnswers[userAnswerCursor.current]
        if (answer === undefined) {
          drivingRef.current = false
          setReplayReady(true)
          return
        }
        userAnswerCursor.current += 1
        setUserTurns((current) => [
          ...current,
          { speaker: t('learning.speakerMe'), text: answer, isUser: true },
        ])
        resumeAfterInput(answer)
        queueMicrotask(() => {
          advanceStory()
          drivingRef.current = false
        })
        return
      }

      if (storyChoices.length > 0) {
        const answer = userAnswers[userAnswerCursor.current]
        const matched = answer
          ? storyChoices.findIndex((choice) => choice.text.trim() === answer.trim())
          : -1
        if (answer !== undefined) {
          userAnswerCursor.current += 1
          setUserTurns((current) => [
            ...current,
            { speaker: t('learning.speakerMe'), text: answer, isUser: true },
          ])
        }
        handleChoice(matched >= 0 ? matched : 0)
        drivingRef.current = false
        return
      }

      advanceStory()
      drivingRef.current = false
    } catch (error) {
      console.error('[vn-record] ink replay drive failed', error)
      drivingRef.current = false
      setReplayReady(true)
    }
  }, [
    advanceStory,
    handleChoice,
    mediaReady,
    prepared,
    replayReady,
    resumeAfterInput,
    storyChoices,
    storyEnded,
    storyLines.length,
    storyWaiting,
    t,
    userAnswers,
  ])

  const inkLines = useMemo<ReplayLine[]>(
    () => storyLines.map((line) => {
      const parsed = parseVnTags(line.tags, mediaReady ? resolvedAssetMap : undefined)
      return {
        speaker: line.speaker,
        text: line.text,
        translation: parsed.translation,
        audioUrl: isPlayableMediaUrl(parsed.audio) ? parsed.audio : undefined,
        tags: line.tags,
      }
    }),
    [mediaReady, resolvedAssetMap, storyLines],
  )

  const combined = useMemo<ReplayLine[]>(() => {
    // Prefer the saved dialogue order for user text, but keep Ink tags on NPC
    // turns so stage media matches the live theatre.
    const saved = record.resultSnapshot?.dialogue ?? []
    const recordingAssets = record.resultSnapshot?.recordingAssets ?? {}
    const userRecordingUrl = (line: { recordingFrameIndex?: number }, index: number) => {
      const assetId = recordingAssets[String(line.recordingFrameIndex ?? index)]
      return resolveUserRecordingPlaybackUrl(assetId)
    }
    if (saved.length === 0) {
      const result: ReplayLine[] = []
      const maxLen = Math.max(inkLines.length, userTurns.length)
      for (let i = 0; i < maxLen; i++) {
        if (i < inkLines.length) result.push(inkLines[i])
        if (i < userTurns.length) {
          const turn = userTurns[i]
          result.push({
            ...turn,
            audioUrl: turn.audioUrl || userRecordingUrl({}, result.length),
          })
        }
      }
      return result
    }

    let inkCursor = 0
    return saved.map((line, index) => {
      if (line.isUser) {
        return {
          speaker: line.speaker || t('learning.speakerMe'),
          text: line.text,
          isUser: true,
          audioUrl: userRecordingUrl(line, index),
        }
      }
      const inkLine = inkLines[inkCursor]
      inkCursor += 1
      if (!inkLine) {
        return { speaker: line.speaker, text: line.text }
      }
      return {
        ...inkLine,
        speaker: line.speaker || inkLine.speaker,
        text: line.text || inkLine.text,
      }
    })
  }, [inkLines, record.resultSnapshot?.dialogue, record.resultSnapshot?.recordingAssets, t, userTurns])

  const activeTags = useMemo(() => {
    if (!replayReady || combined.length === 0) return [] as string[]
    const cursor = Math.min(lineIndex, combined.length - 1)
    for (let i = cursor; i >= 0; i--) {
      const line = combined[i]
      if (!line.isUser && line.tags?.length) return line.tags
    }
    return []
  }, [combined, lineIndex, replayReady])

  const vnVisual = useVnTagVisuals({
    currentTags: activeTags,
    mediaReady: Boolean(prepared) && mediaReady && replayReady,
    assetMap: resolvedAssetMap,
    sceneBackgroundUrl: (resolvedScene as { backgroundUrl?: string | null } | null)?.backgroundUrl
      ?? prepared?.backgroundUrl,
    isWaiting: false,
    initialBackgroundUrl: prepared?.backgroundUrl,
  })

  const characters = useMemo(
    () => (resolvedScene as { characters?: any[] } | null)?.characters ?? [],
    [resolvedScene],
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
  const stateSpriteUrl = typeof currentState === 'string' ? currentState : (currentState as any)?.spriteUrl
  const stateAvatarUrl = typeof currentState === 'object' ? (currentState as any)?.avatarUrl : undefined
  // Match live theatre: pass resolved identities through to VnPlayer offlineOnly
  // cache resolution instead of pre-stripping with isPlayableMediaUrl.
  const currentSpriteUrl = currentCharacter
    ? stateSpriteUrl || currentCharacter.spriteBaseUrl || undefined
    : undefined
  const currentAvatarUrl = currentLine?.isUser
    ? undefined
    : stateAvatarUrl || (currentCharacter as any)?.avatarUrl || undefined
  const spritePosition = (vnVisual.position || currentCharacter?.defaultPosition || 'center') as 'left' | 'center' | 'right'
  const backgroundUrl = vnVisual.backgroundUrl || undefined

  const isEnded = replayReady && combined.length > 0 && lineIndex >= combined.length
  const history = combined.slice(0, Math.min(lineIndex, combined.length))

  if (prepFailed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{t('scripts.playbackUnavailable')}</p>
        <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    )
  }

  if (!prepared || !mediaReady || !replayReady) {
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
        <p className="text-sm text-muted-foreground">{t('scripts.playbackUnavailable')}</p>
        <Button variant="secondary" className="rounded-full border-0 shadow-none" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    )
  }

  return (
    <VnPlayer
      className="h-full max-w-none rounded-none border-0 bg-background"
      stageClassName="min-h-0"
      offlineOnly
      currentLine={currentLine}
      history={history}
      isEnded={isEnded}
      onAdvance={() => setLineIndex((current) => Math.min(current + 1, combined.length))}
      showHistoryButton={false}
      showUserInputOverride
      clearBackdrop
      backgroundUrl={backgroundUrl}
      backgroundFit={vnVisual.backgroundFit}
      currentSpriteUrl={currentSpriteUrl}
      spriteAlt={currentCharacter?.displayName || currentCharacter?.name}
      spritePosition={spritePosition}
      currentAvatarUrl={currentAvatarUrl}
      currentAvatarAlt={currentCharacter?.displayName || currentCharacter?.name}
      hideEndedCaption
      endedActions={(
        <div className="mx-auto flex flex-col items-center gap-2.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 rounded-full border-0 bg-primary/10 px-4 text-xs font-medium text-primary shadow-none hover:bg-primary/16 hover:text-primary"
            onClick={() => setLineIndex(0)}
          >
            {t('scripts.replayAgain')}
          </Button>
        </div>
      )}
    />
  )
}
