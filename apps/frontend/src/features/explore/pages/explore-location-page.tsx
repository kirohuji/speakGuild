import { useParams } from 'react-router-dom'

/**
 * 探索模式 - 地点 VN 场景页
 * Phase 4 实现完整功能
 */
export function ExploreLocationPage() {
  const { locationId } = useParams<{ locationId: string }>()
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">地点</h1>
      <p className="mt-2 text-muted-foreground">Location: {locationId}</p>
      <p className="mt-4 text-sm text-muted-foreground">视觉小说场景即将就绪</p>
    </div>
  )
}
