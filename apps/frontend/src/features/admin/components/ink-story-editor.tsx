import { useState, useCallback, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Code, Eye, Wand2, AlertTriangle } from 'lucide-react'
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
*  选项文本   分支选项    +  粘性选项（不消失）    -> target  跳转    -> END  结束
{var}  显示变量    ~ temp  临时变量    VAR x = 0  全局变量`

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
  const [editorMode, setEditorMode] = useState<'ink' | 'json'>('ink')
  const [jsonView, setJsonView] = useState('')

  // Meta fields
  const [key, setKey] = useState(initialKey)
  const [title, setTitle] = useState(initialTitle)
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [characterId, setCharacterId] = useState(initialCharacterId || '')

  // Compile on source change
  const [compileResult, setCompileResult] = useState<ReturnType<typeof compileInk> | null>(null)

  useEffect(() => {
    if (editorMode === 'json') {
      setCompileResult(null)
      return
    }
    const result = compileInk(source)
    setCompileResult(result)
    if (result.success && result.json) {
      setJsonView(JSON.stringify(result.json, null, 2))
    }
  }, [source, editorMode])

  // Extract meta from source
  const meta = useMemo(() => extractInkMeta(source), [source])

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

  const handleSave = useCallback(() => {
    if (!onSave) return
    let inkJson: Record<string, any>

    if (editorMode === 'json') {
      try { inkJson = JSON.parse(jsonView) }
      catch { inkJson = {} }
    } else {
      const result = compileInk(source)
      if (!result.success) return // Don't save invalid Ink
      inkJson = result.json!
    }

    onSave({
      key, title,
      inkSource: source,
      inkJson,
      locationId: locationId || undefined,
      characterId: characterId || undefined,
    })
  }, [onSave, editorMode, source, jsonView, key, title, locationId, characterId])

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
            <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'ink' | 'json')}>
              <TabsList className="h-7">
                <TabsTrigger value="ink" className="text-xs px-2.5">Ink 脚本</TabsTrigger>
                <TabsTrigger value="json" className="text-xs px-2.5">
                  <Code className="size-3 mr-1" />JSON
                </TabsTrigger>
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
                  disabled={saving || !key || !title || (editorMode === 'ink' && !compileResult?.success)}
                  className="h-7 gap-1 text-xs">
                  {saving ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={editorMode}>
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
            <TabsContent value="json" className="mt-0">
              <Textarea
                className="min-h-[400px] font-mono text-xs"
                value={jsonView}
                onChange={(e) => setJsonView(e.target.value)}
                placeholder='{"inkVersion":21,"root":[...],"listDefs":{}}'
                disabled={readOnly}
              />
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
            inkSource={editorMode === 'ink' ? source : undefined}
            inkJson={editorMode === 'json' ? (() => { try { return JSON.parse(jsonView) } catch { return undefined } })() : undefined}
            characterSprites={charSprites}
            characterPositions={charPositions}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
