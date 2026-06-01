import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Code, BookOpen, MapPin, Users, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  listStories, createStory, updateStory, deleteStory, getStory,
  listLocations, listCharacters,
  type StoryData, type GameLocationData, type GameCharacter,
} from '../api-content-admin'

export function AdminStoriesPage() {
  const [items, setItems] = useState<StoryData[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<StoryData | null>(null)
  const [saving, setSaving] = useState(false)
  const [locations, setLocations] = useState<GameLocationData[]>([])
  const [characters, setCharacters] = useState<GameCharacter[]>([])

  // Form state
  const [key, setKey] = useState('')
  const [title, setTitle] = useState('')
  const [scriptType, setScriptType] = useState('practice')
  const [locationId, setLocationId] = useState('')
  const [characterId, setCharacterId] = useState('')
  const [inkJsonStr, setInkJsonStr] = useState('')
  const [jsonError, setJsonError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [stories, locs, chars] = await Promise.all([
        listStories(), listLocations().catch(() => []), listCharacters().catch(() => []),
      ])
      setItems(stories.items)
      setLocations(locs)
      setCharacters(chars)
    } catch { toast.error('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditItem(null)
    setKey(''); setTitle(''); setScriptType('practice')
    setLocationId(''); setCharacterId('')
    setInkJsonStr(JSON.stringify({ inkVersion: 21, root: [], listDefs: {} }, null, 2))
    setJsonError('')
    setDialogOpen(true)
  }

  const openEdit = async (item: StoryData) => {
    setEditItem(item)
    setKey(item.key)
    setTitle(item.title)
    setScriptType(item.scriptType)
    setLocationId(item.locationId ?? '')
    setCharacterId(item.characterId ?? '')
    try {
      const full = await getStory(item.id)
      setInkJsonStr(JSON.stringify(full.inkJson, null, 2))
    } catch {
      setInkJsonStr(JSON.stringify(item.inkJson ?? {}, null, 2))
    }
    setJsonError('')
    setDialogOpen(true)
  }

  const save = async () => {
    if (!key || !title) { toast.error('Key 和标题必填'); return }
    let inkJson: any
    try {
      inkJson = JSON.parse(inkJsonStr)
      setJsonError('')
    } catch {
      setJsonError('JSON 格式错误')
      return
    }
    setSaving(true)
    try {
      const data: any = { key, title, scriptType, inkJson, version: (editItem?.version ?? 0) + 1 }
      if (locationId) {
        data.locationId = locationId
        // Also set topicId to null to avoid conflicts (use locationId instead)
      }
      if (characterId) data.characterId = characterId
      if (editItem) {
        await updateStory(editItem.id, data)
        toast.success('已更新')
      } else {
        await createStory(data)
        toast.success('已创建')
      }
      setDialogOpen(false)
      load()
    } catch { toast.error('保存失败') }
    finally { setSaving(false) }
  }

  const remove = async (item: StoryData) => {
    if (!confirm(`确定删除故事 "${item.title}"？`)) return
    try { await deleteStory(item.id); toast.success('已删除'); load() } catch { toast.error('删除失败') }
  }

  const getLocationName = (id?: string | null) => locations.find(l => l.id === id)?.displayName ?? '-'
  const getCharacterName = (id?: string | null) => characters.find(c => c.id === id)?.displayName ?? '-'

  // Generate a valid minimal Ink JSON template
  const insertTemplate = () => {
    const template = {
      inkVersion: 21,
      root: [
        ['^Hello! Welcome!', '\n', '#npc', '\n', 'end', null],
        ['^How can I help you today?', '\n', '#wait', '#user_input', '\n', 'end', null],
        ['^Great, let me help you with that.', '\n', '#npc', '\n', 'end', null],
      ],
      listDefs: {},
    }
    setInkJsonStr(JSON.stringify(template, null, 2))
    setJsonError('')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">故事管理</h1>
          <p className="text-sm text-muted-foreground">管理 Ink 对话脚本（视觉小说剧情），可绑定地点和角色</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1 size-4" />新建故事</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} className="transition-colors hover:border-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">{item.key}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit3 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(item)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">{item.scriptType}</Badge>
                {item.locationId && (
                  <Badge variant="outline" className="text-xs"><MapPin className="mr-0.5 size-3" />{getLocationName(item.locationId)}</Badge>
                )}
                {item.characterId && (
                  <Badge variant="outline" className="text-xs"><Users className="mr-0.5 size-3" />{getCharacterName(item.characterId)}</Badge>
                )}
                {item.trainingTopic && (
                  <Badge className="text-xs bg-green-500/10 text-green-600"><BookOpen className="mr-0.5 size-3" />{item.trainingTopic.title}</Badge>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">版本 {item.version} · {new Date(item.updatedAt).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? '编辑故事' : '新建故事'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Key (唯一标识)</Label><Input value={key} onChange={e => setKey(e.target.value)} placeholder="practice_check_in" /></div>
              <div><Label>标题</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="宿舍入住对话" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>类型</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={scriptType} onChange={e => setScriptType(e.target.value)}>
                  <option value="practice">练习</option><option value="episode">剧本关卡</option><option value="side_quest">支线</option><option value="free_talk">自由对话</option>
                </select>
              </div>
              <div>
                <Label>绑定地点</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">不限</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
                </select>
              </div>
              <div>
                <Label>绑定角色</Label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={characterId} onChange={e => setCharacterId(e.target.value)}>
                  <option value="">不限</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Ink JSON (对话脚本)</Label>
                <Button variant="ghost" size="sm" onClick={insertTemplate}><Code className="mr-1 size-3" />插入模板</Button>
              </div>
              <Textarea
                className="font-mono text-xs min-h-[300px]"
                value={inkJsonStr}
                onChange={e => { setInkJsonStr(e.target.value); setJsonError('') }}
                placeholder='{"inkVersion":21,"root":[...],"listDefs":{}}'
              />
              {jsonError && <p className="text-xs text-destructive mt-1">{jsonError}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Ink JSON 格式：<code>{"{ inkVersion, root: [[\"^text\", \"\\n\", \"#tag\"], ...], listDefs: {} }"}</code>
                <br />标签: <code>#npc</code> = NPC说话, <code>#wait</code> = 等待用户输入, <code>#hint</code> = 显示提示
              </p>
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
