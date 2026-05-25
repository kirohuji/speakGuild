import { Link } from 'react-router-dom'

/**
 * 练习模式 - 场景/话题选择页
 * Phase 1 实现完整功能
 */
export function PracticeHubPage() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">练习模式</h1>
      <p className="mt-2 text-muted-foreground">选择场景，激活 Chunk，开口练习</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder scene cards */}
        {['留学生活', '旅行英语', '日常社交', '职场交流', '学术挑战'].map((scene) => (
          <Link
            key={scene}
            to="/practice/daily-routine"
            className="rounded-xl border border-border bg-card p-6 text-left transition-shadow hover:shadow-md"
          >
            <h3 className="font-semibold text-foreground">{scene}</h3>
            <p className="mt-1 text-sm text-muted-foreground">即将上线</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
