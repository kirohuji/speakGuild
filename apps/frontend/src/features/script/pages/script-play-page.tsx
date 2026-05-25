import { useParams } from 'react-router-dom'

/**
 * 剧本对话页面
 * Phase 2 实现完整 Ink + VN 渲染
 */
export function ScriptPlayPage() {
  const { episodeId } = useParams<{ episodeId: string }>()
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">剧本关卡</h1>
      <p className="mt-2 text-muted-foreground">Episode: {episodeId}</p>
      <p className="mt-4 text-sm text-muted-foreground">Ink 叙事引擎即将就绪</p>
    </div>
  )
}
