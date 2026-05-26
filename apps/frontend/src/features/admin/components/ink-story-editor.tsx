import { useState, useCallback } from 'react'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Code, Eye, FileText, Wand2, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { parseInkDsl, compileToInkJson, type SimpleStory } from './ink-dsl'
import { VnStoryPreview } from './vn-story-preview'
import {
  type GameLocationData,
  type GameCharacter,
} from '../api-content-admin'

// ─── 默认 DSL 模板 ───────────────────────────────────────────

const DEFAULT_DSL_TEMPLATE = `---
key: my_story
title: 我的故事
---

# start
bg: https://images.unsplash.com/photo-1527261834078-9b6a7b7b9c3c?w=800

Alex: 嗨！欢迎来到这里。
今天过得怎么样？

*choice*
- 挺好的，谢谢！
- 有点累，但是还不错。
- 我想四处看看。

Alex: 太好了！让我带你参观一下吧。
这里是我们最受欢迎的地方之一。

*wait*

#end
`

// ─── 辅助：从 DSL 中提取元数据 ──────────────────────────────

function extractMeta(dsl: string): {
  key: string; title: string; locationId?: string; characterId?: string
} {
  try {
    const story = parseInkDsl(dsl)
    return {
      key: story.meta.key || '',
      title: story.meta.title || '',
      locationId: story.meta.locationId,
      characterId: story.meta.characterId,
    }
  } catch {
    return { key: '', title: '' }
  }
}

// ─── 组件 Props ─────────────────────────────────────────────

interface InkStoryEditorProps {
  /** 初始 DSL 源码 */
  initialSource?: string
  /** 初始元数据 */
  initialKey?: string
  initialTitle?: string
  initialLocationId?: string
  initialCharacterId?: string
  /** 可选的地点列表 */
  locations?: GameLocationData[]
  /** 可选的角色列表 */
  characters?: GameCharacter[]
  /** 保存回调 */
  onSave?: (data: {
    key: string
    title: string
    inkSource: string
    inkJson: Record<string, any>
    locationId?: string
    characterId?: string
  }) => void
  /** 是否正在保存 */
  saving?: boolean
  /** 只读模式 */
  readOnly?: boolean
  className?: string
}

