/**
 * 成就殿堂页面
 * Phase 3 实现完整功能（徽章网格+稀有度配色+进度条）
 */
export function AchievementHallPage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">🏆 成就殿堂</h1>
      <p className="mt-2 text-muted-foreground">已解锁 0 / 25</p>
      <div className="mt-8">
        <p className="text-sm text-muted-foreground">
          完成首次练习，解锁你的第一个成就！
        </p>
      </div>
    </div>
  )
}
