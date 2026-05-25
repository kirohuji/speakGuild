/**
 * 剧本模式 - 章节列表+关卡卡片
 * Phase 2 实现完整功能
 */
export function ScriptHubPage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">剧本模式</h1>
      <p className="mt-2 text-muted-foreground">在剧情任务中使用英语，推动故事发展</p>
      <div className="mt-8">
        <p className="text-sm text-muted-foreground">Chapter 0 体验关即将开放</p>
      </div>
    </div>
  )
}
