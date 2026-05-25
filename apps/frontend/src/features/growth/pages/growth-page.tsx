/**
 * 我的成长页面
 * Phase 3 实现完整功能（等级+熟练度+成就入口+周报）
 */
export function GrowthPage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">我的成长</h1>
      <p className="mt-2 text-muted-foreground">追踪你的英语输出成长轨迹</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">用户等级</h3>
          <p className="text-sm text-muted-foreground">Lv.1</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">输出能力</h3>
          <p className="text-sm text-muted-foreground">能说一句</p>
        </div>
      </div>
    </div>
  )
}
