import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  Clock3,
  Code2,
  GitBranch,
  ImageIcon,
  MapPin,
  MessageSquare,
  Plus,
  Route,
  Save,
  Target,
  Trash2,
  Lightbulb,
  Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { cn } from '@/lib/cn'
import { compileInk, defaultInkTemplate, extractInkMeta } from './ink-compiler'
import { VnStoryPreview, type CharacterSpriteMap, type PreviewAiEvaluation } from './vn-story-preview'
import { VnLineAudioGenerator } from './vn-line-audio-generator'
import { summarizePreviewDialogue, type GameCharacter, type GameLocationData } from '../api-content-admin'

type ComposerItem =
  | { type: 'line'; speaker: string; expression: string; position: 'left' | 'center' | 'right'; text: string; translation?: string; audioUrl?: string }
  | { type: 'choice'; text: string; target: string; showCharacter: boolean }
  | { type: 'background'; url: string; fit: 'cover' | 'contain' | 'stretch' | 'repeat' }
  | { type: 'wait'; requiresInput: boolean; objective?: string; hint?: string; chunks?: string[] }
  | { type: 'divert'; target: string }
  | { type: 'tag'; value: string }

type ComposerScene = {
  name: string
  items: ComposerItem[]
}

type Selection =
  | { type: 'scene'; sceneIndex: number }
  | { type: 'item'; sceneIndex: number; itemIndex: number }

interface VnPreviewDebugState {
  isReady: boolean
  isWaiting: boolean
  isEnded: boolean
  currentTags: string[]
  history: Array<{ speaker: string; text: string; expression?: string }>
  choices: Array<{ index: number; text: string }>
  activeBackground: { url?: string; fit?: string }
  aiPayload: Record<string, any>
  aiEvaluations: PreviewAiEvaluation[]
}

interface InkStoryEditorProps {
  initialSource?: string
  initialKey?: string
  initialTitle?: string
  initialLocationId?: string
  initialCharacterId?: string
  locations?: GameLocationData[]
  characters?: GameCharacter[]
  trainingTopic?: { id: string; title: string; teachingMarkdown?: string | null } | null
  onSaveTeachingMarkdown?: (teachingMarkdown: string) => void | Promise<void>
  onSave?: (data: {
    key: string
    title: string
    inkSource: string
    inkJson: Record<string, any>
    locationId?: string
    characterId?: string
  }, options?: { silent?: boolean }) => void | Promise<void>
  saving?: boolean
  readOnly?: boolean
  className?: string
}

const syntaxHint =
  'Ink: === scene === defines a scene, # speaker / # expression control the VN sprite, * [choice] -> target creates a choice, # wait pauses for input, -> END ends the story.'

function buildCharacterSpriteData(characters: GameCharacter[]): {
  sprites: Record<string, CharacterSpriteMap>
  positions: Record<string, 'left' | 'center' | 'right'>
  avatars: Record<string, string>
} {
  const sprites: Record<string, CharacterSpriteMap> = {}
  const positions: Record<string, 'left' | 'center' | 'right'> = {}
  const avatars: Record<string, string> = {}

  for (const char of characters) {
    const map: CharacterSpriteMap = {}
    if (char.expressions && typeof char.expressions === 'object') {
      Object.assign(map, char.expressions as Record<string, string>)
    }
    if (!map.default && char.spriteBaseUrl) map.default = char.spriteBaseUrl
    if (Object.keys(map).length > 0) {
      sprites[char.name] = map
      sprites[char.displayName] = map
    }
    if (char.avatarUrl) {
      avatars[char.name] = char.avatarUrl
      if (char.displayName && char.displayName !== char.name) {
        avatars[char.displayName] = char.avatarUrl
      }
    }
    const pos = char.defaultPosition as 'left' | 'center' | 'right' | undefined
    if (pos) {
      positions[char.name] = pos
      positions[char.displayName] = pos
    }
  }

  return { sprites, positions, avatars }
}

function cleanChoiceText(text: string) {
  return text.trim().replace(/^\[(.*)\]$/, '$1')
}

