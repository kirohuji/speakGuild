import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, Code2, FileText, Loader2, Type } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownEditor } from '@/components/common/markdown-editor'
import { packageDataAdminApi, type ImportResult, type PackageImportPreview } from '../api-package-data'

type Props = {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (result: ImportResult) => void
}

const STEPS = ['导入计划', '教学文档', '练习题', '内容语料库']
const COUNT_LABELS: Record<string, string> = {
  topics: '教学话题', documents: '教学文档', exercises: '练习题', vocabularies: '词汇', chunks: '句块', patterns: '句式', episodes: '剧本关卡',
}
const EMPTY_SCENE = { title: '未命名学习包', category: '未分类', description: '', packageType: 'daily', willReplace: false }
const EMPTY_COUNTS = { topics: 0, documents: 0, exercises: 0, vocabularies: 0, chunks: 0, patterns: 0, episodes: 0 }
const EMPTY_DOCUMENT_MATERIALS = { vocabulary: [] as Array<{ text: string; status: 'existing' | 'missing' }>, chunk: [] as Array<{ text: string; status: 'existing' | 'missing' }>, pattern: [] as Array<{ text: string; status: 'existing' | 'missing' }> }

/**
 * 后端统一响应会解开一层 data；这里兼容旧预览接口曾出现的双层 data，
 * 并把所有可选字段归一为可直接渲染的结构，禁止原始接口对象进入 JSX。
 */
function normalizePreviewResponse(payload: unknown): PackageImportPreview {
  const outer = payload && typeof payload === 'object' ? payload as Record<string, any> : {}
  const raw = outer.scene ? outer : (outer.data && typeof outer.data === 'object' ? outer.data : outer)
  const corpus = raw.corpus && typeof raw.corpus === 'object' ? raw.corpus : {}
  const normalizeCorpus = (item: any) => ({
    existing: Array.isArray(item?.existing) ? item.existing : [],
    missing: Array.isArray(item?.missing) ? item.missing : [],
  })
  return {
    packageName: typeof raw.packageName === 'string' ? raw.packageName : '',
    scene: { ...EMPTY_SCENE, ...(raw.scene && typeof raw.scene === 'object' ? raw.scene : {}) },
    counts: { ...EMPTY_COUNTS, ...(raw.counts && typeof raw.counts === 'object' ? raw.counts : {}) },
    documents: Array.isArray(raw.documents) ? raw.documents.map((document: any) => ({
      ...document,
      materials: {
        vocabulary: Array.isArray(document?.materials?.vocabulary) ? document.materials.vocabulary : [],
        chunk: Array.isArray(document?.materials?.chunk) ? document.materials.chunk : [],
        pattern: Array.isArray(document?.materials?.pattern) ? document.materials.pattern : [],
      },
    })) : [],
    exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
    importPlan: Array.isArray(raw.importPlan) ? raw.importPlan : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    notices: Array.isArray(raw.notices) ? raw.notices : [],
    corpus: {
      vocabulary: normalizeCorpus(corpus.vocabulary),
      chunk: normalizeCorpus(corpus.chunk),
      pattern: normalizeCorpus(corpus.pattern),
    },
    // 响应契约不完整时保守禁用导入，避免把“空预览”当成合法数据包。
    canImport: Boolean(raw.scene && raw.counts && raw.corpus && raw.canImport),
  }
}