/**
 * Ink 故事编辑器 — 双模式（DSL / JSON）+ 实时预览
 *
 * 设计：
 * - 左侧/上方：编辑器（DSL Markdown 或 Raw JSON）
 * - 右侧/下方：VN 预览
 * - 顶部：元数据表单（key, title, 绑定地点/角色）
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
  const [source, setSource] = useState(initialSource || DEFAULT_DSL_TEMPLATE)
  const [editorMode, setEditorMode] = useState<'dsl' | 'json'>('dsl')
  const [jsonStr, setJsonStr] = useState(() => {
    if (initialSource) {
      try {
        const story = parseInkDsl(initialSource)
        return JSON.stringify(compileToInkJson(story), null, 2)
      } catch {
        return '{}'
      }
    }
    try {
      const story = parseInkDsl(DEFAULT_DSL_TEMPLATE)
      return JSON.stringify(compileToInkJson(story), null, 2)
    } catch {
      return '{}'
    }
  })

  // Meta fields
  const [key, setKey] = useState(initialKey)
  const [title, setTitle] = useState(initialTitle)
  const [locationId, setLocationId] = useState(initialLocationId || '')
  const [characterId, setCharacterId] = useState(initialCharacterId || '')

  // Parse DSL whenever source changes
  const [parsedStory, setParsedStory] = useState<SimpleStory | null>(() => {
    try {
      const src = initialSource || DEFAULT_DSL_TEMPLATE
      return parseInkDsl(src)
    } catch { return null }
  })

  // Handle source changes
  const handleSourceChange = useCallback((value: string) => {
    setSource(value)
    // Try parsing for live preview
    try {
      const story = parseInkDsl(value)
      setParsedStory(story)
      // Update meta from source
      if (story.meta.key) setKey(story.meta.key)
      if (story.meta.title) setTitle(story.meta.title)
      if (story.meta.locationId) setLocationId(story.meta.locationId)
      if (story.meta.characterId) setCharacterId(story.meta.characterId)
      // Also update JSON view
      setJsonStr(JSON.stringify(compileToInkJson(story), null, 2))
    } catch {
      // Invalid DSL, keep previous parsed story but mark as error
    }
  }, [])

  // Handle JSON changes
  const handleJsonChange = useCallback((value: string) => {
    setJsonStr(value)
  }, [])

  // Insert template
  const insertTemplate = useCallback(() => {
    setSource(DEFAULT_DSL_TEMPLATE)
    try {
      const story = parseInkDsl(DEFAULT_DSL_TEMPLATE)
      setParsedStory(story)
      setJsonStr(JSON.stringify(compileToInkJson(story), null, 2))
    } catch { /* ignore */ }
  }, [])

  // Handle save
  const handleSave = useCallback(() => {
    if (!onSave) return
    let inkJson: Record<string, any>
    if (editorMode === 'dsl') {
      try {
        const story = parseInkDsl(source)
        inkJson = compileToInkJson(story)
      } catch {
        // Fallback to raw source as JSON
        inkJson = { inkVersion: 21, root: [], listDefs: {}, _raw: source }
      }
    } else {
      try {
        inkJson = JSON.parse(jsonStr)
      } catch {
        inkJson = {}
      }
    }
    onSave({
      key,
      title,
      inkSource: source,
      inkJson,
      locationId: locationId || undefined,
      characterId: characterId || undefined,
    })
  }, [onSave, editorMode, source, jsonStr, key, title, locationId, characterId])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Meta data form */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Key</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="story_key"
            className="h-8 text-xs"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-xs">标题</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="故事标题"
            className="h-8 text-xs"
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-xs">绑定地点</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">不限</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">绑定角色</Label>
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            disabled={readOnly}
          >
            <option value="">不限</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Editor Panel */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'dsl' | 'json')}>
                <TabsList className="h-7">
                  <TabsTrigger value="dsl" className="text-xs gap-1 px-2.5">
                    <FileText className="size-3" />
                    Markdown DSL
                  </TabsTrigger>
                  <TabsTrigger value="json" className="text-xs gap-1 px-2.5">
                    <Code className="size-3" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1">
              {editorMode === 'dsl' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={insertTemplate}
                  className="h-7 gap-1 text-xs"
                >
                  <Wand2 className="size-3" />
                  模板
                </Button>
              )}
              {onSave && !readOnly && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !key || !title}
                  className="h-7 gap-1 text-xs"
                >
                  {saving ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </div>

          <Tabs value={editorMode} className="flex-1">
            <TabsContent value="dsl" className="mt-0 h-full">
              <MarkdownEditor
                value={source}
                onChange={(val) => handleSourceChange(val || '')}
                height={420}
                preview="edit"
                minimal={false}
                placeholder="输入 Ink Markdown DSL..."
                disabled={readOnly}
              />
              <div className="mt-1.5 rounded-md border border-border/60 bg-muted/30 p-2">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground/70">语法参考：</span>
                  <code className="rounded bg-muted px-1 text-[10px]"># scene_id</code> 场景 ·
                  <code className="rounded bg-muted px-1 text-[10px]">Name: 对话</code> 角色对话 ·
                  <code className="rounded bg-muted px-1 text-[10px]">*choice*</code> 选项 ·
                  <code className="rounded bg-muted px-1 text-[10px]">- 文本 -&gt; scene</code> 跳转 ·
                  <code className="rounded bg-muted px-1 text-[10px]">#end</code> 结束 ·
                  <code className="rounded bg-muted px-1 text-[10px]">*wait*</code> 等待输入 ·
                  <code className="rounded bg-muted px-1 text-[10px]">bg: url</code> 背景
                </p>
              </div>
            </TabsContent>
            <TabsContent value="json" className="mt-0">
              <Textarea
                className="min-h-[420px] font-mono text-xs"
                value={jsonStr}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder='{"inkVersion":21,"root":[...],"listDefs":{}}'
                disabled={readOnly}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">VN 预览</span>
          </div>
          <VnStoryPreview
            story={editorMode === 'dsl' ? (parsedStory ?? undefined) : undefined}
            dslSource={editorMode === 'dsl' ? source : undefined}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}