function parseComposer(source: string): ComposerScene[] {
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
        pendingAudioUrl = decodeURIComponent(tag.replace(/^audio:/, '').trim())
      } else if (tag.startsWith('translation:')) {
        pendingTranslation = decodeURIComponent(tag.replace(/^translation:/, '').trim())
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
        const last = scene.items[scene.items.length - 1]
        if (last?.type === 'wait') {
          last.requiresInput = requiresInput
        } else {
          scene.items.push({ type: 'wait', requiresInput })
        }
      } else if (tag === 'input' || tag === 'user_input') {
        const last = scene.items[scene.items.length - 1]
        if (last?.type === 'wait') {
          last.requiresInput = true
        } else {
          scene.items.push({ type: 'wait', requiresInput: true })
        }
      } else if (tag.startsWith('objective:')) {
        const val = tag.replace(/^objective:/, '').trim()
        const last = scene.items[scene.items.length - 1]
        if (last?.type === 'wait') { last.objective = val }
        else { scene.items.push({ type: 'wait', requiresInput: false, objective: val }) }
      } else if (tag.startsWith('hint:')) {
        const val = tag.replace(/^hint:/, '').trim()
        const last = scene.items[scene.items.length - 1]
        if (last?.type === 'wait') { last.hint = val }
        else { scene.items.push({ type: 'wait', requiresInput: false, hint: val }) }
      } else if (tag.startsWith('chunks:')) {
        const val = tag.replace(/^chunks:/, '').trim().split(/[;,]/).map((s) => s.trim()).filter(Boolean)
        const last = scene.items[scene.items.length - 1]
        if (last?.type === 'wait') { last.chunks = val }
        else { scene.items.push({ type: 'wait', requiresInput: false, chunks: val }) }
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

function serializeComposer(
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

function cloneScenes(scenes: ComposerScene[]) {
  return scenes.map((scene) => ({
    ...scene,
    items: scene.items.map((item) => ({ ...item })),
  }))
}

function serializeSourceForSave(source: string, key: string, title: string) {
  return serializeComposer({ key, title }, parseComposer(source))
}

function itemTitle(item: ComposerItem) {
  if (item.type === 'line') return item.speaker || '旁白'
  if (item.type === 'choice') return '选项'
  if (item.type === 'background') return '背景'
  if (item.type === 'wait') return '等待'
  if (item.type === 'divert') return '跳转'
  return '标签'
}

function itemSummary(item: ComposerItem) {
  if (item.type === 'line') return item.text || '空对白'
  if (item.type === 'choice') return `${item.text || '空选项'} -> ${item.target || 'END'} · ${item.showCharacter ? '保留角色' : '隐藏角色'}`
  if (item.type === 'background') return `${item.fit || 'cover'} · ${item.url || '未选择背景'}`
  if (item.type === 'wait') {
    const parts = [item.requiresInput ? '等待用户输入' : '暂停']
    if (item.objective) parts.push(`目标: ${item.objective}`)
    if (item.chunks?.length) parts.push(`句块: ${item.chunks.join(', ')}`)
    return parts.join(' · ')
  }
  if (item.type === 'divert') return `-> ${item.target || 'END'}`
  return `# ${item.value}`
}

function itemIcon(item: ComposerItem) {
  if (item.type === 'line') return MessageSquare
  if (item.type === 'choice') return GitBranch
  if (item.type === 'background') return ImageIcon
  if (item.type === 'wait') return Clock3
  if (item.type === 'divert') return Route
  return Code2
}

export function InkStoryEditor({
  initialSource,
  initialKey = '',
  initialTitle = '',
  initialLocationId,
  initialCharacterId,
  locations = [],
  characters = [],
  trainingTopic,
  onSaveTeachingMarkdown,
  onSave,
  saving = false,
  readOnly = false,
  className,
}: InkStoryEditorProps) {
  const [source, setSource] = useState(initialSource || defaultInkTemplate())
  const [workspaceTab, setWorkspaceTab] = useState<'compose' | 'preview' | 'teaching'>('compose')
  const [rawOpen, setRawOpen] = useState(false)
  const [compileResult, setCompileResult] = useState<ReturnType<typeof compileInk> | null>(null)
  const [selection, setSelection] = useState<Selection>({ type: 'scene', sceneIndex: 0 })
  const [draggedItem, setDraggedItem] = useState<{ sceneIndex: number; itemIndex: number } | null>(null)
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [previewDebug, setPreviewDebug] = useState<VnPreviewDebugState | null>(null)
  const [previewAiEnabled, setPreviewAiEnabled] = useState(false)
  const [teachingMarkdown, setTeachingMarkdown] = useState(trainingTopic?.teachingMarkdown ?? '')
  const [teachingSaving, setTeachingSaving] = useState(false)
  const lastAutoSavedSourceRef = useRef('')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [key, setKey] = useState(initialKey)
  const [title, setTitle] = useState(initialTitle)
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [characterId, setCharacterId] = useState(initialCharacterId || '')

  const scenes = useMemo(() => parseComposer(source), [source])
  const selectedScene = scenes[selection.sceneIndex] ?? scenes[0]
  const selectedItem = selection.type === 'item' ? selectedScene?.items[selection.itemIndex] : null
  const selectedBackgroundLocationId = selectedItem?.type === 'background'
    ? locations.find((location) => location.backgroundUrl === selectedItem.url)?.id || ''
    : ''

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === characterId),
    [characterId, characters],
  )
  const defaultCharacter = selectedCharacter || characters[0]
  const defaultSpeaker = defaultCharacter?.name || defaultCharacter?.displayName || 'Alex'
  const expressionOptions = useMemo(() => {
    const names = new Set<string>(['default'])
    const expressions = defaultCharacter?.expressions
    if (expressions && typeof expressions === 'object') {
      Object.keys(expressions as Record<string, string>).forEach((name) => names.add(name))
    }
    return Array.from(names)
  }, [defaultCharacter])

  const { sprites: charSprites, positions: charPositions, avatars: charAvatars } = useMemo(
    () => buildCharacterSpriteData(characters),
    [characters],
  )

  const sourceWithMeta = useCallback(
    (nextScenes = scenes) => serializeComposer({
      key,
      title,
      locationId,
      characterId,
    }, nextScenes),
    [characterId, key, locationId, scenes, title],
  )

  const updateScenes = useCallback((producer: (draft: ComposerScene[]) => void) => {
    setSource((prev) => {
      const draft = cloneScenes(parseComposer(prev))
      producer(draft)
      return serializeComposer({
        key,
        title,
        locationId,
        characterId,
      }, draft)
    })
  }, [characterId, key, locationId, title])

  useEffect(() => {
    const nextSource = initialSource || defaultInkTemplate({ key: initialKey, title: initialTitle })
    setSource(nextSource)
    setKey(initialKey)
    setTitle(initialTitle)
    setLocationId(initialLocationId || '')
    setCharacterId(initialCharacterId || '')
    setSelection({ type: 'scene', sceneIndex: 0 })
    lastAutoSavedSourceRef.current = serializeSourceForSave(nextSource, initialKey, initialTitle)
    setAutoSaveState('idle')
  }, [initialSource, initialKey, initialTitle, initialLocationId, initialCharacterId])

  useEffect(() => {
    setTeachingMarkdown(trainingTopic?.teachingMarkdown ?? '')
  }, [trainingTopic?.id, trainingTopic?.teachingMarkdown])

  useEffect(() => {
    setCompileResult(compileInk(sourceWithMeta()))
  }, [source, sourceWithMeta])

  const checkFormat = useCallback(() => {
    setCompileResult(compileInk(sourceWithMeta()))
  }, [sourceWithMeta])

  const addScene = useCallback(() => {
    updateScenes((draft) => {
      const nextIndex = draft.length + 1
      draft.push({ name: `scene_${nextIndex}`, items: [] })
      setSelection({ type: 'scene', sceneIndex: draft.length - 1 })
    })
  }, [updateScenes])

  const addItem = useCallback((type: ComposerItem['type']) => {
    const sceneIndex = selection.sceneIndex < scenes.length ? selection.sceneIndex : 0
    updateScenes((draft) => {
      const scene = draft[sceneIndex] ?? draft[0]
      if (!scene) return
      const item: ComposerItem =
        type === 'line'
          ? { type: 'line', speaker: defaultSpeaker, expression: 'default', position: 'center', text: '新的对白' }
          : type === 'choice'
            ? { type: 'choice', text: '新的选项', target: 'END', showCharacter: true }
            : type === 'background'
              ? { type: 'background', url: '', fit: 'cover' }
              : type === 'wait'
                ? { type: 'wait', requiresInput: true }
                : type === 'divert'
                  ? { type: 'divert', target: 'END' }
                  : { type: 'tag', value: 'tag' }
      const insertIndex = selection.type === 'item'
        ? Math.min(selection.itemIndex + 1, scene.items.length)
        : scene.items.length
      scene.items.splice(insertIndex, 0, item)
      setSelection({ type: 'item', sceneIndex, itemIndex: insertIndex })
    })
  }, [defaultSpeaker, scenes.length, selection, updateScenes])

  const updateSelectedSceneName = useCallback((name: string) => {
    updateScenes((draft) => {
      if (draft[selection.sceneIndex]) draft[selection.sceneIndex].name = name
    })
  }, [selection.sceneIndex, updateScenes])

  const updateSelectedItem = useCallback((patch: Partial<ComposerItem>) => {
    if (selection.type !== 'item') return
    updateScenes((draft) => {
      const item = draft[selection.sceneIndex]?.items[selection.itemIndex]
      if (item) Object.assign(item, patch)
    })
  }, [selection, updateScenes])

  const moveItem = useCallback((sceneIndex: number, fromIndex: number, toIndex: number) => {
    if (readOnly || fromIndex === toIndex) return
    updateScenes((draft) => {
      const items = draft[sceneIndex]?.items
      if (!items || !items[fromIndex] || toIndex < 0 || toIndex >= items.length) return
      const [item] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, item)
      setSelection({ type: 'item', sceneIndex, itemIndex: toIndex })
    })
  }, [readOnly, updateScenes])

  const deleteSelection = useCallback(() => {
    if (readOnly) return
    updateScenes((draft) => {
      if (selection.type === 'scene') {
        if (draft.length <= 1) return
        draft.splice(selection.sceneIndex, 1)
        setSelection({ type: 'scene', sceneIndex: Math.max(0, selection.sceneIndex - 1) })
      } else {
        draft[selection.sceneIndex]?.items.splice(selection.itemIndex, 1)
        setSelection({ type: 'scene', sceneIndex: selection.sceneIndex })
      }
    })
  }, [readOnly, selection, updateScenes])

  const handleSourceChange = useCallback((value: string) => {
    setSource(value)
    const meta = extractInkMeta(value)
    if (meta.key) setKey(meta.key)
    if (meta.title) setTitle(meta.title)
    if (meta.locationId) setLocationId(meta.locationId)
    if (meta.characterId) setCharacterId(meta.characterId)
  }, [])

  const saveCurrentStory = useCallback(async (options?: { silent?: boolean }) => {
    if (!onSave) return
    const nextSource = sourceWithMeta()
    const result = compileInk(nextSource)
    if (!result.success || !result.json) return
    await onSave({
      key,
      title,
      inkSource: nextSource,
      inkJson: result.json,
      locationId: locationId || undefined,
      characterId: characterId || undefined,
    }, options)
    lastAutoSavedSourceRef.current = nextSource
  }, [characterId, key, locationId, onSave, sourceWithMeta, title])

  const handleSave = useCallback(() => {
    void saveCurrentStory()
  }, [saveCurrentStory])

  const handleSaveTeachingMarkdown = useCallback(async () => {
    if (!onSaveTeachingMarkdown) return
    setTeachingSaving(true)
    try {
      await onSaveTeachingMarkdown(teachingMarkdown)
    } finally {
      setTeachingSaving(false)
    }
  }, [onSaveTeachingMarkdown, teachingMarkdown])

  useEffect(() => {
    return // 自动保存已暂时关闭
    if (!onSave || readOnly || saving || !key.trim() || !title.trim() || !compileResult?.success) return
    const nextSource = sourceWithMeta()
    if (!nextSource.trim() || nextSource === lastAutoSavedSourceRef.current) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setAutoSaveState('idle')
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveState('saving')
      void saveCurrentStory({ silent: true })
        .then(() => setAutoSaveState('saved'))
        .catch(() => setAutoSaveState('error'))
    }, 1200)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [compileResult?.success, key, onSave, readOnly, saveCurrentStory, saving, source, sourceWithMeta, title])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-2">
        <div>
          <Label className="text-xs">Key</Label>
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="story_key" className="h-8 text-xs" disabled={readOnly} />
        </div>
        <div>
          <Label className="text-xs">标题</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="故事标题" className="h-8 text-xs" disabled={readOnly} />
        </div>
      </div>

      <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as 'compose' | 'preview' | 'teaching')} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="compose">编排</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
            <TabsTrigger value="teaching">教学文档</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={compileResult?.success ? 'success' : 'destructive'} className="h-7">
              {compileResult?.success ? '格式通过' : '需要修正'}
            </Badge>
            {onSave && !readOnly && (
              <Badge variant={autoSaveState === 'error' ? 'destructive' : 'secondary'} className="h-7">
                {autoSaveState === 'saving' ? '自动保存中' : autoSaveState === 'saved' ? '已自动保存' : autoSaveState === 'error' ? '自动保存失败' : '自动保存'}
              </Badge>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setRawOpen((value) => !value)} className="h-8 gap-1.5">
              <Code2 className="size-3.5" />源码
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={checkFormat} className="h-8 gap-1.5">
              <CheckCircle2 className="size-3.5" />检查格式
            </Button>
            {onSave && !readOnly && (
              <Button size="sm" onClick={handleSave} disabled={saving || !key || !title || !compileResult?.success} className="h-8 gap-1.5">
                <Save className="size-3.5" />{saving ? '保存中...' : '保存'}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="compose" className="mt-0 space-y-3">
          {rawOpen && (
            <div className="rounded-lg border border-border bg-card p-3">
              <Textarea
                className="min-h-64 font-mono text-xs leading-relaxed"
                value={sourceWithMeta()}
                onChange={(event) => handleSourceChange(event.target.value)}
                disabled={readOnly}
                spellCheck={false}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">{syntaxHint}</p>
            </div>
          )}

          <div className="grid gap-3 xl:grid-cols-[230px_minmax(0,1fr)_320px]">
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <p className="text-sm font-semibold">场景</p>
                <Button type="button" variant="ghost" size="icon-sm" onClick={addScene} disabled={readOnly}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="space-y-1 p-2">
                {scenes.map((scene, sceneIndex) => {
                  const active = selection.sceneIndex === sceneIndex
                  return (
                    <button
                      key={`${scene.name}-${sceneIndex}`}
                      type="button"
                      onClick={() => setSelection({ type: 'scene', sceneIndex })}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/70',
                        active && 'bg-primary/10 text-primary ring-1 ring-primary/20',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs">=== {scene.name} ===</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{scene.items.length}</Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">流程画布</p>
                  <p className="text-xs text-muted-foreground">{selectedScene ? `正在编辑 ${selectedScene.name}` : '选择一个场景开始'}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem('line')} disabled={readOnly}>
                    <MessageSquare className="size-3.5" />对白
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem('choice')} disabled={readOnly}>
                    <GitBranch className="size-3.5" />选项
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem('background')} disabled={readOnly}>
                    <ImageIcon className="size-3.5" />背景
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem('wait')} disabled={readOnly}>
                    <Clock3 className="size-3.5" />等待
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem('divert')} disabled={readOnly}>
                    <Route className="size-3.5" />跳转
                  </Button>
                </div>
              </div>

              <div className="max-h-[620px] space-y-3 overflow-y-auto p-4">
                {selectedScene?.items.length ? selectedScene.items.map((item, itemIndex) => {
                  const Icon = itemIcon(item)
                  const active = selection.type === 'item' && selection.sceneIndex === selection.sceneIndex && selection.itemIndex === itemIndex
                  return (
                    <button
                      key={`${item.type}-${itemIndex}`}
                      type="button"
                      draggable={!readOnly}
                      onDragStart={(event) => {
                        setDraggedItem({ sceneIndex: selection.sceneIndex, itemIndex })
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={() => setDraggedItem(null)}
                      onDragOver={(event) => {
                        if (!readOnly && draggedItem?.sceneIndex === selection.sceneIndex) event.preventDefault()
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (draggedItem?.sceneIndex === selection.sceneIndex) {
                          moveItem(selection.sceneIndex, draggedItem.itemIndex, itemIndex)
                        }
                      }}
                      onClick={() => setSelection({ type: 'item', sceneIndex: selection.sceneIndex, itemIndex })}
                      className={cn(
                        'grid w-full cursor-grab grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-background p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-muted/30 active:cursor-grabbing',
                        item.type === 'choice' && 'ml-8 w-[calc(100%-2rem)] scale-[0.98] border-primary/25 bg-primary/5',
                        active && 'border-primary/60 bg-primary/5 shadow-md',
                        draggedItem?.sceneIndex === selection.sceneIndex && draggedItem.itemIndex === itemIndex && 'opacity-45',
                      )}
                    >
                      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium">{itemTitle(item)}</span>
                          {item.type === 'line' && <Badge variant="secondary" className="text-[10px]">{item.expression}</Badge>}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{itemSummary(item)}</span>
                      </span>
                    </button>
                  )
                }) : (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <Wand2 className="mx-auto mb-3 size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">这个场景还没有节点</p>
                    <p className="mt-1 text-xs text-muted-foreground">从上方添加对白、选项、背景或跳转。</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">属性</p>
                <Button type="button" variant="ghost" size="icon-sm" onClick={deleteSelection} disabled={readOnly}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-4 p-4">
                {selection.type === 'scene' && selectedScene && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">场景名</Label>
                      <Input value={selectedScene.name} onChange={(event) => updateSelectedSceneName(event.target.value)} disabled={readOnly} className="mt-1 font-mono text-sm" />
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      场景名会生成 Ink 的 <code>=== {selectedScene.name || 'scene'} ===</code>。选中画布中的节点可以编辑对白、选项和跳转。
                    </div>
                  </div>
                )}

                {selectedItem?.type === 'line' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">角色</Label>
                      <select className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={selectedItem.speaker} onChange={(event) => updateSelectedItem({ speaker: event.target.value })} disabled={readOnly}>
                        <option value="">旁白</option>
                        {characters.map((character) => (
                          <option key={character.id} value={character.name || character.displayName}>{character.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">表情</Label>
                      <select className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={selectedItem.expression} onChange={(event) => updateSelectedItem({ expression: event.target.value })} disabled={readOnly}>
                        {expressionOptions.map((expression) => <option key={expression} value={expression}>{expression}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">对白</Label>
                      <select className="mb-3 mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={selectedItem.position} onChange={(event) => updateSelectedItem({ position: event.target.value as 'left' | 'center' | 'right' })} disabled={readOnly}>
                        <option value="left">左</option>
                        <option value="center">中</option>
                        <option value="right">右</option>
                      </select>
                      <Textarea value={selectedItem.text} onChange={(event) => updateSelectedItem({ text: event.target.value })} disabled={readOnly} className="mt-1 min-h-32 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">翻译（双语显示）</Label>
                      <Textarea
                        value={selectedItem.translation || ''}
                        onChange={(event) => updateSelectedItem({ translation: event.target.value })}
                        disabled={readOnly}
                        className="mt-1 min-h-[72px] text-sm"
                        placeholder="输入中文翻译，用户开启双语显示后会展示在英文对白下方"
                      />
                    </div>
                    <VnLineAudioGenerator
                      text={selectedItem.text}
                      audioUrl={selectedItem.audioUrl}
                      storyKey={key}
                      sceneName={selectedScene?.name}
                      lineIndex={selection.type === 'item' ? selection.itemIndex : undefined}
                      onChange={(audioUrl) => updateSelectedItem({ audioUrl })}
                    />
                  </div>
                )}

                {selectedItem?.type === 'choice' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">选项文本</Label>
                      <Input value={selectedItem.text} onChange={(event) => updateSelectedItem({ text: event.target.value })} disabled={readOnly} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">跳转目标</Label>
                      <Input value={selectedItem.target} onChange={(event) => updateSelectedItem({ target: event.target.value })} disabled={readOnly} className="mt-1 font-mono" placeholder="scene / END" />
                      <label className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedItem.showCharacter}
                          onChange={(event) => updateSelectedItem({ showCharacter: event.target.checked })}
                          disabled={readOnly}
                          className="rounded border-border"
                        />
                        选项出现时保留角色立绘
                      </label>
                    </div>
                  </div>
                )}

                {selectedItem?.type === 'background' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">从地点选择</Label>
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                        value={selectedBackgroundLocationId}
                        onChange={(event) => {
                          const location = locations.find((item) => item.id === event.target.value)
                          updateSelectedItem({ url: location?.backgroundUrl || '' })
                        }}
                        disabled={readOnly}
                      >
                        <option value="">选择地点背景</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.displayName}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">背景 URL</Label>
                      <select className="mb-3 mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm" value={selectedItem.fit} onChange={(event) => updateSelectedItem({ fit: event.target.value as 'cover' | 'contain' | 'stretch' | 'repeat' })} disabled={readOnly}>
                        <option value="cover">Cover 填满裁切</option>
                        <option value="contain">Contain 完整显示</option>
                        <option value="stretch">Stretch 拉伸</option>
                        <option value="repeat">Repeat 平铺</option>
                      </select>
                      <Input value={selectedItem.url} onChange={(event) => updateSelectedItem({ url: event.target.value })} disabled={readOnly} className="mt-1" placeholder="选择地点后自动填入，也可以粘贴自定义 URL" />
                    </div>
                    {selectedItem.url && (
                      <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
                        <img src={selectedItem.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {selectedItem?.type === 'wait' && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedItem.requiresInput}
                        onChange={(event) => updateSelectedItem({ requiresInput: event.target.checked })}
                        disabled={readOnly}
                        className="rounded border-border"
                      />
                      等待用户输入
                    </label>

                    {selectedItem.requiresInput && (
                      <>
                        <div>
                          <Label className="text-xs">练习目的 (objective)</Label>
                          <Input
                            value={selectedItem.objective || ''}
                            onChange={(event) => updateSelectedItem({ objective: event.target.value })}
                            disabled={readOnly}
                            className="mt-1"
                            placeholder="例如：Greet the receptionist and introduce yourself"
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            描述本轮对话期望用户完成的任务，AI 会据此评判回答质量
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">提示 (hint)</Label>
                          <Input
                            value={selectedItem.hint || ''}
                            onChange={(event) => updateSelectedItem({ hint: event.target.value })}
                            disabled={readOnly}
                            className="mt-1"
                            placeholder="例如：Try using I'm here to check in"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">推荐句块 (chunks)</Label>
                          <Textarea
                            value={selectedItem.chunks?.join(', ') || ''}
                            onChange={(event) => updateSelectedItem({
                              chunks: event.target.value.split(/[,;，；]/).map((s) => s.trim()).filter(Boolean),
                            })}
                            disabled={readOnly}
                            className="mt-1 min-h-[60px] text-sm"
                            placeholder="用逗号分隔，例如：I'm here to check in, My name is..."
                          />
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            用逗号或分号分隔，这些句块会出现在练习助手中提示用户
                          </p>
                        </div>
                      </>
                    )}

                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                      会生成
                      {selectedItem.objective && <><br /><code>#objective:{selectedItem.objective}</code></>}
                      {selectedItem.hint && <><br /><code>#hint:{selectedItem.hint}</code></>}
                      {selectedItem.chunks?.length ? <><br /><code>#chunks:{selectedItem.chunks.join(', ')}</code></> : null}
                      <br /><code>{selectedItem.requiresInput ? '# wait:input' : '# wait'}</code>
                    </div>
                  </div>
                )}

                {selectedItem?.type === 'divert' && (
                  <div>
                    <Label className="text-xs">跳转目标</Label>
                    <Input value={selectedItem.target} onChange={(event) => updateSelectedItem({ target: event.target.value })} disabled={readOnly} className="mt-1 font-mono" placeholder="scene / END" />
                  </div>
                )}

                {selectedItem?.type === 'tag' && (
                  <div>
                    <Label className="text-xs">Tag</Label>
                    <Input value={selectedItem.value} onChange={(event) => updateSelectedItem({ value: event.target.value })} disabled={readOnly} className="mt-1 font-mono" />
                  </div>
                )}

                {compileResult && !compileResult.success && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    <div className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="size-3.5" />格式错误</div>
                    {compileResult.errors.slice(0, 4).map((error, index) => <p key={index} className="font-mono">{error}</p>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className="grid gap-4 rounded-lg border border-border bg-card p-4 xl:grid-cols-[minmax(360px,460px)_minmax(0,1fr)]">
            <div className="min-w-0">
              <VnStoryPreview
                inkSource={sourceWithMeta()}
                characterSprites={charSprites}
                characterAvatars={charAvatars}
                characterPositions={charPositions}
                aiEvaluationEnabled={previewAiEnabled}
                className="mx-auto h-[78vh] max-h-[760px] max-w-[420px]"
                onDebugChange={setPreviewDebug}
              />
            </div>
            <PreviewDebugPanel debug={previewDebug} aiEnabled={previewAiEnabled} onAiEnabledChange={setPreviewAiEnabled} />
          </div>
        </TabsContent>

        <TabsContent value="teaching" className="mt-0">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">练习助手教学文档</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {trainingTopic
                    ? `绑定话题：${trainingTopic.title}。用户点击练习页顶部“教学”按钮后会看到这篇文档。`
                    : '当前故事尚未绑定训练话题。请先在场景管理中绑定话题，再回来编写教学文档。'}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveTeachingMarkdown()}
                disabled={!trainingTopic || !onSaveTeachingMarkdown || teachingSaving}
              >
                <Save className="size-3.5" />{teachingSaving ? '保存中...' : '保存教学文档'}
              </Button>
            </div>
            <div className="p-4">
              <MarkdownEditor
                value={teachingMarkdown}
                onChange={setTeachingMarkdown}
                height={560}
                disabled={!trainingTopic || readOnly}
                placeholder="## 这个场景怎么说&#10;&#10;先说明来意，再补充关键信息。"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PreviewDebugPanel({
  debug,
  aiEnabled,
  onAiEnabledChange,
}: {
  debug: VnPreviewDebugState | null
  aiEnabled: boolean
  onAiEnabledChange: (enabled: boolean) => void
}) {
  const formattedPayload = JSON.stringify(debug?.aiPayload ?? {}, null, 2)
  const practiceContext = extractPracticeContext(debug?.currentTags ?? [])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryResult, setSummaryResult] = useState<any>(null)
  const [summaryError, setSummaryError] = useState('')

  const runSummary = async () => {
    const history = debug?.history ?? []
    const dialogues = history.flatMap((line, index) => {
      if (line.speaker !== 'You') return []
      const npcLine = [...history.slice(0, index)].reverse().find((item) => item.speaker !== 'You')
      return [{ round: index + 1, npcText: npcLine?.text ?? '', userText: line.text }]
    })
    if (dialogues.length === 0) {
      setSummaryError('请先在左侧提交至少一条测试回答。')
      return
    }

    setSummaryLoading(true)
    setSummaryError('')
    try {
      const objectives = [...new Set([
        practiceContext.objective,
        ...(debug?.aiEvaluations ?? []).map((evaluation) => evaluation.objective),
      ].filter(Boolean))]
      const coreChunks = [...new Set([
        ...practiceContext.chunks,
        ...(debug?.aiEvaluations ?? []).flatMap((evaluation) => evaluation.targetChunks),
      ])]
      const result = await summarizePreviewDialogue({
        topicId: 'admin-preview',
        topicTitle: '故事工坊预览',
        promptEn: practiceContext.objective || 'Evaluate the preview dialogue.',
        objectives,
        coreChunks,
        dialogues,
      })
      setSummaryResult(result.analysis ?? result.raw)
    } catch (error: any) {
      setSummaryError(error?.response?.data?.message || error?.message || '整场复盘请求失败')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="min-w-0 rounded-lg border border-border bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">实时状态与评估数据</p>
            <p className="mt-1 text-xs text-muted-foreground">用于检查 #wait / #input 流程和最终 AI 评估 payload。</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-muted-foreground">AI 实时评估</span>
            <Switch checked={aiEnabled} onCheckedChange={onAiEnabledChange} />
          </label>
        </div>
        {aiEnabled && (
          <p className="mt-2 text-[11px] text-amber-600">已开启：每次提交测试文本都会请求 AI，使用管理员预览通道，不扣练习额度。</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
        <DebugMetric label="状态" value={debug?.isEnded ? '已完成' : debug?.isWaiting ? '等待输入' : debug?.isReady ? '播放中' : '未开始'} />
        <DebugMetric label="对话" value={`${debug?.history.length ?? 0} 条`} />
        <DebugMetric label="选项" value={`${debug?.choices.length ?? 0} 个`} />
      </div>

      <Tabs defaultValue="practice">
        <TabsList className="mx-3 mt-3 grid h-8 grid-cols-3 p-0.5">
          <TabsTrigger value="practice" className="px-2 py-1 text-xs">练习评估</TabsTrigger>
          <TabsTrigger value="history" className="px-2 py-1 text-xs">对话记录</TabsTrigger>
          <TabsTrigger value="debug" className="px-2 py-1 text-xs">调试数据</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(78vh-116px)] max-h-[644px]">
          <TabsContent value="practice" className="mt-0 space-y-3 p-3">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">本轮练习设计</p>
                <span className="text-[10px] text-muted-foreground">来自当前 input Tags</span>
              </div>
              <div className="grid gap-1.5">
                <PracticeContextCard icon={Target} label="Objective" description="任务目标" value={practiceContext.objective} />
                <PracticeContextCard icon={Lightbulb} label="Hint" description="表达方向" value={practiceContext.hint} />
                <PracticeContextCard icon={Blocks} label="Chunks" description="推荐积木块" values={practiceContext.chunks} />
              </div>
            </section>

            {aiEnabled && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">逐轮 AI 评估</p>
                <div className="space-y-2">
                  {debug?.aiEvaluations.length ? [...debug.aiEvaluations].reverse().map((evaluation) => (
                    <PreviewEvaluationCard key={evaluation.id} evaluation={evaluation} />
                  )) : (
                    <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      提交测试文本后显示 AI 判断。
                    </p>
                  )}
                </div>
              </section>
            )}

            <section className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">整场 AI 复盘</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">使用当前已收集对话，测试用户端结束后的总结报告。</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={runSummary} disabled={summaryLoading}>
                  {summaryLoading ? '复盘中...' : '生成复盘'}
                </Button>
              </div>
              {summaryError && <p className="text-xs text-destructive">{summaryError}</p>}
              {summaryResult && (
                <details open className="rounded-md border border-border bg-card">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">查看复盘结果</summary>
                  <pre className="max-h-[360px] overflow-auto border-t border-border bg-muted/30 p-2 text-[11px] leading-relaxed">
                    {JSON.stringify(summaryResult, null, 2)}
                  </pre>
                </details>
              )}
            </section>
          </TabsContent>

          <TabsContent value="history" className="mt-0 space-y-2 p-3">
            {debug?.history.length ? debug.history.map((line, index) => (
              <div key={`${line.speaker}-${index}`} className="rounded-md border border-border bg-card px-3 py-2">
                <p className="text-[11px] font-semibold text-muted-foreground">{index + 1}. {line.speaker || 'Narrator'}</p>
                <p className="mt-0.5 text-sm leading-5">{line.text}</p>
              </div>
            )) : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">开始预览后这里会显示台词和用户输入。</p>}
          </TabsContent>

          <TabsContent value="debug" className="mt-0 space-y-2 p-3">
            <details open className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">当前 Tags</summary>
              <div className="flex min-h-8 flex-wrap gap-1 border-t border-border p-2">
                {debug?.currentTags.length ? debug.currentTags.map((tag) => (
                  <Badge key={tag} variant={tag === 'input' || tag === 'wait' ? 'default' : 'secondary'} className="text-[10px]">#{tag}</Badge>
                )) : <span className="text-xs text-muted-foreground">暂无 tags</span>}
              </div>
            </details>
            <details className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">背景</summary>
              <div className="border-t border-border p-2 text-xs">
                <p>fit: <span className="font-mono">{debug?.activeBackground.fit ?? '-'}</span></p>
                <p className="mt-1 break-all">url: <span className="font-mono">{debug?.activeBackground.url ?? '-'}</span></p>
              </div>
            </details>
            <details className="rounded-md border border-border bg-card">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">AI 评估 Payload</summary>
              <pre className="max-h-[420px] overflow-auto border-t border-border bg-muted/30 p-2 text-[11px] leading-relaxed">
                {formattedPayload}
              </pre>
            </details>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

function extractPracticeContext(tags: string[]) {
  const readValue = (prefix: string) => {
    const value = tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length).trim()
    if (!value) return ''
    try { return decodeURIComponent(value) } catch { return value }
  }

  const readList = (prefix: string) => {
    const list: string[] = []
    for (const tag of tags) {
      if (!tag.startsWith(prefix)) continue
      const raw = tag.slice(prefix.length).trim()
      if (!raw) continue
      const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
      // One tag may contain comma/semicolon-separated values OR be a single value
      decoded.split(/[,;，；]/).forEach((item) => {
        const trimmed = item.trim()
        if (trimmed) list.push(trimmed)
      })
    }
    return list
  }

  return {
    objective: readValue('objective:'),
    hint: readValue('hint:'),
    chunks: readList('chunks:'),
  }
}

function PreviewEvaluationCard({ evaluation }: { evaluation: PreviewAiEvaluation }) {
  const result = evaluation.result
  const isLoading = evaluation.status === 'loading'
  const isError = evaluation.status === 'error'
  const isPassed = result?.passed

  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">用户输入</p>
          <p className="mt-1 text-sm leading-5">{evaluation.userText}</p>
        </div>
        <Badge variant={isPassed ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
          {isLoading ? '评估中' : isError ? '请求失败' : isPassed ? '符合预期' : '需要调整'}
        </Badge>
      </div>
      {isError && <p className="mt-3 text-xs text-destructive">{evaluation.error}</p>}
      {result && (
        <div className="mt-2 space-y-1.5 border-t border-border pt-2 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>intent: <code>{result.intent}</code></span>
            <span>confidence: <code>{result.confidence}</code></span>
          </div>
          <p className="leading-5">{result.feedback || 'AI 未返回文字反馈'}</p>
          <EvaluationList label="完成目标" items={result.objectiveCompleted} />
          <EvaluationList label="命中 Chunks" items={result.chunksUsed} />
        </div>
      )}
    </div>
  )
}

function EvaluationList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.length
          ? items.map((item) => <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>)
          : <span className="text-[11px] text-muted-foreground">无</span>}
      </div>
    </div>
  )
}

function PracticeContextCard({
  icon: Icon,
  label,
  description,
  value,
  values,
}: {
  icon: typeof Target
  label: string
  description: string
  value?: string
  values?: string[]
}) {
  const hasValue = Boolean(value || values?.length)

  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-primary" />
        <p className="text-xs font-semibold">{label}</p>
        <span className="text-[10px] text-muted-foreground">{description}</span>
      </div>
      {values?.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {values.map((item) => <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>)}
        </div>
      ) : (
        <p className={cn('mt-1 text-xs leading-5', hasValue ? 'text-foreground' : 'text-muted-foreground')}>{value || '未配置'}</p>
      )}
    </div>
  )
}

function DebugMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  )
}