function CorpusTable({ title, existing, missing }: { title: string; existing: string[]; missing: string[] }) {
  const rows = [...existing.map(text => ({ text, status: '已存在' })), ...missing.map(text => ({ text, status: '待生成' }))]
  return <Card className="overflow-hidden border-border/80 shadow-none">
    <CardContent className="p-0">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">已有 {existing.length} · 待生成 {missing.length}</span>
      </div>
      <ScrollArea className="h-44">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-background text-muted-foreground"><tr><th className="px-3 py-2 font-medium">内容</th><th className="px-3 py-2 font-medium">语料库状态</th></tr></thead>
          <tbody className="divide-y">
            {rows.map(row => <tr key={row.text}><td className="px-3 py-2 font-medium">{row.text}</td><td className="px-3 py-2"><Badge variant={row.status === '已存在' ? 'secondary' : 'outline'} className="text-[10px]">{row.status}</Badge></td></tr>)}
            {!rows.length && <tr><td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">此包未声明此类内容</td></tr>}
          </tbody>
        </table>
      </ScrollArea>
    </CardContent>
  </Card>
}

function TeachingMaterialList({ title, items }: { title: string; items: Array<{ text: string; status: 'existing' | 'missing' }> }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-2">
    <div className="space-y-1">
      {items.map((item) => <div key={item.text} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2 py-1.5">
        <span className="min-w-0 break-words text-[11px] font-medium leading-4">{item.text}</span>
        <Badge variant={item.status === 'existing' ? 'secondary' : 'outline'} className="shrink-0 text-[9px]">{item.status === 'existing' ? '复用语料' : '待生成'}</Badge>
      </div>)}
      {!items.length && <p className="py-8 text-center text-[11px] text-muted-foreground">该教学文档未关联{title}</p>}
    </div>
  </div>
}

export function PackageImportDialog({ file, open, onOpenChange, onImported }: Props) {
  const [preview, setPreview] = useState<PackageImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState(0)
  const [acknowledgedMissing, setAcknowledgedMissing] = useState(false)
  const [selectedDocumentTitle, setSelectedDocumentTitle] = useState('')
  const [materialKind, setMaterialKind] = useState<'pattern' | 'chunk' | 'vocabulary'>('pattern')
  const packageName = file?.name.replace(/\.zip$/i, '') ?? ''

  useEffect(() => {
    if (!open || !file) return
    setPreview(null); setStep(0); setAcknowledgedMissing(false); setLoading(true)
    packageDataAdminApi.preview(file, packageName)
      .then((result) => {
        const next = normalizePreviewResponse(result)
        setPreview(next)
        setSelectedDocumentTitle(next.documents[0]?.topicTitle ?? '')
      })
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || err?.message || '数据包解析失败')
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
  }, [open, file, packageName, onOpenChange])

  const missingCount = useMemo(() => {
    if (!preview) return 0
    return (preview.corpus?.vocabulary?.missing?.length ?? 0)
      + (preview.corpus?.chunk?.missing?.length ?? 0)
      + (preview.corpus?.pattern?.missing?.length ?? 0)
  }, [preview])
  const selectedDocument = preview?.documents.find((document) => document.topicTitle === selectedDocumentTitle) ?? preview?.documents[0]
  const selectedMaterials = selectedDocument?.materials ?? EMPTY_DOCUMENT_MATERIALS
  const importNow = async () => {
    if (!file || !preview) return
    setImporting(true)
    try {
      const result = await packageDataAdminApi.import(file, packageName)
      onImported(result)
      onOpenChange(false)
    } catch (err: any) { toast.error(err?.response?.data?.message || err?.message || '导入失败') }
    finally { setImporting(false) }
  }

  return <Dialog open={open} onOpenChange={next => !importing && onOpenChange(next)}>
    <DialogContent className="flex h-[90vh] w-[96vw] max-w-[88rem] flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="border-b bg-muted/20 px-6 py-5">
        <DialogTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />导入数据包：上传前核对</DialogTitle>
        <DialogDescription>解析结果不会写入数据库；请逐步确认后再开始覆盖式导入。</DialogDescription>
      </DialogHeader>
      {loading || !preview ? <div className="flex h-80 flex-col items-center justify-center gap-3"><Loader2 className="size-7 animate-spin text-primary" /><span className="text-sm text-muted-foreground">正在解析 ZIP 并核对内容语料库…</span></div> : <>
        <div className="grid grid-cols-4 border-b">
          {STEPS.map((label, index) => <button key={label} onClick={() => setStep(index)} className={`border-r px-3 py-3 text-left text-xs last:border-r-0 ${step === index ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
            <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full border text-[10px]">{index < step ? <CheckCircle2 className="size-3" /> : index + 1}</span>{label}
          </button>)}
        </div>
        <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 p-6">
          {step === 0 && <>
            <Card className="border-primary/20 bg-primary/[0.03] shadow-none"><CardContent className="grid items-start gap-5 p-4 sm:grid-cols-[1fr_1.2fr]"><div><div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">学习包</p><Badge variant={preview.scene.willReplace ? 'destructive' : 'secondary'} className="text-[10px]">{preview.scene.willReplace ? '将覆盖已有包' : '将新建'}</Badge></div><p className="mt-1.5 text-base font-semibold">{preview.scene.title}</p><p className="mt-1 text-xs text-muted-foreground">{preview.scene.category} · {preview.scene.packageType}</p></div><p className="border-l pl-5 text-sm leading-6 text-muted-foreground">{preview.scene.description || '未填写学习包描述'}</p></CardContent></Card>
            <section className="space-y-2"><div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h3 className="text-sm font-semibold">本次导入将执行</h3><span className="text-xs text-muted-foreground">最终确认后才写入</span></div><div className="divide-y overflow-hidden rounded-lg border">{preview.importPlan.map((item, index) => <div key={item.title} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3"><span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{index + 1}</span><div><p className="text-sm font-medium">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p></div><Badge variant={item.status === '覆盖' ? 'destructive' : item.status === '后续任务' ? 'outline' : 'secondary'} className="mt-0.5 whitespace-nowrap text-[10px]">{item.status}</Badge></div>)}</div></section>
            <section className="space-y-2"><h3 className="text-sm font-semibold">解析统计</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(preview.counts).map(([key, value]) => <Card key={key} className="shadow-none"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{COUNT_LABELS[key]}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div></section>
            {preview.notices.length > 0 && <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">可选文件已跳过</p><ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{preview.notices.map(item => <li key={item}>{item}</li>)}</ul></div>}
            {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" />发现需处理的问题</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{preview.warnings.map(item => <li key={item}>{item}</li>)}</ul></div>}
          </>}
          {step === 1 && <section className="grid min-h-[calc(90vh-13rem)] overflow-hidden rounded-xl border bg-background lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
            <aside className="min-h-0 border-b bg-muted/20 lg:border-b-0 lg:border-r">
              <div className="border-b px-3 py-2.5"><p className="text-xs font-semibold">教学文档库</p><p className="mt-0.5 text-[10px] text-muted-foreground">{preview.documents.length} 份文档 · 逐份核对后导入</p></div>
              <ScrollArea className="h-[calc(90vh-16rem)]"><div className="space-y-1 p-1.5">{preview.documents.map(document => <button key={document.topicTitle} type="button" onClick={() => setSelectedDocumentTitle(document.topicTitle)} className={`w-full rounded-md border px-2 py-2 text-left transition-colors ${selectedDocument?.topicTitle === document.topicTitle ? 'border-primary/40 bg-primary/[0.06]' : 'border-transparent hover:border-border hover:bg-muted/40'}`}><div className="flex items-start gap-1"><BookOpen className="mt-0.5 size-3 shrink-0 text-sky-600" /><span className="line-clamp-2 text-[11px] font-medium leading-4">{document.topicTitle}</span></div><div className="mt-1 flex items-center justify-between gap-1"><span className="truncate text-[9px] text-muted-foreground">{document.filename ?? '内嵌内容'}</span>{document.willImport ? <CheckCircle2 className="size-3 shrink-0 text-emerald-600" /> : <AlertTriangle className="size-3 shrink-0 text-amber-600" />}</div></button>)}{!preview.documents.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">未解析到教学文档</p>}</div></ScrollArea>
            </aside>
            <section className="min-w-0 border-b lg:border-b-0">
              <div className="flex items-center justify-between gap-2 border-b bg-gradient-to-r from-sky-500/[0.08] to-transparent px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedDocument?.topicTitle ?? '选择教学文档'}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{selectedDocument?.filename ? `teaching-docs/${selectedDocument.filename}` : 'CSV 内嵌教学内容'}</p></div>{selectedDocument && <Badge variant={selectedDocument.willImport ? 'secondary' : 'destructive'} className="shrink-0 text-[10px]">{selectedDocument.willImport ? '将导入' : '不会导入'}</Badge>}</div>
              <div className="p-2">{selectedDocument?.content ? <MarkdownEditor value={selectedDocument.content} preview="preview" minimal height={620} /> : <div className="flex h-[620px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">未找到可预览的教学文档</div>}</div>
            </section>
            <aside className="flex min-h-0 flex-col bg-muted/10 lg:border-l">
              <div className="border-b px-3 py-2.5"><p className="text-xs font-semibold">当前语言材料</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">对应本话题，将随导入建立关联。</p></div>
              <div className="grid grid-cols-3 border-b bg-muted/30 p-1">{([{ kind: 'pattern', label: '句型', Icon: Code2 }, { kind: 'chunk', label: '句块', Icon: Type }, { kind: 'vocabulary', label: '单词', Icon: BookOpen }] as const).map(({ kind, label, Icon }) => <button key={kind} type="button" onClick={() => setMaterialKind(kind)} className={`flex h-7 items-center justify-center gap-1 rounded text-[10px] ${materialKind === kind ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground'}`}><Icon className="size-3" />{label}<span className="tabular-nums">{selectedMaterials[kind].length}</span></button>)}</div>
              <TeachingMaterialList title={materialKind === 'pattern' ? '句型' : materialKind === 'chunk' ? '句块' : '单词'} items={selectedMaterials[materialKind]} />
            </aside>
          </section>}
          {step === 2 && <div className="overflow-hidden rounded-lg border"><table className="w-full text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-3 py-2">话题</th><th className="px-3 py-2">练习</th><th className="px-3 py-2">题目</th><th className="px-3 py-2">答案</th></tr></thead><tbody className="divide-y">{preview.exercises.map((row, index) => <tr key={`${row.topicTitle}-${index}`}><td className="px-3 py-2 align-top">{row.topicTitle}</td><td className="px-3 py-2 align-top">{row.groupTitle}</td><td className="px-3 py-2 align-top">{row.prompt}</td><td className="px-3 py-2 align-top">{row.answer}</td></tr>)}{!preview.exercises.length && <tr><td colSpan={4} className="px-3 py-12 text-center text-muted-foreground">未发现练习题</td></tr>}</tbody></table></div>}
          {step === 3 && <><div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm leading-6 text-muted-foreground">已有内容会直接复用，且保留人工维护的富化字段；待生成内容会在导入后进入“内容准备”任务，补全词典、释义、例句与音频等信息。</div><div className="space-y-3"><CorpusTable title="词汇" existing={preview.corpus.vocabulary.existing} missing={preview.corpus.vocabulary.missing} /><CorpusTable title="句块" existing={preview.corpus.chunk.existing} missing={preview.corpus.chunk.missing} /><CorpusTable title="句式" existing={preview.corpus.pattern.existing} missing={preview.corpus.pattern.missing} /></div>{missingCount > 0 && <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={acknowledgedMissing} onChange={event => setAcknowledgedMissing(event.target.checked)} className="mt-0.5" />我已确认上述 {missingCount} 项内容尚未在语料库中，将在导入后交由内容准备任务生成。</label>}</>}
        </div></ScrollArea>
        <DialogFooter className="border-t bg-muted/10 px-6 py-4"><Button variant="outline" onClick={() => step ? setStep(step - 1) : onOpenChange(false)} disabled={importing}><ArrowLeft className="mr-1 size-4" />{step ? '上一步' : '取消'}</Button>{step < STEPS.length - 1 ? <Button onClick={() => setStep(step + 1)}>确认并继续<ArrowRight className="ml-1 size-4" /></Button> : <Button onClick={importNow} disabled={!preview.canImport || importing || (missingCount > 0 && !acknowledgedMissing)}>{importing && <Loader2 className="mr-1 size-4 animate-spin" />}确认导入并创建内容准备任务</Button>}</DialogFooter>
      </>}
    </DialogContent>
  </Dialog>
}
