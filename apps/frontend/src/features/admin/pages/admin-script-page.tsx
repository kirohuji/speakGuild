import { useState, useEffect } from 'react'
import {
    Plus, Trash2, Edit3, Search, Film, Target, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { AdminPagination, getPageItems, getTotalPages } from '../components/admin-pagination'
import { ChunkMultiSelect, DynamicStringList } from '../components/content-authoring-fields'
import {
    listScriptEpisodes, getScriptEpisode, createScriptEpisode, updateScriptEpisode, deleteScriptEpisode,
    listSceneCategories, listScenes, listAllChunks, listVocabularies,
    type StoryEpisode, type SceneCategory, type Scene, type Chunk, type Vocabulary,
} from '../api-content-admin'

export function AdminScriptPage({ sceneId }: { sceneId?: string } = {}) {
    const [episodes, setEpisodes] = useState<StoryEpisode[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [detail, setDetail] = useState<StoryEpisode | null>(null)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const load = async () => {
        setLoading(true)
        try {
            const eps = await listScriptEpisodes(sceneId)
            setEpisodes(eps)
        } catch { }
        finally { setLoading(false) }
    }

    const openDetail = async (episode: StoryEpisode) => {
        try {
            const full = await getScriptEpisode(episode.id)
            setDetail(full)
        } catch {
            setDetail(episode)
        }
    }

    useEffect(() => { load() }, [sceneId])

    const filteredEpisodes = episodes.filter((ep) =>
        !search || ep.title.includes(search) || ep.chapterTitle.includes(search) || ep.npcName?.includes(search)
    )
    const totalPages = getTotalPages(filteredEpisodes.length, pageSize)
    const pageItems = getPageItems(filteredEpisodes, Math.min(page, totalPages), pageSize)

    useEffect(() => { setPage(1) }, [search])

    if (detail) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setDetail(null)}>
                        <Edit3 className="size-4 rotate-90" />
                    </Button>
                    <div>
                        <h2 className="text-lg font-bold">{detail.title}</h2>
                        <p className="text-sm text-muted-foreground">{detail.chapterTitle} · {detail.scene?.title}</p>
                    </div>
                </div>
                <EpisodeDetailView episode={detail} onSaved={load} onClose={() => setDetail(null)} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">章节与剧集管理</h1>
                    <p className="text-sm text-muted-foreground">维护剧情包中的章节、剧集顺序和高级配置</p>
                </div>
                <EpisodeCreateButton onCreated={load} defaultSceneId={sceneId} />
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="搜索章节或剧集..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">剧集列表</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-2 p-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    ) : filteredEpisodes.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center">
                            <Film className="h-12 w-12 text-muted-foreground/30" />
                            <p className="mt-4 text-sm font-medium text-muted-foreground">
                                {search ? '没有匹配的剧集' : '暂无剧集'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/60">
                                {search ? '尝试更换搜索关键词' : '新增后会显示在这里'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-muted/40">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">剧集</th>
                                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">章节</th>
                                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">要求</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">记录</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {pageItems.map((ep) => (
                                        <tr
                                            key={ep.id}
                                            className="cursor-pointer transition-colors hover:bg-muted/30"
                                            onClick={() => openDetail(ep)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                        {ep.episodeOrder}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-sm font-medium">{ep.title}</span>
                                                            {ep.isPreview && <Badge variant="secondary" className="text-[10px]">体验</Badge>}
                                                            <Badge variant="outline" className="text-[10px]">{ep.requiredOutputLevel}</Badge>
                                                        </div>
                                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                            {ep.scene?.title ?? '未关联场景'} · {ep.npcName || '无 NPC'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-3 md:table-cell">
                                                <div className="text-sm font-medium">{ep.chapterTitle}</div>
                                                <div className="text-xs text-muted-foreground">{ep.chapterId}</div>
                                            </td>
                                            <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                                                词汇 {ep.vocabRequiredCount}/{ep.vocabTotalCount} · Chunk {ep.chunkRequiredCount}/{ep.chunkTotalCount}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                                                {ep._count?.records ?? 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <AdminPagination
                        total={filteredEpisodes.length}
                        page={Math.min(page, totalPages)}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                    />
                </CardContent>
            </Card>
        </div>
    )
}

function EpisodeCreateButton({ onCreated, defaultSceneId }: { onCreated: () => void; defaultSceneId?: string }) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> 新建剧集</Button>
            <EpisodeEditDialog open={open} onClose={() => setOpen(false)} edit={null} onSaved={onCreated} defaultSceneId={defaultSceneId} />
        </>
    )
}

function EpisodeDetailView({ episode, onSaved, onClose }: { episode: StoryEpisode; onSaved: () => void; onClose: () => void }) {
    const [editOpen, setEditOpen] = useState(false)
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">剧集配置</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                        <Edit3 className="size-3.5 mr-1" /> 编辑
                    </Button>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div><dt className="text-muted-foreground">章节</dt><dd className="font-medium">{episode.chapterTitle} ({episode.chapterId})</dd></div>
                        <div><dt className="text-muted-foreground">排序</dt><dd className="font-medium">第 {episode.episodeOrder} 关</dd></div>
                        <div><dt className="text-muted-foreground">场景</dt><dd className="font-medium">{episode.scene?.title ?? '-'}</dd></div>
                        <div><dt className="text-muted-foreground">NPC</dt><dd className="font-medium">{episode.npcName} · {episode.npcRole}</dd></div>
                        <div><dt className="text-muted-foreground">输出要求</dt><dd className="font-medium">{episode.requiredOutputLevel}</dd></div>
                        <div><dt className="text-muted-foreground">用户等级要求</dt><dd className="font-medium">Lv.{episode.requiredUserLevel}</dd></div>
                        <div><dt className="text-muted-foreground">词汇要求</dt><dd className="font-medium">{episode.vocabRequiredCount}/{episode.vocabTotalCount}</dd></div>
                        <div><dt className="text-muted-foreground">Chunk 要求</dt><dd className="font-medium">{episode.chunkRequiredCount}/{episode.chunkTotalCount}</dd></div>
                    </dl>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Target className="size-4" /> 任务目标
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-1">
                        {(episode.objectives ?? []).map((obj, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="size-3.5 text-primary" />
                                {obj}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">通关条件</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div><dt className="text-muted-foreground">最少完成目标</dt><dd>{episode.passObjectiveCount}</dd></div>
                        <div><dt className="text-muted-foreground">最少 Chunk</dt><dd>{episode.passChunkCount}</dd></div>
                        <div><dt className="text-muted-foreground">需要复述</dt><dd>{episode.passRetellRequired ? '是' : '否'}</dd></div>
                        <div><dt className="text-muted-foreground">最少对话轮次</dt><dd>{episode.passMinDialogues}</dd></div>
                    </dl>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">奖励配置</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(episode.rewards, null, 2)}
                    </pre>
                </CardContent>
            </Card>

            <EpisodeEditDialog open={editOpen} onClose={() => setEditOpen(false)}
                edit={episode} onSaved={() => { onSaved(); setEditOpen(false); onClose() }} />
        </div>
    )
}

export function EpisodeEditDialog({
    open, onClose, edit, onSaved, defaultSceneId,
}: {
    open: boolean; onClose: () => void; edit: StoryEpisode | null; onSaved: () => void; defaultSceneId?: string
}) {
    const [form, setForm] = useState<any>({})
    const [saving, setSaving] = useState(false)
    const [categories, setCategories] = useState<SceneCategory[]>([])
    const [scenes, setScenes] = useState<Scene[]>([])
    const [chunks, setChunks] = useState<Chunk[]>([])
    const [existingEpisodes, setExistingEpisodes] = useState<StoryEpisode[]>([])

    useEffect(() => {
        listSceneCategories('story').then(setCategories).catch(() => { })
        listScenes(undefined, 'story').then(setScenes).catch(() => { })
        listAllChunks().then(setChunks).catch(() => { })
        listScriptEpisodes().then(setExistingEpisodes).catch(() => { })
    }, [])

    useEffect(() => {
        if (edit) setForm({
            ...edit,
            chunkIds: edit.coreChunks?.map((item: any) => item.chunk?.id ?? item.chunkId).filter(Boolean) ?? [],
            vocabIds: edit.coreVocabularies?.map((item: any) => item.vocab?.id ?? item.vocabId).filter(Boolean) ?? [],
        })
        else setForm({
            chapterId: '', chapterTitle: '',
            episodeOrder: 1, title: '', description: '', sceneId: defaultSceneId ?? '',
            requiredOutputLevel: 'L1', requiredUserLevel: 1,
            vocabRequiredCount: 6, vocabTotalCount: 10,
            chunkRequiredCount: 6, chunkTotalCount: 10,
            passObjectiveCount: 3, passChunkCount: 3,
            passRetellRequired: true, passMinDialogues: 3,
            objectives: [], prerequisiteEpisodes: [],
            npcName: '', npcRole: '', npcPersonality: '',
            chunkIds: [], vocabIds: [], isPreview: false, rewards: {},
        })
    }, [edit, open, defaultSceneId])

    const handleSave = async () => {
        if (!form.title?.trim() || !form.sceneId || !form.chapterTitle?.trim()) return
        setSaving(true)
        try {
            const payload = {
                ...form,
                chapterId: form.chapterId || `chapter_${Date.now().toString(36)}`,
            }
            if (edit) await updateScriptEpisode(edit.id, payload)
            else await createScriptEpisode(payload)
            toast.success('剧集已保存')
            onSaved()
            onClose()
        } catch { toast.error('保存失败') }
        finally { setSaving(false) }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{edit ? '编辑剧集' : '新建剧集'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>剧集标题</Label>
                            <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="宿舍 Check-in" />
                        </div>
                        <div>
                            <Label>排序</Label>
                            <Input type="number" value={form.episodeOrder ?? 1}
                                onChange={(e) => setForm({ ...form, episodeOrder: Number(e.target.value) })} />
                        </div>
                    </div>
                    <MarkdownEditor
                        label="剧集简介"
                        value={form.description ?? ''}
                        onChange={(value) => setForm({ ...form, description: value })}
                        height={150}
                        preview="edit"
                        placeholder="这一集发生什么、用户扮演谁、需要推动什么剧情..."
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>所属剧情包</Label>
                            <Select value={form.sceneId} onChange={(e) => setForm({ ...form, sceneId: e.target.value, chapterId: '', chapterTitle: '' })}>
                                <option value="">选择剧情包</option>
                                {categories.map((cat) => (
                                    <optgroup key={cat.id} label={cat.name}>
                                        {scenes.filter((s) => s.categoryId === cat.id).map((s) => (
                                            <option key={s.id} value={s.id}>{s.title}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <Label>所属章节</Label>
                            <Select
                                value={form.chapterId || '__new__'}
                                onChange={(e) => {
                                    const value = e.target.value
                                    const chapter = existingEpisodes.find((item) => item.sceneId === form.sceneId && item.chapterId === value)
                                    setForm({ ...form, chapterId: value === '__new__' ? '' : value, chapterTitle: chapter?.chapterTitle ?? '' })
                                }}
                            >
                                <option value="__new__">＋ 新建章节</option>
                                {Array.from(new Map(existingEpisodes.filter((item) => item.sceneId === form.sceneId).map((item) => [item.chapterId, item])).values()).map((item) => (
                                    <option key={item.chapterId} value={item.chapterId}>{item.chapterTitle}</option>
                                ))}
                            </Select>
                        </div>
                        {!form.chapterId && <div className="col-span-2">
                            <Label>新章节名称</Label>
                            <Input value={form.chapterTitle ?? ''} onChange={(e) => setForm({ ...form, chapterTitle: e.target.value })} placeholder="例如：第一章 · 初到漫语町" />
                            <p className="mt-1 text-xs text-muted-foreground">内部章节 Key 会在保存时自动生成，无需手工填写。</p>
                        </div>}
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Label>等级要求</Label>
                                <Select value={form.requiredOutputLevel} onChange={(e) => setForm({ ...form, requiredOutputLevel: e.target.value })}>
                                    {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label>预览剧集</Label>
                                <Select value={form.isPreview ? 'true' : 'false'}
                                    onChange={(e) => setForm({ ...form, isPreview: e.target.value === 'true' })}>
                                    <option value="false">否</option>
                                    <option value="true">是</option>
                                </Select>
                            </div>
                        </div>
                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>NPC 名称</Label>
                                <Input value={form.npcName ?? ''} onChange={(e) => setForm({ ...form, npcName: e.target.value })} placeholder="前台" />
                            </div>
                            <div>
                                <Label>NPC 角色</Label>
                                <Input value={form.npcRole ?? ''} onChange={(e) => setForm({ ...form, npcRole: e.target.value })} placeholder="宿舍前台工作人员" />
                            </div>
                        </div>
                        <div>
                            <MarkdownEditor
                                label="NPC 性格 / 对话风格"
                                value={form.npcPersonality ?? ''}
                                onChange={(value) => setForm({ ...form, npcPersonality: value })}
                                height={140}
                                preview="edit"
                                placeholder="友好健谈；会主动确认信息；语速适中..."
                            />
                        </div>

                        <Separator />

                        <DynamicStringList
                            label="任务目标"
                            value={form.objectives ?? []}
                            onChange={(objectives) => setForm({ ...form, objectives: objectives.filter(Boolean) })}
                            placeholder="说明自己来办理入住"
                            addLabel="添加目标"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>最少完成目标数</Label>
                                <Input type="number" value={form.passObjectiveCount ?? 3}
                                    onChange={(e) => setForm({ ...form, passObjectiveCount: Number(e.target.value) })} />
                            </div>
                            <div>
                                <Label>最少使用 Chunk 数</Label>
                                <Input type="number" value={form.passChunkCount ?? 3}
                                    onChange={(e) => setForm({ ...form, passChunkCount: Number(e.target.value) })} />
                            </div>
                            <div>
                                <Label>最少对话轮次</Label>
                                <Input type="number" value={form.passMinDialogues ?? 3}
                                    onChange={(e) => setForm({ ...form, passMinDialogues: Number(e.target.value) })} />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={form.passRetellRequired ?? true}
                                        onChange={(e) => setForm({ ...form, passRetellRequired: e.target.checked })} />
                                    需要复述
                                </label>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>词汇要求（已学/总数）</Label>
                                <div className="flex gap-2">
                                    <Input type="number" value={form.vocabRequiredCount ?? 6}
                                        onChange={(e) => setForm({ ...form, vocabRequiredCount: Number(e.target.value) })} />
                                    <span className="flex items-center text-muted-foreground">/</span>
                                    <Input type="number" value={form.vocabTotalCount ?? 10}
                                        onChange={(e) => setForm({ ...form, vocabTotalCount: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div>
                                <Label>Chunk 要求（掌握/总数）</Label>
                                <div className="flex gap-2">
                                    <Input type="number" value={form.chunkRequiredCount ?? 6}
                                        onChange={(e) => setForm({ ...form, chunkRequiredCount: Number(e.target.value) })} />
                                    <span className="flex items-center text-muted-foreground">/</span>
                                    <Input type="number" value={form.chunkTotalCount ?? 10}
                                        onChange={(e) => setForm({ ...form, chunkTotalCount: Number(e.target.value) })} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <ChunkMultiSelect
                            chunks={chunks}
                            value={form.chunkIds ?? []}
                            onChange={(chunkIds) => setForm({ ...form, chunkIds })}
                        />

                        <Separator />

                        <div>
                            <Label>奖励配置 (JSON)</Label>
                            <Textarea
                                value={JSON.stringify(form.rewards ?? {}, null, 2)}
                                onChange={(e) => {
                                    try { setForm({ ...form, rewards: JSON.parse(e.target.value) }) } catch { }
                                }}
                                rows={6}
                                className="font-mono text-xs"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={onClose}>取消</Button>
                            <Button onClick={handleSave} disabled={saving || !form.title?.trim() || !form.sceneId || !form.chapterTitle?.trim()}>保存</Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
