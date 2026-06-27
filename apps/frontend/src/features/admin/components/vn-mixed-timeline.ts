import { type BackgroundFit } from '@/features/vn-engine/pixi-vn-stage'
import { type CharacterSpriteMap } from './vn-story-preview'
import { type ComposerItem, type ComposerScene } from './composer-parser'

export type MixedTimelineFrameKind = 'line' | 'choice' | 'userInput' | 'missingInput'

export interface MixedTimelineFrame {
  index: number
  kind: MixedTimelineFrameKind
  speaker: string
  text: string
  expression: string
  position: 'left' | 'center' | 'right'
  translation?: string
  audioUrl?: string
  source: 'ink' | 'choice' | 'defaultAnswer' | 'system'
  sceneName: string
  sceneItemIndex: number
  background: {
    url?: string
    fit?: BackgroundFit
  }
  sprite: {
    speaker?: string
    expression?: string
    position: 'left' | 'center' | 'right'
    url?: string
    avatarUrl?: string
  }
  choices?: { index: number; text: string; target: string }[]
  hideSpriteForChoices?: boolean
  defaultBranchTarget?: string
  missingDefaultAnswer?: boolean
  onDefaultBranch?: boolean
}

interface FlattenOptions {
  characterSprites?: Record<string, CharacterSpriteMap>
  characterAvatars?: Record<string, string>
  characterPositions?: Record<string, 'left' | 'center' | 'right'>
  defaultBackgroundUrl?: string
  maxFrames?: number
}

interface TimelineContext {
  background: { url?: string; fit?: BackgroundFit }
  speaker: string
  expression: string
  position: 'left' | 'center' | 'right'
  onDefaultBranch: boolean
}

function normalizeTarget(target?: string) {
  return (target || '').trim()
}

function isEndTarget(target?: string) {
  const normalized = normalizeTarget(target).toUpperCase()
  return !normalized || normalized === 'END' || normalized === 'DONE'
}

function resolveSprite(
  speaker: string,
  expression: string,
  position: 'left' | 'center' | 'right',
  options: FlattenOptions,
) {
  const speakerSprites = speaker ? options.characterSprites?.[speaker] : undefined
  return {
    speaker: speaker || undefined,
    expression: expression || undefined,
    position,
    url: expression ? speakerSprites?.[expression] || speakerSprites?.default : speakerSprites?.default,
    avatarUrl: speaker ? options.characterAvatars?.[speaker] : undefined,
  }
}

function toFrameBase(
  frames: MixedTimelineFrame[],
  kind: MixedTimelineFrameKind,
  sceneName: string,
  sceneItemIndex: number,
  ctx: TimelineContext,
  options: FlattenOptions,
) {
  return {
    index: frames.length,
    kind,
    expression: ctx.expression,
    position: ctx.position,
    sceneName,
    sceneItemIndex,
    background: { ...ctx.background },
    sprite: resolveSprite(ctx.speaker, ctx.expression, ctx.position, options),
    onDefaultBranch: ctx.onDefaultBranch,
  }
}

export function flattenComposerToTimeline(scenes: ComposerScene[], options: FlattenOptions = {}) {
  const frames: MixedTimelineFrame[] = []
  const maxFrames = options.maxFrames ?? 500
  const sceneMap = new Map(scenes.map((scene) => [scene.name, scene]))
  const firstScene = scenes.find((scene) => scene.name === 'start') ?? scenes[0]
  const visited = new Map<string, number>()

  const walk = (scene: ComposerScene | undefined, ctx: TimelineContext) => {
    if (!scene || frames.length >= maxFrames) return
    let itemIndex = 0
    while (itemIndex < scene.items.length && frames.length < maxFrames) {
      const visitKey = `${scene.name}:${itemIndex}`
      const visits = visited.get(visitKey) ?? 0
      if (visits > 2) return
      visited.set(visitKey, visits + 1)

      const item = scene.items[itemIndex]
      if (item.type === 'background') {
        ctx.background = { url: item.url || ctx.background.url, fit: item.fit || ctx.background.fit || 'cover' }
        itemIndex += 1
        continue
      }

      if (item.type === 'line') {
        const speaker = item.speaker || ctx.speaker
        const expression = item.expression || ctx.expression || 'default'
        const position = item.position || options.characterPositions?.[speaker] || ctx.position || 'center'
        ctx.speaker = speaker
        ctx.expression = expression
        ctx.position = position
        frames.push({
          ...toFrameBase(frames, 'line', scene.name, itemIndex, ctx, options),
          speaker,
          text: item.text,
          translation: item.translation,
          audioUrl: item.audioUrl,
          source: 'ink',
          sprite: resolveSprite(speaker, expression, position, options),
        })
        itemIndex += 1
        continue
      }

      if (item.type === 'choice') {
        const group: Extract<ComposerItem, { type: 'choice' }>[] = []
        let cursor = itemIndex
        while (scene.items[cursor]?.type === 'choice') {
          group.push(scene.items[cursor] as Extract<ComposerItem, { type: 'choice' }>)
          cursor += 1
        }
        const choices = group.map((choice, index) => ({ index, text: choice.text, target: choice.target }))
        const defaultChoice = choices[0]
        frames.push({
          ...toFrameBase(frames, 'choice', scene.name, itemIndex, ctx, options),
          speaker: ctx.speaker,
          text: defaultChoice?.text || '选择',
          source: 'choice',
          choices,
          hideSpriteForChoices: group.every((choice) => !choice.showCharacter),
          defaultBranchTarget: defaultChoice?.target,
        })
        if (!defaultChoice || isEndTarget(defaultChoice.target)) return
        ctx.onDefaultBranch = true
        walk(sceneMap.get(defaultChoice.target), ctx)
        return
      }

      if (item.type === 'wait') {
        if (item.requiresInput) {
          if (item.defaultAnswer?.trim()) {
            frames.push({
              ...toFrameBase(frames, 'userInput', scene.name, itemIndex, ctx, options),
              speaker: 'You',
              text: item.defaultAnswer.trim(),
              audioUrl: item.defaultAnswerAudioUrl,
              source: 'defaultAnswer',
              sprite: {
                speaker: 'You',
                expression: 'default',
                position: 'center',
              },
            })
          } else {
            frames.push({
              ...toFrameBase(frames, 'missingInput', scene.name, itemIndex, ctx, options),
              speaker: 'System',
              text: '缺少默认回答',
              source: 'system',
              missingDefaultAnswer: true,
            })
            return
          }
        }
        itemIndex += 1
        continue
      }

      if (item.type === 'divert') {
        if (isEndTarget(item.target)) return
        walk(sceneMap.get(item.target), ctx)
        return
      }

      itemIndex += 1
    }
  }

  walk(firstScene, {
    background: { url: options.defaultBackgroundUrl, fit: 'cover' },
    speaker: '',
    expression: 'default',
    position: 'center',
    onDefaultBranch: false,
  })

  return frames.map((frame, index) => ({ ...frame, index }))
}
