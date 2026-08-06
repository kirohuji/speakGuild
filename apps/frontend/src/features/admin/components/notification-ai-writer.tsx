import React, { useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import {
  aiWriteNotification,
  type NotificationAiScene,
} from '@/features/admin/api-notifications'

const SCENES: { value: NotificationAiScene; label: string }[] = [
  { value: 'versionUpdate', label: '版本更新' },
  { value: 'learningPack', label: '学习包发布' },
  { value: 'discount', label: '优惠活动' },
  { value: 'maintenance', label: '系统维护' },
  { value: 'greeting', label: '节日问候' },
  { value: 'custom', label: '自定义' },
]

const PLACEHOLDERS: Record<NotificationAiScene, string> = {
  versionUpdate: '如：v2.3.0 上线了互动剧本新玩法，还优化/修复了哪些问题…',
  learningPack: '如：新学习包《机场出行》包含哪些场景和内容，适合谁…',
  discount: '如：会员 7 折，活动截止时间，参与方式…',
  maintenance: '如：本周六 02:00-04:00 维护，影响哪些功能…',
  greeting: '如：新年 / 圣诞 / 开学季…',
  custom: '描述你想通知的事情，越具体写得越准…',
}

interface NotificationAiWriterProps {
  /** 生成成功回调，把标题和内容填入表单 */
  onGenerated: (title: string, content: string) => void
  /** 当前是否为特殊消息（首页横幅），影响生成风格 */
  isSpecial?: boolean
}

export function NotificationAiWriter({ onGenerated, isSpecial = false }: NotificationAiWriterProps) {
  const [scene, setScene] = useState<NotificationAiScene>('versionUpdate')
  const [details, setDetails] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    if (generating) return
    if (scene === 'custom' && !details.trim()) {
      toast.warning('自定义场景建议先填写素材，AI 会写得更有针对性')
    }
    setGenerating(true)
    try {
      const result = await aiWriteNotification({
        type: scene,
        details: details.trim() || undefined,
        isSpecial,
      })
      onGenerated(result.title, result.content)
      setGenerated(true)
      toast.success('AI 文案已生成，可继续编辑')
    } catch {
      toast.error('AI 生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI 写作助手</p>
          <p className="text-[11px] text-muted-foreground">
            不知道通知怎么写？选个场景、补点素材，AI 按漫语町文风帮你起草
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Spinner className="size-3.5" />
              写作中...
            </>
          ) : generated ? (
            <>
              <RefreshCw className="size-3.5" data-icon="inline-start" />
              换个风格
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" data-icon="inline-start" />
              生成文案
            </>
          )}
        </Button>
      </div>

      <div className="mt-3">
        <ToggleGroup
          type="single"
          value={scene}
          onValueChange={(v) => { if (v) setScene(v as NotificationAiScene) }}
          className="flex-wrap justify-start"
        >
          {SCENES.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} size="sm" variant="outline" className="h-7 gap-1 rounded-full px-2.5 text-xs">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="mt-3">
        <Input
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleGenerate() }}
          placeholder={PLACEHOLDERS[scene]}
          maxLength={200}
          className="h-8 text-xs"
        />
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          生成后会自动填入标题与内容，可继续手动编辑
        </p>
      </div>
    </div>
  )
}
