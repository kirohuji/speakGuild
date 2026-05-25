import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ABILITY_OPTIONS = [
  { level: 'L1', label: 'A. 我能看懂一些英语，但开口很困难' },
  { level: 'L2', label: 'B. 我能说简单句，但经常卡住' },
  { level: 'L3', label: 'C. 我能回答日常问题，但说得不自然' },
  { level: 'L4', label: 'D. 我能聊日常话题，但复杂话题说不好' },
  { level: 'L5', label: 'E. 我可以自由交流，但想说得更自然、更高级' },
]

/**
 * 新手引导 - 自评当前能力
 */
export function AbilitySelectionPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold text-foreground">你现在更接近哪种状态？</h1>
      <p className="mt-2 text-muted-foreground">诚实选择，我们会匹配合适的难度</p>
      <div className="mt-8 grid w-full max-w-md gap-3">
        {ABILITY_OPTIONS.map((opt) => (
          <button
            key={opt.level}
            onClick={() => setSelected(opt.level)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected === opt.level
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        disabled={!selected}
        onClick={() => navigate('/')}
        className="mt-8 rounded-lg bg-primary px-8 py-3 text-primary-foreground disabled:opacity-50"
      >
        开始学习
      </button>
    </div>
  )
}
