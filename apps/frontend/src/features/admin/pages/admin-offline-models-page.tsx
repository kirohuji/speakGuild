import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cpu, Download, ExternalLink, FileArchive, HardDrive, Loader2, Mic, Plus, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectItem } from '@/components/ui/select'
import { showRequestError } from '@/lib/request-feedback'
import { getFileAssetContentUrl } from '@/lib/file-asset-reference'
import { uploadFileToCosAndComplete } from '@/features/file-assets/api'
import { offlineModelsApi, type OfflineModelPreset, type OfflineModelVersion } from '../api-offline-models'
import { listFileAssets, type FileAssetItem } from '../api-content-admin'

const statusLabels: Record<string, string> = { queued: '排队中', downloading: '准备中', ready: '可发布', failed: '准备失败', canceled: '已取消' }
const validationLabels = { unverified: '未验证', passed: '验证通过', failed: '验证失败' }
const sizeLabel = (bytes: number) => !bytes ? '—' : bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
const active = (row: OfflineModelVersion) => ['queued', 'downloading'].includes(row.status) && !['failed', 'canceled', 'completed'].includes(row.task?.status ?? '')

export function AdminOfflineModelsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const detailId = searchParams.get('version')
  const [catalog, setCatalog] = useState<OfflineModelPreset[]>([])
  const [versions, setVersions] = useState<OfflineModelVersion[]>([])
  const [purpose, setPurpose] = useState('stt')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<OfflineModelVersion | null>(null)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [mode, setMode] = useState('download')
  const [variantId, setVariantId] = useState('tiny-en-q8')
  const [version, setVersion] = useState('')
  const [revision, setRevision] = useState('main')
  const [importAssetId, setImportAssetId] = useState('')
  const [archives, setArchives] = useState<FileAssetItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [deviceValidation, setDeviceValidation] = useState('unverified')
  const [validationNote, setValidationNote] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'publish' | 'unpublish' | 'remove'; row: OfflineModelVersion } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const load = useCallback(async (background = false) => {
    try {
      const result = await offlineModelsApi.list()
      if (!mounted.current) return
      setCatalog(result.catalog); setVersions(result.versions)
      if (detailId) {
        const value = await offlineModelsApi.detail(detailId)
        if (mounted.current) setDetail(value)
      }
    } catch (error) { showRequestError(error, '加载离线模型失败', { background }) }
    finally { if (mounted.current) setLoading(false) }
  }, [detailId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!versions.some(active)) return
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(true) }, 5000)
    return () => clearInterval(timer)
  }, [versions, load])
  useEffect(() => { setDetail(null) }, [detailId])
  useEffect(() => { if (detail) { setPurpose(detail.purpose); setDeviceValidation(detail.deviceValidation); setValidationNote(detail.validationNote ?? '') } }, [detail?.id, detail?.deviceValidation, detail?.validationNote])
  useEffect(() => {
    if (!createOpen) return
    let canceled = false
    listFileAssets({ search: '.zip', pageSize: 100 }).then(result => { if (!canceled) setArchives(result.items.filter(file => file.filename.toLowerCase().endsWith('.zip'))) }).catch(() => undefined)
    return () => { canceled = true }
  }, [createOpen])
  const perform = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try { await work(); toast.success(message); await load(true) }
    catch (error) { showRequestError(error, '操作失败') }
    finally { setBusy(false) }
  }
  const openCreate = () => {
    setVariantId(purpose === 'stt' ? 'tiny-en-q8' : 'q8')
    setVersion(`v${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`)
    setRevision('main'); setImportAssetId(''); setMode('download'); setCreateOpen(true)
  }
  const prepare = () => perform(async () => {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(version)) throw new Error('版本号仅支持字母、数字、点、横线和下划线，最多 64 字符')
    if (mode === 'import' && !importAssetId) throw new Error('请选择或上传模型 ZIP 包')
    const result = await offlineModelsApi.prepare({ variantId, version, ...(mode === 'import' ? { importAssetId } : { sourceRevision: revision }) })
    setCreateOpen(false); setSearchParams({ version: result.id })
  }, '任务已创建，关闭页面后仍会继续执行')
  const upload = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > 600 * 1024 * 1024) { toast.error('请选择不超过 600 MB 的 ZIP 包'); return }
    setUploading(true)
    try {
      const asset = await uploadFileToCosAndComplete({ file, group: 'offline_model' })
      setArchives(current => [{ ...asset, filename: file.name } as FileAssetItem, ...current.filter(row => row.id !== asset.id)])
      setImportAssetId(asset.id); toast.success('模型包已上传资源库，创建任务后开始校验')
    } catch (error) { showRequestError(error, '模型包上传失败') }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = '' }
  }
  const openDetail = (id: string) => setSearchParams({ version: id })
  const filtered = versions.filter(row => row.purpose === purpose)
  const published = versions.filter(row => row.isPublished).length
  const processing = versions.filter(active).length
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5"><p className="text-xs font-medium tracking-widest text-muted-foreground">设备端 AI / 资源发布</p><h1 className="text-2xl font-semibold tracking-tight">离线模型管理</h1><p className="max-w-2xl text-sm text-muted-foreground">将语音识别与知识点判断模型保存到资源库，校验后发布给 App 下载。</p></div>
        <div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin/file-assets?group=offline_model"><HardDrive data-icon="inline-start" />资源库</Link></Button><Button variant="outline" onClick={() => void load()} disabled={loading || busy}><RefreshCw data-icon="inline-start" />刷新</Button><Button onClick={openCreate}><Plus data-icon="inline-start" />准备新版本</Button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['模型版本', versions.length], ['已发布型号', published], ['后台准备中', processing]].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-card px-5 py-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div>)}
      </div>
      <Tabs value={purpose} onValueChange={setPurpose}><TabsList><TabsTrigger value="stt"><Mic className="mr-2 size-4" />语音识别</TabsTrigger><TabsTrigger value="embedding"><Cpu className="mr-2 size-4" />知识点判断</TabsTrigger></TabsList></Tabs>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table><TableHeader><TableRow><TableHead>模型 / 版本</TableHead><TableHead>资源大小</TableHead><TableHead>准备状态</TableHead><TableHead>iOS 真机验证</TableHead><TableHead>发布状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>
          {loading ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">正在读取模型版本…</TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="h-44 text-center"><FileArchive className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">还没有模型版本</p><p className="mt-1 text-sm text-muted-foreground">从服务器下载，或导入已有模型包，再发布到 App。</p><Button variant="outline" className="mt-4" onClick={openCreate}>准备第一个版本</Button></TableCell></TableRow> : filtered.map(row => <TableRow key={row.id}>
            <TableCell><button className="text-left font-medium hover:underline" onClick={() => openDetail(row.id)}>{catalog.find(p => p.variantId === row.variantId)?.label ?? row.modelId}</button><p className="mt-1 text-xs text-muted-foreground">{row.version} · {row.dtype.toUpperCase()}</p></TableCell>
            <TableCell className="tabular-nums">{sizeLabel(row.totalBytes)}<p className="mt-1 text-xs text-muted-foreground">{row.files.length} 个文件</p></TableCell>
            <TableCell><Badge variant={row.status === 'failed' ? 'destructive' : 'secondary'}>{statusLabels[row.status] ?? row.status}</Badge>{active(row) && <p className="mt-1 max-w-52 truncate text-xs text-muted-foreground">{row.task?.currentStep ?? '等待后台任务'} · {row.task?.progress ?? 0}%</p>}{row.errorMessage && <p className="mt-1 max-w-64 text-xs text-destructive">{row.errorMessage}</p>}</TableCell>
            <TableCell>{validationLabels[row.deviceValidation]}</TableCell><TableCell>{row.isPublished ? <Badge>App 可下载</Badge> : <span className="text-sm text-muted-foreground">{row.publishedAt ? '已下架' : '未发布'}</span>}</TableCell>
            <TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => openDetail(row.id)}>详情</Button>{active(row) ? <Button disabled={busy} size="sm" variant="ghost" onClick={() => void perform(() => offlineModelsApi.cancel(row.id), '任务已取消')}>取消</Button> : ['failed', 'canceled'].includes(row.status) ? <Button disabled={busy} size="sm" variant="outline" onClick={() => void perform(() => offlineModelsApi.retry(row.id), '已创建重试任务')}>重试</Button> : row.status === 'ready' && <Button disabled={busy || row.deviceValidation === 'failed'} size="sm" variant={row.isPublished ? 'outline' : 'default'} onClick={() => setConfirm({ kind: row.isPublished ? 'unpublish' : 'publish', row })}>{row.isPublished ? '下架' : row.publishedAt ? '重新发布' : '发布'}</Button>}</div></TableCell>
          </TableRow>)}
        </TableBody></Table>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">文件校验与真机验证分别记录。发布新版本会替换该型号的下载版本，用户已安装的模型继续可用。</p>
      <Dialog open={createOpen} onOpenChange={open => { if (!busy && !uploading) setCreateOpen(open) }}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>准备离线模型版本</DialogTitle><DialogDescription>服务器下载或资源库导入均由后台任务执行，完成文件校验后才能发布。</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-4">
          <Tabs value={mode} onValueChange={setMode}><TabsList className="w-full"><TabsTrigger value="download" className="flex-1">下载到资源库</TabsTrigger><TabsTrigger value="import" className="flex-1">导入模型包</TabsTrigger></TabsList></Tabs>
          <div className="flex flex-col gap-2"><Label>型号与精度</Label><Select aria-label="型号与精度" value={variantId} onChange={event => setVariantId(event.target.value)}>{catalog.map(item => <SelectItem key={item.variantId} value={item.variantId}>{item.purpose === 'stt' ? '语音识别' : '知识点判断'} · {item.label}</SelectItem>)}</Select></div>
          <div className="flex flex-col gap-2"><Label htmlFor="offline-model-version">版本号</Label><Input id="offline-model-version" maxLength={64} value={version} onChange={e => setVersion(e.target.value)} placeholder="例如 v1.0.0" /></div>
          {mode === 'download' ? <div className="flex flex-col gap-2"><Label htmlFor="model-revision">来源版本</Label><Input id="model-revision" value={revision} onChange={e => setRevision(e.target.value)} maxLength={100} /><p className="text-xs leading-5 text-muted-foreground">下载 Hugging Face 仓库模型，默认使用 HF-Mirror 国内镜像，可通过后端 HF_ENDPOINT 配置下载源。任务会固定实际提交版本并校验文件。</p></div> : <div className="flex flex-col gap-3"><Label>资源库中的模型包</Label><Select aria-label="资源库模型包" value={importAssetId} onChange={event => setImportAssetId(event.target.value)}><SelectItem value="">选择 ZIP 模型包</SelectItem>{archives.map(file => <SelectItem key={file.id} value={file.id}>{file.filename} · {sizeLabel(file.size)}</SelectItem>)}</Select><input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={e => void upload(e.target.files?.[0])} /><Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}{uploading ? '正在上传资源库…' : '上传新的 ZIP 包'}</Button><p className="text-xs leading-5 text-muted-foreground">最大 600 MB。包内需包含所选型号的 JSON 配置、分词器和 onnx 目录；保持文件名及相对目录结构。</p></div>}
        </div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy || uploading}>取消</Button><Button onClick={() => void prepare()} disabled={busy || uploading || !variantId}>{busy && <Loader2 data-icon="inline-start" className="animate-spin" />}{mode === 'download' ? '开始后台下载' : '开始导入校验'}</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={Boolean(detailId)} onOpenChange={open => { if (!open) setSearchParams({}) }}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>模型版本详情{detail ? ` · ${detail.version}` : ''}</DialogTitle><DialogDescription>{detail?.modelId ?? '正在加载…'}</DialogDescription></DialogHeader>
        {detail && <div className="flex flex-col gap-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{statusLabels[detail.status]}</Badge>{detail.isPublished && <Badge>App 可下载</Badge>}<span className="text-sm text-muted-foreground">{sizeLabel(detail.totalBytes)} · {detail.dtype}</span>{detail.bundleAssetId && <Button size="sm" variant="outline" asChild><a href={getFileAssetContentUrl(detail.bundleAssetId)} download><Download data-icon="inline-start" />导出完整模型包</a></Button>}{detail.taskId && <Button size="sm" variant="outline" asChild><Link to={`/admin/tasks?taskId=${detail.taskId}`}><ExternalLink data-icon="inline-start" />任务中心</Link></Button>}</div>
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm"><p>来源：{detail.importAssetId ? '资源库导入' : '模型源下载'}</p><p className="mt-1 break-all text-xs text-muted-foreground">固定来源版本：{detail.sourceCommit ?? (detail.importAssetId ? '手动导入' : detail.sourceRevision)}</p>{detail.task?.currentStep && <p className="mt-2">{detail.task.currentStep} · {detail.task.progress}%</p>}{detail.task?.currentStep?.startsWith('下载') && detail.task?.summary?.loadedBytes > 0 && <p className="mt-1 text-xs text-muted-foreground">{sizeLabel(detail.task.summary.loadedBytes)} / {sizeLabel(detail.task.summary.expectedBytes)} · {sizeLabel(detail.task.summary.bytesPerSecond)}/s</p>}{detail.errorMessage && <p className="mt-2 text-destructive">{detail.errorMessage}</p>}</div>
          <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>文件</TableHead><TableHead>大小</TableHead><TableHead>SHA-256</TableHead><TableHead>资源关联</TableHead></TableRow></TableHeader><TableBody>{detail.files.map(file => <TableRow key={file.path}><TableCell className="font-mono text-xs">{file.path}</TableCell><TableCell>{sizeLabel(file.size)}</TableCell><TableCell className="font-mono text-xs" title={file.sha256}>{file.sha256.slice(0, 16)}…</TableCell><TableCell><Link className="text-sm text-primary hover:underline" to={`/admin/file-assets?assetId=${file.assetId}`}>查看资源</Link></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="flex flex-col gap-3 rounded-lg border p-4"><div className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />iOS 真机验证</div><p className="text-xs text-muted-foreground">记录下载、加载和推理的实际结果；文件校验完成不会自动标记真机通过。</p><Select aria-label="真机验证结果" value={deviceValidation} onChange={event => setDeviceValidation(event.target.value)}>{Object.entries(validationLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</Select><Textarea aria-label="验证备注" placeholder="设备、App 版本和验证结果" maxLength={2000} value={validationNote} onChange={e => setValidationNote(e.target.value)} /><Button className="self-start" variant="outline" disabled={busy} onClick={() => void perform(() => offlineModelsApi.validate(detail.id, { deviceValidation, validationNote }), '验证结果已保存')}>保存验证结果</Button></div>
          {'logs' in (detail.task ?? {}) && (detail.task as unknown as AdminTaskDetailLike)?.logs?.length > 0 && <div className="rounded-lg bg-muted/40 p-4"><p className="mb-2 text-sm font-medium">任务日志</p>{(detail.task as unknown as AdminTaskDetailLike).logs.map(log => <p key={log.id} className="mb-1 text-xs text-muted-foreground">{log.message}</p>)}</div>}
          {!detail.isPublished && !active(detail) && <Button className="self-start" variant="destructive" disabled={busy} onClick={() => setConfirm({ kind: 'remove', row: detail })}>删除此版本</Button>}
        </div>}
      </DialogContent></Dialog>
      <Dialog open={Boolean(confirm)} onOpenChange={open => { if (!open && !busy) setConfirm(null) }}><DialogContent><DialogHeader><DialogTitle>{confirm?.kind === 'publish' ? '发布此模型版本？' : confirm?.kind === 'unpublish' ? '下架此模型版本？' : '删除此模型版本？'}</DialogTitle><DialogDescription>{confirm?.kind === 'publish' ? `${confirm.row.deviceValidation === 'unverified' ? '该版本尚未完成 iOS 真机验证。' : ''}发布后 App 将下载此版本，同型号先前发布的版本会下架。` : confirm?.kind === 'unpublish' ? '停止提供新的下载，用户本机已安装的模型继续可用。' : '删除版本并解除其资源引用；其他版本引用的共享文件会保留。'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>取消</Button><Button disabled={busy} onClick={() => { if (!confirm) return; const value = confirm; setConfirm(null); void perform(async () => { await offlineModelsApi[value.kind](value.row.id); if (value.kind === 'remove') { setSearchParams({}); setDetail(null) } }, '操作完成') }}>确认</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
type AdminTaskDetailLike = { logs: Array<{ id: string; message: string }> }
