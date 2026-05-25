import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onboardingApi } from '../api/onboarding-api'

const GOAL_OPTIONS = [
  { id: 'daily', label: '日常交流' },
  { id: 'study_abroad', label: '留学生活' },
  { id: 'travel', label: '旅行英语' },
  { id: 'ielts', label: '雅思口语' },
  { id: 'workplace', label: '职场交流' },
  { id: 'interview', label: '面试表达' },
  { id: 'thinking', label: '提升英语思维' },
]

export function GoalsSelectionPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleNext = async () => {
    setSaving(true)
    try { await onboardingApi.selectGoals(selected) } catch {}
    navigate('/onboarding/ability')
  }

  return (
    <div className="flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold text-foreground">你想提升哪些方面？</h1>
      <p className="mt-2 text-muted-foreground">可多选，我们会为你定制学习路径</p>
      <div className="mt-8 grid w-full max-w-md gap-3">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected.includes(opt.id)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:border-primary/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        disabled={selected.length === 0 || saving}
        onClick={handleNext}
        className="mt-8 rounded-lg bg-primary px-8 py-3 text-primary-foreground disabled:opacity-50"
      >
        {saving ? '保存中...' : '下一步'}
      </button>
    </div>
  )
}
