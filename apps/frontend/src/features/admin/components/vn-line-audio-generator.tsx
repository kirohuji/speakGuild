import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Play, Save, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'
import {
  getTtsParamsSchema,
  synthesizeAsset,
  type TtsParamSchemaField,
  type TtsProviderKey,
  type TtsSchema,
} from '@/lib/tts-api'
import { usePreferencesStore } from '@/stores/preferences.store'

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
  { id: 'English_Trustworthy_Man', label: 'Trustworthy Man (EN)' },
  { id: 'English_CalmWoman', label: 'Calm Woman (EN)' },
  { id: 'English_expressive_narrator', label: 'Expressive Narrator (EN)' },
  { id: 'female-chengshu', label: '成熟女声 (ZH)' },
  { id: 'male-qn-qingse', label: '青涩男声 (ZH)' },
  { id: 'female-yujie', label: '御姐 (ZH)' },
]

type ParamValues = Record<string, string | number | boolean>

interface VnLineAudioGeneratorProps {
  text: string
  audioUrl?: string
  storyKey?: string
  sceneName?: string
  lineIndex?: number
  onChange: (audioUrl: string) => void
}

export function VnLineAudioGenerator({
  text,
  audioUrl,
  storyKey,
  sceneName,
  lineIndex,
  onChange,
}: VnLineAudioGeneratorProps) {
  const { ttsBackend, setTtsBackend } = usePreferencesStore()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [paramsOpen, setParamsOpen] = useState(false)
  const [schemas, setSchemas] = useState<TtsSchema[]>([])
  const [provider, setProvider] = useState<TtsProviderKey>(ttsBackend.provider)
  const [model, setModel] = useState(ttsBackend.model)
  const [voiceId, setVoiceId] = useState(ttsBackend.voiceId ?? '')
  const [params, setParams] = useState<ParamValues>(ttsBackend.params ?? {})
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    getTtsParamsSchema().then(setSchemas).catch(() => undefined)
  }, [])

  const currentSchema = schemas.find((schema) => schema.provider === provider)
  const currentModelSchema = currentSchema?.models.find((item) => item.model === model)
  const voiceOptions = provider === 'cartesia' ? CARTESIA_VOICES : MINIMAX_VOICES
  const configLabel = useMemo(() => {
    const voiceLabel = voiceOptions.find((voice) => voice.id === voiceId)?.label || voiceId || '默认声音'
    return `${provider} · ${model} · ${voiceLabel}`
  }, [model, provider, voiceId, voiceOptions])

  useEffect(() => {
    if (!currentSchema) return
    const firstModel = currentSchema.models[0]?.model
    if (firstModel && !currentSchema.models.some((item) => item.model === model)) {
      setModel(firstModel)
    }
  }, [currentSchema, model])

  useEffect(() => {
    if (!currentModelSchema) return
    const defaults: ParamValues = {}
    currentModelSchema.fields.forEach((field) => {
      if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue
    })
    setParams((prev) => ({ ...defaults, ...prev }))
  }, [currentModelSchema])

  const play = () => {
    if (!audioUrl) return
    audioRef.current?.pause()
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    void audio.play()
  }

  const generate = async () => {
    if (!text.trim()) return
    setGenerating(true)
    setError('')
    try {
      const result = await synthesizeAsset({
        text: text.trim(),
        provider,
        model,
        voiceId: voiceId || undefined,
        params,
        bizType: 'tts_story_line',
        bizId: [storyKey, sceneName, lineIndex ?? 0, text.trim()].filter(Boolean).join(':'),
      })
      onChange(result.url)
    } catch (err: any) {
      setError(err?.message || '生成音频失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">台词音频</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {configLabel}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setParamsOpen((value) => !value)}>
            <ChevronDown className={cn('size-3.5 transition-transform', paramsOpen && 'rotate-180')} />
          </Button>
          {audioUrl && (
            <Button type="button" variant="outline" size="icon-sm" onClick={play}>
              <Play className="size-3.5" />
            </Button>
          )}
          <Button type="button" size="sm" onClick={generate} disabled={generating || !text.trim()} className="h-8 gap-1.5">
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
            生成
          </Button>
        </div>
      </div>

      {paramsOpen && (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">引擎</span>
              <select
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={provider}
                onChange={(event) => setProvider(event.target.value as TtsProviderKey)}
              >
                <option value="minimax">MiniMax</option>
                <option value="cartesia">Cartesia</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">模型</span>
              <select
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {(currentSchema?.models ?? []).map((item) => (
                  <option key={item.model} value={item.model}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">声音</span>
            <select
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              value={voiceId}
              onChange={(event) => setVoiceId(event.target.value)}
            >
              <option value="">默认声音</option>
              {voiceOptions.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.label}</option>
              ))}
            </select>
          </label>

          {currentModelSchema?.fields.length ? (
            <div className="space-y-3">
              {currentModelSchema.fields.map((field) => (
                <AudioParamField
                  key={field.key}
                  field={field}
                  value={params[field.key]}
                  onChange={(value) => setParams((prev) => ({ ...prev, [field.key]: value }))}
                />
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5"
            onClick={() => setTtsBackend({ provider, model, voiceId: voiceId || undefined, params })}
          >
            <Save className="size-3.5" />
            保存为全局 TTS 配置
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={audioUrl ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="生成后自动写入音频 URL，也可粘贴已有 URL"
          className="h-8 text-xs"
        />
        {audioUrl && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange('')}>
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {audioUrl && (
        <audio controls src={audioUrl} className="h-9 w-full" />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function AudioParamField({
  field,
  value,
  onChange,
}: {
  field: TtsParamSchemaField
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean) => void
}) {
  const current = value ?? field.defaultValue

  if (field.type === 'number' && field.min !== undefined && field.max !== undefined) {
    const num = typeof current === 'number' ? current : Number(field.defaultValue ?? 1)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/80">{field.label}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">{num}</span>
        </div>
        <Slider
          min={field.min}
          max={field.max}
          step={field.step ?? 0.1}
          value={[num]}
          onValueChange={([next]) => onChange(next)}
        />
      </div>
    )
  }

  if (field.type === 'select' && field.options?.length) {
    return (
      <label className="space-y-1">
        <span className="text-xs text-foreground/80">{field.label}</span>
        <select
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
          value={String(current ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={Boolean(current)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    )
  }

  return (
    <label className="space-y-1">
      <span className="text-xs text-foreground/80">{field.label}</span>
      <Input
        value={String(current ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-xs"
      />
    </label>
  )
}
