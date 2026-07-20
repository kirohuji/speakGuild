import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Loader2, Plus, RefreshCw, Search, Trash2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { listAiProviders, type AiProviderItem } from '../api-ai-models'
import { createTtsVoice, deleteTtsVoice, listTtsVoices, syncTtsVoices, updateTtsVoice, type TtsVoiceAsset } from '../api-content-admin'
import { TtsVoiceTester } from './tts-voice-tester'

const emptyForm = { providerId: '', externalVoiceId: '', displayName: '', category: 'system', language: '', gender: '', description: '', previewUrl: '', isAvailable: true }

export function VoiceAssetsTab() {
  const [providers, setProviders] = useState<AiProviderItem[]>([])
  const [voices, setVoices] = useState<TtsVoiceAsset[]>([])
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TtsVoiceAsset | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    const [groups, items] = await Promise.all([listAiProviders(), listTtsVoices()])
    setProviders(groups.tts ?? [])
    setVoices(items)
  }, [])

  useEffect(() => { void load().catch(() => toast.error('音色资产加载失败')) }, [load])

  const filtered = useMemo(() => voices.filter((voice) => {
    const matchesProvider = providerFilter === 'all' || voice.providerId === providerFilter
    const q = search.trim().toLowerCase()
    return matchesProvider && (!q || `${voice.displayName} ${voice.externalVoiceId} ${voice.provider.label}`.toLowerCase().includes(q))
  }), [providerFilter, search, voices])
  const selectedProvider = providers.find((provider) => provider.id === form.providerId)

  const edit = (voice?: TtsVoiceAsset) => {
    setEditing(voice ?? null)
    setForm(voice ? {
      providerId: voice.providerId, externalVoiceId: voice.externalVoiceId, displayName: voice.displayName,
      category: voice.category, language: voice.language ?? '', gender: voice.gender ?? '',
      description: voice.description ?? '', previewUrl: voice.previewUrl ?? '', isAvailable: voice.isAvailable,
    } : { ...emptyForm, providerId: providers.find((item) => item.isActive)?.id ?? providers[0]?.id ?? '' })
    setOpen(true)
  }

  const save = async () => {
    if (!form.providerId || !form.externalVoiceId.trim() || !form.displayName.trim()) return
    setSaving(true)
    try {
      if (editing) await updateTtsVoice(editing.id, form)
      else await createTtsVoice(form)
      setOpen(false)
      await load()
      toast.success(editing ? '音色资产已更新' : '音色资产已添加')
    } catch { toast.error('保存失败，请检查 Voice ID 是否重复') }
    finally { setSaving(false) }
  }

  const remove = async (voice: TtsVoiceAsset) => {
    if (!confirm(`确定删除音色“${voice.displayName}”？`)) return
    try { await deleteTtsVoice(voice.id); await load(); toast.success('音色已删除') }
    catch { toast.error('删除失败；音色可能仍被角色引用') }
  }

  const sync = async () => {
    const providerId = providerFilter !== 'all' ? providerFilter : providers.find((item) => item.isActive)?.id
    if (!providerId) { toast.error('请先筛选一个 TTS 厂商，或激活默认厂商'); return }
    setSyncing(true)
    try { const result = await syncTtsVoices(providerId); await load(); toast.success(`已同步 ${result.synced} 个音色`) }
    catch (error: any) { toast.error(error?.message || '同步失败，请检查厂商 API 配置') }
    finally { setSyncing(false) }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1 sm:max-w-[320px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索音色名称或 Voice ID…" className="pl-9" /></div>
      <Select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="w-[160px]"><SelectItem value="all">全部厂商</SelectItem>{providers.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</Select>
      <span className="text-sm text-muted-foreground">{filtered.length} 个音色</span>
      <Button size="sm" variant="outline" className="ml-auto" disabled={syncing} onClick={() => void sync()}>{syncing ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}同步厂商音色</Button>
      <Button size="sm" onClick={() => edit()}><Plus className="mr-1 size-4" />手动添加</Button>
    </div>

    {filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((voice) => <Card key={voice.id} className="overflow-hidden"><CardContent className="p-4"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Volume2 className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{voice.displayName}</p><p className="truncate font-mono text-[11px] text-muted-foreground">{voice.externalVoiceId}</p></div><Button size="icon" variant="ghost" className="size-7" aria-label="编辑音色" onClick={() => edit(voice)}><Edit3 className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-7" aria-label="删除音色" onClick={() => void remove(voice)}><Trash2 className="size-3.5 text-destructive" /></Button></div><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="secondary">{voice.provider.label}</Badge><Badge variant="outline">{voice.category}</Badge>{voice.language && <Badge variant="outline">{voice.language}</Badge>}{voice._count?.characterBindings ? <Badge variant="outline">{voice._count.characterBindings} 个角色引用</Badge> : null}</div></div></div></CardContent></Card>)}</div> : <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">还没有匹配的音色资产</div>}

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? '编辑音色资产' : '添加音色资产'}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div><Label>TTS 厂商</Label><Select value={form.providerId} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, providerId: e.target.value })}><option value="">选择厂商</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></div><div><Label>资产类型</Label><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><SelectItem value="system">系统音色</SelectItem><SelectItem value="cloned">克隆音色</SelectItem><SelectItem value="designed">设计音色</SelectItem><SelectItem value="custom">自定义</SelectItem></Select></div><div><Label>显示名称</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="例如：Magnetic Male…" /></div><div><Label>Voice ID</Label><Input value={form.externalVoiceId} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, externalVoiceId: e.target.value })} className="font-mono" placeholder="厂商返回的音色 ID…" /></div><div><Label>语言</Label><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="例如：en-US…" /></div><div><Label>性别标签</Label><Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} placeholder="例如：female…" /></div><div className="sm:col-span-2"><Label>说明</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="声音年龄、口音与适用角色…" /></div><div className="sm:col-span-2"><TtsVoiceTester provider={selectedProvider?.provider} model={selectedProvider?.model} voiceId={form.externalVoiceId} /></div><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />允许角色引用</label></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={() => void save()} disabled={saving || !form.providerId || !form.externalVoiceId.trim() || !form.displayName.trim()}>{saving ? '保存中…' : '保存音色'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
