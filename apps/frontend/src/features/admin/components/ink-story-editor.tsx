import { useState, useCallback, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Eye, Wand2, AlertTriangle, MapPin, MessageSquare, GitBranch, UserRound, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { compileInk, extractInkMeta, defaultInkTemplate } from './ink-compiler'
import { VnStoryPreview, type CharacterSpriteMap } from './vn-story-preview'
import type { GameLocationData, GameCharacter } from '../api-content-admin'

// ─── 从角色列表构建立绘映射 ────────────────────────────────

function buildCharacterSpriteData(characters: GameCharacter[]): {
  sprites: Record<string, CharacterSpriteMap>
  positions: Record<string, 'left' | 'center' | 'right'>
} {
  const sprites: Record<string, CharacterSpriteMap> = {}
  const positions: Record<string, 'left' | 'center' | 'right'> = {}

  for (const char of characters) {
    const map: CharacterSpriteMap = {}
    if (char.expressions && typeof char.expressions === 'object') {
      Object.assign(map, char.expressions as Record<string, string>)
    }
    if (!map['default'] && char.spriteBaseUrl) map['default'] = char.spriteBaseUrl
    if (Object.keys(map).length > 0) {
      sprites[char.name] = map
      sprites[char.displayName] = map
    }
    const pos = char.defaultPosition as 'left' | 'center' | 'right' | undefined
    if (pos) {
      positions[char.name] = pos
      positions[char.displayName] = pos
    }
  }
  return { sprites, positions }
}

// ─── 语法提示 ──────────────────────────────────────────────

const INK_SYNTAX_HINT = `Ink 语法速查：
=== knot ===  定义场景    # tag  标签（# speaker:Alex / # expression:happy / # bg:url）
* [选项文本]  分支选项（不会回显）    +  粘性选项（不消失）    -> target  跳转    -> END  结束
{var}  显示变量    ~ temp  临时变量    VAR x = 0  全局变量`

type VisualScriptItem =
  | { type: 'knot'; name: string; lineNumber: number; raw: string }
  | { type: 'line'; speaker?: string; text: string; tags: string[]; lineNumber: number; raw: string }
  | { type: 'choice'; text: string; target?: string; lineNumber: number; raw: string }
  | { type: 'tag'; value: string; lineNumber: number; raw: string }
  | { type: 'divert'; target: string; lineNumber: number; raw: string }

function parseVisualScript(source: string): VisualScriptItem[] {
  const { remainingSource } = extractInkMeta(source)
  const items: VisualScriptItem[] = []
  let tags: string[] = []

  for (const [lineIndex, rawLine] of remainingSource.split('\n').entries()) {
    const lineNumber = lineIndex + 1
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    const knot = line.match(/^={3,}\s*([^=]+?)\s*={3,}$/)
    if (knot) {
      items.push({ type: 'knot', name: knot[1].trim(), lineNumber, raw: rawLine })
      tags = []
      continue
    }

    if (line.startsWith('#')) {
      const value = line.slice(1).trim()
      items.push({ type: 'tag', value, lineNumber, raw: rawLine })
      tags = [...tags, value]
      continue
    }

    const choice = line.match(/^\*\s*(.+?)(?:\s*->\s*(.+))?$/)
    if (choice) {
      const text = choice[1].trim().replace(/^\[(.*)\]$/, '$1')
      items.push({ type: 'choice', text, target: choice[2]?.trim(), lineNumber, raw: rawLine })
      continue
    }

    if (line.startsWith('->')) {
      items.push({ type: 'divert', target: line.replace(/^->\s*/, '').trim(), lineNumber, raw: rawLine })
      continue
    }

    const spoken = line.match(/^([^:：]{1,24})[:：]\s*(.+)$/)
    items.push({
      type: 'line',
      speaker: spoken?.[1]?.trim(),
      text: spoken?.[2]?.trim() ?? line,
      tags,
      lineNumber,
      raw: rawLine,
    })
    tags = []
  }

  return items
}

// ─── Props ─────────────────────────────────────────────────

interface InkStoryEditorProps {
  initialSource?: string
  initialKey?: string
  initialTitle?: string
  initialLocationId?: string
  initialCharacterId?: string
  locations?: GameLocationData[]
  characters?: GameCharacter[]
  onSave?: (data: {
    key: string; title: string; inkSource: string
    inkJson: Record<string, any>; locationId?: string; characterId?: string
  }) => void
  saving?: boolean
  readOnly?: boolean
  className?: string
}

/**
 * Ink 故事编辑器 — 使用 inkjs v2.4.0 Compiler
 * 编辑标准 Ink 脚本语法，实时编译预览
 */
export function InkStoryEditor({
  initialSource,
  initialKey = '',
  initialTitle = '',
  initialLocationId,
  initialCharacterId,
  locations = [],
  characters = [],
  onSave,
  saving = false,
  readOnly = false,
  className,
}: InkStoryEditorProps) {
  const [source, setSource] = useState(initialSource || defaultInkTemplate())
  const [editorMode, setEditorMode] = useState<'design' | 'ink'>('design')

  // Meta fields
  const [key, setKey] = useState(initialKey)
  const [title, setTitle] = useState(initialTitle)
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [characterId, setCharacterId] = useState(initialCharacterId || '')
  const [visualSpeaker, setVisualSpeaker] = useState('')
  const [visualExpression, setVisualExpression] = useState('default')
  const [visualLine, setVisualLine] = useState('')
  const [visualChoice, setVisualChoice] = useState('')
  const [visualChoiceTarget, setVisualChoiceTarget] = useState('END')
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | null>(null)
  const [selectedLineText, setSelectedLineText] = useState('')

  // Compile on source change
  const [compileResult, setCompileResult] = useState<ReturnType<typeof compileInk> | null>(null)

  useEffect(() => {
    const result = compileInk(source)
    setCompileResult(result)
  }, [source])

  // Extract meta from source
  const meta = useMemo(() => extractInkMeta(source), [source])
  const visualScriptItems = useMemo(() => parseVisualScript(source), [source])

  useEffect(() => {
    setSource(initialSource || defaultInkTemplate({ key: initialKey, title: initialTitle }))
    setKey(initialKey)
    setTitle(initialTitle)
    setLocationId(initialLocationId || '')
    setCharacterId(initialCharacterId || '')
  }, [initialSource, initialKey, initialTitle, initialLocationId, initialCharacterId])

  // Build character sprite data
  const { sprites: charSprites, positions: charPositions } = useMemo(
    () => buildCharacterSpriteData(characters), [characters],
  )

  const defaultChar = useMemo(() => {
    if (characterId) {
      const c = characters.find((ch) => ch.id === characterId)
      return c?.name || c?.displayName
    }
    return undefined
  }, [characterId, characters])

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === locationId),
    [locationId, locations],
  )

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === characterId),
    [characterId, characters],
  )

  const expressionOptions = useMemo(() => {
    const names = new Set<string>(['default'])
    const expressions = selectedCharacter?.expressions
    if (expressions && typeof expressions === 'object') {
      Object.keys(expressions as Record<string, string>).forEach((name) => names.add(name))
    }
    return Array.from(names)
  }, [selectedCharacter])

  useEffect(() => {
    if (!selectedCharacter) return
    setVisualSpeaker(selectedCharacter.name || selectedCharacter.displayName)
  }, [selectedCharacter])

  // Sync meta from source
  const handleSourceChange = useCallback((value: string) => {
    setSource(value)
    const m = extractInkMeta(value)
    if (m.key) setKey(m.key)
    if (m.title) setTitle(m.title)
    if (m.locationId) setLocationId(m.locationId)
    if (m.characterId) setCharacterId(m.characterId)
  }, [])

  const insertTemplate = useCallback(() => {
    setSource(defaultInkTemplate({ key, title }))
  }, [key, title])

  const appendToSource = useCallback((block: string) => {
    setSource((prev) => `${prev.trimEnd()}\n\n${block.trim()}\n`)
  }, [])

  const replaceVisualLine = useCallback(() => {
    if (!selectedLineNumber) return
    const { remainingSource, ...meta } = extractInkMeta(source)
    const lines = remainingSource.split('\n')
    lines[selectedLineNumber - 1] = selectedLineText
    const metaLines = ['---']
    if (meta.key) metaLines.push(`key: ${meta.key}`)
    if (meta.title) metaLines.push(`title: ${meta.title}`)
    if (meta.locationId) metaLines.push(`locationId: ${meta.locationId}`)
    if (meta.characterId) metaLines.push(`characterId: ${meta.characterId}`)
    metaLines.push('---', '')
    setSource(`${metaLines.join('\n')}${lines.join('\n')}`)
  }, [selectedLineNumber, selectedLineText, source])

  const deleteVisualLine = useCallback(() => {
    if (!selectedLineNumber) return
    const { remainingSource, ...meta } = extractInkMeta(source)
    const lines = remainingSource.split('\n')
    lines.splice(selectedLineNumber - 1, 1)
    const metaLines = ['---']
    if (meta.key) metaLines.push(`key: ${meta.key}`)
    if (meta.title) metaLines.push(`title: ${meta.title}`)
    if (meta.locationId) metaLines.push(`locationId: ${meta.locationId}`)
    if (meta.characterId) metaLines.push(`characterId: ${meta.characterId}`)
    metaLines.push('---', '')
    setSource(`${metaLines.join('\n')}${lines.join('\n')}`)
    setSelectedLineNumber(null)
    setSelectedLineText('')
  }, [selectedLineNumber, source])

  const selectVisualItem = useCallback((item: VisualScriptItem) => {
    setSelectedLineNumber(item.lineNumber)
    setSelectedLineText(item.raw)
  }, [])

  const applyLocationBackground = useCallback(() => {
    if (!selectedLocation?.backgroundUrl) return
    appendToSource(`# bg:${selectedLocation.backgroundUrl}`)
  }, [appendToSource, selectedLocation])

  const appendDialogue = useCallback(() => {
    const line = visualLine.trim()
    if (!line) return
    const speaker = visualSpeaker.trim()
    const block = [
      speaker ? `# speaker:${speaker}` : '',
      visualExpression ? `# expression:${visualExpression}` : '',
      speaker ? `${speaker}: ${line}` : line,
    ].filter(Boolean).join('\n')
    appendToSource(block)
    setVisualLine('')
  }, [appendToSource, visualExpression, visualLine, visualSpeaker])

  const appendWaitPoint = useCallback(() => {
    appendToSource('# wait')
  }, [appendToSource])

  const appendChoice = useCallback(() => {
    const text = visualChoice.trim()
    if (!text) return
    const target = visualChoiceTarget.trim() || 'END'
    appendToSource(`*   [${text}] -> ${target}`)
    setVisualChoice('')
  }, [appendToSource, visualChoice, visualChoiceTarget])

  const handleSave = useCallback(() => {
    if (!onSave) return
    const result = compileInk(source)
    if (!result.success || !result.json) return

    onSave({
      key, title,
      inkSource: source,
      inkJson: result.json,
      locationId: locationId || undefined,
      characterId: characterId || undefined,
    })
  }, [onSave, source, key, title, locationId, characterId])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Key</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="story_key"
            className="h-8 text-xs" disabled={readOnly} />
        </div>
        <div>
          <Label className="text-xs">标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="故事标题"
            className="h-8 text-xs" disabled={readOnly} />
        </div>
        <div>
          <Label className="text-xs">绑定地点</Label>
          <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={readOnly}>
            <option value="">不限</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.displayName}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs">绑定角色</Label>
          <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={characterId} onChange={(e) => setCharacterId(e.target.value)} disabled={readOnly}>
            <option value="">不限</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
          </select>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'design' | 'ink')}>
              <TabsList className="h-7">
                <TabsTrigger value="design" className="text-xs px-2.5">可视化编排</TabsTrigger>
                <TabsTrigger value="ink" className="text-xs px-2.5">Ink 脚本</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              {editorMode === 'ink' && (
                <Button variant="ghost" size="sm" onClick={insertTemplate} className="h-7 gap-1 text-xs">
                  <Wand2 className="size-3" />模板
                </Button>
              )}
              {onSave && !readOnly && (
                <Button size="sm" onClick={handleSave}
                  disabled={saving || !key || !title || !compileResult?.success}
                  className="h-7 gap-1 text-xs">
                  {saving ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={editorMode}>
            <TabsContent value="design" className="mt-0">
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="rounded-md border border-border/70 bg-background">
                  <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                    <p className="text-sm font-medium">当前脚本结构</p>
                    <Badge variant={compileResult?.success ? 'success' : 'destructive'} className="text-[10px]">
                      {compileResult?.success ? '可预览' : '需修正'}
                    </Badge>
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto p-2">
                    {visualScriptItems.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted-foreground">还没有可显示的脚本内容</p>
                    ) : visualScriptItems.map((item, index) => {
                      const active = selectedLineNumber === item.lineNumber
                      const itemClass = cn(
                        'w-full rounded text-left transition-colors hover:bg-muted/60',
                        active && 'bg-primary/10 ring-1 ring-primary/20',
                      )
                      if (item.type === 'knot') {
                        return (
                          <button key={index} type="button" className={cn(itemClass, 'bg-muted px-2 py-1 font-mono text-xs font-semibold')} onClick={() => selectVisualItem(item)}>
                            === {item.name} ===
                          </button>
                        )
                      }
                      if (item.type === 'line') {
                        return (
                          <button key={index} type="button" className={cn(itemClass, 'border border-border/60 px-2 py-1.5')} onClick={() => selectVisualItem(item)}>
                            <div className="flex items-center gap-2">
                              {item.speaker && <Badge variant="outline" className="text-[10px]">{item.speaker}</Badge>}
                              {item.tags.filter((tag) => tag.startsWith('expression:')).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">{tag.replace('expression:', '')}</Badge>
                              ))}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed">{item.text}</p>
                          </button>
                        )
                      }
                      if (item.type === 'choice') {
                        return (
                          <button key={index} type="button" className={cn(itemClass, 'bg-primary/5 px-2 py-1 text-xs')} onClick={() => selectVisualItem(item)}>
                            选项：{item.text}{item.target ? ` -> ${item.target}` : ''}
                          </button>
                        )
                      }
                      if (item.type === 'tag') {
                        return (
                          <button key={index} type="button" className={cn(itemClass, 'px-2 py-0.5 font-mono text-[11px] text-muted-foreground')} onClick={() => selectVisualItem(item)}>
                            #{item.value}
                          </button>
                        )
                      }
                      return (
                        <button key={index} type="button" className={cn(itemClass, 'px-2 py-0.5 font-mono text-[11px] text-muted-foreground')} onClick={() => selectVisualItem(item)}>
                          -&gt; {item.target}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedLineNumber && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">编辑第 {selectedLineNumber} 行</p>
                      <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={deleteVisualLine}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <Input
                      className="font-mono text-xs"
                      value={selectedLineText}
                      onChange={(e) => setSelectedLineText(e.target.value)}
                      disabled={readOnly}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedLineNumber(null); setSelectedLineText('') }}>
                        取消
                      </Button>
                      <Button type="button" size="sm" onClick={replaceVisualLine} disabled={readOnly}>
                        <Pencil className="size-3.5" />应用修改
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">默认地点</Label>
                    <select className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={readOnly}>
                      <option value="">不限地点</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.displayName}</option>)}
                    </select>
                    {selectedLocation?.backgroundUrl && (
                      <Button type="button" variant="outline" size="sm" className="mt-2 h-7 gap-1.5 text-xs" onClick={applyLocationBackground}>
                        <MapPin className="size-3" />插入背景标签
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">默认角色</Label>
                    <select className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                      value={characterId} onChange={(e) => setCharacterId(e.target.value)} disabled={readOnly}>
                      <option value="">不限角色</option>
                      {characters.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                    </select>
                    {selectedCharacter && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Ink speaker: <code className="rounded bg-muted px-1">{selectedCharacter.name || selectedCharacter.displayName}</code>
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    <p className="text-sm font-medium">追加对话</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div>
                      <Label className="text-xs">说话人</Label>
                      <Input className="mt-1 h-8 text-sm" value={visualSpeaker}
                        onChange={(e) => setVisualSpeaker(e.target.value)}
                        placeholder={defaultChar || 'Alex'} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">表情</Label>
                      <select className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                        value={visualExpression} onChange={(e) => setVisualExpression(e.target.value)} disabled={readOnly}>
                        {expressionOptions.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                      </select>
                    </div>
                  </div>
                  <Textarea className="mt-3 min-h-24 text-sm" value={visualLine}
                    onChange={(e) => setVisualLine(e.target.value)}
                    placeholder="输入这一句对话，会自动生成 # speaker / # expression 标签..." disabled={readOnly} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={appendDialogue} disabled={readOnly || !visualLine.trim()}>
                      追加对话
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={appendWaitPoint} disabled={readOnly}>
                      插入等待点
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <GitBranch className="size-4 text-muted-foreground" />
                    <p className="text-sm font-medium">追加选项</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div>
                      <Label className="text-xs">选项文本</Label>
                      <Input className="mt-1 h-8 text-sm" value={visualChoice}
                        onChange={(e) => setVisualChoice(e.target.value)}
                        placeholder="挺好的，谢谢！" disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">跳转目标</Label>
                      <Input className="mt-1 h-8 text-sm" value={visualChoiceTarget}
                        onChange={(e) => setVisualChoiceTarget(e.target.value)}
                        placeholder="tour / END" disabled={readOnly} />
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={appendChoice}
                    disabled={readOnly || !visualChoice.trim()}>
                    追加选项
                  </Button>
                </div>

                <div className="rounded-md border border-border/70 bg-background p-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      复杂分支、knot 命名和变量仍可在 Ink 脚本 tab 里精修。
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="ink" className="mt-0">
              <Textarea
                className="min-h-[400px] font-mono text-xs leading-relaxed"
                value={source}
                onChange={(e) => handleSourceChange(e.target.value)}
                placeholder="输入 Ink 脚本..."
                disabled={readOnly}
                spellCheck={false}
              />
              {/* Compilation status */}
              {compileResult && (
                <div className={cn(
                  'mt-1.5 rounded-md px-3 py-1.5 text-xs',
                  compileResult.success
                    ? 'border border-green-500/20 bg-green-500/5 text-green-600'
                    : 'border border-destructive/20 bg-destructive/5 text-destructive',
                )}>
                  {compileResult.success ? (
                    <span>✓ 编译成功{compileResult.warnings.length > 0 ? ` (${compileResult.warnings.length} 个警告)` : ''}</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1"><AlertTriangle className="size-3" />编译失败</span>
                      {compileResult.errors.map((e, i) => (
                        <span key={i} className="font-mono text-[11px] opacity-80">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Syntax hint */}
              <div className="mt-1.5 rounded-md border border-border/60 bg-muted/30 p-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{INK_SYNTAX_HINT}</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">VN 预览</span>
          </div>
          <VnStoryPreview
            inkSource={source}
            characterSprites={charSprites}
            characterPositions={charPositions}
            defaultBackgroundUrl={selectedLocation?.backgroundUrl ?? undefined}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
