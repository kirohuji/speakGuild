import { extractInkMeta } from './ink-compiler'

export type ComposerItem =
  | { type: 'line'; speaker: string; expression: string; position: 'left' | 'center' | 'right'; text: string; translation?: string; audioUrl?: string }
  | { type: 'choice'; text: string; target: string; showCharacter: boolean }
  | { type: 'background'; url: string; fit: 'cover' | 'contain' | 'stretch' | 'repeat' }
  | { type: 'wait'; requiresInput: boolean; objective?: string; hint?: string; chunks?: string[]; defaultAnswer?: string; defaultAnswerAudioUrl?: string }
  | { type: 'divert'; target: string }
  | { type: 'tag'; value: string }

export type ComposerScene = {
  name: string
  items: ComposerItem[]
}

function cleanChoiceText(text: string) {
  return text.trim().replace(/^\[(.*)\]$/, '$1')
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getOrCreateWaitItem(scene: ComposerScene, requiresInput = false) {
  const last = scene.items[scene.items.length - 1]
  if (last?.type === 'wait') {
    if (requiresInput) last.requiresInput = true
    return last
  }
  const item: Extract<ComposerItem, { type: 'wait' }> = { type: 'wait', requiresInput }
  scene.items.push(item)
  return item
}

export function parseComposer(source: string): ComposerScene[] {
  const { remainingSource } = extractInkMeta(source)
  const scenes: ComposerScene[] = []
  let current: ComposerScene | null = null
  let pendingSpeaker = ''
  let pendingExpression = 'default'
  let pendingPosition: 'left' | 'center' | 'right' = 'center'
  let pendingTranslation = ''
  let pendingAudioUrl = ''
  let pendingChoiceShowCharacter = true

  const ensureScene = () => {
    if (!current) {
      current = { name: 'start', items: [] }
      scenes.push(current)
    }
    return current
  }

  for (const rawLine of remainingSource.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    const knot = line.match(/^={3,}\s*([^=]+?)\s*={3,}$/)
    if (knot) {
      current = { name: knot[1].trim() || `scene_${scenes.length + 1}`, items: [] }
      scenes.push(current)
      pendingSpeaker = ''
      pendingExpression = 'default'
      pendingPosition = 'center'
      pendingTranslation = ''
      pendingAudioUrl = ''
      continue
    }

    if (!current && line === '-> start') continue
    const scene = ensureScene()

    if (line.startsWith('#')) {
      const tag = line.slice(1).trim()
      if (tag.startsWith('speaker:')) {
        pendingSpeaker = tag.replace(/^speaker:/, '').trim()
      } else if (tag.startsWith('expression:')) {
        pendingExpression = tag.replace(/^expression:/, '').trim() || 'default'
      } else if (tag.startsWith('position:')) {
        const position = tag.replace(/^position:/, '').trim()
        pendingPosition = position === 'left' || position === 'right' ? position : 'center'
      } else if (tag.startsWith('audio:')) {
        pendingAudioUrl = safeDecode(tag.replace(/^audio:/, '').trim())
      } else if (tag.startsWith('translation:')) {
        pendingTranslation = safeDecode(tag.replace(/^translation:/, '').trim())
      } else if (tag.startsWith('choiceCharacter:')) {
        pendingChoiceShowCharacter = tag.replace(/^choiceCharacter:/, '').trim() !== 'hide'
      } else if (tag.startsWith('bg:')) {
        scene.items.push({ type: 'background', url: tag.replace(/^bg:/, '').trim(), fit: 'cover' })
      } else if (tag.startsWith('bgFit:')) {
        const last = scene.items[scene.items.length - 1]
        const fit = tag.replace(/^bgFit:/, '').trim()
        if (last?.type === 'background') {
          last.fit = fit === 'contain' || fit === 'stretch' || fit === 'repeat' ? fit : 'cover'
        } else {
          scene.items.push({ type: 'tag', value: tag })
        }
      } else if (tag === 'wait' || tag.startsWith('wait:')) {
        const waitMode = tag.replace(/^wait:?/, '').trim()
        const requiresInput = waitMode === 'input' || waitMode === 'user_input'
        const wait = getOrCreateWaitItem(scene, requiresInput)
        wait.requiresInput = requiresInput
      } else if (tag === 'input' || tag === 'user_input') {
        getOrCreateWaitItem(scene, true)
      } else if (tag.startsWith('objective:')) {
        getOrCreateWaitItem(scene).objective = tag.replace(/^objective:/, '').trim()
      } else if (tag.startsWith('hint:')) {
        getOrCreateWaitItem(scene).hint = tag.replace(/^hint:/, '').trim()
      } else if (tag.startsWith('chunks:')) {
        getOrCreateWaitItem(scene).chunks = tag.replace(/^chunks:/, '').trim().split(/[;,，；]/).map((s) => s.trim()).filter(Boolean)
      } else if (tag.startsWith('defaultAnswer:')) {
        getOrCreateWaitItem(scene, true).defaultAnswer = safeDecode(tag.replace(/^defaultAnswer:/, '').trim())
      } else if (tag.startsWith('defaultAnswerAudio:')) {
        getOrCreateWaitItem(scene, true).defaultAnswerAudioUrl = safeDecode(tag.replace(/^defaultAnswerAudio:/, '').trim())
      } else {
        scene.items.push({ type: 'tag', value: tag })
      }
      continue
    }

    const choice = line.match(/^\*\s*(.+?)(?:\s*->\s*(.+))?$/)
    if (choice) {
      scene.items.push({
        type: 'choice',
        text: cleanChoiceText(choice[1]),
        target: choice[2]?.trim() || 'END',
        showCharacter: pendingChoiceShowCharacter,
      })
      pendingChoiceShowCharacter = true
      continue
    }

    if (line.startsWith('->')) {
      scene.items.push({ type: 'divert', target: line.replace(/^->\s*/, '').trim() || 'END' })
      continue
    }

    const spoken = line.match(/^([^:：]{1,32})[:：]\s*(.+)$/)
    scene.items.push({
      type: 'line',
      speaker: pendingSpeaker || spoken?.[1]?.trim() || '',
      expression: pendingExpression || 'default',
      position: pendingPosition,
      text: spoken?.[2]?.trim() ?? line,
      translation: pendingTranslation,
      audioUrl: pendingAudioUrl,
    })
    pendingSpeaker = ''
    pendingExpression = 'default'
    pendingPosition = 'center'
    pendingTranslation = ''
    pendingAudioUrl = ''
  }

  if (scenes.length === 0) {
    scenes.push({
      name: 'start',
      items: [
        { type: 'line', speaker: 'Alex', expression: 'default', position: 'center', text: '你好，欢迎来到这里。' },
        { type: 'choice', text: '继续', target: 'END', showCharacter: true },
      ],
    })
  }

  return scenes
}

export function serializeComposer(
  meta: { key: string; title: string; locationId?: string; characterId?: string },
  scenes: ComposerScene[],
) {
  const lines: string[] = ['---']
  if (meta.key) lines.push(`key: ${meta.key}`)
  if (meta.title) lines.push(`title: ${meta.title}`)
  if (meta.locationId) lines.push(`locationId: ${meta.locationId}`)
  if (meta.characterId) lines.push(`characterId: ${meta.characterId}`)
  lines.push('---', '', '-> start', '')

  for (const scene of scenes) {
    lines.push(`=== ${scene.name || 'scene'} ===`)
    for (const item of scene.items) {
      if (item.type === 'line') {
        if (item.speaker) lines.push(`# speaker:${item.speaker}`)
        if (item.expression) lines.push(`# expression:${item.expression}`)
        if (item.position) lines.push(`# position:${item.position}`)
        if (item.translation) lines.push(`# translation:${encodeURIComponent(item.translation)}`)
        if (item.audioUrl) lines.push(`# audio:${encodeURIComponent(item.audioUrl)}`)
        lines.push(item.speaker ? `${item.speaker}: ${item.text}` : item.text)
      } else if (item.type === 'choice') {
        lines.push(`# choiceCharacter:${item.showCharacter ? 'show' : 'hide'}`)
        lines.push(`*   [${item.text || '选项'}] -> ${item.target || 'END'}`)
      } else if (item.type === 'background') {
        lines.push(`# bg:${item.url}`)
        lines.push(`# bgFit:${item.fit || 'cover'}`)
      } else if (item.type === 'wait') {
        if (item.objective) lines.push(`#objective:${item.objective}`)
        if (item.hint) lines.push(`#hint:${item.hint}`)
        if (item.chunks?.length) lines.push(`#chunks:${item.chunks.join(', ')}`)
        if (item.requiresInput && item.defaultAnswer) {
          lines.push(`# defaultAnswer:${encodeURIComponent(item.defaultAnswer)}`)
        }
        if (item.requiresInput && item.defaultAnswerAudioUrl) {
          lines.push(`# defaultAnswerAudio:${encodeURIComponent(item.defaultAnswerAudioUrl)}`)
        }
        lines.push(item.requiresInput ? '# wait:input' : '# wait')
      } else if (item.type === 'divert') {
        lines.push(`-> ${item.target || 'END'}`)
      } else {
        lines.push(`# ${item.value}`)
      }
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function cloneScenes(scenes: ComposerScene[]) {
  return scenes.map((scene) => ({
    ...scene,
    items: scene.items.map((item) => ({ ...item })),
  }))
}

export function serializeSourceForSave(source: string, key: string, title: string) {
  return serializeComposer({ key, title }, parseComposer(source))
}
