import { Link } from 'react-router-dom'
import { Lock, BookOpen, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { EpisodeDetail, EpisodeReadiness } from '../api/script-api'

interface UnlockGuidanceProps {
  episode: EpisodeDetail
  readiness: EpisodeReadiness
  onClose?: () => void
}

/** 解锁引导：显示缺失项 + 推荐练习 + 跳转练习模式 */
export function UnlockGuidance({ episode, readiness, onClose }: UnlockGuidanceProps) {
  const missing: { label: string; current: number; required: number }[] = []

  if (!readiness.outputLevelSatisfied) {
    missing.push({ label: '输出等级不足', current: 0, required: parseInt(episode.requiredOutputLevel?.replace('L', '') ?? '2') })
  }
  if (!readiness.prerequisiteCompleted) {
    missing.push({ label: '前置关卡未完成', current: 0, required: 1 })
  }
  if (readiness.vocabLearned < readiness.vocabRequired) {
    missing.push({ label: '场景词汇', current: readiness.vocabLearned, required: readiness.vocabRequired })
  }
  if (readiness.chunkMastered < readiness.chunkRequired) {
    missing.push({ label: '核心 Chunk', current: readiness.chunkMastered, required: readiness.chunkRequired })
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-amber-500" />
          你还不能挑战「{episode.title}」
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Readiness bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">场景准备度</span>
            <span className="font-medium text-foreground">{readiness.readiness}%</span>
          </div>
          <Progress value={readiness.readiness} className="h-2" />
        </div>

        {/* Missing items */}
        {missing.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">还需要：</p>
            {missing.map((m) => (
              <div key={m.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium text-foreground">
                  {m.current}/{m.required}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">推荐先练：</p>
          <div className="space-y-2">
            {readiness.chunkMastered < readiness.chunkRequired && (
              <Link to={`/practice?sceneId=${episode.scene?.id ?? ''}`} onClick={onClose}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-4" />
                    练习「{episode.scene?.title ?? '相关场景'}」的 Chunk
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}
            <Link to="/practice" onClick={onClose}>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  去练习模式提升能力
                </span>
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
