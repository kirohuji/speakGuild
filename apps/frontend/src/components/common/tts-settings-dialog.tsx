import { useCallback, useEffect, useState } from 'react'
import { SlidersHorizontal, Volume2, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import {
  getTtsParamsSchema,
  synthesizeText,
  type TtsSchema,
  type TtsParamSchemaField,
  type TtsProviderKey,
} from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'

// ---- Cartesia 常用英语声音 ----
const CARTESIA_VOICES: Array<{ id: string; label: string }> = [
  { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', label: 'British Reading Lady' },
  { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', label: 'Barbershop Man' },
  { id: '87748186-23bb-4158-a1eb-332911b0b708', label: 'Newsman' },
  { id: 'bd9120b6-7761-47a6-a446-77ca49132781', label: 'Calm Lady' },
  { id: 'b7d50908-b17c-442d-ad8d-810c63997ed9', label: 'California Girl' },
  { id: '156fb8d2-335b-4950-9cb3-a2d33befec77', label: 'Helpful Woman' },
  { id: '694f9389-aac1-45b6-b726-9d9369183238', label: 'Sportsman' },
  { id: '5c42302c-194b-4d0c-ba1a-8cb485c84ab9', label: 'Reading Man' },
]

const MINIMAX_VOICES: Array<{ id: string; label: string }> = [
  { id: 'English_Trustworthy_Man',    label: 'Trustworthy Man (EN)' },
  { id: 'English_CalmWoman',          label: 'Calm Woman (EN)' },
  { id: 'English_expressive_narrator', label: 'Expressive Narrator (EN)' },
  { id: 'female-chengshu',            label: '成熟女声 (ZH)' },
  { id: 'male-qn-qingse',             label: '青涩男声 (ZH)' },
  { id: 'female-yujie',               label: '御姐 (ZH)' },
]

const PREVIEW_TEXT = "The ancient city of Beijing is home to some of the world's most remarkable cultural treasures."

type ParamValues = Record<string, string | number | boolean>

interface TtsSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TtsSettingsDialog({ open, onOpenChange }: TtsSettingsDialogProps) {
  const { ttsBackend, setTtsBackend } = usePreferencesStore()

  const [schemas, setSchemas] = useState<TtsSchema[]>([])
  const [loadingSchema, setLoadingSchema] = useState(false)

  // Local draft (not saved until "保存")
  const [provider, setProvider] = useState<TtsProviderKey>(ttsBackend.provider)
  const [model, setModel]       = useState(ttsBackend.model)
  const [voiceId, setVoiceId]   = useState(ttsBackend.voiceId ?? '')
  const [params, setParams]     = useState<ParamValues>(ttsBackend.params ?? {})

  // Preview state
  const [previewing, setPreviewing] = useState(false)
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewDone, setPreviewDone] = useState(false)

  // Sync draft when store changes externally
  useEffect(() => {
    if (open) {
      setProvider(ttsBackend.provider)
      setModel(ttsBackend.model)
      setVoiceId(ttsBackend.voiceId ?? '')
      setParams(ttsBackend.params ?? {})
    }
  }, [open, ttsBackend])

  // Load schemas on first open
  useEffect(() => {
    if (!open || schemas.length) return
    setLoadingSchema(true)
    getTtsParamsSchema()
      .then(setSchemas)
      .catch(() => {})
      .finally(() => setLoadingSchema(false))
  }, [open, schemas.length])

  const currentSchema = schemas.find((s) => s.provider === provider)
  const currentModelSchema = currentSchema?.models.find((m) => m.model === model)

  // When provider changes, reset model to first available
  useEffect(() => {
    if (!currentSchema) return
    const first = currentSchema.models[0]?.model
    if (first && model !== first) {
      setModel(first)
      setParams({})
    }
  }, [provider, currentSchema])

  // When model changes, reset params to defaults
  useEffect(() => {
    if (!currentModelSchema) return
    const defaults: ParamValues = {}
    for (const f of currentModelSchema.fields) {
      if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue
    }
    setParams((prev) => ({ ...defaults, ...prev }))
  }, [model])

  const voiceOptions = provider === 'cartesia' ? CARTESIA_VOICES : MINIMAX_VOICES

  const handlePreview = async () => {
    if (previewing) return
    setPreviewError('')
    setPreviewDone(false)
    setPreviewing(true)
    try {
      const result = await synthesizeText({
        text: PREVIEW_TEXT,
        provider,
        model,
        voiceId: voiceId || undefined,
        params,
      })
      const blob = base64ToBlob(result.audioBase64, result.mimeType)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setPreviewDone(true)
        setPreviewing(false)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        setPreviewError('播放失败')
        setPreviewing(false)
      }
      setPreviewAudio(audio)
      await audio.play()
    } catch (e: any) {
      setPreviewError(e?.message || '合成失败，请检查 API Key 配置')
      setPreviewing(false)
    }
  }

  const stopPreview = () => {
    previewAudio?.pause()
    setPreviewAudio(null)
    setPreviewing(false)
  }

  const handleSave = () => {
    setTtsBackend({ provider, model, voiceId: voiceId || undefined, params })
    stopPreview()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopPreview(); onOpenChange(v) }}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            语音合成设置
          </DialogTitle>
        </DialogHeader>

        {loadingSchema && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            加载配置中…
          </div>
        )}

        {!loadingSchema && (
          <div className="space-y-5 py-2">
            {/* Provider */}
            <Section label="合成引擎">
              <div className="flex gap-2">
                {(['minimax', 'cartesia'] as TtsProviderKey[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={cn(
                      'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all',
                      provider === p
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {p === 'minimax' ? 'MiniMax' : 'Cartesia'}
                    {p === 'cartesia' && (
                      <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                        词时间戳
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {provider === 'cartesia'
                  ? 'Cartesia 支持词级时间戳，可实现逐词高亮与句子导航。'
                  : 'MiniMax 中英文质量好，但不支持词级时间戳。'}
              </p>
            </Section>

            {/* Model */}
            {currentSchema && (
              <Section label="模型">
                <div className="grid grid-cols-2 gap-2">
                  {currentSchema.models.map((m) => (
                    <button
                      key={m.model}
                      type="button"
                      onClick={() => setModel(m.model)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-sm transition-all',
                        model === m.model
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Voice */}
            <Section label="声音">
              <div className="grid grid-cols-2 gap-2">
                {voiceOptions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition-all',
                      voiceId === v.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {currentModelSchema?.requiresVoiceId && !voiceId && (
                <p className="mt-1 text-xs text-destructive">该模型需要选择声音</p>
              )}
            </Section>

            {/* Dynamic params */}
            {currentModelSchema && currentModelSchema.fields.length > 0 && (
              <Section label="高级参数">
                <div className="space-y-4">
                  {currentModelSchema.fields.map((f) => (
                    <ParamField
                      key={f.key}
                      field={f}
                      value={params[f.key]}
                      onChange={(v) => setParams((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Preview */}
            <Section label="试听">
              <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground italic">
                "{PREVIEW_TEXT}"
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={previewing ? 'destructive' : 'outline'}
                  disabled={!!(currentModelSchema?.requiresVoiceId && !voiceId)}
                  onClick={previewing ? stopPreview : handlePreview}
                  className="gap-1.5"
                >
                  {previewing
                    ? <><Loader2 className="size-3.5 animate-spin" />停止</>
                    : <><Play className="size-3.5" />试听</>
                  }
                </Button>
                {previewDone && !previewError && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="size-3.5" />播放完毕
                  </span>
                )}
                {previewError && (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3.5" />{previewError}
                  </span>
                )}
              </div>
            </Section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { stopPreview(); onOpenChange(false) }}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!!(currentModelSchema?.requiresVoiceId && !voiceId)}>
            <Volume2 className="mr-1.5 size-4" />
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Sub-components ----

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function ParamField({
  field, value, onChange,
}: {
  field: TtsParamSchemaField
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean) => void
}) {
  const current = value ?? field.defaultValue

  if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
    const num = typeof current === 'number' ? current : Number(field.defaultValue ?? 1)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm text-foreground/80">{field.label}</label>
          <span className="rounded-md bg-muted px-2 py-0.5 text-sm tabular-nums">{num}</span>
        </div>
        <Slider
          min={field.min}
          max={field.max}
          step={field.step ?? 0.1}
          value={[num]}
          onValueChange={([v]) => onChange(v)}
        />
      </div>
    )
  }

  if (field.type === 'select' && field.options?.length) {
    return (
      <div className="space-y-1.5">
        <label className="text-sm text-foreground/80">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'rounded-lg border px-3 py-1 text-sm transition-all',
                String(current) === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (field.type === 'boolean') {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary"
          checked={Boolean(current)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm text-foreground/80">{field.label}</label>
      <input
        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
        value={String(current ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}
